// ── Expiry API client ────────────────────────────────────────────────────────
// Talks to the pharmacy backend's expiry endpoints:
//   GET  /api/v1/inventory/expiry/dashboard                    (expiry dashboard + summary)
//   GET  /api/v1/inventory/expiry/batches                      (expiring batch list, paginated)
//   GET  /api/v1/inventory/expired-products                    (expired products aggregated per product)
//   GET  /api/v1/inventory/batches/{batchId}/expiry-actions    (action history)
//   POST /api/v1/inventory/batches/{batchId}/expiry-actions    (return / clearance / dispose)
//
// All requests require the authenticated admin session cookie
// (HTTP-only — sent automatically with `credentials: "include"`).

import { API_BASE_URL } from "../auth/authApi";
import { invalidateCachePrefix } from "./apiCache";

// ─── Types (mirror the Swagger response shapes) ──────────────────────────────

export type ExpiryBatchStatus = "EXPIRED" | "CRITICAL" | "WARNING" | "NORMAL" | (string & {});

export interface ExpiryProductRefDto {
  id: string;
  name: string;
  sku: string;
  brand: string;
}

export interface ExpiryStockDto {
  quantity: number;
  location: { id: string; name: string };
}

/** Batch row shared by GET /expiry/dashboard and GET /expiry/batches. */
export interface ExpiryBatchDto {
  id: string;
  batchNumber: string;
  expiryDate: string;
  daysRemaining: number;
  purchaseCost: number;
  status: ExpiryBatchStatus;
  product: ExpiryProductRefDto;
  stock: ExpiryStockDto;
}

/** One expiry window of GET /expiry/dashboard. */
export interface ExpiryWindowDto {
  label: string;
  daysFrom: number;
  daysTo: number;
  batchCount: number;
  totalQuantity: number;
  batches: ExpiryBatchDto[];
}

export interface ExpirySummaryDto {
  expired: number;
  critical: number;
  expiringSoon: number;
  warning: number;
  normal: number;
  totalBatches: number;
  totalQuantity: number;
}

export interface ExpiryDashboardResult {
  windows: ExpiryWindowDto[];
  summary: ExpirySummaryDto;
}

export interface ExpiryListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ExpiryBatchesResult {
  data: ExpiryBatchDto[];
  meta: ExpiryListMeta;
}

export type ExpiryActionType = "RETURN_TO_SUPPLIER" | "DISPOSE" | (string & {});

/** Row of GET /batches/{batchId}/expiry-actions. */
export interface ExpiryActionDto {
  id: string;
  batchId: string;
  actionType: ExpiryActionType;
  quantity: number;
  locationId: string;
  supplierId: string | null;
  discountPercent: number;
  reason: string;
  notes: string | null;
  performedById: string;
  createdAt: string;
}

export interface ExpiryActionsResult {
  data: ExpiryActionDto[];
  meta: ExpiryListMeta;
}

/** Body for POST /batches/{batchId}/expiry-actions. */
export interface CreateExpiryActionInput {
  batchId: string;
  actionType: "RETURN_TO_SUPPLIER" | "DISPOSE";
  quantity: number;
  locationId: string;
  supplierId?: string;
  discountPercent?: number;
  reason: string;
  notes?: string;
}

/** Response of POST /batches/{batchId}/expiry-actions (unwrapped `.data`). */
export interface CreateExpiryActionResult {
  action: ExpiryActionDto;
  stockMovement: {
    id: string;
    transactionType: string;
    direction: "IN" | "OUT" | (string & {});
    quantity: number;
    balanceAfter: number;
    createdAt: string;
  };
  remainingStock: number;
}

export interface ExpiryDashboardQuery {
  thresholds?: [number, number, number] | number[];
  locationId?: string;
  productId?: string;
}

export interface ExpiryBatchesQuery extends ExpiryDashboardQuery {
  windowStart?: number;
  windowEnd?: number;
  page?: number;
  limit?: number;
}

// ─── Expired products (GET /inventory/expired-products) ──────────────────────

