// ── Purchase Requirements API client ─────────────────────────────────────────
// Talks to the pharmacy backend's purchasing requirement endpoints:
//   GET    /api/v1/purchasing/requirements                        (list, filter)
//   POST   /api/v1/purchasing/requirements                        (create)
//   GET    /api/v1/purchasing/requirements/{id}                   (detail)
//   PATCH  /api/v1/purchasing/requirements/{id}                   (update header)
//   POST   /api/v1/purchasing/requirements/{id}/close             (close)
//   DELETE /api/v1/purchasing/requirements/{id}                   (delete; 409 when lines have POs)
//   POST   /api/v1/purchasing/requirements/generate-from-reorder  (auto-generate)
//   POST   /api/v1/purchasing/requirements/{id}/lines             (add line)
//   PATCH  /api/v1/purchasing/requirements/lines/{lineId}         (update line)
//   DELETE /api/v1/purchasing/requirements/lines/{lineId}         (remove line)
//
// All requests require the authenticated session cookie
// (HTTP-only — sent automatically with `credentials: "include"`).

import { API_BASE_URL } from "../auth/authApi";

// ─── Types (mirror the Swagger response shapes) ──────────────────────────────

export type RequirementStatus =
  | "OPEN"
  | "PARTIALLY_FULFILLED"
  | "FULFILLED"
  | "CLOSED"
  | (string & {});
export type RequirementLineStatus =
  | "OPEN"
  | "PARTIALLY_FULFILLED"
  | "FULFILLED"
  | "CLOSED"
  | (string & {});
export type RequirementReasonCode =
  | "LOW_STOCK"
  | "REORDER_ALERT"
  | "MANUAL"
  | (string & {});

export interface RequirementProductRefDto {
  id: string;
  name: string;
  sku: string;
}

export interface RequirementSupplierRefDto {
  id: string;
  name: string;
}

/**
 * One purchase-order allocation against a requirement line. Returned by the
 * backend inside `RequirementLineDto.allocations` (never as fabricated
 * `purchaseOrderItems`).
 */
export interface RequirementAllocationDto {
  id: string;
  /** Base-unit quantity allocated to this line by the PO item. */
  quantityAllocated: number;
  /** False when the allocation's purchase order has been cancelled. */
  active: boolean;
  purchaseOrderItemId: string;
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  purchaseOrderStatus: string;
  supplier: RequirementSupplierRefDto | null;
  /** PO item's ordered quantity in its own unit. */
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  createdAt: string;
  updatedAt: string;
}

/** Row of the requirement `lines` array. */
export interface RequirementLineDto {
  id: string;
  requirementId: string;
  productId: string;
  requiredQuantity: number;
  quantityNeeded: number;
  quantityOrdered: number;
  orderedQuantity: number;
  quantityDelivered: number;
  quantityRemaining: number;
  remainingQuantity: number;
  remainingToOrder: number;
  remainingToReceive: number;
  reasonCode: RequirementReasonCode | null;
  status: RequirementLineStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  product?: RequirementProductRefDto | null;
  allocations?: RequirementAllocationDto[];
  activeOrderCount?: number;
}

export interface RequirementUserDto {
  id: string;
  name: string;
}

/** Requirement header + lines — the shape of GET /requirements/{id}. */
export interface RequirementDto {
  id: string;
  reference: string;
  status: RequirementStatus;
  requiredBy: string | null;
  notes: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  lines: RequirementLineDto[];
  createdBy?: RequirementUserDto | null;
}

export interface RequirementListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Server-computed status counts over the FILTERED dataset (not just the page). */
export interface RequirementSummaryDto {
  open: number;
  partiallyFulfilled: number;
  fulfilled: number;
  closed: number;
  total: number;
}

export interface RequirementListResult {
  data: RequirementDto[];
  meta: RequirementListMeta;
  summary?: RequirementSummaryDto;
}

