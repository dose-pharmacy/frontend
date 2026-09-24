// ── Reports API client ───────────────────────────────────────────────────────
// Talks to the pharmacy backend's reports endpoints:
//   Sales
//     GET  /api/v1/financials/reports/sales/summary                (dateFrom, dateTo, locationId)
//     GET  /api/v1/financials/reports/sales/trend                  (period, dateFrom, dateTo, locationId)
//     GET  /api/v1/financials/reports/sales                        (paginated & sortable)
//     GET  /api/v1/financials/reports/sales/detail                 (paginated drill-down)
//   Profitability
//     GET  /api/v1/financials/reports/profitability/summary        (groupBy, productGroupId, manufacturerId, dateFrom, dateTo)
//     GET  /api/v1/financials/reports/profitability                (paginated & sortable)
//     GET  /api/v1/financials/reports/profit-margin/summary        (productGroupId, dateFrom, dateTo)
//     GET  /api/v1/financials/reports/profit-margin                (paginated & sortable)
//   Slow moving
//     GET  /api/v1/financials/reports/slow-moving                  (paginated & filterable)
//     GET  /api/v1/financials/reports/slow-moving                  (list, paginated & filterable)
//     GET  /api/v1/financials/reports/slow-moving/{id}
//     GET  /api/v1/financials/reports/slow-moving/product/{productId}
//     POST /api/v1/financials/reports/slow-moving
//     PATCH /api/v1/financials/reports/slow-moving/{id}
//     DELETE /api/v1/financials/reports/slow-moving/{id}
//     POST /api/v1/financials/reports/slow-moving/evaluate
//   Narcotics
//     GET  /api/v1/financials/reports/narcotics              (paginated product summary)
//     GET  /api/v1/financials/reports/narcotics/activity     (paginated movement ledger)
//
// All requests require the authenticated session cookie
// (HTTP-only — sent automatically with `credentials: "include"`).

import { API_BASE_URL } from "../auth/authApi";
import type { SaleDto, SaleStatus } from "../sales/salesApi";

/** Base path for the reports module endpoints. */
const REPORTS_BASE = `${API_BASE_URL}/api/v1/financials/reports`;
/** Base path for slow-moving configuration endpoints. */
const SLOW_MOVING_CONFIG_BASE = `${API_BASE_URL}/api/v1/financials/reports/slow-moving`;

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface ReportMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ReportPaginatedResult<T> {
  data: T[];
  meta: ReportMeta;
}

export type SortOrder = "asc" | "desc";

// ─── Sales summary ────────────────────────────────────────────────────────────

export interface SalesSummaryDto {
  totalSales: number;
  totalSubtotal: number;
  totalDiscount: number;
  transactionCount: number;
  averageTransaction: number;
  paymentsByMethod: SalesSummaryPaymentEntry[];
  topProducts: SalesSummaryTopProductEntry[];
}

export interface SalesSummaryPaymentEntry {
  method: string;
  amount: number;
  count?: number;
}

export interface SalesSummaryTopProductEntry {
  productId: string;
  name: string;
  sku?: string;
  quantitySold: number;
  revenue: number;
}

export interface SalesSummaryQuery {
  dateFrom?: string;
  dateTo?: string;
  locationId?: string;
}

// ─── Sales trend ──────────────────────────────────────────────────────────────

export type SalesTrendPeriod = "DAILY" | "MONTHLY" | "ANNUAL";

export interface SalesTrendPointDto {
  period: string;
  revenue: number;
  transactionCount: number;
  quantitySold: number;
}

export interface SalesTrendQuery {
  period: SalesTrendPeriod;
  dateFrom?: string;
  dateTo?: string;
  locationId?: string;
}

// ─── Sales report (transactions) ──────────────────────────────────────────────

export type SalesReportSortBy = "createdAt" | "saleNumber" | "totalAmount" | "paidAmount";

export interface SalesReportQuery {
  dateFrom?: string;
  dateTo?: string;
  locationId?: string;
  page?: number;
  limit?: number;
  sortBy?: SalesReportSortBy;
  sortOrder?: SortOrder;
}

// ─── Sales detail (drill-down) ───────────────────────────────────────────────

export interface SalesDetailSaleDto {
  id: string;
  saleNumber: string;
  status?: SaleStatus;
  subtotal?: number;
  totalAmount: number;
  paidAmount?: number;
  completedAt?: string | null;
  createdAt: string;
  location?: { id: string; name: string } | null;
  cashier?: { id: string; name: string } | null;
}