/** One expired batch/location row of an expired product. */
export interface ExpiredProductBatchDto {
  id: string;
  batchNumber: string;
  expiryDate: string;
  purchaseCost: number | null;
  quantity: number;
  locationId: string;
  locationName: string;
}

/**
 * A product with expired stock, aggregated across its expired batches —
 * `expiredBatches` carries one row per (batch, location) stock slice.
 */
export interface ExpiredProductDto {
  productId: string;
  productName: string;
  sku: string;
  brand: string | null;
  isNarcotic: boolean;
  batchCount: number;
  totalExpiredQuantity: number;
  expiredBatches: ExpiredProductBatchDto[];
}

export interface ExpiredProductsQuery {
  page?: number;
  limit?: number;
  search?: string;
  locationId?: string;
}

export interface ExpiredProductsResult {
  data: ExpiredProductDto[];
  meta: ExpiryListMeta;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class ExpiryApiError extends Error {
  readonly status: number;
  readonly code?: string;
  /** Per-field validation messages from the backend, when provided. */
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    options: { status: number; code?: string; details?: Record<string, unknown> } = {
      status: 0,
    },
  ) {
    super(message);
    this.name = "ExpiryApiError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}

function friendlyStatusMessage(status: number): string {
  switch (status) {
    case 400:
      return "The expiry action was rejected — check the quantity and fields.";
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return "You don't have permission to manage expiry actions.";
    case 404:
      return "This batch no longer exists.";
    case 409:
      return "This batch was already processed by someone else. Refresh and try again.";
    default:
      return `Request failed (HTTP ${status}).`;
  }
}

async function parseErrorResponse(res: Response): Promise<ExpiryApiError> {
  let message = friendlyStatusMessage(res.status);
  let code: string | undefined;
  let details: Record<string, unknown> | undefined;

  try {
    const body = (await res.json()) as {
      error?: { code?: string; message?: string; details?: Record<string, unknown> };
      message?: string;
      code?: string;
    } | null;
    if (body?.error?.message) message = body.error.message;
    else if (body?.message) message = body.message;
    if (body?.error?.code) code = body.error.code;
    if (body?.error?.details) details = body.error.details;
  } catch {
    // Non-JSON error body — keep the generic message.
  }

  return new ExpiryApiError(message, { status: res.status, code, details });
}

// ─── Request plumbing ────────────────────────────────────────────────────────

const EXPIRY_BASE = `${API_BASE_URL}/api/v1/inventory/expiry`;
const INVENTORY_BASE = `${API_BASE_URL}/api/v1/inventory`;
const BATCHES_BASE = `${API_BASE_URL}/api/v1/inventory/batches`;

async function expiryRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${EXPIRY_BASE}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ExpiryApiError(
      "Cannot reach the server. Please check your connection and try again.",
    );
  }

  if (!res.ok) throw await parseErrorResponse(res);

  const text = await res.text();
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null as T;
  }
}

async function batchExpiryRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BATCHES_BASE}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ExpiryApiError(
      "Cannot reach the server. Please check your connection and try again.",
    );
  }

  if (!res.ok) throw await parseErrorResponse(res);

  const text = await res.text();
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null as T;
  }
}

/** Direct /inventory route (not under /expiry). */
async function inventoryRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${INVENTORY_BASE}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ExpiryApiError(
      "Cannot reach the server. Please check your connection and try again.",
    );
  }

  if (!res.ok) throw await parseErrorResponse(res);

  const text = await res.text();
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null as T;
  }
}

