# Invoice-Upload Assisted Receiving — Backend Spec (for the API repo)

The frontend (`figma-make-app`, `src/features/purchasing/`) is contract-ready for
this spec. This document is the implementation target for the API repo
(`backend-p89g.onrender.com`). Numbers in parentheses reference frozen business
rules from the task; the frontend already implements the UI side.

> **Where the receiving endpoints live today**
> - `POST /api/v1/purchasing/purchase-orders/{id}/invoice-upload` (preview)
> - `POST /api/v1/purchasing/purchase-orders/{id}/invoice-upload/confirm`
>
> The frontend client: `src/features/purchasing/invoiceUploadReceivingApi.ts`

---

## 1. New endpoint: OCR extraction

### `POST /api/v1/purchasing/invoice-upload/extract`

- **Auth:** ADMIN (same guard as the receiving endpoints).
- **Body:** `multipart/form-data`, field **`file`**.
- **Validation:**
  - Extension: `pdf | jpg | jpeg | png`.
  - MIME + magic bytes must agree (don't trust the extension alone).
  - Max size ~ **10 MB** (`413`/`422` above it).
- **Behaviour:** read-only. Never mutates stock, POs, invoices or receipts.
- **Response (200):**
  ```jsonc
  {
    "invoiceNumber": "CR-00004212",     // string|null — never a guess
    "invoiceDate": "2026-08-20",        // string|null (ISO date, see §1.3)
    "grandTotal": 22689.0,              // number|null
    "items": [
      {
        "productName": "FINALERGE 1MG/ML SOLUTION OF 100ML",
        "quantity": 12,                 // number|null
        "batchNumber": "3260079",       // string|null
        "expiryDate": "2030-06-30",     // string|null (ISO)
        "manufacturingDate": null,      // string|null — blank on this supplier: null, NOT guessed
        "unitPrice": 427.5,             // number|null
        "lineTotal": 5130.0,            // number|null
        "confidence": "high"            // "high" | "low"
      }
    ],
    "warnings": [],                     // information only, never blocking
    "documentUrl": "/api/v1/purchasing/invoice-upload/files/<id>"
  }
  ```
- **Errors:** `400` invalid file, `401/403` auth, `413` too large, `422`/`500`
  extraction failure (frontend falls back to manual entry). Do not return a
  200 with empty fields when the model failed — return an error so the UI can
  tell the user to type it in.

### 1.1 `OcrProvider` interface (swappable)

```ts
interface ExtractedInvoiceLine {
  productName: string | null;
  quantity: number | null;
  batchNumber: string | null;
  expiryDate: string | null;
  manufacturingDate: string | null;
  unitPrice: number | null;
  lineTotal: number | null;
  confidence: "high" | "low";
}

interface ExtractedInvoice {
  invoiceNumber: string | null;
  invoiceDate: string | null;
  grandTotal: number | null;
  items: ExtractedInvoiceLine[];
  warnings: string[];          // date ambiguity, qty×price mismatch, etc.
  documentUrl: string | null;
}

interface OcrProvider {
  extract(buffer: Buffer, mimeType: string): Promise<ExtractedInvoice>;
}
```

- Keep an in-memory registry / DI token so Tesseract/Textract can slot in later.

### 1.2 Anthropic implementation

- Env: **`ANTHROPIC_API_KEY`** (required — fail with a clear error when missing),
  **`OCR_MODEL`** (default e.g. `claude-sonnet-4-5` or a vision-capable model),
  sensible timeout (e.g. 60–90 s).
- **Prompt contract (frozen):**
  - "ATTACHMENT" diagonal watermark on this supplier's photos is not data —
    ignore it.
  - Read the table **row by row**; product name is the item description column.
  - Ignore the **product code / SKU column**, the **printed UOM column**, the
    **printed supplier name** and the **"Fs No."** column — they are not used.
  - **`null` for anything unreadable — never a guess.**
- **Image pre-processing:** downscale very large images to **≥ 1600 px on the
  long edge** before sending.
- **PDFs:** send as a document, or rasterize pages (page 1..N) and send pages.
- **Structured output:** strict JSON schema (vision model), `temperature: 0`,
  validate with **zod** before returning; reject with a clear error if
  validation fails.

### 1.3 Date parsing

- Supplier prints **MM/DD/YYYY** on lines (e.g. `06/30/2030`, `02/29/2028`) and
  a header date like `Aug 20,2026 12:18`.
- Infer the format from unambiguous dates in the same document (e.g. month > 12
  is impossible).
- If a value is still ambiguous after inference (e.g. `04/03/2028`): keep the
  inferred value, but append a warning to `warnings` **and** set that line's
  `confidence: "low"` so the UI amber-highlights it.

### 1.4 Post-extraction sanity checks (warnings only, never blocking)

- `quantity × unitPrice ≈ lineTotal` → add warning + mark line `low` if off.
- `SUM(lineTotals) ≈ grandTotal` → warning (not a guess; don't override).
- Expiry date in the past → warning.
- Invalid dates → warning, field `null`.

### 1.5 Document storage

- Use the existing storage utility if present; otherwise a local uploads dir
  with a **configurable path** (env, e.g. `UPLOADS_DIR`).
- Return `documentUrl` in the extraction response **and echo it back** in the
  preview response so the workflow can attach it to the confirm payload.
- Files **must never be served unauthenticated** — mount under the same
  authenticated router (e.g. `GET /api/v1/purchasing/invoice-upload/files/:id`
  with the standard auth guard).

### 1.6 OCR failure / missing API key

Return a clear error (`OCR_EXTRACTION_FAILED`) or `503` when the key is absent.
The frontend catches this and falls back to the fully-manual form — OCR is a
helper, never a hard dependency.

---

## 2. Matching changes in preview / confirm

### 2.1 Line matching order (replaces product-code matching)

1. **Explicit `purchaseOrderItemId`** — set only when the pharmacist confirms
   it (per-line dropdown). Highest priority, fully trusted.
2. **Normalized `productName`** vs PO item product `name` / `genericName` /
   `brand`:
   - Normalize: case, whitespace, punctuation-insensitive.
   - Handle packed strings: `1MG/ML`, `1*10`, `OF 30 CAPS`.
   - **Fuzzy:** token-set / trigram similarity; auto-match only when the best
     score ≥ threshold **and** clearly ahead of the second best.
3. **Unmatched** when no candidate qualifies.

### 2.2 Suggestions for unmatched lines

Each unmatched preview item must include:

```jsonc
"suggestions": [
  { "purchaseOrderItemId": "...", "productName": "...", "score": 0.91 }
]
```

top-3 by score. The UI renders these as one-click choices (already implemented
in `ScanReceiptWorkflow.tsx` step 2).

### 2.3 Unit handling (frozen)

- The `unit` request field becomes **optional** on `InvoiceUploadLineInput`.
- When the pharmacist selects a unit **different from the PO item's ordered
  unit** → `INVOICE_UNIT_MISMATCH` (blocking). **Never** invent a conversion.
- When `unit` is **omitted** → default to the PO item's unit, no mismatch.
- Keep all existing discrepancy codes:
  `UNMATCHED_INVOICE_ITEM`, `INVOICE_QUANTITY_EXCEEDS_PO_REMAINING`,
  `MISSING_BATCH`, `MISSING_EXPIRY`, `DUPLICATE_INVOICE_NUMBER`,
  `PHYSICAL_DISCREPANCY`, `PRICE_DIFFERENCE`, `INVOICE_UNIT_MISMATCH`.
- `productCode` and `supplierName` are **no longer required** inputs;
  `supplierName` stays informational only — the PO's supplier is authoritative.
- **Multiple batches for one PO item:** keep supporting several lines with the
  same `purchaseOrderItemId`; aggregate `acceptedQuantity ≤ remaining`.

### 2.4 Payments (schema finding — verify in the API repo)

Frontend findings (`src/features/purchasing/supplierInvoicesApi.ts`):

- `PaymentMethod = "CASH" | "BANK_TRANSFER" | "CHECK" | "CREDIT_CARD" | "OTHER"`
  exists as a type, and invoices expose `status: OPEN | PARTIALLY_PAID | PAID`
  with embedded `payments`.
- BUT the payment record contract — `POST /purchase-orders/…/supplier-invoices` /
  `POST /supplier-invoices/{id}/payments` with `{ paymentDate, amount, notes }` —
  has **no `method` field** anywhere in the API surface. The frontend sends
  `paymentMethod` on the receiving confirm payload; the backend must be able to
  persist it.

**Required changes:**

1. Add optional `paymentMethod?: PaymentMethod` and `paymentDate?: string` to
   **both** the preview and confirm request bodies.
2. Inside the **confirm transaction** (same DB txn that creates the GR, GR
   items, batches, stock movements and the supplier invoice):
   - Neither provided → invoice stays `OPEN`, no payment record.
   - A **paid method** chosen (`CASH | BANK_TRANSFER | CHECK | CREDIT_CARD |
     OTHER`) → create the payment through the existing supplier-payment
     service for the invoice's grand total (or the user-specified amount if the
     contract adds one), so the invoice lands `PAID` / `PARTIALLY_PAID` via the
     existing status logic.
   - Authoritative model check: confirm whether the `Payment` model has a
     `method` column today. If it does not, add it (enum or string) — this is
     the one schema change the task anticipated. **Do not invent a payment
     method model beyond that.**
3. `paymentDate` may be omitted when a method is chosen — default to the
   invoice/received date.

### 2.5 New read-only endpoint

### `GET /api/v1/purchasing/purchase-orders/match-candidates`

- **Query:** `supplierId` (required), `productNames[]` (repeatable).
- **Behaviour:** return open POs (`AWAITING_DELIVERY` with `remaining > 0`) for
  that supplier, **ranked** by (a) how many extracted product names match PO
  items, then (b) remaining quantity. Never auto-selects; purely informational.
- **Response:**
  ```jsonc
  { "data": [
    {
      "purchaseOrder": { "id": "...", "poNumber": "PO-…", "status": "AWAITING_DELIVERY",
                         "supplier": { "id": "...", "name": "…" }, "expectedDeliveryDate": null },
      "matchCount": 3, "itemCount": 6, "remainingQuantity": 42,
      "matchedProductNames": ["FINALERGE 1MG/ML SOLUTION OF 100ML", "…"]
    }
  ] }
  ```

---

## 3. Frontend contract (what the UI now sends)

Per line (`InvoiceUploadLineInput`):

```jsonc
{
  "quantity": 12,                       // documented qty
  "acceptedQuantity": 12,               // physical — stock uses ONLY this
  "productCode": "FINS-01",             // optional, legacy echo of matched PO item SKU; ignored by new backend
  "productName": "FINALERGE 1MG/ML SOLUTION OF 100ML",
  "unit": "BOTTLE",                     // optional; Omit → default to PO item unit
  "unitPrice": 427.5,
  "batchNumber": "3260079",
  "expiryDate": "2030-06-30T00:00:00.000Z",
  "manufacturingDate": "…",             // omitted when empty
  "purchaseOrderItemId": "…",           // optional — pharmacist-confirmed match
  "confidence": "high"                  // optional — informational
}
```

Invoice level: `locationId`, `invoiceNumber`, `invoiceDate`, `receivedDate`,
`grandTotal`, optional `documentUrl`, `discrepancyNote`, optional
`paymentMethod`/`paymentDate`.

---

## 4. Tests to add (backend repo)

1. **Name-based matching** — exact normalized match picks the right PO item.
2. **Fuzzy + ambiguous** — `1MG/ML`, `1*10`, `OF 30 CAPS`; a near-tie leaves the
   line unmatched and returns suggestions.
3. **No product code** — a line without `productCode` still matches by name.
4. **Unit selected ≠ PO unit** → `INVOICE_UNIT_MISMATCH`; unit omitted → OK.
5. **Payments** — confirm without method (invoice OPEN, no payment), with
   method (payment created in-transaction, PAID/PARTIALLY_PAID).
6. **match-candidates ranking** — a PO matching 3/6 items ranks above one
   matching 1/6; ties broken by remaining quantity.
7. **Extract endpoint validation** — magic-byte checks, size limit, and provider
   behaviour (mock `OcrProvider`).
8. **Fixture** — the sample receipt below; assert no product codes, no printed
   UOM, blank manufacturing dates → `null`, watermark ignored, MM/DD/YYYY
   parsing incl. `02/29/2028`.

### Sample receipt fixture

Supplier: DEVICE TRADING PLC · "Credit Sales Attachment" · Invoice
`CR-00004212` · Date `Aug 20, 2026` · Grand total `22,689.00`
("twenty two thousand six hundred eighty nine birr"). Customer: DOSE PHARMACY.

| Product name (description)       | Batch    | Expiry     | Qty | Unit price | Line total |
|----------------------------------|----------|------------|-----|------------|------------|
| FINALERGE 1MG/ML SOLUTION OF 100ML | 3260079 | 06/30/2030 | 12 | 427.50     | 5,130.00   |
| CEFIX 100MG/5ML SUSPENSION 60ML  | 6250672  | 10/30/2027 | 4   | 1,068.75   | 4,275.00   |
| OPTIFRESH PLUS EYE DROP          | N26C23   | 02/29/2028 | 10  | 393.00     | 3,930.00   |
| NAT D 50,000IU 1*10              | 26C05H1  | 04/03/2028 | 5   | 946.00     | 4,730.00   |
| PRENATAL OF 30 CAPS              | 26B06B1  | 02/05/2028 | 2   | 935.00     | 1,870.00   |
| AVULGA CREAM                     | JH019    | 08/30/2028 | 6   | 459.00     | 2,754.00   |

Printed codes (`FINS-01`, `CEFS-02`, `OPFD-01`, `NAT-01`, `PREC-01`, `AVUC-01`)
and printed units (`BOTTLE`/`PK`/`TUBE`) must be ignored. Manufacturing date is
blank → `null`.

---

## 5. Env vars (new)

| Var               | Purpose                                        | Required |
|-------------------|------------------------------------------------|----------|
| `ANTHROPIC_API_KEY` | OCR provider key                             | yes (for OCR) |
| `OCR_MODEL`         | Vision model id (default: a Claude vision model) | no |
| `UPLOADS_DIR`       | Local uploads dir when no storage util exists  | no |

## 6. Compatibility notes

- The frontend **still works against the old backend**: it keeps echoing the
  matched PO item SKU as `productCode` and the selected UOM as `unit`, and it
  falls back to manual entry when `/extract` or `/match-candidates` are absent.
- Once the new backend ships, sending `purchaseOrderItemId` +
  `productName`-based matching takes over, and the OCR + ranking endpoints light
  up automatically — no frontend change required to adopt them.