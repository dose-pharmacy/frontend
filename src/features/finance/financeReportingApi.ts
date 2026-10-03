// ── Finance Reporting API client ─────────────────────────────────────────────
// Talks to the pharmacy backend's Finance Reporting endpoints:
//   GET /api/v1/finance-reporting/report      (from, to, locationId, productGroupId, granularity)
//   GET /api/v1/finance-reporting/trends      (same query parameters)
//   GET /api/v1/finance-reporting/dashboard  (no filters)
//
// All three require the authenticated session cookie (HTTP-only — sent
// automatically with `credentials: "include"`) and are ADMIN-only server-side.
// Authorisation is not enforced here: hiding or disabling a tab is not the
// security boundary, so a 401/403 surfaces through the shared error path.
//
// SCOPE: `/report` is the single primary data source for the Finance tab and
// already embeds its own `trends` block, so the dedicated `/trends` endpoint is
// deliberately NOT called by the Finance page — that would be a second request
// for information the report already returned (§16).
//
// No field in this file is optional-by-convenience: every property mirrors the
// OpenAPI schema, which declares none of them `required`, so they are modelled
// as optional and callers format an absent value as "—" rather than as 0.

import { API_BASE_URL } from "../auth/authApi";

const FINANCE_REPORTING_BASE = `${API_BASE_URL}/api/v1/finance-reporting`;

// ─── Shared types ────────────────────────────────────────────────────────────

/** Report bucket width. Note this is NOT the legacy reports `period` enum. */
export type FinanceGranularity = "DAY" | "MONTH" | "YEAR";

/** Whether a section describes the requested scope or the whole company. */
export type FinanceSectionBasis = "REPORT_SCOPE" | "COMPANY";

/** The sections the backend discloses a scope basis for. */
export type FinanceReportSection =
  | "salesPerformance"
  | "purchasing"
  | "collections"
  | "inventoryValue";

/**
 * Per-section scope disclosure.
 *
 * The backend does NOT nest this on each section — it keys them by section name
 * under `scopeNotes`, e.g. `{ inventoryValue: { basis: "COMPANY" } }`. A section
 * flagged `COMPANY` ignores the location/product-group filter, so anything read
 * from it must be labelled as whole-company rather than "for the selected
 * window".
 */
export interface FinanceSectionBasisNote {
  basis?: FinanceSectionBasis;
  note?: string;
}

export interface FinanceScopeNotes {
  salesPerformance?: FinanceSectionBasisNote;
  purchasing?: FinanceSectionBasisNote;
  collections?: FinanceSectionBasisNote;
  inventoryValue?: FinanceSectionBasisNote;
}

export interface FinancePeriod {
  from?: string;
  to?: string;
  /** UTC calendar start day (`YYYY-MM-DD`). */
  fromDate?: string;
  /** UTC calendar end day (`YYYY-MM-DD`). */
  toDate?: string;
  locationId?: string | null;
  productGroupId?: string | null;
  granularity?: FinanceGranularity;
}

export interface PaymentMethodTotal {
  method: string;
  amount: number;
}

export interface SalesLocationBreakdown {
  locationId: string;
  locationName: string;
  netSales: number;
  discounts: number;
  transactionCount: number;
}

export interface SalesProductGroupBreakdown {
  productGroupId: string | null;
  productGroupName: string;
  lineRevenue: number;
  unitsSold: number;
}

export interface FinanceSalesPerformance {
  grossSales: number;
  discounts: number;
  customerReturns: number;
  netSales: number;
  netSalesAfterReturns: number;
  transactionCount: number;
  unitsSold: number;
  averageTransactionValue: number;
  byPaymentMethod: PaymentMethodTotal[];
  byLocation: SalesLocationBreakdown[];
  byProductGroup: SalesProductGroupBreakdown[];
}

/**
 * The top-line money block.
 *
 * Extends the same gross/discount/net/returns breakdown the sales section
 * reports, so `netSales` means the identical figure in both places.
 */
