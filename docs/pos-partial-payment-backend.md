# POS Partial Payment (Credit) — Backend Implementation Spec

**Target:** the API repo behind `dose-backend-ky5q.onrender.com`.
**Client:** `figma-make-app` (`src/features/sales/salesApi.ts`, `src/pages/pos/`),
already implemented and building clean.

---

## 0. Status — verified blocked against the live service

The live OpenAPI document (`/api-docs`, 270,950 bytes) is unchanged:

- `POST /pos/sales` description still reads: *"`payments` supports split
  payments; **total payments must cover `totalAmount`**, and the excess is
  recorded as `changeAmount`."*
- Its `422` still lists *"insufficient payment"* as a cause.
- `SaleCreateInput` publishes only `locationId`, `items`, `payments`,
  `billDiscount`, `notes` — **no customer fields**.
- `Sale` publishes no credit/outstanding field and no customer fields.

**Consequence:** until §3 lands, every sale with `Paid < Total` fails with
`422`. The frontend no longer blocks underpayment, so the cashier can press
*Complete Sale* and the backend will reject it. That error is surfaced verbatim,
never swallowed.

> Auth is enforced **before** request-body validation. Verified: `POST
> /pos/sales` with a complete valid body returns `401 UNAUTHENTICATED`, and so
> does a completely empty body `{}` — never `422`. No unauthenticated probe can
> reach the validator, so its current rule cannot be read from outside.

**Endpoint locations** (verified):

- `POST /api/v1/pos/sales` — the only sale-creation endpoint. There is no
  separate credit-sale endpoint.
- `POST /api/v1/pos/sales/{id}/payments` — already collects against an existing
  balance. **Leave unchanged.**

---

## 1. Business rule

**Credit is not a payment method.** It is the unpaid remainder.

```
paidAmount   = sum(payments.amount)          // real money received, per method
creditAmount = max(totalAmount - paidAmount, 0)
changeAmount = max(paidAmount - totalAmount, 0)
```

| Total | Paid | creditAmount | changeAmount | paymentStatus |
|-----:|-----:|-------------:|-------------:|---------------|
| 40 | 40 | 0 | 0 | `PAID` |
| 40 | 20 | **20** | 0 | `PARTIALLY_PAID` |
| 40 | 10 + 10 (split) | **20** | 0 | `PARTIALLY_PAID` |
| 40 | 50 | 0 | **10** | `PAID` |
| 40 | *none* | **40** | 0 | `OUTSTANDING` |

The sale is **always** `COMPLETED` and stock moves out in full, whatever was
paid. Partial payment never means partial stock deduction.

Accepted methods at checkout stay exactly `CASH | MOBILE_TRANSFER | CHECK`.
**Do not add `CREDIT`.** **Do not add `CARD`** — it is not in the enum.

---

## 2. Prisma schema + migration

> ⚠️ **Reconcile these names against the real schema before applying.** The
> backend source is not on the frontend machine, so table/column casing, the
> scalar type actually used for money (`Decimal` vs `Float`), and whether a
> payment-status enum already exists could not be read. The shape below is what
> is needed; the identifiers are the frontend's best reading and must be
> confirmed.

### 2.1 `Sale` model — three new columns

```prisma
model Sale {
  // …existing columns unchanged…

  /// Outstanding credit left on this sale. Always derived server-side.
  creditAmount   Decimal  @default(0) @db.Decimal(14, 2)

  /// Server-side payment state derived from totalAmount vs paidAmount.
  /// Reuse the enum the credit module already has (see §2.2) — do NOT
  /// introduce a second one.
  paymentStatus  PaymentStatus @default(PAID)

  /// Optional customer identification recorded alongside a credit balance.
  customerName   String?  @db.VarChar(120)
  customerPhone  String?  @db.VarChar(30)

  // …existing relations unchanged…
}
```

All four are **nullable or defaulted**, so every existing sale row stays valid
and no historical data is invalidated.

### 2.2 Reuse the existing payment-status enum

`CreditSaleListItem` in the live document already publishes:

```jsonc
"paymentStatus": "OUTSTANDING | PARTIALLY_PAID | PAID"
```

That enum very likely already exists in the service/entity layer. **Reuse it**
and do not create `PaymentStatus2`/`SalePaymentStatus`. `OUTSTANDING` and
`UNPAID` are the same state; `OUTSTANDING` is the spelling already published, so
prefer it unless the backend team says otherwise.

