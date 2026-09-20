// ── Purchase Orders API client ───────────────────────────────────────────────
// Talks to the pharmacy backend's purchasing purchase-order endpoints:
//   GET    /api/v1/purchasing/purchase-orders                     (list, filter)
//   POST   /api/v1/purchasing/purchase-orders                     (create)
//   GET    /api/v1/purchasing/purchase-orders/{id}                (detail)
//   PATCH  /api/v1/purchasing/purchase-orders/{id}                (update)
//   POST   /api/v1/purchasing/purchase-orders/{id}/mark-awaiting-delivery (→ AWAITING_DELIVERY)
//   POST   /api/v1/purchasing/purchase-orders/{id}/cancel         (→ CANCELLED)
//   POST   /api/v1/purchasing/purchase-orders/{id}/close          (→ CLOSED)
//
// All requests require the authenticated session cookie
// (HTTP-only — sent automatically with `credentials: "include"`).

import { API_BASE_URL } from "../auth/authApi";
import type { RequirementProductRefDto } from "./requirementsApi";

// ─── Types (mirror the Swagger response shapes) ──────────────────────────────

export type POStatus =
  | "REGISTERED"
  | "AWAITING_DELIVERY"
  | "RECEIVED"
  | "CLOSED"
  | "CANCELLED"
  | (string & {});

export interface POItemDto {
  id: string;
  productId: string;
  quantityOrdered: number;
  unitCost: number;
  requirementLineId: string | null;
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

/** PO header + items — shape of list rows, POST and GET /purchase-orders/{id}. */
export interface PurchaseOrderDto {
  id: string;
  poNumber: string;
  supplierId: string;
  status: POStatus;
  expectedDeliveryDate: string | null;
  notes: string | null;
  totalAmount: number;
  supplier?: POSupplierRefDto | null;
  items: POItemDto[];
}

export interface POListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PurchaseOrderListResult {
  data: PurchaseOrderDto[];
  pagination: POListMeta;
}

export interface PurchaseOrdersQuery {
  page?: number;
  limit?: number;
  supplierId?: string;
  status?: string;
  search?: string;
}

/** Body for POST /purchase-orders. */
export interface CreatePurchaseOrderItemInput {
  productId: string;
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

/** Body for PATCH /purchase-orders/{id} — all fields optional. */
export interface UpdatePurchaseOrderInput {
  supplierId?: string;
  expectedDeliveryDate?: string | null;
  notes?: string | null;
  items?: CreatePurchaseOrderItemInput[];
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

/** Response for PO item operations. */
export interface POItemDto {
  id: string;
  productId: string;
  quantityOrdered: number;
  unitCost: number;
  requirementLineId: string | null;
  product?: RequirementProductRefDto | null;
  requirementLine?: {
    id: string;
    requirementId: string;
    productId: string;
    quantityNeeded: number;
    quantityRemaining: number;
  } | null;
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

/** GET /purchase-orders — paginated list with supplier/status/search filters. */
export async function listPurchaseOrders(
  query: PurchaseOrdersQuery = {},
): Promise<PurchaseOrderListResult> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({
    page: query.page,
    limit: query.limit,
    supplierId: query.supplierId,
    status: query.status,
    search: query.search,
  })) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  const result = await poRequest<{
    data?: PurchaseOrderDto[];
    pagination?: POListMeta;
    /** Some envelopes use `meta` instead of `pagination`. */
    meta?: POListMeta;
  }>(qs ? `?${qs}` : "");
  return {
    data: result?.data ?? [],
    pagination:
      result?.pagination ??
      result?.meta ?? { page: query.page ?? 1, limit: query.limit ?? 20, total: 0, totalPages: 1 },
  };
}

/** POST /purchase-orders — create a PO; the backend starts it as REGISTERED. */
export async function createPurchaseOrder(input: CreatePurchaseOrderInput): Promise<PurchaseOrderDto> {
  const raw = await poRequest<unknown>("", {
    method: "POST",
    body: JSON.stringify(input),
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
    body: JSON.stringify(input),
  });
  const data = unwrapEnvelope<PurchaseOrderDto>(raw, null as unknown as PurchaseOrderDto);
  if (!data?.id) throw new PurchaseOrdersApiError("Unexpected response from the server.");
  return data;
}

/**
 * PATCH /purchase-orders/items/{itemId} — update a PO item (quantity, unit cost).
 */
export async function updatePurchaseOrderItem(
  itemId: string,
  patch: { quantityOrdered?: number; unitCost?: number },
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
 * DELETE /purchase-orders/items/{itemId} — remove a PO item.
 * Only available for REGISTERED orders.
 */
export async function deletePurchaseOrderItem(itemId: string): Promise<void> {
  await poRequest<{ success: boolean; data: null }>(`/items/${encodeURIComponent(itemId)}`, {
    method: "DELETE",
  });
}
