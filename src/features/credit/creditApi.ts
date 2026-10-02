// ── Credit API client ─────────────────────────────────────────────────────────
// Talks to the pharmacy backend's customer-receivables endpoints:
//
//   GET /api/v1/financials/credit-sales       (list credit sales, paginated & filterable)
//   GET /api/v1/financials/credit-sales/{id}  (credit sale detail: items + payment history)
//
// Collecting money is NOT done here. A payment is recorded against the underlying
// POS sale with POST /api/v1/pos/sales/{id}/payments (see features/sales/salesApi)
// and this client re-reads the credit record afterwards, so the backend stays the
// single source of truth for every balance.
//
// All requests require the authenticated session cookie
// (HTTP-only — sent automatically with `credentials: "include"`).

import { API_BASE_URL } from "../auth/authApi";
import type { RecordSalePaymentMethod } from "../sales/salesApi";

// ─── Types (mirror the Swagger response shapes) ──────────────────────────────

/**
 * A credit sale's payment state. This is a REAL backend enum returned as
 * `paymentStatus` — these three values are not derived client-side.
 *
 * It is NOT the same axis as `Sale.status` (DRAFT | COMPLETED | CANCELLED), and
 * it is NOT a payment method. "CREDIT" is deliberately absent everywhere: an
 * unpaid remainder is a balance, never a method of payment.
 */
export type CreditPaymentStatus = "OUTSTANDING" | "PARTIALLY_PAID" | "PAID";

/** Values accepted by the list endpoint's `status` query parameter. */
export type CreditStatusFilter = CreditPaymentStatus | "ALL";

export interface CreditLocationRef {
  id: string;
  name: string;
}

export interface CreditUserRef {
  id: string;
  name: string;
  email: string;
}

/** A payment recorded against a credit sale. */
export interface CreditPaymentRecord {
  id: string;
  /** Raw backend value. Labels are resolved in the UI; never invent one. */
  method: string;
  amount: number;
  reference: string | null;
  createdAt: string;
}

/**
 * FEFO batch allocation as returned by the credit endpoints. Note this is a
 * FLAT shape (`batchNumber` sits directly on the allocation) — unlike
 * `SaleItem.batchAllocations`, which nests a `batch` object.
 */
export interface CreditBatchAllocation {
  batchId: string;
  batchNumber: string | null;
  expiryDate: string | null;
  baseQuantity: number;
}

export interface CreditSaleItem {
  id: string;
  product: { id: string; name: string; sku: string; isNarcotic?: boolean } | null;
  unit: { id: string; name: string; symbol: string | null } | null;
  quantity: number;
  baseQuantity: number;
  lineTotal: number;
  originalUnitPrice: number | null;
  actualUnitPrice: number | null;
  conversionFactor: number | null;
  batchAllocations: CreditBatchAllocation[] | null;
}

/** One row of GET /financials/credit-sales. */
export interface CreditSaleListItem {
  id: string;
  saleNumber: string;
  customerName: string | null;
  customerPhone: string | null;
  saleDate: string;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  paymentStatus: CreditPaymentStatus;
  location: CreditLocationRef | null;
  payments: CreditPaymentRecord[];
}

/** GET /financials/credit-sales/{id}. */
export interface CreditSaleDetail extends Omit<CreditSaleListItem, "payments"> {
  cashier: CreditUserRef | null;
  items: CreditSaleItem[] | null;
  payments: CreditPaymentRecord[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CreditSaleListResult {
  data: CreditSaleListItem[];
  meta: PaginationMeta;
}

export interface CreditSalesQuery {
  page?: number;
  limit?: number;
  /** Exact customer-name match filter. Separate from customerPhone by design. */
  customerName?: string;
  /** Exact customer-phone match filter. */
  customerPhone?: string;
  /** Exact sale-number match filter. */
  saleNumber?: string;
  status?: CreditStatusFilter;
  locationId?: string;
  /** ISO datetime, e.g. 2026-09-01T00:00:00Z */
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Body accepted by POST /pos/sales/{id}/payments, re-declared here so the Credit
 * page documents the contract it depends on. The call itself is made through the
 * sales client — there is exactly one implementation of it.
 */
export type RecordCreditPaymentMethod = RecordSalePaymentMethod;

// ─── Errors ──────────────────────────────────────────────────────────────────

export class CreditApiError extends Error {
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
    this.name = "CreditApiError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}

function friendlyStatusMessage(status: number): string {
  switch (status) {
    case 400:
      return "The request was rejected — check the filters and try again.";
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return "You don't have permission to view credit balances.";
    case 404:
      return "This credit sale no longer exists.";
    case 409:
      return "This credit balance can no longer be modified in its current state.";
    default:
      return `Request failed (HTTP ${status}).`;
  }
}

// ─── Request plumbing ────────────────────────────────────────────────────────

const CREDIT_BASE = `${API_BASE_URL}/api/v1/financials/credit-sales`;

async function creditRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${CREDIT_BASE}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new CreditApiError(
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
    throw new CreditApiError(message, { status: res.status, code, details });
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

/** GET /financials/credit-sales — paginated, filterable credit sales list. */
export async function listCreditSales(query: CreditSalesQuery = {}): Promise<CreditSaleListResult> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({
    page: query.page,
    limit: query.limit,
    customerName: query.customerName,
    customerPhone: query.customerPhone,
    saleNumber: query.saleNumber,
    status: query.status,
    locationId: query.locationId,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  })) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  const result = await creditRequest<CreditSaleListResult>(qs ? `?${qs}` : "");
  return (
    result ?? {
      data: [],
      meta: { page: 1, limit: query.limit ?? 20, total: 0, totalPages: 1 },
    }
  );
}

/** GET /financials/credit-sales/{id} — balance, items and payment history. */
export async function getCreditSale(id: string): Promise<CreditSaleDetail> {
  const result = await creditRequest<{ success: boolean; data: CreditSaleDetail }>(
    `/${encodeURIComponent(id)}`,
  );
  if (!result?.data) throw new CreditApiError("Unexpected response from the server.");
  return result.data;
}