### 2.3 Migration

```sql
-- Additive only. No column is dropped, renamed or retyped.
ALTER TABLE "Sale"
  ADD COLUMN "creditAmount"  DECIMAL(14,2)      NOT NULL DEFAULT 0,
  ADD COLUMN "paymentStatus"  "PaymentStatus"    NOT NULL DEFAULT 'PAID',
  ADD COLUMN "customerName"   VARCHAR(120),
  ADD COLUMN "customerPhone"  VARCHAR(30);

-- Backfill: every already-COMPLETED sale that was underpaid carries credit
-- today but has no column recording it.
UPDATE "Sale"
   SET "creditAmount" = GREATEST("totalAmount" - "paidAmount", 0),
       "paymentStatus" = CASE
         WHEN "totalAmount" - "paidAmount" <= 0 THEN 'PAID'::"PaymentStatus"
         WHEN "paidAmount" <= 0                 THEN 'OUTSTANDING'::"PaymentStatus"
         ELSE 'PARTIALLY_PAID'::"PaymentStatus"
       END
 WHERE "status" = 'COMPLETED';
```

Indexes, only if the credit report filters on them:

```sql
CREATE INDEX "Sale_paymentStatus_idx"  ON "Sale" ("paymentStatus");
CREATE INDEX "Sale_customerName_idx"   ON "Sale" ("customerName");
CREATE INDEX "Sale_customerPhone_idx"  ON "Sale" ("customerPhone");
```

These already exist for other fields — confirm before adding duplicates.

### 2.4 Queryable outstanding customer credit

`creditAmount` must be reportable. The minimal query — outstanding credit per
customer:

```sql
SELECT "customerName", "customerPhone",
       COUNT(*)                    AS saleCount,
       SUM("creditAmount")         AS outstandingCredit
  FROM "Sale"
 WHERE "status" = 'COMPLETED'
   AND "creditAmount" > 0
   AND "customerName" IS NOT NULL
 GROUP BY "customerName", "customerPhone"
 ORDER BY outstandingCredit DESC;
```

If this belongs on `GET /financials/credit-sales` as a grouped view, reuse that
endpoint — **do not add a second credit system** (§36 of the original brief).

---

## 3. The validation change

Today the sale is rejected when:

```
totalPayments >= totalAmount
```

### 3.1 Replace with

```
totalPayments >= 0                      // always true, keep as a guard
totalPayments <= totalAmount + maxChange
maxChange = sum of CASH rows over totalAmount   // see §3.3
```

**Do not simply delete the check.** What must be rejected:

- a negative payment amount
- a non-positive payment amount on a row that was sent (`amount <= 0`)
- a payment method outside `CASH | MOBILE_TRANSFER | CHECK`
- overpayment that cannot be returned as change (§3.3)

What must **no longer** be rejected:

- `totalPayments < totalAmount` → completes, difference becomes `creditAmount`
- `payments: []` or every amount `0` → completes, whole total becomes credit
  (the frontend sends an empty array for a zero-payment sale; it never invents a
  `CREDIT` row)

### 3.2 Two concerns stay separate

- **"Did the customer pay anything?"** — no longer blocking.
- **"Did the customer pay the whole bill?"** — never blocking; it is the credit.

### 3.3 Overpayment is CASH-only

The original brief said *"overpayment is only allowed when it can be returned as
change; keep existing rule for that"*. The backend already has a change rule —
keep it exactly as-is and do not widen it. Concretely: the excess is
`changeAmount` only while every overpaid portion is attributable to `CASH`
(rows), since cash is physically returnable. If today's implementation allows
overpay on any method, **do not change that here** — just preserve it and note
it. The frontend shows a `Change` line whenever `Paid > Total` and never sends a
`changeAmount` of its own.

### 3.4 Never accept these from the client

`baseQuantity`, `creditAmount`, `changeAmount`, `paidAmount`, `paymentStatus`,
`outstanding`. All server-derived. If a DTO uses
`@Expose({ forbidNonWhitelisted: true })` this is enforced for free — otherwise
strip explicitly. The frontend sends none of them.

---

## 4. Customer fields — optional, and the "customer name is required" bug

### 4.1 The reported bug

