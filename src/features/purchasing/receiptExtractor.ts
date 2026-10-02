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
  /**
   * Pharmacy SKU sent to the API. Echoed from the PO item the pharmacist picked
   * in the "PO Item" column — never taken from the receipt document.
   */
  productCode: string;
  productName: string;
  /** Pharmacy unit sent to the API. Set by the pharmacist from the PO item. */
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
   * Code printed on the receipt (e.g. "FINS-01") — OCR reference only, shown as
   * "Receipt Code (OCR)". NEVER used as the pharmacy product identity.
   */
  ocrProductCode?: string;
  /**
   * UOM printed on the receipt (e.g. "BOTTLE") — OCR reference only. NEVER
   * auto-applied as the pharmacy unit; the pharmacist picks the unit from the
   * selected PO item so the backend can raise INVOICE_UNIT_MISMATCH instead of
   * silently converting.
   */
  ocrUnit?: string;
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
  /** The supplier the pharmacist selected (never set from OCR). */
  supplierName: string;
  /**
   * Supplier name printed on the receipt (OCR hint). Displayed to the
   * pharmacist for reference — it never selects or changes the supplier.
   */
  ocrSupplierName?: string;
  ocrSupplierTin?: string;
  invoiceNumber: string;
  /** "YYYY-MM-DD". */
  invoiceDate: string;
  /** "YYYY-MM-DD". */
  receivedDate: string;
  /** The supplier document's grand total — reviewed and editable. */
  grandTotal: number;
  subtotal?: number;
  discount?: number;
  tax?: number;
  fees?: number;
  /** Payment terms printed on the document. Recorded on the invoice; it is not a payment. */
  paymentTerms?: string;
  /** "YYYY-MM-DD" — only sent when the pharmacist fills it. */
  dueDate?: string;
  /** FS number printed on the receipt (Ethiopian FS receipt) — informational only. */
  fsNumber?: string;
  documentUrl?: string;
  /** Receipt lines the extractor could not read. */
  skippedLineCount?: number;
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
    // Pharmacy identity fields stay empty: `productCode`/`unit` are filled by
    // the pharmacist from the PO item they select. The document's own code and
    // UOM are kept as OCR-only reference values.
    productCode: "",
    productName: line.productName ?? "",
    unit: "",
    ocrProductCode: line.productCode?.trim() ?? undefined,
    ocrUnit: line.unit?.trim() ?? undefined,
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
 * Merge the OCR warnings with anything the pharmacist must act on. Lines the
 * extractor skipped are surfaced explicitly so they are never silently dropped.
 */
