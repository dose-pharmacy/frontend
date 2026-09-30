// ── Invoice-Upload Assisted Receiving API client ─────────────────────────────
// Used by the Scan / Upload Goods Receipt workflow.
//
//   POST /api/v1/purchasing/invoice-upload/extract               (OCR, new)
//   GET  /api/v1/purchasing/purchase-orders/match-candidates     (new)
//   POST /api/v1/purchasing/purchase-orders/{id}/invoice-upload         (preview)
//   POST /api/v1/purchasing/purchase-orders/{id}/invoice-upload/confirm (confirm)
//
// OCR extraction is backend-side. The frontend POSTs the raw document
// (multipart "file") and receives a normalized `ExtractedInvoice`; every field
// is editable and treated as helper input only. When the extract endpoint is
// not deployed (404) the workflow falls back to manual entry. The backend still
// re-matches and re-validates every line against the authoritative PO.
//
// All requests require the authenticated session cookie (HTTP-only — sent
// automatically with `credentials: "include"`).

import { API_BASE_URL } from "../auth/authApi";
import type { PaymentMethod } from "./supplierInvoicesApi";

// ─── OCR extraction (Part 1 contract) ───────────────────────────────────────

/**
 * One line extracted from the supplier document by the OCR backend
 * (POST /api/v1/purchasing/invoice-upload/extract). Fields the model could not
 * read reliably are `null` — the pharmacist fills them ("never guess").
 */
export interface ExtractedInvoiceLine {
  productName: string | null;
  quantity: number | null;
  batchNumber: string | null;
  expiryDate: string | null;
  manufacturingDate: string | null;
  unitPrice: number | null;
  lineTotal: number | null;
  confidence: "high" | "low";
}

/** Response of POST /api/v1/purchasing/invoice-upload/extract. */
export interface ExtractedInvoice {
  invoiceNumber: string | null;
  invoiceDate: string | null;
  grandTotal: number | null;
  items: ExtractedInvoiceLine[];
  warnings: string[];
  documentUrl: string | null;
}

// ─── Match candidates (Part 2 contract) ─────────────────────────────────────

export interface MatchCandidateDto {
  purchaseOrder: InvoiceUploadPurchaseOrderDto & {
    poNumber: string;
    expectedDeliveryDate: string | null;
  };
  /** Number of extracted product names that matched this PO's items. */
  matchCount: number;
  /** Total item count on the PO. */
  itemCount: number;
  /** Remaining quantity across the PO (ordered − received − short). */
  remainingQuantity: number;
  matchedProductNames: string[];
}

// ─── Input payload ──────────────────────────────────────────────────────────

/** One normalized invoice line supplied to the receiving API. */
export interface InvoiceUploadLineInput {
  /** Quantity written on the supplier document. */
  quantity: number;
  /** Quantity physically accepted (may differ from `quantity`). */
  acceptedQuantity: number;
  /**
   * Legacy product code / SKU. The OCR pipeline no longer reads this — when a
   * PO item is selected by the pharmacist its SKU is echoed here for
   * backward-compatible matching; new backends ignore it.
   */
  productCode?: string;
  productName: string;
  /**
   * Unit symbol / name selected by the pharmacist (default = the matched PO
   * item's unit). When omitted the backend defaults to the PO item's unit and
   * no INVOICE_UNIT_MISMATCH is raised. Never filled from OCR.
   */
  unit?: string;
  unitPrice: number;
  batchNumber: string;
  expiryDate: string;
  manufacturingDate?: string;
  /**
   * Explicit PO item the pharmacist confirmed. Highest-priority match signal —
   * backend headers: explicit id → name similarity → suggestions.
   */
  purchaseOrderItemId?: string;
  /** Confidence from OCR — informational, drives amber highlighting. */
  confidence?: "high" | "low";
}

/** Request body for both the preview and confirm invoice-upload endpoints. */
export interface InvoiceUploadReceivingInput {
  locationId: string;
  invoiceNumber: string;
  invoiceDate: string;
  grandTotal: number;
  /** Helper input only — the selected PO's supplier is authoritative. */
  supplierName?: string;
  documentUrl?: string;
  receivedDate: string;
  discrepancyNote?: string;
  /**
   * Optional payment for the created supplier invoice. When neither is set the
   * invoice stays OPEN and no payment is created. When a non-credit method is
   * chosen the backend records the payment inside the same confirm transaction
   * (grand total by default), leaving the invoice PAID / PARTIALLY_PAID.
   */
  paymentMethod?: PaymentMethod;
  paymentDate?: string;
  items: InvoiceUploadLineInput[];
}

