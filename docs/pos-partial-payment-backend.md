# POS Partial Payment / Outstanding Balance — Backend Spec (for the API repo)

The frontend (`figma-make-app`, `src/features/sales/salesApi.ts`,
`src/pages/pos/`) is already contract-ready for this spec. This document is the
implementation target for the API repo (`backend-p89g.onrender.com`).

**Current state: blocked.** `POST /pos/sales` rejects an underpaid sale with
`422 insufficient payment`, so partial payment cannot complete today. The
frontend already allows it and surfaces the backend's real error. Until this
spec is implemented, the POS "Complete Sale" button will fail on any sale where
`Paid < Total`.

> **Where the endpoints live today** (verified against the live OpenAPI document)
> - `POST /api/v1/pos/sales` — the only sale-creation endpoint. There is no
>   separate credit-sale endpoint.
> - `POST /api/v1/pos/sales/{id}/payments` — already collects against an
>   existing balance.

---

## 1. Business rule

**Credit is not a payment method.** It is the remainder.

```
outstandingAmount = max(totalAmount - paidAmount, 0)
```

| Total | Paid | paidAmount | changeAmount | outstandingAmount |
|-----:|-----:|-----------:|-------------:|------------------:|
| 40 | 40 | 40 | 0 | 0 |
| 40 | 20 | 20 | 0 | **20** |
| 40 | 10 + 10 (split) | 20 | 0 | **20** |
| 40 | 50 | 50 | **10** | 0 |

Accepted methods at checkout stay exactly `CASH | MOBILE_TRANSFER | CHECK`.
**Do not add `CREDIT`.** **Do not add `CARD`** — it is not in the current enum.

---

## 2. The change, precisely

### 2.1 Relax one validation

In the sale-creation service, the payment validation currently rejects the sale
when:

```
totalPayments >= totalAmount     // required today
```

Change it to reject only a non-positive payment total:

```
totalPayments > 0                // required after this change
```

`totalPayments > totalAmount` stays legal — the excess is still recorded as
`changeAmount`, exactly as the endpoint description already promises.

Two separate concerns are being conflated today. Keep them separate:

- **"Did the customer pay anything?"** → `totalPayments > 0`. This stays blocking.
- **"Did the customer pay the whole bill?"** → `totalPayments >= totalAmount`.
  This stops being blocking and becomes the outstanding balance.

Do not simply delete the check. Deleting it entirely would permit a zero-payment
sale, which is not the intent.

### 2.2 Derive the balance from the existing model

Do **not** introduce a second accounting model. `POST /pos/sales/{id}/payments`
already describes itself as updating *"the sale's `paidAmount` and
`outstandingBalance` … atomically with concurrency protection"*. The outstanding
concept therefore already exists in the service/entity layer.

Reuse it. Specifically:

- `paidAmount` = sum of the `SalePayment` rows created for this sale.
- `changeAmount` = `max(paidAmount - totalAmount, 0)` — unchanged behaviour.
- outstanding = `max(totalAmount - paidAmount, 0)`, derived. If an
  `outstandingBalance`/`outstandingAmount` column or getter already exists on
  the Sale entity, set/read that. If it is genuinely derived today, keep it
  derived.

**If a sale completes with `totalPayments == totalAmount` or greater, nothing
about the existing path changes** — including `changeAmount`, receipt printing,
and the credit-sales projection.

### 2.3 Do not weaken the transaction

`POST /pos/sales` must remain a single database transaction. Every one of these
stays inside it, in the same order:

1. validate location
2. validate products / units / quantity
3. calculate prices and discounts
4. allocate batches with FEFO (expired and reserved stock excluded)
5. create Sale
6. create SaleItems
7. create SaleItemBatch allocations
8. create SalePayments
9. move stock out via the central stock movement engine (`SALE/OUT`)

On any failure, everything rolls back. These invariants must not regress:

- never a completed sale without its stock movements
- never stock deducted without a completed sale

**Payment status must not create a second inventory workflow.** Partial payment
does not change any stock rule. FEFO allocation and stock deduction are identical
for a 40-paid sale and a 20-paid sale.

> Note: `POST /pos/sales/{id}/cancel` is documented as "Cancel a draft sale"
> (`DRAFT` status). If partial payment makes underpaid sales reachable in a new
> state, confirm that cancel/return semantics remain coherent. This spec does
> **not** change cancellation.

---

## 3. Contract gap: `customerName` / `customerPhone`

The frontend POS already collects Customer Name and Phone on an underpaid sale
and sends them as **`customername`** and **`customerphonenumber`**. This could
not be verified against the live service, because auth is enforced *before*
request-body validation — no unauthenticated probe can distinguish "accepted"
from "silently ignored".

**Documented `SaleCreateInput` today** (confirmed against live OpenAPI):

```jsonc
{
  "locationId": "uuid",        // required
  "items":     [ /* SaleItemInput[] */ ],  // required
  "payments":  [ /* SalePaymentInput[] */ ], // required
  "billDiscount": { "type": "PERCENTAGE|FIXED_AMOUNT", "value": 0 },
  "notes": "string"
}
```

