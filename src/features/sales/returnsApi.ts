// ── Customer returns API client ───────────────────────────────────────────────
// Talks to the pharmacy backend's point-of-sale customer-return endpoints:
//
//   GET  /api/v1/pos/sales/{id}/returns   (return eligibility for ONE sale — read-only)
//   POST /api/v1/pos/sales/{id}/returns   (create the customer return)
//   GET  /api/v1/pos/returns              (the return register, paginated)
//   GET  /api/v1/pos/returns/{id}         (one specific return)
//
// Every shape below is taken from the live OpenAPI document. Where a value the
// backend computes is absent, it is typed as optional and rendered as "—" — it
// is never reconstructed in the browser.
//
// Three backend rules shape this client and must not be worked around:
//
//  1. NO refund amount is sent. `SaleReturnCreateInput` has no money field at
//     all: the backend derives every refund from the ORIGINAL sale values
//     (original price, the line's proportional share of the bill-level discount,
//     and the quantity actually returned). A refund is therefore never computed
//     here from today's ProductUnit price.
//  2. NO location is sent. Stock is always restored to the ORIGINAL sale
//     location, so there is no location field on the create body and no
//     location picker on the return screen.
//  3. The original sale is never modified. Return history is recorded
//     separately against the exact original sale item.
//
// All requests require the authenticated session cookie
// (HTTP-only — sent automatically with `credentials: "include"`).

import { API_BASE_URL } from "../auth/authApi";
import type { SaleStatus } from "./salesApi";

// ─── Types (mirror the Swagger response shapes) ──────────────────────────────

/**
 * Refund methods the create endpoint accepts. This is exactly the published
 * `refundMethod` enum on `SaleReturnCreateInput` and on `SaleReturn`:
 * `CASH | MOBILE_TRANSFER | CHECK`.
 *
 * There is no `CARD`, no `DIGITAL_TRANSFER` and no `CREDIT` — a refund is a
 * payout in the same three instruments as a sale payment, and "credit" is a
 * balance, never a method.
 *
 * `REFUND_METHOD_OPTIONS` is the single source for that enum so the create form
 * and the register filter can never drift apart from each other or grow a value
 * the backend would reject with a 422.
 */
export type RefundMethod = "CASH" | "MOBILE_TRANSFER" | "CHECK";

export const REFUND_METHOD_OPTIONS: readonly RefundMethod[] = [
  "CASH",
  "MOBILE_TRANSFER",
  "CHECK",
];

export interface ReturnUserRef {
  id: string;
  name: string;
  email: string;
}

export interface ReturnLocationRef {
  id: string;
  name: string;
}

/** The ORIGINAL sale, as embedded in a return. `totalAmount` is never reduced. */
export interface ReturnSaleRef {
  id: string;
  saleNumber: string;
  status: SaleStatus;
  totalAmount: number;
}

/**
 * A batch movement on one returned line. `batch` nests the batch itself, and
 * carries only what the API publishes — no expiry-status flag is invented here
 * (the register view cannot know whether a batch has since expired).
 */
export interface ReturnItemBatchAllocation {
  batchId: string;
  baseQuantity: number;
  batch: { id: string; batchNumber: string; expiryDate: string | null };
}

/** One returned line, referencing the exact original sale item it came from. */
export interface ReturnItem {
  id: string;
  saleItemId: string;
  productId: string;
  product: { id: string; name: string; sku: string } | null;
  unitId: string;
  unit: { id: string; name: string; symbol: string | null } | null;
  /** Quantity in the sale's unit — the unit the cashier selects against. */
  quantity: number;
  /** The same quantity in base units, as the backend computed it. */
  baseQuantity: number;
  unitPrice: number;
  netUnitPrice: number;
  refundAmount: number;
  restock: boolean;
  reason: string | null;
  createdAt: string;
  batchAllocations: ReturnItemBatchAllocation[];
}

/** A customer return. */
export interface SaleReturn {
  id: string;
  returnNumber: string;
  saleId: string;
  sale: ReturnSaleRef | null;
  locationId: string;
  /** Always the ORIGINAL sale location. */
  location: ReturnLocationRef | null;
  refundAmount: number;
  refundMethod: RefundMethod | (string & {});
  refundReference: string | null;
  reason: string | null;
  notes: string | null;
  createdById: string;
  createdBy: ReturnUserRef | null;
  createdAt: string;
  items: ReturnItem[];
}