// ─── Preview response ───────────────────────────────────────────────────────

export interface InvoiceUploadPurchaseOrderDto {
  id: string;
  poNumber: string;
  status: string;
  supplier: { id: string; name: string } | null;
}

export interface InvoiceUploadReceivingDto {
  locationId: string;
  receivedDate: string;
}

export interface InvoiceUploadInvoiceDto {
  invoiceNumber: string;
  invoiceDate: string;
  grandTotal: number;
  supplierName: string;
  documentUrl: string | null;
}

export interface InvoiceUploadPreviewItemDto {
  lineIndex: number;
  matched: boolean;
  purchaseOrderItemId: string | null;
  product: { id: string; name: string; sku: string | null } | null;
  unit: { id: string; name: string; symbol: string } | null;
  /** Quantity written on the supplier document. */
  invoiceQuantity: number;
  purchaseQuantity: number;
  /** Quantity physically accepted. */
  acceptedQuantity: number;
  poOrdered: number;
  poReceived: number;
  poShort: number;
  poRemaining: number;
  remainingAfterReceipt: number;
  batchNumber: string;
  expiryDate: string | null;
  manufacturingDate: string | null;
  unitPrice: number;
  poUnitCost: number;
  /**
   * Top suggested PO items for an unmatched line (Part 2 backend). The UI
   * offers these as one-click choices before falling back to manual search.
   */
  suggestions?: {
    purchaseOrderItemId: string;
    productName: string;
    score: number;
  }[];
  /** OCR confidence — informational, drives amber highlighting. */
  confidence?: "high" | "low";
}

export type InvoiceUploadDiscrepancyCode =
  | "UNMATCHED_INVOICE_ITEM"
  | "INVOICE_QUANTITY_EXCEEDS_PO_REMAINING"
  | "INVOICE_UNIT_MISMATCH"
  | "MISSING_BATCH"
  | "MISSING_EXPIRY"
  | "DUPLICATE_INVOICE_NUMBER"
  | "PHYSICAL_DISCREPANCY"
  | "PRICE_DIFFERENCE"
  | (string & {});

export interface InvoiceUploadDiscrepancyDto {
  code: InvoiceUploadDiscrepancyCode;
  message: string;
  /** `false` for informational discrepancies (e.g. PRICE_DIFFERENCE). */
  blocking?: boolean;
  lineIndex?: number | null;
  productCode?: string | null;
  documentedQty?: number | null;
  acceptedQty?: number | null;
}

export interface InvoiceUploadPreviewDto {
  purchaseOrder: InvoiceUploadPurchaseOrderDto;
  receiving: InvoiceUploadReceivingDto;
  invoice: InvoiceUploadInvoiceDto;
  items: InvoiceUploadPreviewItemDto[];
  discrepancies: InvoiceUploadDiscrepancyDto[];
  canConfirm: boolean;
  requiresDiscrepancyNote: boolean;
}

// ─── Confirm response ───────────────────────────────────────────────────────

export interface InvoiceUploadConfirmDto {
  purchaseOrder: { id: string; poNumber: string; status: string };
  goodsReceipt: {
    id: string;
    receiptNumber: string;
    status: string;
    receivedDate: string;
    // The backend may include the full goods receipt + items + batches here.
    [key: string]: unknown;
  };
  supplierInvoice: {
    id: string;
    invoiceNumber: string;
    // Full supplier invoice + items when returned.
    [key: string]: unknown;
  };
  receiving: {
    totalDocumented: number;
    totalAccepted: number;
    lineCount: number;
  };
}

// ─── Errors ─────────────────────────────────────────────────────────────────

export class InvoiceUploadReceivingError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(
    message: string,
    options: { status: number; code?: string } = { status: 0 },
  ) {
    super(message);
    this.name = "InvoiceUploadReceivingError";
    this.status = options.status;
    this.code = options.code;
  }
}

