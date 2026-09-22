// ── Purchase Orders API client ───────────────────────────────────────────────
// Talks to the pharmacy backend's purchasing purchase-order endpoints:
//   GET    /api/v1/purchasing/purchase-orders                     (list, filter)
//   POST   /api/v1/purchasing/purchase-orders                     (create)
//   GET    /api/v1/purchasing/purchase-orders/{id}                (detail)
//   PATCH  /api/v1/purchasing/purchase-orders/{id}                (update — dates/notes only)
//   PATCH  /api/v1/purchasing/purchase-orders/items/{itemId}      (update item)
//   DELETE /api/v1/purchasing/purchase-orders/items/{itemId}      (remove item)
//   POST   /api/v1/purchasing/purchase-orders/items/{itemId}/accept-shortage (accept shortage)
//   POST   /api/v1/purchasing/purchase-orders/{id}/mark-awaiting-delivery (→ AWAITING_DELIVERY)
//   POST   /api/v1/purchasing/purchase-orders/{id}/cancel         (→ CANCELLED)
//   POST   /api/v1/purchasing/purchase-orders/{id}/close          (→ CLOSED)
//
// All requests require the authenticated session cookie
// (HTTP-only — sent automatically with `credentials: "include"`).

import { API_BASE_URL } from "../auth/authApi";

// ─── Types (mirror the Swagger response shapes) ──────────────────────────────

export type POStatus =
  | "REGISTERED"
  | "AWAITING_DELIVERY"
  | "RECEIVED"
  | "CLOSED"
  | "CANCELLED"
  | (string & {});

/** Derived (never persisted) payment status of a purchase order. */
export type POPaymentStatus =
  | "NOT_INVOICED"
  | "UNPAID"
  | "PARTIALLY_PAID"
  | "PAID"
  | "ALL";

export interface POItemRequirementRefDto {
  id: string;
  quantityNeeded: number;
  quantityDelivered: number;
  status: string;
  requirement: { id: string; reference: string; status: string };
}

export interface POItemDto {
  id: string;
  productId: string;
  quantityOrdered: number;
  /** Base-unit snapshot of `quantityOrdered` (present on detail responses). */
  quantityOrderedBase?: number;
  quantityReceived?: number;
  quantityShort?: number;
  shortReason?: string | null;
  /** Unit the ordered quantity is expressed in. */
  unitId?: string | null;
  unit?: { id: string; name: string; symbol: string } | null;
  unitCost: number;
  requirementLineId: string | null;
  /** Embedded on detail responses (and from-requirement creates). */
  product?: { id: string; name: string; sku: string } | null;
  /** Embedded on PO detail and returned by item update endpoints. */
  requirementLine?: POItemRequirementRefDto | null;
  allocations?: { id: string; requirementLineId: string; quantityAllocated: number }[];
}

export interface POSupplierRefDto {
  id: string;
  name: string;
  /** Only present on GET /purchase-orders/{id} (and PATCH). */
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  paymentTerms?: string | null;
}

export interface POReceivingSummaryDto {
  orderedQuantity: number;
  receivedQuantity: number;
  shortQuantity: number;
  remainingQuantity: number;
}

export interface POGoodsSummaryDto {
  /** Commercial value of the PO: SUM(quantityOrdered × unitCost). */
  orderedGoodsValue: number;
  /** Value of goods actually received (shortages never count). */
  receivedGoodsValue: number;
  /** Value of received goods already billed on invoices. */
  goodsInvoicedAmount: number;
  /** receivedGoodsValue − goodsInvoicedAmount (still available to invoice). */
  remainingGoodsToInvoice: number;
}

export interface POPaymentSummaryDto {
  status: POPaymentStatus;
  invoiceCount: number;
  /** SUM of invoice totalAmounts (never the goods amount). */
  invoicedAmount: number;
  paidAmount: number;
  outstandingAmount: number;
}