/**
 * A batch the line was originally sold from, with how much of it has already
 * been returned. FLAT shape — `batchNumber` sits directly on the allocation,
 * unlike `ReturnItemBatchAllocation`.
 */
export interface ReturnInfoBatchAllocation {
  batchId: string;
  batchNumber: string;
  expiryDate: string | null;
  expired: boolean;
  baseQuantity: number;
  baseQuantityReturned: number;
  baseQuantityReturnable: number;
}

/**
 * One original sale line, as seen through the return screen.
 *
 * `quantityReturnable` is the hard ceiling the cashier may select — the backend
 * recomputes it inside its own transaction, but the UI must never offer more
 * than this value. `amountReturnable` is the backend's own money figure for the
 * whole remaining returnable amount on the line; it is displayed, never
 * recomputed.
 */
export interface ReturnInfoItem {
  saleItemId: string;
  product: { id: string; name: string; sku: string; isNarcotic: boolean } | null;
  unit: { id: string; name: string; symbol: string | null } | null;
  quantitySold: number;
  baseQuantitySold: number;
  quantityReturned: number;
  quantityReturnable: number;
  baseQuantityReturned: number;
  baseQuantityReturnable: number;
  originalUnitPrice: number;
  actualUnitPrice: number;
  lineTotal: number;
  billDiscountShare: number;
  netLineTotal: number;
  netUnitPrice: number;
  /** Money already refunded on this line. */
  amountRefunded: number;
  /** Money still refundable on this line. */
  amountReturnable: number;
  batchAllocations: ReturnInfoBatchAllocation[];
}

/** Everything the return screen needs for one sale. Read-only. */
export interface SaleReturnInfo {
  sale: {
    id: string;
    saleNumber: string;
    status: SaleStatus;
    /** The backend's own answer — true only for a COMPLETED sale. */
    returnable: boolean;
    location: { id: string; name: string; isActive: boolean } | null;
    subtotal: number;
    totalDiscount: number;
    totalAmount: number;
    completedAt: string | null;
  };
  items: ReturnInfoItem[];
  /** Previous returns against this sale. */
  returns: SaleReturn[];
  totalRefunded: number;
}

/** One line of POST /pos/sales/{id}/returns. */
export interface SaleReturnItemInput {
  saleItemId: string;
  /** Must be > 0 and <= the line's `quantityReturnable`. */
  quantity: number;
  /** Omit to leave it to the backend's own default. */
  restock?: boolean;
  /** Line-level reason. */
  reason?: string;
}

/** Body for POST /pos/sales/{id}/returns. */
export interface SaleReturnCreateInput {
  items: SaleReturnItemInput[];
  refundMethod: RefundMethod;
  /** Optional reference (e.g. cheque number or transfer ref). */
  refundReference?: string;
  /** Return-level reason. */
  reason?: string;
  notes?: string;
  /**
   * Backend-supported idempotency key. Re-sending the SAME key returns the
   * original return instead of creating a second refund and stock movement.
   */
  idempotencyKey?: string;
}

export interface ReturnListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ReturnListResult {
  data: SaleReturn[];
  meta: ReturnListMeta;
  /**
   * The backend's own refund total for the whole filtered set. Kept as supplied
   * and never recomputed from the rows on the current page.
   */
  summary: { refundAmount: number } | null;
}

/**
 * Query parameters for GET /pos/returns. This is the complete, documented set —
 * there is NO `search`, so no search box is offered on the return register.
 *
 * `restock` is a STRING enum (`true` | `false`) in the API, not a boolean, so it
 * is typed as the literal strings the backend accepts.
 */
