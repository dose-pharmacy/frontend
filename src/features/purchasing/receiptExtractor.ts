// ── Receipt extraction service ──────────────────────────────────────────────
// The backend Invoice-Upload-Assisted Receiving API does NOT perform OCR. The
// frontend must supply an already-extracted/normalized invoice payload.
//
// There is currently no OCR engine in the project, so this module:
//   1. Normalizes machine-readable receipts (JSON) into the same shape that a
//      future OCR engine would produce.
//   2. For PDF/images (no frontend OCR), returns a blank normalized template;
//      the Scan / Upload workflow lets the user enter the values shown on the
//      receipt — the "extracted" object is what gets sent to the receiving API.
//
// If an OCR/extraction engine is added later, it plugs into
// `extractReceiptDocument` and returns the same `ExtractedReceipt` shape — the
// receiving API contract does not change.

import type { InvoiceUploadReceivingInput } from "./invoiceUploadReceivingApi";

// ─── Normalized receipt model ───────────────────────────────────────────────

export interface ExtractedReceiptLine {
  /** Product code / SKU printed on the receipt. */
  productCode: string;
  productName: string;
  /** Unit symbol / name (UOM) as printed on the receipt. */
  unit: string;
  /** Quantity written on the supplier document. */
  quantity: number;
  /** Quantity physically accepted — defaults to `quantity`. */
  acceptedQuantity: number;
  unitPrice: number;
  batchNumber: string;
  /** "YYYY-MM-DD" or "". */
  manufacturingDate: string;
  /** "YYYY-MM-DD" or "". */
  expiryDate: string;
}

export interface ExtractedReceipt {
  /** Helper input only — the selected PO's supplier is authoritative. */
  supplierName: string;
  invoiceNumber: string;
  /** "YYYY-MM-DD". */
  invoiceDate: string;
  /** "YYYY-MM-DD". */
  receivedDate: string;
  grandTotal: number;
  documentUrl?: string;
  items: ExtractedReceiptLine[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function localISODate(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Convert a date input ("YYYY-MM-DD") to the API's UTC ISO timestamp. */
export function toISOTimestamp(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  return `${dateStr}T00:00:00.000Z`;
}

/** Convert an ISO timestamp back to a "YYYY-MM-DD" date-input value. */
export function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function emptyExtractedReceipt(): ExtractedReceipt {
  const today = localISODate();
  return {
    supplierName: "",
    invoiceNumber: "",
    invoiceDate: today,
    receivedDate: today,
    grandTotal: 0,
    items: [
      {
        productCode: "",
        productName: "",
        unit: "",
        quantity: 0,
        acceptedQuantity: 0,
        unitPrice: 0,
        batchNumber: "",
        manufacturingDate: "",
        expiryDate: "",
      },
    ],
  };
}

/** SUM(quantity × unitPrice) — used to auto-fill the grand total. */
export function calculateGrandTotal(items: ExtractedReceiptLine[]): number {
  return items.reduce(
    (sum, it) =>
      sum + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0),
    0,
  );
}

// ─── JSON normalizer (machine-readable receipts) ────────────────────────────

function strField(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim() !== "") return v.trim();
    if (typeof v === "number") return String(v);
  }
  return "";
}

function numField(obj: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)))
      return Number(v);
  }
  return null;
}

/**
 * Normalize an arbitrary object (e.g. from an uploaded JSON receipt or a
 * future OCR engine) into the `ExtractedReceipt` shape. Unknown fields are
 * ignored; missing fields fall back to empty defaults.
 */