No customer fields. Yet the backend's own `CreditSaleListItem` exposes:

```jsonc
{
  "customerName":  "string",
  "customerPhone": "string",
  "paidAmount":    0,
  "outstandingAmount": 0,
  "paymentStatus": "OUTSTANDING | PARTIALLY_PAID | PAID"
}
```

Since a credit sale *is* created through `POST /pos/sales`, the Sale record
almost certainly stores these already and the request/response schemas are
merely incomplete. **Please confirm which of these is true:**

- **(A)** The Sale entity has `customerName` / `customerPhone` columns →
  add them to `SaleCreateInput` and `Sale` in the OpenAPI document. **No code
  change**, schema fix only. This is the frontend's working assumption.
- **(B)** The columns exist under different names → tell us the exact names and
  we will correct the frontend. We will **not** guess and we will not send
  speculative aliases.
- **(C)** The columns do not exist → add them as nullable, populate from this
  endpoint, and add them to `SaleCreateInput` and `Sale`.

Also note `paymentStatus` already has three states, including `OUTSTANDING` and
`PARTIALLY_PAID`. That is strong evidence the credit module already anticipates
underpaid sales — which makes case (A) or (C) likely.

### 3.1 Is a customer required for an underpaid sale?

The frontend currently treats it as **optional** and says so in the UI:
*"Customer information is optional. The outstanding balance is recorded on the
sale."*

If the business rule genuinely requires customer identification when
`outstandingAmount > 0`, make it a **422** with a per-field detail rather than a
silent accept, and we will mark the field required in the UI. Please state which
rule is intended; we will not implement it from assumption in either direction.

---

## 4. OpenAPI corrections

Independent of the validation change, the document needs these fixes so the
frontend can stop carrying guesses:

1. **`SaleCreateInput`** — add `customerName` / `customerPhone` (see §3).
2. **`Sale`** — add a nullable `customerName` / `customerPhone`.
3. **`Sale`** — expose the outstanding balance. Either return
   `outstandingAmount: number` (preferred) or state explicitly in the schema
   description that it is derived as `max(totalAmount - paidAmount, 0)`. Today
   the frontend has to derive it, because `Sale` publishes only `subtotal`,
   `totalDiscount`, `totalAmount`, `paidAmount`, `changeAmount`.
4. **`Sale.payments[].method`** — the enum is inlined and already correct
   (`CASH | MOBILE_TRANSFER | CHECK`), but it deserves a named schema
   (`SalePayment`) rather than an inline object.
5. **`POST /pos/sales` description** — update from
   *"total payments must cover `totalAmount`"* to describe the new rule:
   payments must total more than zero; a shortfall becomes the outstanding
   balance; an excess becomes `changeAmount`.
6. **`422` description** — drop *"insufficient payment"* as a blanket cause; it
   should now apply only to a zero-payment sale.

---

## 5. Unchanged on purpose

Do not modify these while implementing the above:

- `POST /pos/sales/{id}/payments` — already correct: sale must be `COMPLETED`,
  must have an outstanding balance, amount > 0, amount must not exceed the
  outstanding balance, atomic, returns the updated `Sale`. Its
  `SaleAddPaymentInput` already restricts methods to `CASH | MOBILE_TRANSFER |
  CHECK` and correctly excludes `CARD`.
- `GET /pos/sales`, `GET /pos/sales/{id}`, `POST /pos/sales/{id}/cancel`,
  the returns endpoints, and the stock movement engine.
- `baseQuantity` stays server-calculated. The frontend does not and will not
  send it, nor frontend-computed FEFO allocations, nor any client-side
  outstanding field — the backend remains the source of truth.

---

## 6. Test matrix

Run against the real service. Tests 2, 3 and 6 are the ones this spec exists for.

| # | Total | Payments | paidAmount | changeAmount | outstanding | Status |
|--:|-----:|----------|-----------:|-------------:|------------:|--------|
| 1 | 40 | CASH 40 | 40 | 0 | 0 | `201` |
| 2 | 40 | CASH 20 | 20 | 0 | **20** | `201` — most important |
| 3 | 40 | CASH 10 + MOBILE_TRANSFER 10 | 20 | 0 | **20** | `201` |
| 4 | 40 | CASH 10 + MOBILE_TRANSFER 30 | 40 | 0 | 0 | `201` |
| 5 | 40 | CASH 50 | 50 | **10** | 0 | `201` |
| 6 | after #2 | `POST /pos/sales/{id}/payments` CASH 20 | 40 | 0 | **0** | `200` |
| 7 | 40 | CASH 0 / empty payments | — | — | — | `422` (must still reject) |
| 8 | 40 | CASH 20, CHECK 30 → overpay via later payment | `422` amount exceeds outstanding |

For every `201`, also assert the atomicity invariants: the sale is `COMPLETED`,
`SaleItems` and batch allocations exist, stock moved out by exactly
`baseQuantity` per line, and rolling back any single step leaves neither a
partial sale nor orphaned stock movement.