function collectWarnings(
  extracted: ExtractedInvoice,
  fallback?: ExtractedReceipt,
): string[] {
  const warnings = [
    ...(extracted.warnings ?? []),
    ...(extracted.skippedLineCount && extracted.skippedLineCount > 0
      ? [
          `${extracted.skippedLineCount} receipt line${
            extracted.skippedLineCount === 1 ? "" : "s"
          } could not be read. Add ${
            extracted.skippedLineCount === 1 ? "it" : "them"
          } manually below.`,
        ]
      : []),
  ];
  return warnings.length > 0 ? warnings : (fallback?.warnings ?? []);
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
    // The selected supplier is pharmacist-controlled. The OCR name is kept
    // only as a hint so it can be shown next to the selector.
    supplierName: fallback?.supplierName ?? "",
    ocrSupplierName: extracted.supplierName?.trim() || undefined,
    ocrSupplierTin: extracted.supplierTin?.trim() || undefined,
    invoiceNumber: extracted.invoiceNumber ?? fallback?.invoiceNumber ?? "",
    invoiceDate: toEditableDate(extracted.invoiceDate) || fallback?.invoiceDate || localISODate(),
    receivedDate: fallback?.receivedDate ?? localISODate(),
    grandTotal: extracted.grandTotal ?? fallback?.grandTotal ?? 0,
    ...(extracted.subtotal != null ? { subtotal: extracted.subtotal } : {}),
    ...(extracted.discount != null ? { discount: extracted.discount } : {}),
    ...(extracted.tax != null ? { tax: extracted.tax } : {}),
    ...(extracted.fees != null ? { fees: extracted.fees } : {}),
    // A "CREDIT" term is a document value, not a payment — it is carried for
    // review and recorded on the invoice; paymentMethod stays pharmacist-set.
    ...(extracted.paymentTerms?.trim()
      ? { paymentTerms: extracted.paymentTerms.trim() }
      : {}),
    ...(extracted.fsNumber?.trim() ? { fsNumber: extracted.fsNumber.trim() } : {}),
    ...(extracted.skippedLineCount != null
      ? { skippedLineCount: extracted.skippedLineCount }
      : {}),
    documentUrl: extracted.documentUrl ?? fallback?.documentUrl ?? undefined,
    warnings: collectWarnings(extracted, fallback),
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
  out.ocrSupplierName = out.supplierName || undefined;
  out.invoiceNumber = strField(o, ["invoiceNumber", "invoice_no", "invoice"]);
  out.invoiceDate = strField(o, ["invoiceDate", "invoice_date", "date"]);
  out.receivedDate = strField(o, ["receivedDate", "received_date"]);
  out.fsNumber = strField(o, ["fsNumber", "fs_number", "fsNo"]) || undefined;
  out.paymentTerms = strField(o, ["paymentTerms", "payment_terms"]) || undefined;
  out.dueDate = strField(o, ["dueDate", "due_date"]) || undefined;
  const grandTotal = numField(o, ["grandTotal", "grand_total", "total"]);
  if (grandTotal != null) out.grandTotal = grandTotal;
  const subtotal = numField(o, ["subtotal", "sub_total"]);
  if (subtotal != null) out.subtotal = subtotal;
  const discount = numField(o, ["discount"]);
  if (discount != null) out.discount = discount;
  const tax = numField(o, ["tax"]);
  if (tax != null) out.tax = tax;
  const fees = numField(o, ["fees"]);
  if (fees != null) out.fees = fees;
  const skipped = numField(o, ["skippedLineCount", "skipped_line_count"]);
  if (skipped != null) out.skippedLineCount = skipped;
  const warnings: string[] = [];
  if (Array.isArray(o.warnings)) {
    warnings.push(...o.warnings.filter((w): w is string => typeof w === "string"));
  }
  if (skipped != null && skipped > 0) {
    warnings.push(
      `${skipped} receipt line${skipped === 1 ? "" : "s"} could not be read. Add ${
        skipped === 1 ? "it" : "them"
      } manually below.`,
    );
  }
  if (warnings.length > 0) out.warnings = warnings;

  const rawItems = o.items;
  if (Array.isArray(rawItems)) {
    const lines: ExtractedReceiptLine[] = rawItems
      .filter((it) => it && typeof it === "object")
      .map((it) => {
        const r = it as Record<string, unknown>;
        const quantity = numField(r, ["quantity", "qty"]);
        const accepted =
          numField(r, ["acceptedQuantity", "accepted_qty"]) ?? quantity ?? 0;
        // The document's own code/UOM are reference values only — the pharmacy
        // SKU and unit come from the PO item the pharmacist selects.
        const docCode = strField(r, ["productCode", "product_code", "code", "sku"]);
        const docUnit = strField(r, ["unit", "uom", "unitSymbol"]);
        return {
          productCode: "",
          productName: strField(r, [
            "productName",
            "product_name",
            "name",
            "description",
          ]),
          unit: "",
          ocrProductCode: docCode || undefined,
          ocrUnit: docUnit || undefined,
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
  /** Payment terms recorded on the supplier invoice (never a payment). */
  paymentTerms?: string;
  /** "YYYY-MM-DD" — only sent when explicitly filled in. */
  dueDate?: string;
  /** When a non-credit payment method is chosen, create the payment with the confirm transaction. */
  paymentMethod?: NonNullable<InvoiceUploadReceivingInput["paymentMethod"]>;
  /** "YYYY-MM-DD" — only sent when the pharmacist actually picked a date. */
  paymentDate?: string;
}

/**
 * Build the invoice-upload request body from the normalized receipt. The
 * extracted data is helper input only — the backend re-matches everything
 * against the selected PO. `supplierName` is never treated as authoritative.
 *
 * Blank optional values are omitted rather than sent as empty strings: the
 * backend distinguishes "not supplied" (e.g. unit → default to the PO item's
 * unit) from a supplied value, so an empty `unit` string must not be sent.
 */
export function toInvoiceUploadInput(
  receipt: ExtractedReceipt,
  locationId: string,
  options: ToInvoiceInputOptions = {},
): InvoiceUploadReceivingInput {
  const paymentTerms = options.paymentTerms ?? receipt.paymentTerms;
  const dueDate = options.dueDate ?? receipt.dueDate;
  return {
    locationId,
    invoiceNumber: receipt.invoiceNumber?.trim() ?? "",
    invoiceDate: toISOTimestamp(receipt.invoiceDate) || new Date().toISOString(),
    grandTotal: Number(receipt.grandTotal) || 0,
    ...(options.supplierName?.trim() || receipt.supplierName?.trim()
      ? { supplierName: options.supplierName ?? receipt.supplierName }
      : {}),
    receivedDate:
      toISOTimestamp(receipt.receivedDate) || new Date().toISOString(),
    ...(options.documentUrl ? { documentUrl: options.documentUrl } : {}),
    ...(options.discrepancyNote ? { discrepancyNote: options.discrepancyNote } : {}),
    ...(paymentTerms?.trim() ? { paymentTerms: paymentTerms.trim() } : {}),
    ...(dueDate?.trim() ? { dueDate: toISOTimestamp(dueDate) } : {}),
    ...(options.paymentMethod ? { paymentMethod: options.paymentMethod } : {}),
    // Only ever send a payment date the pharmacist actually chose — never
    // derive one from the invoice or received date.
    ...(options.paymentMethod && options.paymentDate
      ? { paymentDate: toISOTimestamp(options.paymentDate) }
      : {}),
    items: receipt.items.map((it) => {
      const productCode = it.productCode?.trim();
      const unit = (it.unitSymbol ?? it.unit)?.trim();
      const batchNumber = it.batchNumber?.trim();
      const expiryDate = toISOTimestamp(it.expiryDate);
      return {
        quantity: Number(it.quantity) || 0,
        acceptedQuantity: Number(it.acceptedQuantity) || 0,
        ...(productCode ? { productCode } : {}),
        productName: it.productName?.trim() ?? "",
        ...(unit ? { unit } : {}),
        unitPrice: Number(it.unitPrice) || 0,
        ...(it.poItemId ? { purchaseOrderItemId: it.poItemId } : {}),
        ...(it.confidence ? { confidence: it.confidence } : {}),
        ...(batchNumber ? { batchNumber } : {}),
        ...(it.manufacturingDate
          ? { manufacturingDate: toISOTimestamp(it.manufacturingDate) }
          : {}),
        ...(expiryDate ? { expiryDate } : {}),
      };
    }),
  };
}