export interface SalesDetailProductDto {
  id: string;
  name: string;
  sku?: string;
}

export interface SalesDetailLineUnitDto {
  id: string;
  name: string;
  symbol?: string;
}

export interface SalesDetailLineDto {
  sale: SalesDetailSaleDto;
  product: SalesDetailProductDto;
  quantity: number;
  baseQuantity: number;
  lineTotal: number;
  unit?: SalesDetailLineUnitDto | null;
}

export interface SalesDetailQuery {
  dateFrom?: string;
  dateTo?: string;
  locationId?: string;
  saleId?: string;
  productId?: string;
  cashierId?: string;
  page?: number;
  limit?: number;
}

// ─── Profitability ────────────────────────────────────────────────────────────

export type ProfitabilityGroupBy = "BRAND" | "MANUFACTURER" | "PRODUCT_GROUP" | "PRODUCT";
export type ProfitabilitySortBy =
  | "profit"
  | "revenue"
  | "cost"
  | "margin"
  | "quantity"
  | "productCount"
  | "value";

export interface ProfitabilitySummaryDto {
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  quantity: number;
  productCount: number;
}

export interface ProfitabilityRowDto {
  dimension: string;
  value: string | number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  quantity: number;
  productCount: number;
}

export interface ProfitabilityQuery {
  groupBy?: ProfitabilityGroupBy;
  productGroupId?: string;
  manufacturerId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
  sortBy?: ProfitabilitySortBy;
  sortOrder?: SortOrder;
}

// ─── Profit margin ────────────────────────────────────────────────────────────

export type ProfitMarginSortBy =
  | "productName"
  | "actualMargin"
  | "targetMargin"
  | "revenue"
  | "cost"
  | "quantitySold"
  | "sellingPrice";

export interface ProfitMarginSummaryDto {
  productCount: number;
  belowTargetCount: number;
  averageTargetMargin: number;
  averageActualMargin: number;
}

export interface ProfitMarginRowDto {
  productGroupId: string;
  productGroupName: string;
  productId: string;
  productName: string;
  sku: string;
  sellingPrice: number;
  costPrice: number;
  targetMargin: number;
  actualMargin: number;
  revenue: number;
  cost: number;
  quantitySold: number;
}

export interface ProfitMarginQuery {
  productGroupId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
  sortBy?: ProfitMarginSortBy;
  sortOrder?: SortOrder;
}

// ─── Slow moving report ───────────────────────────────────────────────────────

export type SlowMovingDefinitionType = "DAYS_30" | "DAYS_60" | "DAYS_90" | "DAYS_180" | "CUSTOM";

export interface SlowMovingDto {
  product: {
    id: string;
    name: string;
    sku?: string;
    brand?: string | null;
  };
  definitionType: SlowMovingDefinitionType;
  thresholdDays: number;
  lastSaleAt?: string | null;
  daysSinceLastSale?: number | null;
  isFlagged: boolean;
  stockQuantity?: number | null;
  stockValue?: number | null;
  customDays?: number | null;
}

export interface SlowMovingQuery {
  page?: number;
  limit?: number;
  productGroupId?: string;
  manufacturerId?: string;
  isFlagged?: boolean;
  definitionType?: SlowMovingDefinitionType;
}

// ─── Slow moving configuration ────────────────────────────────────────────────

export interface SlowMovingConfigProductDto {
  id: string;
  name: string;
  sku?: string;
}