export interface FinanceSummary {
  grossSales: number;
  discounts: number;
  netSales: number;
  customerReturns: number;
  netSalesAfterReturns: number;
  cogs: number;
  returnedCogs: number;
  grossProfit: number;
  /** PERCENTAGE, already scaled — `20` means 20%, NOT 0.2. */
  grossMargin: number;
  grossPurchases: number;
  supplierReturns: number;
  netPurchases: number;
  supplierPayments: number;
  supplierOutstanding: number;
  customerCollections: number;
  customerReceivables: number;
}

export interface FinanceProfitabilitySection {
  netSales: number;
  cogs: number;
  grossProfit: number;
  /** PERCENTAGE, already scaled — `20` means 20%, NOT 0.2. */
  grossMargin: number;
}

export interface FinancePurchasingSection {
  grossPurchases: number;
  supplierReturns: number;
  netPurchases: number;
  invoiceAmount: number;
  supplierPayments: number;
  supplierOutstanding: number;
  purchaseOrderCount: number;
  invoiceCount: number;
  supplierReturnCount: number;
  supplierPaymentCount: number;
  outstandingInvoiceCount: number;
  supplierReturnAppliedToPayable: number;
  supplierReturnCreditEffect: number;
}

export interface FinanceCollectionsSection {
  customerCollections: number;
  customerReceivables: number;
  byPaymentMethod: PaymentMethodTotal[];
}

export interface FinanceInventoryBucket {
  key: string;
  value: number;
  quantity: number;
}

export interface FinanceInventoryValueSection {
  totalValue: number;
  batchCostValue: number;
  totalQuantity: number;
  stockedProducts: number;
  expiredValue: number;
  expiringWithin30DaysValue: number;
  expiryBuckets: FinanceInventoryBucket[];
}

export interface FinanceTrendPoint {
  /** `YYYY-MM-DD` | `YYYY-MM` | `YYYY`, depending on granularity. */
  period: string;
  grossSales: number;
  discounts: number;
  netSales: number;
  customerReturns: number;
  netSalesAfterReturns: number;
  cogs: number;
  grossProfit: number;
  /** PERCENTAGE, already scaled — `20` means 20%, NOT 0.2. */
  grossMargin: number;
  transactionCount: number;
  unitsSold: number;
  customerCollections: number;
  supplierPayments: number;
  supplierReturns: number;
}

export interface FinanceTrends {
  granularity: FinanceGranularity;
  from: string;
  to: string;
  /**
   * The backend emits EVERY bucket in the window, including empty ones as
   * zeroes, so consumers must NOT filter these out — dropping them would make a
   * quiet period look like missing data.
   */
  points: FinanceTrendPoint[];
}

export interface FinanceReport {
  period: FinancePeriod;
  summary: FinanceSummary;
  salesPerformance: FinanceSalesPerformance;
  purchasing: FinancePurchasingSection;
  collections: FinanceCollectionsSection;
  profitability: FinanceProfitabilitySection;
  inventoryValue: FinanceInventoryValueSection;
  trends: FinanceTrends;
  scopeNotes?: FinanceScopeNotes;
}

export interface FinanceDashboard {
  /**
   * Server-generated timestamp for this snapshot.
   *
   * This is the ONLY trustworthy "last updated" value — the browser's clock is
   * not used for it, because the snapshot is taken server-side in UTC and a
   * client clock can be skewed or in another timezone entirely.
   */
  asOf: string;
  todayGrossSales: number;
  todayDiscounts: number;
  todayCustomerReturns: number;
  todayNetSales: number;
  todayNetSalesAfterReturns: number;
  todayTransactionCount: number;
  todayCustomerCollections: number;
  todaySupplierPayments: number;
  todaySupplierReturns: number;
  outstandingSupplierPayables: number;
  customerReceivables: number;
}

/** The three legal trend bucket widths. */
export const FINANCE_GRANULARITIES: FinanceGranularity[] = ["DAY", "MONTH", "YEAR"];

export function isFinanceGranularity(value: unknown): value is FinanceGranularity {
  return (
    typeof value === "string" &&
    (FINANCE_GRANULARITIES as string[]).includes(value)
  );
}