function friendlyStatusMessage(status: number, code?: string): string {
  if (code) {
    switch (code) {
      case "PURCHASE_ORDER_NOT_FOUND":
        return "The selected purchase order was not found. It may have been deleted.";
      case "LOCATION_NOT_FOUND":
        return "The selected receiving location was not found.";
      case "INACTIVE_LOCATION":
        return "The selected receiving location is inactive. Choose an active location to receive goods.";
      case "INACTIVE_SUPPLIER":
        return "This purchase order's supplier is inactive and cannot receive goods.";
      case "PURCHASE_ORDER_CANNOT_RECEIVE":
        return "This purchase order cannot receive goods in its current state.";
      case "DUPLICATE_INVOICE_NUMBER":
        return "An invoice with this number has already been registered against this purchase order.";
      case "RECEIVING_DISCREPANCY_UNRESOLVED":
        return "Receiving cannot be confirmed because a discrepancy is still unresolved.";
      case "UNMATCHED_INVOICE_ITEM":
        return "One or more invoice items could not be matched to the purchase order. Check the product codes.";
      case "INVOICE_QUANTITY_EXCEEDS_PO_REMAINING":
        return "An invoice quantity exceeds what remains on the purchase order.";
      case "INVOICE_UNIT_MISMATCH":
        return "A unit on the invoice does not match the purchase order item.";
      case "MISSING_BATCH":
        return "Batch number is required for any item with an accepted quantity.";
      case "MISSING_EXPIRY":
        return "Expiry date is required for any item with an accepted quantity.";
      case "OCR_EXTRACTION_FAILED":
        return "The receipt could not be read automatically. Please enter the values from the receipt manually.";
      case "OCR_UNAVAILABLE":
        return ""; // Silent — the workflow falls back to manual entry.
    }
  }
  switch (status) {
    case 400:
      return "The receipt data was rejected — please check the fields.";
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return "You don't have permission to register goods receipts.";
    case 404:
      return "The purchase order or location was not found.";
    case 409:
      return "This conflicts with the current state of the purchase order or invoice.";
    case 422:
      return "The receipt data could not be validated against the purchase order.";
    default:
      return `Request failed (HTTP ${status}).`;
  }
}

// ─── Request plumbing ───────────────────────────────────────────────────────

const PO_BASE = `${API_BASE_URL}/api/v1/purchasing/purchase-orders`;

async function vioRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${PO_BASE}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new InvoiceUploadReceivingError(
      "Cannot reach the server. Please check your connection and try again.",
    );
  }

  if (!res.ok) {
    let message = friendlyStatusMessage(res.status);
    let code: string | undefined;
    try {
      const body = (await res.json()) as {
        error?: { code?: string; message?: string };
        message?: string;
      } | null;
      if (body?.error?.code) {
        code = body.error.code;
        message = friendlyStatusMessage(res.status, code);
      }
      if (body?.error?.message) message = body.error.message;
      else if (body?.message) message = body.message;
    } catch {
      // Non-JSON error body — keep the friendly message.
    }
    throw new InvoiceUploadReceivingError(message, { status: res.status, code });
  }

  const text = await res.text();
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null as T;
  }
}

/** Unwrap `{ success, data }` envelopes defensively. */
function unwrapEnvelope<T>(raw: unknown, fallback: T): T {
  if (
    raw != null &&
    typeof raw === "object" &&
    "data" in (raw as Record<string, unknown>)
  ) {
    const data = (raw as { data: unknown }).data;
    return (data ?? fallback) as T;
  }
  return (raw as T) ?? fallback;
}

// ─── Endpoints ──────────────────────────────────────────────────────────────

/**
 * POST /purchase-orders/{id}/invoice-upload — validate the normalized receipt
 * against the selected PO and return a read-only receiving preview. This does
 * NOT create anything.
 */