export interface RequirementsQuery {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

/** Body for POST /requirements — requires at least one line, no duplicate products. */
export interface CreateRequirementLineInput {
  productId: string;
  quantityNeeded: number;
  reasonCode?: RequirementReasonCode | null;
  notes?: string | null;
}

export interface CreateRequirementInput {
  /** Optional per the backend contract (ISO8601 datetime|null). */
  requiredBy?: string | null;
  notes?: string | null;
  lines: CreateRequirementLineInput[];
}

/** Body for PATCH /requirements/{id} — header only, both fields optional. */
export interface UpdateRequirementInput {
  requiredBy?: string;
  notes?: string | null;
}

/** Body for POST /requirements/{id}/lines. */
export type CreateRequirementLineBody = CreateRequirementLineInput;

/**
 * Body for PATCH /requirements/lines/{lineId} — all fields optional. Fulfillment
 * status is derived by the backend and can never be supplied by the client body.
 */
export interface UpdateRequirementLineInput {
  quantityNeeded?: number;
  reasonCode?: RequirementReasonCode | null;
  notes?: string | null;
}

/** Response from GET /requirements/lines/{lineId}/order-preview. */
export interface OrderPreviewDto {
  requiredQuantity: number;
  orderedQuantity: number;
  remainingQuantity: number;
  suggestedOrderQuantity: number;
  activeOrderCount: number;
  lineStatus: RequirementLineStatus;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class RequirementsApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, options: { status: number; code?: string } = { status: 0 }) {
    super(message);
    this.name = "RequirementsApiError";
    this.status = options.status;
    this.code = options.code;
  }
}

function friendlyStatusMessage(status: number, code?: string): string {
  switch (status) {
    case 400:
      if (code === "BAD_REQUEST" || !code) return "The request was rejected — please check the fields.";
      return "The request was rejected.";
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return "You don't have permission to manage purchase requirements.";
    case 404:
      if (code === "REQUIREMENT_LINE_NOT_FOUND") return "This requirement line no longer exists.";
      if (code === "SUPPLIER_NOT_FOUND") return "This supplier no longer exists.";
      return "This requirement no longer exists.";
    case 409:
      if (code === "REQUIREMENT_LINE_HAS_PO")
        return "This requirement already has purchase orders and cannot be modified this way.";
      if (code === "REQUIREMENT_CLOSED") return "This requirement is closed and can no longer be modified.";
      if (code === "DUPLICATE_PRODUCT_IN_REQUIREMENT")
        return "This product is already in the requirement.";
      if (code === "REQUIREMENT_HAS_ACTIVE_ORDERS")
        return "This requirement has active purchase orders and cannot be deleted. Cancel the related purchase orders first.";
      if (code === "REQUIREMENT_QUANTITY_BELOW_ORDERED")
        return "Cannot reduce required quantity below the already ordered quantity.";
      if (code === "BAD_REQUEST") return "No reorder suggestions are available to generate from.";
      return "This conflicts with the current state of the requirement.";
    case 422:
      return "The requirement data is invalid — please check the fields.";
    default:
      return `Request failed (HTTP ${status}).`;
  }
}

// ─── Request plumbing ────────────────────────────────────────────────────────

const REQUIREMENTS_BASE = `${API_BASE_URL}/api/v1/purchasing/requirements`;

async function requirementsRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${REQUIREMENTS_BASE}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new RequirementsApiError(
      "Cannot reach the server. Please check your connection and try again.",
    );
  }

  if (!res.ok) {
    let message = friendlyStatusMessage(res.status);
    let code: string | undefined;
    try {
      const body = (await res.json()) as {
        error?: { code?: string; message?: string; details?: unknown };
        message?: string;
      } | null;
      if (body?.error?.code) {
        code = body.error.code;
        message = friendlyStatusMessage(res.status, code);
      }
      if (body?.error?.message) message = body.error.message;
      else if (body?.message) message = body.message;
      // Surface per-field validation details (e.g. from 422 responses) so the
      // user can see exactly which field the backend rejected.
      const details = body?.error?.details;
      if (details != null) {
        const text = typeof details === "string" ? details : JSON.stringify(details);
        if (text && text !== "{}" && text !== "[]") message += ` — ${text}`;
      }
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    throw new RequirementsApiError(message, { status: res.status, code });
  }

  const text = await res.text();
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null as T;
  }
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

/** GET /requirements — paginated requirement list with status filter + search. */
export async function listRequirements(
  query: RequirementsQuery = {},
): Promise<RequirementListResult> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({
    page: query.page,
    limit: query.limit,
    status: query.status,
    search: query.search,
  })) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  const result = await requirementsRequest<RequirementListResult>(qs ? `?${qs}` : "");
  return result ?? { data: [], meta: { page: 1, limit: query.limit ?? 20, total: 0, totalPages: 1 } };
}

