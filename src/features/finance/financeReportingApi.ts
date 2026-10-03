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
  if (status === 403) return "You don't have permission to view finance reporting.";
  if (status === 404) return "This finance report no longer exists.";
  if (status === 422) return "The request was rejected — check the date range and filters provided.";
  return `Request failed (HTTP ${status}).`;
}

// ─── Request plumbing ────────────────────────────────────────────────────────

async function financeReportingRequest<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${FINANCE_REPORTING_BASE}${path}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new FinanceReportingApiError(
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

/** GET /finance-reporting/report — the Finance tab's primary data source. */
export async function getFinanceReport(query: FinanceReportQuery = {}): Promise<FinanceReport> {
  const result = await financeReportingRequest<{ data: FinanceReport }>(
    `/report${buildQuery(query)}`,
  );
  if (!result?.data) throw new FinanceReportingApiError("Unexpected response from the server.");
  return result.data;
}

/** GET /finance-reporting/trends — standalone trend buckets. */
export async function getFinanceTrends(query: FinanceReportQuery = {}): Promise<FinanceTrends> {
  const result = await financeReportingRequest<{ data: FinanceTrends }>(
    `/trends${buildQuery(query)}`,
  );
  if (!result?.data) throw new FinanceReportingApiError("Unexpected response from the server.");
  return result.data;
}

/** GET /finance-reporting/dashboard — unfiltered whole-company snapshot. */
export async function getFinanceDashboard(): Promise<FinanceDashboard> {
  const result = await financeReportingRequest<{ data: FinanceDashboard }>(`/dashboard`);
  if (!result?.data) throw new FinanceReportingApiError("Unexpected response from the server.");
  return result.data;
}