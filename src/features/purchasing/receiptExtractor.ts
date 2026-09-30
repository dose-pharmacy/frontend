// ── Receipt extraction service ──────────────────────────────────────────────
// The backend Invoice-Upload-Assisted Receiving API performs OCR on the server
// (POST /api/v1/purchasing/invoice-upload/extract) and returns a normalized
// `ExtractedInvoice`. This module:
//   1. Maps the backend OCR result into the editable `ExtractedReceipt` shape —
//      null fields (the model "could not read this") stay empty for the
//      pharmacist to fill; nothing is ever guessed.
//   2. Normalizes machine-readable JSON receipts into the same shape.
//   3. For PDFs/images when the extract endpoint is unavailable (e.g. not yet
//      deployed), returns a blank normalized template — the Scan / Upload
//      workflow lets the user enter the values shown on the receipt.
//
// OCR output is helper input only — the receiving API contract does not change
// and the backend re-validates every line against the authoritative PO.

import type {
  ExtractedInvoice,
  ExtractedInvoiceLine,
  InvoiceUploadReceivingInput,
} from "./invoiceUploadReceivingApi";

// ─── Normalized receipt model ───────────────────────────────────────────────

export interface ExtractedReceiptLine {
  /** Product code / SKU on the receipt (legacy — no longer OCR'd; echoed from the matched PO item when selected). */
  productCode: string;
  productName: string;
  /** Unit symbol / name as printed on the receipt (legacy, no longer OCR'd). */
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
  /**
   * PO item the pharmacist pinned for this line (UI-only). Drives the
   * `purchaseOrderItemId` signal sent to the backend and the default UOM.
   */
  poItemId?: string;
  /** UOM symbol/name chosen by the pharmacist (UI-only). Defaults to the matched PO item's unit. */
  unitSymbol?: string;
  /** OCR confidence — informational; drives amber highlighting. */
  confidence?: "high" | "low";
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
  /** Informational notes from the OCR engine (e.g. date-format ambiguity). */
  warnings?: string[];
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

// ─── Backend OCR result → editable receipt ──────────────────────────────────

const isISODate = (s: string): boolean =>
  /^\d{4}-\d{2}-\d{2}/.test(s);

/** Normalize a backend-extracted date string to a "YYYY-MM-DD" input value. */
function toEditableDate(v: string | null | undefined): string {
  if (!v) return "";
  const trimmed = v.trim();
  if (!trimmed || trimmed.toLowerCase() === "null" || trimmed === "-") return "";
  if (isISODate(trimmed)) return toDateInput(trimmed);
  // Loose fallback for "MM/DD/YYYY" etc. — keep as typed, the DatePicker normalizes.
  return trimmed;
}

function ocrLineToReceiptLine(line: ExtractedInvoiceLine): ExtractedReceiptLine {
  const quantity = line.quantity ?? 0;
  const unitPrice = line.unitPrice ?? 0;
  const lineTotal = line.lineTotal ?? 0;
  // Keep the printed line total when supplied; otherwise derive unitPrice from
  // it only when unitPrice is missing and lineTotal reads cleanly.
  const derivedPrice =
    line.unitPrice ?? (quantity > 0 && lineTotal > 0 ? lineTotal / quantity : 0);
  return {
    productCode: "", // Product code is never extracted — column removed from UI.
    productName: line.productName ?? "",
    unit: "", // Printed UOM is never extracted — pharmacist picks the UOM.
    quantity,
    acceptedQuantity: quantity,
    unitPrice: derivedPrice,
    batchNumber: line.batchNumber ?? "",
    manufacturingDate: toEditableDate(line.manufacturingDate),
    expiryDate: toEditableDate(line.expiryDate),
    confidence: line.confidence,
  };
}

/**
 * Map the backend OCR result (`ExtractedInvoice`) into the editable
 * `ExtractedReceipt` shape. Fields the model returned as `null` stay empty so
 * the pharmacist fills them — never a guess. When `fallback` is provided and an
 * OCR line is blank at the header level, the fallback header values are kept.
 */
export function extractedInvoiceToReceipt(
  extracted: ExtractedInvoice,
  fallback?: ExtractedReceipt,
): ExtractedReceipt {
  const items = Array.isArray(extracted.items)
    ? extracted.items.map(ocrLineToReceiptLine)
    : extractedInvoiceToReceiptEmptyItems();
  return {
    supplierName: fallback?.supplierName ?? "",
    invoiceNumber: extracted.invoiceNumber ?? fallback?.invoiceNumber ?? "",
    invoiceDate: toEditableDate(extracted.invoiceDate) || fallback?.invoiceDate || localISODate(),
    receivedDate: fallback?.receivedDate ?? localISODate(),
    grandTotal: extracted.grandTotal ?? fallback?.grandTotal ?? 0,
    documentUrl: extracted.documentUrl ?? fallback?.documentUrl ?? undefined,
    warnings:
      extracted.warnings && extracted.warnings.length > 0
        ? extracted.warnings
        : fallback?.warnings,
    items,
  };
}

function extractedInvoiceToReceiptEmptyItems(): ExtractedReceiptLine[] {
  return emptyExtractedReceipt().items;
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
  if (Array.isArray(o.warnings)) {
    const warnings = o.warnings.filter((w): w is string => typeof w === "string");
    if (warnings.length > 0) out.warnings = warnings;
  }

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
  /** When a non-credit payment method is chosen, create the payment with the confirm transaction. */
  paymentMethod?: "CASH" | "BANK_TRANSFER" | "CHECK" | "CREDIT_CARD" | "OTHER";
  /** "YYYY-MM-DD" — defaults to the received date when a method is chosen. */
  paymentDate?: string;
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
    ...(options.paymentMethod ? { paymentMethod: options.paymentMethod } : {}),
    ...(options.paymentMethod && options.paymentDate
      ? { paymentDate: toISOTimestamp(options.paymentDate) }
      : {}),
    items: receipt.items.map((it) => ({
      quantity: Number(it.quantity) || 0,
      acceptedQuantity: Number(it.acceptedQuantity) || 0,
      productCode: it.productCode?.trim() ?? "",
      productName: it.productName?.trim() ?? "",
      unit: (it.unitSymbol ?? it.unit)?.trim() ?? "",
      unitPrice: Number(it.unitPrice) || 0,
      ...(it.poItemId ? { purchaseOrderItemId: it.poItemId } : {}),
      ...(it.confidence ? { confidence: it.confidence } : {}),
      batchNumber: it.batchNumber?.trim() ?? "",
      ...(it.manufacturingDate ? { manufacturingDate: toISOTimestamp(it.manufacturingDate) } : {}),
      expiryDate: toISOTimestamp(it.expiryDate),
    })),
  };
}