export interface FinanceReportQuery {
  /** Inclusive UTC start-of-day. */
  from?: string;
  /** Inclusive UTC end-of-day. */
  to?: string;
  locationId?: string;
  productGroupId?: string;
  granularity?: FinanceGranularity;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class FinanceReportingApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    options: { status: number; code?: string; details?: Record<string, unknown> } = { status: 0 },
  ) {
    super(message);
    this.name = "FinanceReportingApiError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}

function friendlyStatusMessage(status: number): string {
  if (status === 401) return "Your session has expired. Please sign in again.";
  // The module is ADMIN-only server-side; this states that plainly rather than
  // leaving the reader to guess whether they are on the wrong page.
  if (status === 403)
    return "Finance Reporting is restricted to administrators. Ask an administrator for access.";
  if (status === 404) return "This finance report no longer exists.";
  if (status === 422) return "The request was rejected — check the date range and filters provided.";
  return `Request failed (HTTP ${status}).`;
}

// ─── Request plumbing ────────────────────────────────────────────────────────

/**
 * True for the rejection `fetch` raises when an AbortController fires.
 *
 * An aborted request is a deliberate cancellation, not a failure, so it must
 * never be reported to the user as "cannot reach the server".
 */
function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

async function financeReportingRequest<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${FINANCE_REPORTING_BASE}${path}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
      signal,
    });
  } catch (e) {
    // Re-thrown untouched so the caller's sequencing can recognise it and stay
    // silent instead of flashing a connection error for a request it cancelled.
    if (isAbortError(e)) throw e;
    throw new FinanceReportingApiError(
      "Cannot reach the server. Please check your connection and try again.",
    );
  }

  if (!res.ok) {
    // For 401/403/404 this module's own wording WINS over the server's. The
    // server sends terse strings like "jwt expired" or "Forbidden", which would
    // otherwise replace the only actionable text available ("sign in again",
    // "this module is admin-restricted") with something the reader cannot act on.
    // For 422 and 5xx the server's message WINS, because there it carries the
    // specific reason ("from must be before to") that our generic text lacks.
    const keepFriendly = res.status === 401 || res.status === 403 || res.status === 404;
    let message = friendlyStatusMessage(res.status);
    let code: string | undefined;
    let details: Record<string, unknown> | undefined;
    try {
      const body = (await res.json()) as {
        error?: { code?: string; message?: string; details?: Record<string, unknown> };
        message?: string;
      } | null;
      if (!keepFriendly && body?.error?.message) message = body.error.message;
      else if (!keepFriendly && body?.message) message = body.message;
      if (body?.error?.code) code = body.error.code;
      if (body?.error?.details) details = body.error.details;
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    throw new FinanceReportingApiError(message, { status: res.status, code, details });
  }

  const text = await res.text();
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null as T;
  }
}

/**
 * Drops absent filters rather than sending `undefined`, `null` or the literal
 * string `"all"` — the endpoint validates `locationId` as a UUID, so an empty
 * string or `"all"` would be a 422.
 */
function buildQuery(query: FinanceReportQuery): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

/** GET /finance-reporting/report — the Reports page's primary data source. */
export async function getFinanceReport(
  query: FinanceReportQuery = {},
  signal?: AbortSignal,
): Promise<FinanceReport> {
  const result = await financeReportingRequest<{ data: FinanceReport }>(
    `/report${buildQuery(query)}`,
    signal,
  );
  if (!result?.data) throw new FinanceReportingApiError("Unexpected response from the server.");
  return result.data;
}

/** GET /finance-reporting/trends — standalone trend buckets. */
export async function getFinanceTrends(
  query: FinanceReportQuery = {},
  signal?: AbortSignal,
): Promise<FinanceTrends> {
  const result = await financeReportingRequest<{ data: FinanceTrends }>(
    `/trends${buildQuery(query)}`,
    signal,
  );
  if (!result?.data) throw new FinanceReportingApiError("Unexpected response from the server.");
  return result.data;
}

/** GET /finance-reporting/dashboard — unfiltered whole-company snapshot. */
export async function getFinanceDashboard(signal?: AbortSignal): Promise<FinanceDashboard> {
  const result = await financeReportingRequest<{ data: FinanceDashboard }>(`/dashboard`, signal);
  if (!result?.data) throw new FinanceReportingApiError("Unexpected response from the server.");
  return result.data;
}