/** PO header + items — shape of list rows, POST and GET /purchase-orders/{id}. */
export interface PurchaseOrderDto {
  id: string;
  poNumber: string;
  supplierId: string;
  status: POStatus;
  /** ISO8601 datetime — stamped by the backend on creation. */
  orderDate?: string;
  expectedDeliveryDate: string | null;
  notes: string | null;
  createdById?: string;
  supplier?: POSupplierRefDto | null;
  createdBy?: { id: string; name: string } | null;
  /** List rows carry `_count.items` instead of a full items array. */
  _count?: { items?: number };
  items?: POItemDto[];
  /** Present on every list row and detail response. */
  paymentSummary?: POPaymentSummaryDto;
  /** Detail-only summaries (receiving/goods); also on list in future. */
  receivingSummary?: POReceivingSummaryDto;
  goodsSummary?: POGoodsSummaryDto;
  goodsReceipts?: { id: string; receiptNumber: string; status: string; receivedDate: string }[];
  supplierInvoices?: {
    id: string;
    invoiceNumber: string;
    goodsAmount: number;
    totalAmount: number;
    outstandingBalance: number;
    status: string;
  }[];
}

export interface POListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Server-computed status counts over the FILTERED dataset (not just the page). */
export interface POListSummaryDto {
  registered: number;
  awaitingDelivery: number;
  received: number;
  closed: number;
  cancelled: number;
}

export interface PurchaseOrderListResult {
  data: PurchaseOrderDto[];
  /** The backend returns the page meta under `meta`. */
  meta: POListMeta;
  summary?: POListSummaryDto;
}

export interface PurchaseOrdersQuery {
  page?: number;
  limit?: number;
  supplierId?: string;
  status?: string;
  paymentStatus?: POPaymentStatus;
  search?: string;
}

/** Body for POST /purchase-orders. */
export interface CreatePurchaseOrderItemInput {
  productId: string;
  /** Unit the ordered quantity is expressed in; omit to default to the product's base unit. */
  unitId?: string | null;
  quantityOrdered: number;
  unitCost: number;
  requirementLineId?: string | null;
}

export interface CreatePurchaseOrderInput {
  supplierId: string;
  expectedDeliveryDate?: string | null;
  notes?: string | null;
  items: CreatePurchaseOrderItemInput[];
}

/**
 * Body for PATCH /purchase-orders/{id} — header only. The backend only accepts
 * `expectedDeliveryDate` and `notes`; supplier and item changes are performed
 * through their own endpoints (items: PATCH/DELETE /purchase-orders/items/:id).
 */
export interface UpdatePurchaseOrderInput {
  expectedDeliveryDate?: string | null;
  notes?: string | null;
}

/** Body for PATCH /purchase-orders/items/{itemId} — at least one field required. */
export interface UpdatePurchaseOrderItemInput {
  quantityOrdered?: number;
  unitCost?: number;
}

/** Body for POST /purchase-orders/items/{itemId}/accept-shortage. */
export interface AcceptShortageInput {
  /** Omit to default to the full remaining quantity (ordered − received − short). */
  quantityShort?: number;
  shortReason?: string | null;
}

/** Body for POST /purchase-orders/from-requirement — create PO from requirement lines. */
export interface CreatePurchaseOrderFromRequirementInput {
  supplierId: string;
  expectedDeliveryDate?: string | null;
  notes?: string | null;
  items: {
    requirementLineId: string;
    quantityOrdered: number;
    unitCost: number;
  }[];
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class PurchaseOrdersApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, options: { status: number; code?: string } = { status: 0 }) {
    super(message);
    this.name = "PurchaseOrdersApiError";
    this.status = options.status;
    this.code = options.code;
  }
}

function friendlyStatusMessage(status: number, code?: string): string {
  switch (status) {
    case 400:
      return "The purchase order data was rejected — please check the fields.";
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return "You don't have permission to manage purchase orders.";
    case 404:
      return "This purchase order no longer exists.";
    case 409:
      if (code === "PO_ALREADY_DELIVERED")
        return "This purchase order was already marked as delivered.";
      if (code === "PO_ALREADY_CLOSED") return "This purchase order is already closed.";
      if (code === "PO_ALREADY_CANCELLED") return "This purchase order is already cancelled.";
      if (code === "PO_NOT_CANCELLABLE")
        return "This purchase order can no longer be cancelled in its current state.";
      if (code === "REQUIREMENT_QUANTITY_EXCEEDED")
        return "The available quantity for this requirement changed because another purchase order was created. Refresh the requirement and review the remaining quantity.";
      if (code === "REQUIREMENT_CLOSED")
        return "The linked requirement line is closed and can no longer be ordered.";
      if (code === "INACTIVE_SUPPLIER")
        return "This supplier is inactive and cannot receive new purchase orders.";
      if (code === "PO_STATUS_TRANSITION_INVALID")
        return "This status transition is not allowed for the current purchase order state.";
      if (code === "PO_CANNOT_CANCEL")
        return "This purchase order cannot be cancelled in its current state.";
      return "This conflicts with the current state of the purchase order.";
    case 422:
      return "The purchase order details are invalid — please check the fields.";
    default:
      return `Request failed (HTTP ${status}).`;
  }
}