Symptom: the cashier fills in Customer Name and the API still answers *"customer
name is required"*.

**Most probable root cause: a key-name mismatch.** The frontend previously sent
an all-lowercase `customername` / `customerphonenumber`. That spelling appears
**nowhere** in the OpenAPI document. A backend validator reading `customerName`
would see `undefined` and report exactly this error, even though the field was
filled in on screen.

The frontend now sends **`customerName`** and **`customerPhone`** — the spelling
the backend's own `CreditSaleListItem` and `CreditSaleDetailResponse` use for
these same two values. **If the validator still rejects, confirm the exact
expected key and we will correct the frontend rather than guess again.**

### 4.2 Required backend change

`SaleCreateInput`:

```ts
@IsOptional() @IsString() @MaxLength(120) customerName?: string;
@IsOptional() @IsString() @MaxLength(30)  customerPhone?: string;
```

Both optional on **every** sale, including credit sales.

### 4.3 Normalisation — this is the part that is easy to get wrong

`""`, `null`, `undefined` and whitespace-only must **all** be treated as "not
provided" on the server too:

```ts
const customerName  = input.customerName?.trim();
const customerPhone = input.customerPhone?.trim();

create({
  // …,
  customerName:  customerName  || null,   // empty → NULL, never ""
  customerPhone: customerPhone || null,
});
```

Phone gets **only** a light check — digits, `+`, spaces and dashes. Do **not**
add a length or locale pattern rule; an invented strict rule rejects valid
Ethiopian numbers.

---

## 5. Do not weaken the transaction

`POST /pos/sales` stays one transaction. Same order:

1. validate location
2. validate products / units / quantity
3. calculate prices and discounts
4. allocate batches with FEFO (expired and reserved excluded)
5. create `Sale` (now including `creditAmount`, `paymentStatus`, customer fields)
6. create `SaleItems`
7. create `SaleItemBatch` allocations
8. create `SalePayments`
9. move stock out via the central movement engine (`SALE/OUT`)

On any failure, everything rolls back. Never a completed sale without its stock
movements; never stock deducted without a completed sale.

**Partial payment must not create a second inventory workflow.** FEFO
allocation and stock deduction are byte-identical for a 40-paid sale and a
20-paid sale.

---

## 6. Report impact — read before changing any query

The rule: **accrual figures keep using `totalAmount`; cash/payment-method
breakdowns keep using `SalePayment` rows only.**

Nothing below should change numerically *for existing sales* — credit sales are
newly possible, so their effect is additive, not corrective. **Do not
"fix" any number that is already correct.**

| Endpoint | Effect |
|---|---|
| `GET /financials/reports/sales` | none — `totalAmount`-based |
| `GET /financials/reports/sales/summary` | none — `totalAmount`-based |
| `GET /financials/reports/sales/trend` | none — `totalAmount`-based |
| `GET /financials/reports/sales/detail` | none — line-level `lineTotal` |
| `GET /financials/reports/profitability` (+`/summary`) | none — `totalAmount`-based |
| `GET /financials/reports/profit-margin` (+`/summary`) | none — `totalAmount`-based |
| `GET /dashboard/summary` | **check.** If any field is derived from payments rather than `totalAmount`, it must not start counting credit as revenue. |
| Cash / payment-method breakdowns | **must use `SalePayment` rows only.** Never substitute `totalAmount` for collected cash, or credit sales will inflate cash-in-hand. |
| `GET /financials/credit-sales` (+`/:id`) | gains credit sales as real rows — expected, not a regression |
| `POST /notifications/run/payment-reminders` | **check.** Reminders must key off `creditAmount > 0` / `paymentStatus <> 'PAID'`, never off the existence of a sale. |

**The one real risk** is a cash-in-hand or payment-mixed breakdown that
currently derives from `Sale.totalAmount` and would begin reporting uncollected
money as received. Audit those specifically.

---

## 7. OpenAPI corrections

1. **`SaleCreateInput`** — add optional `customerName` (max 120) /
   `customerPhone` (max 30).
2. **`Sale`** — add `creditAmount`, `paymentStatus`, `customerName`,
   `customerPhone`.
3. **`POST /pos/sales` description** — replace *"total payments must cover
   `totalAmount`"*: payments may be less than the total, in which case the
   shortfall is recorded as `creditAmount`; the excess is `changeAmount`.
