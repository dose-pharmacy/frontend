// ── Stock API client ─────────────────────────────────────────────────────────
// Talks to the pharmacy backend's inventory stock endpoints:
//   GET    /api/v1/inventory/stock                        (stock rows, paginated)
//   GET    /api/v1/inventory/location-stock               (stock grouped by product/location)
//   GET    /api/v1/inventory/products/{productId}/stock    (stock of one product)
//   GET    /api/v1/inventory/products/{productId}/transactions (product tx ledger)
//   GET    /api/v1/inventory/batches/{id}/transactions     (batch tx ledger)
//   GET    /api/v1/inventory/bin-card                      (bin card for product+batch)
//   POST   /api/v1/inventory/opening-stock                 (record opening stock)
//   POST   /api/v1/inventory/stock-adjustments             (stock adjustments)
//
// All requests require the authenticated admin session cookie
// (HTTP-only — sent automatically with `credentials: "include"`).

import { API_BASE_URL } from "../auth/authApi";

// ─── Types (mirror the Swagger response shapes) ──────────────────────────────

export interface StockRowDto {
  id: string;
  productId: string;
  batchId: string;
  locationId: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  product?: { id: string; name?: string; sku?: string; baseUnit?: { id: string; name?: string } | null } | Record<string, never>;
  batch?: { id: string; batchNumber?: string; expiryDate?: string; receivedDate?: string } | Record<string, never>;
  location?: { id: string; name?: string } | Record<string, never>;
  baseUnit?: { id: string; name?: string } | Record<string, never>;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface StockListResult {
  data: StockRowDto[];
  pagination: PaginationMeta;
}

export interface LocationStockGroupDto {
  product: { id: string; name?: string; sku?: string } | Record<string, never>;
  locations: { locationId: string; locationName: string; quantity: number }[];
  totalQuantity: number;
}

export interface LocationStockResult {
  data: LocationStockGroupDto[];
  pagination: PaginationMeta;
}

export interface ProductStockRowDto {
  productId: string;
  batchId: string;
  locationId: string;
  quantity: number;
  availableQuantity: number;
  batch?: { id: string; batchNumber?: string; expiryDate?: string } | Record<string, never>;
  location?: { id: string; name?: string } | Record<string, never>;
  baseUnit?: { id: string; name?: string } | Record<string, never>;
}

export type TransactionTypeDto =
  | "RECEIPT"
  | "TRANSFER"
  | "SALE"
  | "ADJUSTMENT"
  | "OPENING"
  | "DISPOSAL"
  | "RETURN";

export type TransactionDirectionDto = "IN" | "OUT";

export interface StockTransactionDto {
  id: string;
  transactionType: TransactionTypeDto;
  direction: TransactionDirectionDto;
  quantity: number;
  balanceAfter: number;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  createdAt: string;
  productId: string;
  batchId: string | null;
  locationId: string;
  product?: { id: string; name?: string; sku?: string } | Record<string, never>;
  batch?: { id: string; batchNumber?: string } | Record<string, never>;
  location?: { id: string; name?: string } | Record<string, never>;
  baseUnit?: { id: string; name?: string } | Record<string, never>;
  createdBy?: { id: string; name?: string } | Record<string, never>;
}

export interface StockTransactionListResult {
  data: StockTransactionDto[];
  pagination?: PaginationMeta;
}

export interface BinCardTransactionDto {
  transactionId: string;
  date: string;
  reference: string;
  transactionType: TransactionTypeDto;
  direction: TransactionDirectionDto;
  in: number;
  out: number;
  balance: number;
  notes: string | null;
  batch?: { id: string; batchNumber?: string } | Record<string, never>;
  costPrice: number | null;
  user?: { id: string; name?: string } | Record<string, never>;
}

export interface BinCardResult {
  baseUnit?: { id: string; name?: string } | Record<string, never> | null;
  openingBalance: number;
  transactions: BinCardTransactionDto[];
  closingBalance: number;
}

/** Body for POST /inventory/opening-stock. */
export interface OpeningStockInput {
  productId: string;
  batchId: string;
  locationId: string;
  quantity: number;
  unitId: string;
  notes?: string;
}

/** Response of POST /inventory/opening-stock (unwrapped `.data` payload). */
export interface OpeningStockDto {
  id: string;
  productId: string;
  batchId: string;
  locationId: string;
  quantity: number;
  unitId: string;
  notes: string | null;
}

/**
 * Body for POST /inventory/stock-adjustments.
* NOTE: Exact request schema not yet confirmed from Swagger — keep payloads
 * minimal and validate against the live backend before extending.
 */
export interface StockAdjustmentInput {
  productId: string;
  batchId: string;
  locationId: string;
  direction: "IN" | "OUT";
  quantity: number;
  unitId: string;
  reason: string;
  notes?: string;
}

export interface StockAdjustmentResultDto {
  transaction: {
    id: string; productId: string; batchId: string; locationId: string;
    transactionType: string; direction: "IN" | "OUT";
    quantity: number; balanceAfter: number;
  };
  stock: { id: string; quantity: number };
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class StockApiError extends Error {
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
    this.name = "StockApiError";
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
      return "You don't have permission to view or manage stock.";
    case 404:
      return "The requested stock record no longer exists.";
    default:
      return `Request failed (HTTP ${status}).`;
  }
}

async function parseErrorResponse(res: Response): Promise<StockApiError> {
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

  return new StockApiError(message, { status: res.status, code, details });
}

// ─── Request plumbing ────────────────────────────────────────────────────────

const STOCK_BASE = `${API_BASE_URL}/api/v1/inventory`;

async function stockRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${STOCK_BASE}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new StockApiError(
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

/** GET /inventory/stock — paginated stock rows. */
export async function getStock(query: {
  page?: number;
  limit?: number;
  productId?: string;
  batchId?: string;
  locationId?: string;
  search?: string;
} = {}): Promise<StockListResult> {
  const qs = buildQueryString({
    page: query.page,
    limit: query.limit,
    productId: query.productId,
    batchId: query.batchId,
    locationId: query.locationId,
    search: query.search,
  });
  const result = await stockRequest<StockListResult>(`/stock${qs}`);
  return (
    result ?? {
      data: [],
      pagination: { page: query.page ?? 1, limit: query.limit ?? 10, total: 0, totalPages: 1 },
    }
  );
}

/** GET /inventory/location-stock — stock grouped by product/location. */
export async function getLocationStock(
  query: { locationId?: string; page?: number; limit?: number } = {},
): Promise<LocationStockResult> {
  const qs = buildQueryString({
    locationId: query.locationId,
    page: query.page,
    limit: query.limit,
  });
  const result = await stockRequest<LocationStockResult>(`/location-stock${qs}`);
  return (
    result ?? {
      data: [],
      pagination: { page: query.page ?? 1, limit: query.limit ?? 10, total: 0, totalPages: 1 },
    }
  );
}

/** GET /inventory/products/{productId}/stock — all stock rows of one product. */
export async function getProductStock(productId: string): Promise<{ data: ProductStockRowDto[] }> {
  const result = await stockRequest<{ data: ProductStockRowDto[] }>(
    `/products/${encodeURIComponent(productId)}/stock`,
  );
  return result ?? { data: [] };
}

/** GET /inventory/products/{productId}/transactions — ledger of one product. */
export async function getProductTransactions(
  productId: string,
  query: { page?: number; limit?: number } = {},
): Promise<StockTransactionListResult> {
  const qs = buildQueryString({ page: query.page, limit: query.limit });
  const result = await stockRequest<StockTransactionListResult>(
    `/products/${encodeURIComponent(productId)}/transactions${qs}`,
  );
  return result ?? { data: [] };
}

/** GET /inventory/batches/{id}/transactions — ledger of one batch. */
export async function getBatchTransactions(
  batchId: string,
  query: { page?: number; limit?: number } = {},
): Promise<StockTransactionListResult> {
  const qs = buildQueryString({ page: query.page, limit: query.limit });
  const result = await stockRequest<StockTransactionListResult>(
    `/batches/${encodeURIComponent(batchId)}/transactions${qs}`,
  );
  return result ?? { data: [] };
}

/**
 * GET /inventory/bin-card — bin card for a product (optionally per batch).
 * Swagger shows query params for product/batch selection; pass at least the
 * batch the UI opened the card for.
 */
export async function getBinCard(
  query: { 
    productId: string; 
    locationId: string;
    batchId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  },
): Promise<BinCardResult> {
  const qs = buildQueryString(query as Record<string, string | number | undefined>);
  const result = await stockRequest<BinCardResult>(`/bin-card${qs}`);
  return (
    result ?? {
      baseUnit: null,
      openingBalance: 0,
      transactions: [],
      closingBalance: 0,
    }
  );
}

/** POST /inventory/opening-stock — record stock already physically available. */
export interface OpeningStockResultDto {
  transaction: {
    id: string; productId: string; batchId: string; locationId: string;
    transactionType: string; direction: "IN" | "OUT";
    quantity: number; balanceAfter: number;
  };
  stock: { id: string; quantity: number };
}

export async function createOpeningStock(input: OpeningStockInput): Promise<OpeningStockResultDto> {
  const result = await stockRequest<{ success: boolean; data: OpeningStockResultDto }>(
    "/opening-stock",
    {
      method: "POST",
      body: JSON.stringify({
        productId: input.productId,
        batchId: input.batchId,
        locationId: input.locationId,
        quantity: input.quantity,
        unitId: input.unitId,
        ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
      }),
    },
  );
  if (!result?.data) throw new StockApiError("Unexpected response from the server.");
  return result.data;
}

/**
 * POST /inventory/stock-adjustments — adjust recorded stock.
* NOTE: Exact request/response schema unconfirmed — adjust the payload once the
 * Swagger definition is available.
 */
export async function createStockAdjustment(
  input: StockAdjustmentInput,
): Promise<StockAdjustmentResultDto> {
  const result = await stockRequest<{ success: boolean; data: StockAdjustmentResultDto }>(
    "/stock-adjustments",
    { method: "POST", body: JSON.stringify(input) },
  );
  if (!result?.data) throw new StockApiError("Unexpected response from the server.");
  return result.data;
}