export interface SlowMovingConfigDto {
  id: string;
  productId: string;
  product?: SlowMovingConfigProductDto | null;
  definitionType: SlowMovingDefinitionType;
  customDays: number | null;
  isFlagged?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface SlowMovingConfigInput {
  productId: string;
  definitionType: SlowMovingDefinitionType;
  customDays: number | null;
}

export type SlowMovingConfigUpdate = Pick<SlowMovingConfigInput, "definitionType" | "customDays">;

export interface SlowMovingConfigQuery {
  page?: number;
  limit?: number;
  productId?: string;
  isFlagged?: boolean;
  definitionType?: SlowMovingDefinitionType;
}

export interface SlowMovingEvaluateResult {
  evaluated: number;
  flagged: number;
  unflagged: number;
  skipped: number;
  evaluatedAt: string;
  durationMs: number;
}

// ─── Narcotic report ─────────────────────────────────────────────────────────

export interface NarcoticSummaryBatchDto {
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  locationId: string;
  locationName: string;
  currentQuantity: number;
}

/**
 * Product-level narcotic summary. Period activity metrics are omitted when the
 * product had no such movement in the selected window.
 */
export interface NarcoticSummaryDto {
  productId: string;
  productName: string;
  sku: string;
  genericName: string | null;
  brand: string | null;
  isNarcotic: boolean;
  batches: NarcoticSummaryBatchDto[];
  soldQuantity?: number;
  purchasedQuantity?: number;
  returnedQuantity?: number;
  adjustedQuantity?: number;
}

export interface NarcoticReportQuery {
  page?: number;
  limit?: number;
  search?: string;
  productId?: string;
  locationId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface NarcoticActivityDto {
  transactionId: string;
  date: string;
  productId: string;
  productName: string;
  sku: string;
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  locationId: string;
  locationName: string;
  movementType: string;
  direction: "IN" | "OUT";
  quantity: number;
  balanceAfter: number;
  reference: string | null;
}

export interface NarcoticActivityQuery {
  page?: number;
  limit?: number;
  productId?: string;
  locationId?: string;
  batchId?: string;
  movementType?: string;
  dateFrom?: string;
  dateTo?: string;
}

/** GET /reports/narcotics — paginated narcotic product summary. */
export async function getNarcoticReport(
  query: NarcoticReportQuery = {},
): Promise<ReportPaginatedResult<NarcoticSummaryDto>> {
  const result = await reportsRequest<ReportPaginatedResult<NarcoticSummaryDto>>(
    REPORTS_BASE,
    `/narcotics${buildQuery({
      page: query.page,
      limit: query.limit,
      search: query.search,
      productId: query.productId,
      locationId: query.locationId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    })}`,
  );
  return (
    result ?? {
      data: [],
      meta: { page: query.page ?? 1, limit: query.limit ?? 20, total: 0, totalPages: 1 },
    }
  );
}

/** GET /reports/narcotics/activity — paginated movement ledger for narcotics. */
export async function getNarcoticActivity(
  query: NarcoticActivityQuery = {},
): Promise<ReportPaginatedResult<NarcoticActivityDto>> {
  const result = await reportsRequest<ReportPaginatedResult<NarcoticActivityDto>>(
    REPORTS_BASE,
    `/narcotics/activity${buildQuery({
      page: query.page,
      limit: query.limit,
      productId: query.productId,
      locationId: query.locationId,
      batchId: query.batchId,
      movementType: query.movementType,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    })}`,
  );
  return (
    result ?? {
      data: [],
      meta: { page: query.page ?? 1, limit: query.limit ?? 20, total: 0, totalPages: 1 },
    }
  );
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class ReportsApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    options: { status: number; code?: string; details?: Record<string, unknown> } = {
      status: 0,
    },
  ) {
    super(message);
    this.name = "ReportsApiError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}

function friendlyStatusMessage(status: number, path: string): string {
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You don't have permission to view this report.";
  if (status === 404) return "This report data no longer exists.";
  if (status === 409) {
    if (path.includes("evaluate")) {
      return "Another slow-moving evaluation is currently running. Please wait and try again.";
    }
    if (path.includes("slow-moving-configs")) {
      return "This product already has a slow-moving configuration.";
    }
    return "This request conflicts with the current state of the data.";
  }
  if (status === 422) {
    return "The request was rejected — check the definitions and custom days provided.";
  }
  return `Request failed (HTTP ${status}).`;
}

// ─── Request plumbing ────────────────────────────────────────────────────────

async function reportsRequest<T>(base: string, path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ReportsApiError(
      "Cannot reach the server. Please check your connection and try again.",
    );
  }

  if (!res.ok) {
    let message = friendlyStatusMessage(res.status, path);
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
    throw new ReportsApiError(message, { status: res.status, code, details });
  }

  const text = await res.text();
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null as T;
  }
}

// ─── Query builder ───────────────────────────────────────────────────────────

function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

// ─── Sales endpoints ──────────────────────────────────────────────────────────

/** GET /reports/sales/summary — aggregate sales figures for the period. */
export async function getSalesSummary(query: SalesSummaryQuery = {}): Promise<SalesSummaryDto> {
  const result = await reportsRequest<{ data: SalesSummaryDto }>(
    REPORTS_BASE,
    `/sales/summary${buildQuery({
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      locationId: query.locationId,
    })}`,
  );
  if (!result?.data) throw new ReportsApiError("Unexpected response from the server.");
  return result.data;
}

/** GET /reports/sales/trend — time buckets of revenue, transactions and quantity. */
export async function getSalesTrend(query: SalesTrendQuery): Promise<SalesTrendPointDto[]> {
  const result = await reportsRequest<{ data: SalesTrendPointDto[] }>(
    REPORTS_BASE,
    `/sales/trend${buildQuery({
      period: query.period,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      locationId: query.locationId,
    })}`,
  );
  if (!result?.data) throw new ReportsApiError("Unexpected response from the server.");
  return result.data;
}

/** GET /reports/sales — paginated, filterable, sortable transaction list. */
export async function getSalesReport(query: SalesReportQuery = {}): Promise<ReportPaginatedResult<SaleDto>> {
  const result = await reportsRequest<ReportPaginatedResult<SaleDto>>(
    REPORTS_BASE,
    `/sales${buildQuery({
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      locationId: query.locationId,
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    })}`,
  );
  return (
    result ?? {
      data: [],
      meta: { page: query.page ?? 1, limit: query.limit ?? 20, total: 0, totalPages: 1 },
    }
  );
}

/** GET /reports/sales/detail — drill-down rows (sale × product × location × cashier). */
export async function getSalesDetail(query: SalesDetailQuery = {}): Promise<ReportPaginatedResult<SalesDetailLineDto>> {
  const result = await reportsRequest<ReportPaginatedResult<SalesDetailLineDto>>(
    REPORTS_BASE,
    `/sales/detail${buildQuery({
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      locationId: query.locationId,
      saleId: query.saleId,
      productId: query.productId,
      cashierId: query.cashierId,
      page: query.page,
      limit: query.limit,
    })}`,
  );
  return (
    result ?? {
      data: [],
      meta: { page: query.page ?? 1, limit: query.limit ?? 20, total: 0, totalPages: 1 },
    }
  );
}

// ─── Profitability endpoints ─────────────────────────────────────────────────

/** GET /reports/profitability/summary — totals for the selected grouping. */
export async function getProfitabilitySummary(
  query: ProfitabilityQuery = {},
): Promise<ProfitabilitySummaryDto> {
  const result = await reportsRequest<{ data: ProfitabilitySummaryDto }>(
    REPORTS_BASE,
    `/profitability/summary${buildQuery({
      groupBy: query.groupBy,
      productGroupId: query.productGroupId,
      manufacturerId: query.manufacturerId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    })}`,
  );
  if (!result?.data) throw new ReportsApiError("Unexpected response from the server.");
  return result.data;
}

/** GET /reports/profitability — paginated, sortable grouped profitability rows. */
export async function getProfitability(
  query: ProfitabilityQuery = {},
): Promise<ReportPaginatedResult<ProfitabilityRowDto>> {
  const result = await reportsRequest<ReportPaginatedResult<ProfitabilityRowDto>>(
    REPORTS_BASE,
    `/profitability${buildQuery({
      groupBy: query.groupBy,
      productGroupId: query.productGroupId,
      manufacturerId: query.manufacturerId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    })}`,
  );
  return (
    result ?? {
      data: [],
      meta: { page: query.page ?? 1, limit: query.limit ?? 20, total: 0, totalPages: 1 },
    }
  );
}

/** GET /reports/profit-margin/summary — target vs actual margin totals. */
export async function getProfitMarginSummary(
  query: ProfitMarginQuery = {},
): Promise<ProfitMarginSummaryDto> {
  const result = await reportsRequest<{ data: ProfitMarginSummaryDto }>(
    REPORTS_BASE,
    `/profit-margin/summary${buildQuery({
      productGroupId: query.productGroupId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    })}`,
  );
  if (!result?.data) throw new ReportsApiError("Unexpected response from the server.");
  return result.data;
}

/** GET /reports/profit-margin — paginated, sortable per-product margin rows. */
export async function getProfitMargin(
  query: ProfitMarginQuery = {},
): Promise<ReportPaginatedResult<ProfitMarginRowDto>> {
  const result = await reportsRequest<ReportPaginatedResult<ProfitMarginRowDto>>(
    REPORTS_BASE,
    `/profit-margin${buildQuery({
      productGroupId: query.productGroupId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    })}`,
  );
  return (
    result ?? {
      data: [],
      meta: { page: query.page ?? 1, limit: query.limit ?? 20, total: 0, totalPages: 1 },
    }
  );
}

// ─── Slow moving endpoints ───────────────────────────────────────────────────

/** GET /reports/slow-moving — paginated report of slow-moving products. */
export async function getSlowMovingReport(
  query: SlowMovingQuery = {},
): Promise<ReportPaginatedResult<SlowMovingDto>> {
  const result = await reportsRequest<ReportPaginatedResult<SlowMovingDto>>(
    REPORTS_BASE,
    `/slow-moving${buildQuery({
      page: query.page,
      limit: query.limit,
      productGroupId: query.productGroupId,
      manufacturerId: query.manufacturerId,
      isFlagged: query.isFlagged,
      definitionType: query.definitionType,
    })}`,
  );
  return (
    result ?? {
      data: [],
      meta: { page: query.page ?? 1, limit: query.limit ?? 20, total: 0, totalPages: 1 },
    }
  );
}

/** GET /slow-moving-configs — paginated configuration list. */
export async function getSlowMovingConfigs(
  query: SlowMovingConfigQuery = {},
): Promise<ReportPaginatedResult<SlowMovingConfigDto>> {
  const result = await reportsRequest<ReportPaginatedResult<SlowMovingConfigDto>>(
    SLOW_MOVING_CONFIG_BASE,
    buildQuery({
      page: query.page,
      limit: query.limit,
      productId: query.productId,
      isFlagged: query.isFlagged,
      definitionType: query.definitionType,
    }),
  );
  return (
    result ?? {
      data: [],
      meta: { page: query.page ?? 1, limit: query.limit ?? 20, total: 0, totalPages: 1 },
    }
  );
}

/** GET /slow-moving-configs/{id} — fetch a single configuration. */
export async function getSlowMovingConfig(id: string): Promise<SlowMovingConfigDto> {
  const result = await reportsRequest<{ data: SlowMovingConfigDto }>(
    SLOW_MOVING_CONFIG_BASE,
    `/${encodeURIComponent(id)}`,
  );
  if (!result?.data) throw new ReportsApiError("Unexpected response from the server.");
  return result.data;
}

/** GET /slow-moving-configs/product/{productId} — config for one product (may be null). */
export async function getProductSlowMovingConfig(
  productId: string,
): Promise<SlowMovingConfigDto | null> {
  const result = await reportsRequest<{ data: SlowMovingConfigDto | null }>(
    SLOW_MOVING_CONFIG_BASE,
    `/product/${encodeURIComponent(productId)}`,
  );
  return result?.data ?? null;
}

/** POST /slow-moving-configs — create a configuration for a product. */
export async function createSlowMovingConfig(
  input: SlowMovingConfigInput,
): Promise<SlowMovingConfigDto> {
  const result = await reportsRequest<{ data: SlowMovingConfigDto }>(SLOW_MOVING_CONFIG_BASE, "", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!result?.data) throw new ReportsApiError("Unexpected response from the server.");
  return result.data;
}

/** PATCH /slow-moving-configs/{id} — update definitionType / customDays. */
export async function updateSlowMovingConfig(
  id: string,
  input: SlowMovingConfigUpdate,
): Promise<SlowMovingConfigDto> {
  const result = await reportsRequest<{ data: SlowMovingConfigDto }>(
    SLOW_MOVING_CONFIG_BASE,
    `/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
  if (!result?.data) throw new ReportsApiError("Unexpected response from the server.");
  return result.data;
}

/** DELETE /slow-moving-configs/{id} — remove a configuration. */
export async function deleteSlowMovingConfig(id: string): Promise<void> {
  await reportsRequest<unknown>(SLOW_MOVING_CONFIG_BASE, `/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

/** POST /slow-moving-configs/evaluate — run the slow-moving evaluation. */
export async function evaluateSlowMoving(): Promise<SlowMovingEvaluateResult> {
  const result = await reportsRequest<{ data: SlowMovingEvaluateResult }>(
    SLOW_MOVING_CONFIG_BASE,
    "/evaluate",
    { method: "POST" },
  );
  if (!result?.data) throw new ReportsApiError("Unexpected response from the server.");
  return result.data;
}