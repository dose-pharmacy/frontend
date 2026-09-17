// ── Batches API client ───────────────────────────────────────────────────────
// Talks to the pharmacy backend's inventory batch endpoints:
//   GET    /api/v1/inventory/products/{productId}/batches  (batches of one product)
//   GET    /api/v1/inventory/batches                       (list, paginated & filterable)
//   POST   /api/v1/inventory/batches                       (create)
//   GET    /api/v1/inventory/batches/{id}                  (get one)
//   PATCH  /api/v1/inventory/batches/{id}                  (update — batchNumber REQUIRED)
//   DELETE /api/v1/inventory/batches/{id}                  (soft delete → deactivate)
//
// All requests require the authenticated admin session cookie
// (HTTP-only — sent automatically with `credentials: "include"`).

import { API_BASE_URL } from "../auth/authApi";

// ─── Types (mirror the backend response shapes) ──────────────────────────────

export type BatchStatusDto = "AVAILABLE" | "LOW_STOCK" | "DEPLETED" | "EXPIRED";

/** `product` as embedded in list/get batch responses. */
export interface BatchProductRefDto {
  id: string;
  name: string;
  /** Only present on get-one responses. */
  genericName?: string | null;
  brand: string | null;
  sku: string;
}

/** Row of GET /inventory/batches and GET /inventory/products/{id}/batches. */
export interface BatchDto {
  id: string;
  productId: string;
  batchNumber: string;
  manufacturingDate: string | null;
  receivedDate: string | null;
  expiryDate: string;
  purchaseCost: number | null;
  supplierReference: string | null;
  createdAt: string;
  updatedAt: string;
  product: BatchProductRefDto;
  totalQuantity: number;
  status: BatchStatusDto;
  daysUntilExpiry: number;
}

/** Row of GET /inventory/batches/{id} — adds per-location stock. */
export interface BatchDetailDto extends BatchDto {
  locationStock: { locationId: string; locationName: string; quantity: number }[];
}

/** Body for POST /inventory/batches. */
export interface CreateBatchInput {
  productId: string;
  batchNumber: string;
  receivedDate: string; // "YYYY-MM-DD"
  expiryDate: string; // "YYYY-MM-DD"
  purchaseCost?: number;
  supplierReference?: string;
}

/**
 * Body for PATCH /inventory/batches/{id}.
 * ⚠️ The backend requires `batchNumber` on every PATCH even though this is a
 * partial update — callers must pass the existing batch number through.
 */
export interface UpdateBatchInput {
  batchNumber: string;
  receivedDate?: string;
  expiryDate?: string;
  purchaseCost?: number | null;
  supplierReference?: string | null;
}

export interface BatchesQuery {
  page?: number;
  limit?: number;
  productId?: string;
  locationId?: string;
  search?: string;
  status?: BatchStatusDto;
  expiresBefore?: string;
  expiresAfter?: string;
}

export interface ProductBatchesQuery {
  page?: number;
  limit?: number;
  locationId?: string;
}

export interface ListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface BatchListResult {
  data: BatchDto[];
  meta: ListMeta;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class BatchesApiError extends Error {
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
    this.name = "BatchesApiError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}

function friendlyStatusMessage(status: number): string {
  switch (status) {
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return "You don't have permission to manage batches.";
    case 404:
      return "This batch no longer exists.";
    case 409:
      return "A batch with that batch number already exists for this product.";
    default:
      return `Request failed (HTTP ${status}).`;
  }
}

async function parseErrorResponse(res: Response): Promise<BatchesApiError> {
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

  return new BatchesApiError(message, { status: res.status, code, details });
}

// ─── Request plumbing ────────────────────────────────────────────────────────

const BATCHES_BASE = `${API_BASE_URL}/api/v1/inventory/batches`;
const PRODUCT_BATCHES_BASE = `${API_BASE_URL}/api/v1/inventory/products`;

async function batchesRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
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
    throw new BatchesApiError(
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

async function productBatchesRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${PRODUCT_BATCHES_BASE}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new BatchesApiError(
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

// ─── Endpoints ───────────────────────────────────────────────────────────────

/**
 * GET /inventory/products/{productId}/batches — batches belonging to one
 * product, with optional pagination & location filter.
 */
export async function listProductBatches(
  productId: string,
  query: ProductBatchesQuery = {},
): Promise<BatchListResult> {
  const qs = buildQueryString({
    page: query.page,
    limit: query.limit,
    locationId: query.locationId,
  });
  const result = await productBatchesRequest<BatchListResult>(
    `/${encodeURIComponent(productId)}/batches${qs}`,
  );
  return (
    result ?? {
      data: [],
      meta: { page: 1, limit: query.limit ?? 20, total: 0, totalPages: 1 },
    }
  );
}

/** GET /inventory/batches — all batches with optional pagination & filters. */
export async function listBatches(query: BatchesQuery = {}): Promise<BatchListResult> {
  const qs = buildQueryString({
    page: query.page,
    limit: query.limit,
    productId: query.productId,
    locationId: query.locationId,
    search: query.search,
    status: query.status,
    expiresBefore: query.expiresBefore,
    expiresAfter: query.expiresAfter,
  });
  const result = await batchesRequest<BatchListResult>(qs);
  return (
    result ?? {
      data: [],
      meta: { page: 1, limit: query.limit ?? 20, total: 0, totalPages: 1 },
    }
  );
}

/** POST /inventory/batches — create a new batch. */
export async function createBatch(input: CreateBatchInput): Promise<BatchDto> {
  const result = await batchesRequest<{ data: BatchDto }>("", {
    method: "POST",
    body: JSON.stringify({
      productId: input.productId,
      batchNumber: input.batchNumber.trim(),
      receivedDate: input.receivedDate,
      expiryDate: input.expiryDate,
      ...(input.purchaseCost != null ? { purchaseCost: input.purchaseCost } : {}),
      ...(input.supplierReference?.trim()
        ? { supplierReference: input.supplierReference.trim() }
        : {}),
    }),
  });
  return result.data;
}

/** GET /inventory/batches/{id} — single batch incl. product & location stock. */
export async function getBatch(id: string): Promise<BatchDetailDto> {
  const result = await batchesRequest<{ data: BatchDetailDto }>(
    `/${encodeURIComponent(id)}`,
  );
  return result.data;
}

/**
 * PATCH /inventory/batches/{id} — update a batch.
 * ⚠️ `batchNumber` is required by the backend (not truly optional) — pass the
 * batch's current number through unchanged unless it is being renamed.
 */
export async function updateBatch(
  id: string,
  input: UpdateBatchInput,
): Promise<BatchDto> {
  const body: Record<string, unknown> = {
    batchNumber: input.batchNumber.trim(),
  };
  if (input.receivedDate !== undefined) body.receivedDate = input.receivedDate;
  if (input.expiryDate !== undefined) body.expiryDate = input.expiryDate;
  if (input.purchaseCost !== undefined) body.purchaseCost = input.purchaseCost;
  if (input.supplierReference !== undefined)
    body.supplierReference = input.supplierReference?.trim() || null;

  const result = await batchesRequest<{ data: BatchDto }>(
    `/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
  return result.data;
}

/**
 * DELETE /inventory/batches/{id} — soft delete (deactivate).
 * The backend's Swagger response example looks copy-pasted (shows a location
 * shape), so — like the Products/Locations clients — we don't trust the
 * response body and let the caller refresh from the list.
 */
export async function deactivateBatch(id: string): Promise<void> {
  await batchesRequest<unknown>(`/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