function buildQueryString(query: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * The backend can list the same batch in more than one expiry window
 * (overlapping/cumulative ranges). Windows and lists must render each batch
 * once, so dedupe by batch id before feeding rows to the UI.
 */
export function dedupeBatchesById(batches: ExpiryBatchDto[]): ExpiryBatchDto[] {
  const seen = new Set<string>();
  return batches.filter((b) => {
    if (seen.has(b.id)) return false;
    seen.add(b.id);
    return true;
  });
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

/**
 * GET /inventory/expiry/dashboard — expiry windows + summary.
 * `thresholds` is e.g. [30, 60, 90], sent as `thresholds=30,60,90`.
 */
export async function getExpiryDashboard(
  query: ExpiryDashboardQuery = {},
): Promise<ExpiryDashboardResult> {
  const result = await expiryRequest<{ success: boolean; data: ExpiryDashboardResult }>(
    `/dashboard${buildQueryString({
      thresholds: query.thresholds?.join(","),
      locationId: query.locationId,
      productId: query.productId,
    })}`,
  );
  return result?.data ?? {
    windows: [],
    summary: {
      expired: 0, critical: 0, expiringSoon: 0, warning: 0, normal: 0,
      totalBatches: 0, totalQuantity: 0,
    },
  };
}

/**
 * GET /inventory/expiry/batches — paginated expiring batches.
 * Pass `windowStart`/`windowEnd` to filter a single expiry window.
 */
export async function listExpiryBatches(
  query: ExpiryBatchesQuery = {},
): Promise<ExpiryBatchesResult> {
  const result = await expiryRequest<{
    success: boolean;
    data: ExpiryBatchDto[];
    meta: ExpiryListMeta;
  }>(
    `/batches${buildQueryString({
      thresholds: query.thresholds?.join(","),
      windowStart: query.windowStart,
      windowEnd: query.windowEnd,
      page: query.page,
      limit: query.limit,
      locationId: query.locationId,
      productId: query.productId,
    })}`,
  );
  return result ?? { data: [], meta: { page: 1, limit: query.limit ?? 20, total: 0, totalPages: 1 } };
}

/**
 * GET /inventory/expired-products — products with expired stock, aggregated
 * per product. Supports search (name/generic/brand/sku) and an optional
 * location filter. Distinct from `/expiry/batches`. Unwraps defensively.
 */
export async function listExpiredProducts(
  query: ExpiredProductsQuery = {},
): Promise<ExpiredProductsResult> {
  const result = await inventoryRequest<{
    success: boolean;
    data: ExpiredProductDto[];
    meta: ExpiryListMeta;
  }>(
    `/expired-products${buildQueryString({
      page: query.page,
      limit: query.limit,
      search: query.search,
      locationId: query.locationId,
    })}`,
  );
  if (result?.data) {
    return {
      data: result.data,
      meta: result.meta ?? { page: query.page ?? 1, limit: query.limit ?? 20, total: 0, totalPages: 1 },
    };
  }
  return { data: [], meta: { page: query.page ?? 1, limit: query.limit ?? 20, total: 0, totalPages: 1 } };
}

/** GET /inventory/batches/{batchId}/expiry-actions — action history for a batch. */
export async function getExpiryActions(
  batchId: string,
  query: { page?: number; limit?: number } = {},
): Promise<ExpiryActionsResult> {
  const result = await batchExpiryRequest<{
    success: boolean;
    data: ExpiryActionDto[];
    meta: ExpiryListMeta;
  }>(
    `/${encodeURIComponent(batchId)}/expiry-actions${buildQueryString({
      page: query.page,
      limit: query.limit,
    })}`,
  );
  return result ?? { data: [], meta: { page: 1, limit: query.limit ?? 20, total: 0, totalPages: 1 } };
}

/**
 * POST /inventory/batches/{batchId}/expiry-actions — perform an expiry action
 * (return to supplier / dispose). Clearance maps to `RETURN_TO_SUPPLIER` with
 * a `discountPercent`, or a dedicated backend type when one becomes available.
 */
export async function createExpiryAction(
  batchId: string,
  input: Omit<CreateExpiryActionInput, "batchId">,
): Promise<CreateExpiryActionResult> {
  const result = await batchExpiryRequest<{
    success: boolean;
    data: CreateExpiryActionResult;
  }>(`/${encodeURIComponent(batchId)}/expiry-actions`, {
    method: "POST",
    body: JSON.stringify({ ...input, batchId }),
  });
  invalidateCachePrefix("product:");
  invalidateCachePrefix("inventory-products:");
  if (!result?.data) throw new ExpiryApiError("Unexpected response from the server.");
  return result.data;
}