export async function previewInvoiceUpload(
  poId: string,
  input: InvoiceUploadReceivingInput,
): Promise<InvoiceUploadPreviewDto> {
  const raw = await vioRequest<unknown>(`/${encodeURIComponent(poId)}/invoice-upload`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  const data = unwrapEnvelope<InvoiceUploadPreviewDto>(
    raw,
    null as unknown as InvoiceUploadPreviewDto,
  );
  if (!data || !data.purchaseOrder?.id || !Array.isArray(data.items)) {
    throw new InvoiceUploadReceivingError("Unexpected response from the server.");
  }
  return data;
}

/**
 * POST /purchase-orders/{id}/invoice-upload/confirm — atomic confirmation.
 * The backend creates the goods receipt, goods receipt items, batches, stock
 * movements, PO quantity updates, supplier invoice and audit event. Do not call
 * any other receiving/confirmation API afterwards.
 */
export async function confirmInvoiceUpload(
  poId: string,
  input: InvoiceUploadReceivingInput,
): Promise<InvoiceUploadConfirmDto> {
  const raw = await vioRequest<unknown>(
    `/${encodeURIComponent(poId)}/invoice-upload/confirm`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
  const data = unwrapEnvelope<InvoiceUploadConfirmDto>(
    raw,
    null as unknown as InvoiceUploadConfirmDto,
  );
  if (!data || !data.purchaseOrder?.id || !data.goodsReceipt?.id) {
    throw new InvoiceUploadReceivingError("Unexpected response from the server.");
  }
  return data;
}

// ─── OCR extraction endpoint (Part 1) ────────────────────────────────────────

const EXTRACT_URL = `${API_BASE_URL}/api/v1/purchasing/invoice-upload/extract`;

function extractErrorFrom(res: Response): Promise<InvoiceUploadReceivingError> {
  const status = res.status;
  return res
    .json()
    .catch(() => null)
    .then((body: { error?: { code?: string; message?: string }; message?: string } | null) => {
      let code: string | undefined;
      let message = friendlyStatusMessage(status);
      if (body?.error?.code) {
        code = body.error.code;
        message = friendlyStatusMessage(status, code) || message;
      }
      if (body?.error?.message) message = body.error.message;
      else if (body?.message) message = body.message;
      return new InvoiceUploadReceivingError(message, { status, code });
    });
}

/**
 * POST /api/v1/purchasing/invoice-upload/extract — send the raw supplier
 * document (pdf/jpg/jpeg/png, ≤ ~10MB) and receive the normalized `ExtractedInvoice`.
 * OCR output is helper input only: every field is editable and re-validated by
 * the preview/confirm endpoints. When the endpoint is not deployed (404) this
 * throws `InvoiceUploadReceivingError` with code "OCR_UNAVAILABLE" so the
 * workflow can fall back to manual entry without alarming the user.
 */
export async function extractInvoiceReceipt(file: File): Promise<ExtractedInvoice> {
  let res: Response;
  try {
    const form = new FormData();
    form.append("file", file);
    res = await fetch(EXTRACT_URL, {
      method: "POST",
      credentials: "include",
      body: form,
    });
  } catch {
    throw new InvoiceUploadReceivingError("Cannot reach the server while reading the receipt.");
  }

  if (!res.ok) {
    const err = await extractErrorFrom(res);
    if (res.status === 404 && !err.code) {
      throw new InvoiceUploadReceivingError(err.message, {
        status: 404,
        code: "OCR_UNAVAILABLE",
      });
    }
    throw err;
  }

  const raw = (await res.json().catch(() => null)) as unknown;
  const data = unwrapEnvelope<ExtractedInvoice>(raw, null as unknown as ExtractedInvoice);
  if (!data || !Array.isArray(data.items)) {
    throw new InvoiceUploadReceivingError(
      "The receipt reader returned an unexpected response. Please enter the values manually.",
    );
  }
  return data;
}

// ─── Match candidates endpoint (Part 2) ──────────────────────────────────────

/**
 * GET /purchase-orders/match-candidates?supplierId=…&productNames[]=… — open POs
 * (AWAITING_DELIVERY with remaining > 0) for the supplier, ranked by how many
 * extracted product names match and by remaining quantity. Read-only; PO
 * selection is never auto-made by the frontend.
 */
export async function listMatchCandidates(
  supplierId: string,
  productNames: string[],
): Promise<MatchCandidateDto[]> {
  const params = new URLSearchParams();
  params.set("supplierId", supplierId);
  for (const name of productNames) {
    if (name.trim()) params.append("productNames", name.trim());
  }
  const raw = await vioRequest<unknown>(`/match-candidates?${params.toString()}`);
  const data = unwrapEnvelope<MatchCandidateDto[]>(raw, []);
  return Array.isArray(data) ? data : [];
}