/** POST /requirements — create a requirement with one or more product lines. */
export async function createRequirement(input: CreateRequirementInput): Promise<RequirementDto> {
  const result = await requirementsRequest<{ success: boolean; data: RequirementDto }>("", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!result?.data) throw new RequirementsApiError("Unexpected response from the server.");
  return result.data;
}

/** GET /requirements/{id} — full requirement with its lines. */
export async function getRequirement(id: string): Promise<RequirementDto> {
  const result = await requirementsRequest<{ success: boolean; data: RequirementDto }>(
    `/${encodeURIComponent(id)}`,
  );
  if (!result?.data) throw new RequirementsApiError("Unexpected response from the server.");
  return result.data;
}

/** PATCH /requirements/{id} — update the header (requiredBy and/or notes). */
export async function updateRequirement(
  id: string,
  patch: UpdateRequirementInput,
): Promise<RequirementDto> {
  const result = await requirementsRequest<{ success: boolean; data: RequirementDto }>(
    `/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
  if (!result?.data) throw new RequirementsApiError("Unexpected response from the server.");
  return result.data;
}

/** POST /requirements/{id}/close — close the requirement; backend closes all lines. */
export async function closeRequirement(id: string): Promise<RequirementDto> {
  const result = await requirementsRequest<{ success: boolean; data: RequirementDto }>(
    `/${encodeURIComponent(id)}/close`,
    { method: "POST" },
  );
  if (!result?.data) throw new RequirementsApiError("Unexpected response from the server.");
  return result.data;
}

/**
 * DELETE /requirements/{id} — remove a requirement.
 * Fails with 409 REQUIREMENT_LINE_HAS_PO when any line already has purchase orders.
 */
export async function deleteRequirement(id: string): Promise<void> {
  await requirementsRequest<{ success: boolean; data: null }>(`/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

/**
 * POST /requirements/generate-from-reorder — auto-create a requirement from the
 * current reorder suggestions. Fails with 409 BAD_REQUEST when there is nothing
 * to generate from.
 */
export async function generateRequirementFromReorder(): Promise<RequirementDto> {
  const result = await requirementsRequest<{ success: boolean; data: RequirementDto }>(
    "/generate-from-reorder",
    { method: "POST" },
  );
  if (!result?.data) throw new RequirementsApiError("Unexpected response from the server.");
  return result.data;
}

/** POST /requirements/{id}/lines — add another product line to a requirement. */
export async function addRequirementLine(
  requirementId: string,
  body: CreateRequirementLineBody,
): Promise<RequirementLineDto> {
  const result = await requirementsRequest<{ success: boolean; data: RequirementLineDto }>(
    `/${encodeURIComponent(requirementId)}/lines`,
    { method: "POST", body: JSON.stringify(body) },
  );
  if (!result?.data) throw new RequirementsApiError("Unexpected response from the server.");
  return result.data;
}

/** PATCH /requirements/lines/{lineId} — edit quantity, reason, notes or status. */
export async function updateRequirementLine(
  lineId: string,
  patch: UpdateRequirementLineInput,
): Promise<RequirementLineDto> {
  const result = await requirementsRequest<{ success: boolean; data: RequirementLineDto }>(
    `/lines/${encodeURIComponent(lineId)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
  if (!result?.data) throw new RequirementsApiError("Unexpected response from the server.");
  return result.data;
}


/**
 * DELETE /requirements/lines/{lineId} — remove a product line.
 * Fails with 409 when the line already has purchase orders or the requirement is closed.
 */
export async function removeRequirementLine(lineId: string): Promise<void> {
  await requirementsRequest<{ success: boolean; data: null }>(
    `/lines/${encodeURIComponent(lineId)}`,
    { method: "DELETE" },
  );
}

/**
 * GET /requirements/lines/{lineId}/order-preview — get order preview for a requirement line.
 * Returns suggested order quantity and current fulfillment state.
 */
export async function getOrderPreview(lineId: string): Promise<OrderPreviewDto> {
  const result = await requirementsRequest<{ success: boolean; data: OrderPreviewDto }>(
    `/lines/${encodeURIComponent(lineId)}/order-preview`,
  );
  if (!result?.data) throw new RequirementsApiError("Unexpected response from the server.");
  return result.data;
}