// ─── Request plumbing ────────────────────────────────────────────────────────

const PO_BASE = `${API_BASE_URL}/api/v1/purchasing/purchase-orders`;

async function poRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
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
    throw new PurchaseOrdersApiError(
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
      // Non-JSON error body — keep the generic message.
    }
    throw new PurchaseOrdersApiError(message, { status: res.status, code });
  }

  const text = await res.text();
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null as T;
  }
}

/** Unwrap `{ success, data }` / `{ data, pagination }` envelopes defensively. */
function unwrapEnvelope<T>(raw: unknown, fallbackData: T): T {
  if (raw == null) return fallbackData;
  if (typeof raw === "object" && "data" in (raw as Record<string, unknown>)) {
    const data = (raw as { data: unknown }).data;
    return (data ?? fallbackData) as T;
  }
  return (raw as T) ?? fallbackData;
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

/** GET /purchase-orders — paginated list with supplier/status/payment/search filters. */
export async function listPurchaseOrders(
  query: PurchaseOrdersQuery = {},
): Promise<PurchaseOrderListResult> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({
    page: query.page,
    limit: query.limit,
    supplierId: query.supplierId,
    status: query.status,
    paymentStatus: query.paymentStatus,
    search: query.search,
  })) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  const result = await poRequest<{
    data?: PurchaseOrderDto[] | null;
    meta?: POListMeta;
    pagination?: POListMeta;
    summary?: POListSummaryDto;
  }>(qs ? `?${qs}` : "");
  return {
    data: Array.isArray(result?.data) ? result.data : [],
    meta:
      result?.meta ??
      result?.pagination ?? { page: query.page ?? 1, limit: query.limit ?? 20, total: 0, totalPages: 1 },
    summary: result?.summary,
  };
}

/**
 * Build a POST /purchase-orders items array. `requirementLineId` is omitted
 * when absent — the backend's validator rejects explicit nulls with 422.
 */
function toCreateItems(items: CreatePurchaseOrderItemInput[]) {
  return items.map((it) => ({
    productId: it.productId,
    quantityOrdered: it.quantityOrdered,
    unitCost: it.unitCost,
    ...(it.requirementLineId ? { requirementLineId: it.requirementLineId } : {}),
  }));
}