export interface ReturnsQuery {
  page?: number;
  limit?: number;
  saleId?: string;
  locationId?: string;
  /** Only returns containing this product. */
  productId?: string;
  refundMethod?: RefundMethod;
  restock?: "true" | "false";
  /** ISO datetime, e.g. 2026-09-01T00:00:00Z */
  dateFrom?: string;
  dateTo?: string;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class ReturnsApiError extends Error {
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
    this.name = "ReturnsApiError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}

function friendlyStatusMessage(status: number): string {
  switch (status) {
    case 400:
      return "The return request was rejected.";
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return "You are not authorized to process customer returns.";
    case 404:
      return "The sale or return no longer exists.";
    case 409:
      return "This sale can no longer be returned — it may have been changed since it was loaded.";
    default:
      return `Request failed (HTTP ${status}).`;
  }
}

// ─── Request plumbing ────────────────────────────────────────────────────────

/** Shared `/pos` prefix so the sale-scoped and register-scoped paths sit together. */
const POS_BASE = `${API_BASE_URL}/api/v1/pos`;

async function returnsRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${POS_BASE}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ReturnsApiError(
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
    throw new ReturnsApiError(message, { status: res.status, code, details });
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

/**
 * GET /pos/sales/{id}/returns — return eligibility for one sale.
 *
 * Read-only: it creates nothing and authorises nothing. Its own description is
 * explicit that the create endpoint recomputes everything inside its own
 * transaction, so a value read here is a display value, not a guarantee.
 */
export async function getSaleReturnInfo(saleId: string): Promise<SaleReturnInfo> {
  const result = await returnsRequest<{ success: boolean; data: SaleReturnInfo }>(
    `/sales/${encodeURIComponent(saleId)}/returns`,
  );
  if (!result?.data) throw new ReturnsApiError("Unexpected response from the server.");
  return result.data;
}

/**
 * POST /pos/sales/{id}/returns — actually process a customer return.
 *
 * The backend does all of this in one transaction: it validates the sale is
 * COMPLETED, locks the requested sale items, recomputes already-returned
 * quantities, validates the requested quantities, computes the refund from the
 * ORIGINAL sale values, creates the return and its items, records the refund
 * and restores inventory when `restock` is true — all or nothing.
 */
export async function createSaleReturn(
  saleId: string,
  input: SaleReturnCreateInput,
): Promise<SaleReturn> {
  const result = await returnsRequest<{ success: boolean; data: SaleReturn }>(
    `/sales/${encodeURIComponent(saleId)}/returns`,
    { method: "POST", body: JSON.stringify(input) },
  );
  if (!result?.data) throw new ReturnsApiError("Unexpected response from the server.");
  return result.data;
}

/** GET /pos/returns — the return register: paginated rows plus a refund total. */
export async function listReturns(query: ReturnsQuery = {}): Promise<ReturnListResult> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({
    page: query.page,
    limit: query.limit,
    saleId: query.saleId,
    locationId: query.locationId,
    productId: query.productId,
    refundMethod: query.refundMethod,
    // `restock` is a string enum on the wire — send the literal, never a boolean.
    restock: query.restock,
    dateFrom: query.dateFrom,
    dateTo: query.dateTo,
  })) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  const result = await returnsRequest<ReturnListResult>(qs ? `/returns?${qs}` : "/returns");
  return (
    result ?? {
      data: [],
      meta: { page: 1, limit: query.limit ?? 20, total: 0, totalPages: 1 },
      summary: null,
    }
  );
}

/** GET /pos/returns/{id} — one return with its items and restocked batches. */
export async function getReturn(id: string): Promise<SaleReturn> {
  const result = await returnsRequest<{ success: boolean; data: SaleReturn }>(
    `/returns/${encodeURIComponent(id)}`,
  );
  if (!result?.data) throw new ReturnsApiError("Unexpected response from the server.");
  return result.data;
}

// ─── Idempotency ─────────────────────────────────────────────────────────────

/**
 * A fresh idempotency key for ONE logical return submission.
 *
 * The caller must hold this value for the life of a submission attempt and reuse
 * it on every retry — a retry after a timeout, a 409 or a network failure must
 * NOT mint a new key, or the backend is free to treat it as a brand-new return
 * and refund twice. A new key belongs only to a genuinely new return (a fresh
 * screen for a fresh sale).
 *
 * Built with `crypto.getRandomValues` rather than `crypto.randomUUID` because
 * `randomUUID` is restricted to secure contexts, and this app is also served
 * over plain HTTP on a LAN. The value is a random RFC 4122 v4 string; the
 * backend treats it as an opaque token.
 */
export function newReturnIdempotencyKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}