export function normalizeExtractedReceipt(data: unknown): ExtractedReceipt {
  const out = emptyExtractedReceipt();
  if (!data || typeof data !== "object") return out;
  const o = data as Record<string, unknown>;

  out.supplierName = strField(o, ["supplierName", "supplier", "vendor"]);
  out.invoiceNumber = strField(o, ["invoiceNumber", "invoice_no", "invoice"]);
  out.invoiceDate = strField(o, ["invoiceDate", "invoice_date", "date"]);
  out.receivedDate = strField(o, ["receivedDate", "received_date"]);
  const grandTotal = numField(o, ["grandTotal", "grand_total", "total"]);
  if (grandTotal != null) out.grandTotal = grandTotal;

  const rawItems = o.items;
  if (Array.isArray(rawItems)) {
    const lines: ExtractedReceiptLine[] = rawItems
      .filter((it) => it && typeof it === "object")
      .map((it) => {
        const r = it as Record<string, unknown>;
        const quantity = numField(r, ["quantity", "qty"]);
        const accepted =
          numField(r, ["acceptedQuantity", "accepted_qty"]) ?? quantity ?? 0;
        return {
          productCode: strField(r, ["productCode", "product_code", "code", "sku"]),
          productName: strField(r, [
            "productName",
            "product_name",
            "name",
            "description",
          ]),
          unit: strField(r, ["unit", "uom", "unitSymbol"]),
          quantity: quantity ?? 0,
          acceptedQuantity: accepted,
          unitPrice: numField(r, ["unitPrice", "unit_price", "price"]) ?? 0,
          batchNumber: strField(r, ["batchNumber", "batch_number", "batch"]),
          manufacturingDate: strField(r, [
            "manufacturingDate",
            "manufacturing_date",
            "mfgDate",
          ]),
          expiryDate: strField(r, ["expiryDate", "expiry_date", "expiry"]),
        };
      });
    if (lines.length > 0) out.items = lines;
  }

  return out;
}

// ─── Document → extracted receipt ───────────────────────────────────────────

/**
 * Best-effort extraction from the uploaded document.
 *  - JSON receipts are parsed and normalized.
 *  - PDF / JPG / JPEG / PNG are not OCR-able in the frontend: a blank
 *    normalized template is returned for manual entry (honest — no fake OCR).
 */
export async function extractReceiptDocument(
  file: File,
): Promise<ExtractedReceipt> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".json") || name.endsWith(".txt")) {
    try {
      const text = await file.text();
      return normalizeExtractedReceipt(JSON.parse(text));
    } catch {
      // Unparseable JSON/text — fall through to the blank template.
    }
  }
  return emptyExtractedReceipt();
}

// ─── Normalized receipt → receiving API input ───────────────────────────────

export interface ToInvoiceInputOptions {
  discrepancyNote?: string;
  documentUrl?: string;
  /** Authoritative supplier name (from the selected PO) when available. */
  supplierName?: string;
}

/**
 * Build the invoice-upload request body from the normalized receipt. The
 * extracted data is helper input only — the backend re-matches everything
 * against the selected PO. `supplierName` is never treated as authoritative.
 */
export function toInvoiceUploadInput(
  receipt: ExtractedReceipt,
  locationId: string,
  options: ToInvoiceInputOptions = {},
): InvoiceUploadReceivingInput {
  return {
    locationId,
    invoiceNumber: receipt.invoiceNumber?.trim() ?? "",
    invoiceDate: toISOTimestamp(receipt.invoiceDate) || new Date().toISOString(),
    grandTotal: Number(receipt.grandTotal) || 0,
    supplierName: options.supplierName ?? receipt.supplierName ?? "",
    receivedDate:
      toISOTimestamp(receipt.receivedDate) || new Date().toISOString(),
    ...(options.documentUrl ? { documentUrl: options.documentUrl } : {}),
    ...(options.discrepancyNote ? { discrepancyNote: options.discrepancyNote } : {}),
    items: receipt.items.map((it) => ({
      quantity: Number(it.quantity) || 0,
      acceptedQuantity: Number(it.acceptedQuantity) || 0,
      productCode: it.productCode?.trim() ?? "",
      productName: it.productName?.trim() ?? "",
      unit: it.unit?.trim() ?? "",
      unitPrice: Number(it.unitPrice) || 0,
      batchNumber: it.batchNumber?.trim() ?? "",
      ...(it.manufacturingDate ? { manufacturingDate: toISOTimestamp(it.manufacturingDate) } : {}),
      expiryDate: toISOTimestamp(it.expiryDate),
    })),
  };
}