/** POST /purchase-orders — create a PO; the backend starts it as REGISTERED. */
export async function createPurchaseOrder(input: CreatePurchaseOrderInput): Promise<PurchaseOrderDto> {
  const raw = await poRequest<unknown>("", {
    method: "POST",
    body: JSON.stringify({
      supplierId: input.supplierId,
      ...(input.expectedDeliveryDate ? { expectedDeliveryDate: input.expectedDeliveryDate } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
      items: toCreateItems(input.items),
    }),
  });
  const data = unwrapEnvelope<PurchaseOrderDto>(raw, null as unknown as PurchaseOrderDto);
  if (!data?.id) throw new PurchaseOrdersApiError("Unexpected response from the server.");
  return data;
}

/** GET /purchase-orders/{id} — full PO with supplier contact and items. */
export async function getPurchaseOrder(id: string): Promise<PurchaseOrderDto> {
  const raw = await poRequest<unknown>(`/${encodeURIComponent(id)}`);
  const data = unwrapEnvelope<PurchaseOrderDto>(raw, null as unknown as PurchaseOrderDto);
  if (!data?.id) throw new PurchaseOrdersApiError("Unexpected response from the server.");
  return data;
}

/** PATCH /purchase-orders/{id} — partial update (supplier, dates, notes, items). */
export async function updatePurchaseOrder(
  id: string,
  patch: UpdatePurchaseOrderInput,
): Promise<PurchaseOrderDto> {
  const raw = await poRequest<unknown>(`/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  const data = unwrapEnvelope<PurchaseOrderDto>(raw, null as unknown as PurchaseOrderDto);
  if (!data?.id) throw new PurchaseOrdersApiError("Unexpected response from the server.");
  return data;
}

/**
 * POST /purchase-orders/{id}/mark-awaiting-delivery — move a REGISTERED PO to
 * AWAITING_DELIVERY. Physical receiving happens through Deliveries.
 */
export async function markPurchaseOrderAwaitingDelivery(id: string): Promise<PurchaseOrderDto> {
  const raw = await poRequest<unknown>(`/${encodeURIComponent(id)}/mark-awaiting-delivery`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  const data = unwrapEnvelope<PurchaseOrderDto>(raw, null as unknown as PurchaseOrderDto);
  if (!data?.id) throw new PurchaseOrdersApiError("Unexpected response from the server.");
  return data;
}

/**
 * POST /purchase-orders/{id}/cancel — cancel a PO from a pre-receipt state
 * (REGISTERED or AWAITING_DELIVERY).
 */
export async function cancelPurchaseOrder(id: string): Promise<PurchaseOrderDto> {
  const raw = await poRequest<unknown>(`/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  const data = unwrapEnvelope<PurchaseOrderDto>(raw, null as unknown as PurchaseOrderDto);
  if (!data?.id) throw new PurchaseOrdersApiError("Unexpected response from the server.");
  return data;
}

/** POST /purchase-orders/{id}/close — close a RECEIVED PO; ends the cycle. */
export async function closePurchaseOrder(id: string): Promise<PurchaseOrderDto> {
  const raw = await poRequest<unknown>(`/${encodeURIComponent(id)}/close`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  const data = unwrapEnvelope<PurchaseOrderDto>(raw, null as unknown as PurchaseOrderDto);
  if (!data?.id) throw new PurchaseOrdersApiError("Unexpected response from the server.");
  return data;
}

/**
 * POST /purchase-orders/from-requirement — create a PO from one or more requirement lines.
 * The backend derives the product from requirementLineId.
 */
export async function createPurchaseOrderFromRequirement(
  input: CreatePurchaseOrderFromRequirementInput,
): Promise<PurchaseOrderDto> {
  const raw = await poRequest<unknown>("/from-requirement", {
    method: "POST",
    body: JSON.stringify({
      supplierId: input.supplierId,
      ...(input.expectedDeliveryDate ? { expectedDeliveryDate: input.expectedDeliveryDate } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
      items: input.items,
    }),
  });
  const data = unwrapEnvelope<PurchaseOrderDto>(raw, null as unknown as PurchaseOrderDto);
  if (!data?.id) throw new PurchaseOrdersApiError("Unexpected response from the server.");
  return data;
}

/**
 * PATCH /purchase-orders/items/{itemId} — update a PO item (quantity, unit cost).
 * Only allowed while the order is REGISTERED or AWAITING_DELIVERY.
 */
export async function updatePurchaseOrderItem(
  itemId: string,
  patch: UpdatePurchaseOrderItemInput,
): Promise<POItemDto> {
  const raw = await poRequest<unknown>(`/items/${encodeURIComponent(itemId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  const data = unwrapEnvelope<POItemDto>(raw, null as unknown as POItemDto);
  if (!data?.id) throw new PurchaseOrdersApiError("Unexpected response from the server.");
  return data;
}

/**
 * POST /purchase-orders/items/{itemId}/accept-shortage — record the
 * unreceived remainder of an item as an explicit shortage. When all items are
 * accounted for (received + short covers ordered) the backend moves the order
 * to RECEIVED.
 */
export async function acceptPurchaseOrderShortage(
  itemId: string,
  input: AcceptShortageInput,
): Promise<POItemDto> {
  const raw = await poRequest<unknown>(`/items/${encodeURIComponent(itemId)}/accept-shortage`, {
    method: "POST",
    body: JSON.stringify({
      ...(input.quantityShort !== undefined ? { quantityShort: input.quantityShort } : {}),
      ...(input.shortReason !== undefined ? { shortReason: input.shortReason } : {}),
    }),
  });
  const data = unwrapEnvelope<POItemDto>(raw, null as unknown as POItemDto);
  if (!data?.id) throw new PurchaseOrdersApiError("Unexpected response from the server.");
  return data;
}

/**
 * DELETE /purchase-orders/items/{itemId} — remove a PO item.
 * Only available for REGISTERED orders.
 */
export async function deletePurchaseOrderItem(itemId: string): Promise<void> {
  await poRequest<{ success: boolean; data: null }>(`/items/${encodeURIComponent(itemId)}`, {
    method: "DELETE",
  });
}