4. **`422` description** — drop *"insufficient payment"* as a blanket cause. It
   now applies only to negative amounts, amounts `<= 0` on a supplied row,
   invalid methods, or unreturnable overpayment.
5. **`SalePaymentInput`** — extract to a named `SalePayment` schema. The enum is
   already correct (`CASH | MOBILE_TRANSFER | CHECK`).

---

## 8. Unchanged on purpose

- `POST /pos/sales/{id}/payments` — already correct: sale must be `COMPLETED`,
  must have an outstanding balance, amount > 0, amount must not exceed the
  balance, atomic, returns the updated `Sale`. Its `SaleAddPaymentInput` already
  restricts methods to `CASH | MOBILE_TRANSFER | CHECK` and correctly excludes
  `CARD`. **Settling a credit balance is out of scope for this change** — the
  §2.4 columns are shaped so it can be added later without a migration.
- `GET /pos/sales`, `GET /pos/sales/{id}`, `POST /pos/sales/{id}/cancel`,
  `POST /pos/sales/{id}/returns`, and the stock movement engine.
- `baseQuantity` stays server-calculated.
- No second credit system, no `CreditRecord` table, no frontend-side credit
  storage.

---

## 9. Test matrix

| # | Total | Payments | Name/Phone | Expect |
|--:|-----:|----------|------------|--------|
| 1 | 40 | CASH 40 | — | `201`, credit 0, change 0, `PAID` |
| 2 | 40 | CASH 20 | Yemariyam / +251… | `201`, **credit 20**, change 0, `PARTIALLY_PAID`, stock fully deducted |
| 3 | 40 | CASH 10 + MOBILE_TRANSFER 10 | — | `201`, credit 20, two `SalePayment` rows, `PARTIALLY_PAID` |
| 4 | 40 | CASH 10 + MOBILE_TRANSFER 30 | — | `201`, credit 0, change 0, `PAID` |
| 5 | 40 | CASH 50 | — | `201`, change **10**, credit 0, `PAID` |
| 6 | 40 | CASH 20 | **none** | `201` — must succeed, credit 20, `customerName` NULL |
| 7 | 40 | CASH 20 | `""` / `"   "` | `201`, treated as missing → NULL (not `""`) |
| 8 | 40 | `[]` (all credit) | — | `201`, **credit 40**, `OUTSTANDING` |
| 9 | 40 | CASH 20, phone `"abc!"` | — | `422` on the phone format rule |
| 10 | 40 | CASH -5 | — | `422` negative |
| 11 | 40 | CASH 0 (explicit row) | — | `422` `amount <= 0` |
| 12 | 40 | CASH 40 but stock insufficient | — | `422`, **and no `Sale`, no `SaleItem`, no `SalePayment`, no stock movement persists** |
| 13 | after #2 | `POST /pos/sales/{id}/payments` CASH 20 | — | `200`, credit 0, `PAID` |

For every `201`, also assert the atomicity invariants: sale is `COMPLETED`,
`SaleItems` and batch allocations exist, stock moved out by exactly
`baseQuantity` per line, and `creditAmount + paidAmount - changeAmount` equals
`totalAmount`.

---

## 10. Frontend status (for reference)

Implemented and building clean (`pnpm tsc --noEmit` exit 0, `pnpm build` clean):

- `Complete Sale` is enabled whenever the cart has ≥ 1 item — including with no
  payment at all. Never gated on `Paid >= Total`.
- Live `Total`, `Paid`, then either `Change` (overpaid) or
  `Credit / Balance due` (underpaid). Credit is never negative.
- Notices, both non-blocking: *"Remaining X will be recorded as credit."* and,
  when no name was entered, *"No customer name entered, so this credit can't be
  traced to a customer."*
- Customer Name and Phone are always optional, labelled `(optional)`, and send
  nothing when empty after trimming.
- Receipt (`SaleDetailModal`) prints `Paid` always, `Balance Due` only when there
  is credit, `Change` only when there is change, and customer details only when
  provided. It prefers the server's `creditAmount` and falls back to
  `totalAmount - paidAmount` until that field exists.
- Empty payment rows are dropped before submission; a row with content that is
  not a positive number blocks submission with an explanation.

**Nothing has been verified against a live backend** — no credentials are
available, so no end-to-end run has been performed.
