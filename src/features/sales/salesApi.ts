// ── Sales API client ─────────────────────────────────────────────────────────
// Talks to the pharmacy backend's point-of-sale sales endpoints:
//   GET  /api/v1/pos/sales            (list sales, paginated & filterable)
//   GET  /api/v1/pos/sales/{id}       (receipt / sale detail)
//   POST /api/v1/pos/sales            (complete a POS sale)
//   POST /api/v1/pos/sales/{id}/cancel (cancel a DRAFT sale)
//
// All requests require the authenticated session cookie
// (HTTP-only — sent automatically with `credentials: "include"`).

import { API_BASE_URL } from "../auth/authApi";
import { invalidateCachePrefix } from "../inventory/apiCache";

// ─── Types (mirror the Swagger response shapes) ──────────────────────────────

export type SaleStatus = "COMPLETED" | "DRAFT" | "CANCELLED" | (string & {});
export type SalePaymentMethod = "CASH" | "CARD" | "DIGITAL_TRANSFER" | (string & {});
export type SaleDiscountType = "PERCENTAGE" | "FIXED" | (string & {});

export interface SaleUserDto {
  id: string;
  name: string;
  email: string;
}

export interface SaleLocationRefDto {
  id: string;
  name: string;
}

export interface SalePaymentDto {
  id: string;
  method: SalePaymentMethod;
  amount: number;
  reference: string | null;
  createdAt: string;
}

export interface SaleBatchAllocationDto {
  id: string;
  batchId: string;
  baseQuantity: number;
  batch: {
    id: string;
    batchNumber: string;
    expiryDate: string | null;
  };
}

export interface SaleItemDto {
  id: string;
  saleId: string;
  productId: string;
  product: {
    id: string;
    name: string;
    sku: string;
    /** Some responses embed the brand. */
    brand?: string;
    /** Narcotic/controlled flag — present on sale-detail item products. */
    isNarcotic?: boolean;
  };
  unitId: string;
  unit: { id: string; name: string; symbol: string };
  quantity: number;
  baseQuantity: number;
  conversionFactor: number;
  originalUnitPrice: number;
  actualUnitPrice: number;
  discountType: SaleDiscountType | null;
  discountValue: number;
  discountAmount: number;
  lineTotal: number;
  batchAllocations: SaleBatchAllocationDto[];
}

export interface SaleDto {
  id: string;
  saleNumber: string;
  locationId: string;
  location: SaleLocationRefDto | null;
  status: SaleStatus;
  subtotal: number;
  totalDiscount: number;
  totalAmount: number;
  paidAmount: number;
  changeAmount: number;
  cashierId: string;
  cashier: SaleUserDto | null;
  notes: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  /** Populated on GET /{id}; may be present (possibly empty) on list rows. */
  items: SaleItemDto[];
  payments: SalePaymentDto[];
}

export interface SaleListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SaleListResult {
  data: SaleDto[];
  meta: SaleListMeta;
}

export interface SalesQuery {
  page?: number;
  limit?: number;
  status?: string;
  locationId?: string;
  /** ISO datetime, e.g. 2026-09-01T00:00:00Z */
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

/** Line item for POST /pos/sales. */
export interface CompleteSaleItemInput {
  productId: string;
  /** ProductUnit row id — from `PosProductDto.units[].id`. */
  unitId: string;
  quantity: number;
  /** Optional price override — omit to use the unit's configured sell price. */
  actualUnitPrice?: number;
}

export type CompleteSalePaymentMethod = "CASH" | "CARD" | "DIGITAL_TRANSFER";

export interface CompleteSalePaymentInput {
  method: CompleteSalePaymentMethod;
  amount: number;
  reference?: string;
}

/** Body for POST /pos/sales. */
export interface CompleteSaleInput {
  /** Location the stock is dispensed from — required by the backend. */
  locationId: string;
  items: CompleteSaleItemInput[];
  payments: CompleteSalePaymentInput[];
  /** Optional bill-level discount applied after summing all line totals. */
  billDiscount?: { type: "PERCENTAGE" | "FIXED_AMOUNT"; value: number };
  notes?: string;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class SalesApiError extends Error {
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
    this.name = "SalesApiError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}

function friendlyStatusMessage(status: number): string {
  switch (status) {
    case 400:
      return "The sale was rejected — check the items, payments, and location.";
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return "You don't have permission to manage sales.";
    case 404:
      return "This sale no longer exists.";
    case 409:
      return "This sale can no longer be modified in its current state.";
    default:
      return `Request failed (HTTP ${status}).`;
  }
}

// ─── Request plumbing ────────────────────────────────────────────────────────

const SALES_BASE = `${API_BASE_URL}/api/v1/pos/sales`;

async function salesRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${SALES_BASE}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new SalesApiError(
      "Cannot reach the server. Please check your connection and try again.",
    );
  }

  if (!res.ok) {
    let message = friendlyStatusMessage(res.status);
    let code: string | undefined;
    let details: Record<string, unknown> | undefined;
    try {
      const body = (await res.json()) as {
        error?: { code?: string; message?: string; details?: Record<string, unknown> };
        message?: string;
      } | null;
      if (body?.error?.message) message = body.error.message;
      else if (body?.message) message = body.message;
      if (body?.error?.code) code = body.error.code;
      if (body?.error?.details) details = body.error.details;
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    throw new SalesApiError(message, { status: res.status, code, details });
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

/** GET /pos/sales — paginated, filterable sales list. */
export async function listSales(query: SalesQuery = {}): Promise<SaleListResult> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({
    page: query.page,
    limit: query.limit,
    status: query.status,
    locationId: query.locationId,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
    search: query.search,
  })) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  const result = await salesRequest<SaleListResult>(qs ? `?${qs}` : "");
  return result ?? { data: [], meta: { page: 1, limit: query.limit ?? 20, total: 0, totalPages: 1 } };
}

/** GET /pos/sales/{id} — receipt / sale detail (items, payments, allocations). */
export async function getSale(id: string): Promise<SaleDto> {
  const result = await salesRequest<{ success: boolean; data: SaleDto }>(
    `/${encodeURIComponent(id)}`,
  );
  if (!result?.data) throw new SalesApiError("Unexpected response from the server.");
  return result.data;
}

/** POST /pos/sales — complete a POS sale and deduct stock. */
export async function completeSale(input: CompleteSaleInput): Promise<SaleDto> {
  const result = await salesRequest<{ success: boolean; data: SaleDto }>("", {
    method: "POST",
    body: JSON.stringify(input),
  });
  // A completed sale deducts stock — drop cached product/stock reads.
  invalidateCachePrefix("product:");
  invalidateCachePrefix("inventory-products:");
  if (!result?.data) throw new SalesApiError("Unexpected response from the server.");
  return result.data;
}

/**
 * POST /pos/sales/{id}/cancel — cancel a DRAFT sale.
 * The backend only allows cancelling sales still in DRAFT status.
 */
export async function cancelSale(id: string, reason: string): Promise<SaleDto> {
  const result = await salesRequest<{ success: boolean; data: SaleDto }>(
    `/${encodeURIComponent(id)}/cancel`,
    { method: "POST", body: JSON.stringify({ reason }) },
  );
  invalidateCachePrefix("product:");
  invalidateCachePrefix("inventory-products:");
  if (!result?.data) throw new SalesApiError("Unexpected response from the server.");
  return result.data;
}
