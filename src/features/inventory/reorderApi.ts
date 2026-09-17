// ── Reorder API client ───────────────────────────────────────────────────────
// Talks to the pharmacy backend's reorder endpoints:
//   GET  /api/v1/inventory/reorder/dashboard                        (low-stock dashboard)
//   GET  /api/v1/inventory/reorder/suggestions                      (reorder suggestions + velocity)
//   GET  /api/v1/inventory/products/{productId}/reorder-config      (get product reorder settings)
//   PUT  /api/v1/inventory/products/{productId}/reorder-config      (update reorder settings)
//   POST /api/v1/inventory/reorder/generate-purchase-requirements   (create purchase requirements)
//
// All requests require the authenticated admin session cookie
// (HTTP-only — sent automatically with `credentials: "include"`).

import { API_BASE_URL } from "../auth/authApi";

// ─── Types (mirror the Swagger response shapes) ──────────────────────────────

export interface ReorderBaseUnitDto {
  id: string;
  name: string;
  symbol: string;
}

/** Product reference embedded in reorder responses. */
export interface ReorderProductDto {
  id: string;
  name: string;
  sku: string;
  brand: string;
  baseUnit: ReorderBaseUnitDto;
}

export type ReorderUrgency = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type ReorderCalculationMethod =
  | "CONFIGURED"
  | "SALES_VELOCITY"
  | (string & {}); // backend may add more methods later

/** Row of GET /inventory/reorder/dashboard. */
export interface ReorderDashboardItemDto {
  product: ReorderProductDto;
  currentStock: number;
  minimumThreshold: number;
  reorderPoint: number;
  suggestedQuantity: number;
  urgency: ReorderUrgency;
  leadTimeDays: number;
  useSalesVelocity: boolean;
  hasSalesData: boolean;
}

export interface ReorderSummaryDto {
  critical: number;
  high: number;
  medium: number;
  low: number;
  totalItems: number;
  totalSuggestedQuantity: number;
}

export interface ReorderListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ReorderDashboardResult {
  items: ReorderDashboardItemDto[];
  summary: ReorderSummaryDto;
}

/** Row of GET /inventory/reorder/suggestions. */
export interface ReorderSuggestionDto {
  product: ReorderProductDto;
  currentStock: number;
  reorderPoint: number;
  minimumStockLevel: number;
  suggestedQuantity: number;
  calculationMethod: ReorderCalculationMethod;
  leadTimeDays: number;
  averageDailySales: number;
  bufferQuantity: number;
  hasSalesData: boolean;
}

export interface ReorderSuggestionsResult {
  data: ReorderSuggestionDto[];
  meta: ReorderListMeta;
}

/** Response of GET/PUT /inventory/products/{productId}/reorder-config. */
export interface ReorderConfigDto {
  id: string;
  productId: string;
  minimumStockLevel: number;
  reorderPoint: number;
  leadTimeDays: number;
  reorderQuantity: number;
  useSalesVelocity: boolean;
  bufferPercentage: number;
  createdAt: string;
  updatedAt: string;
  product: Omit<ReorderProductDto, "brand">;
}

/** Body for PUT /inventory/products/{productId}/reorder-config. */
export interface UpdateReorderConfigInput {
  minimumStockLevel: number;
  reorderPoint: number;
  leadTimeDays: number;
  reorderQuantity: number;
  useSalesVelocity: boolean;
  bufferPercentage: number;
}

/** Requirement row of POST /inventory/reorder/generate-purchase-requirements. */
export interface PurchaseRequirementDto {
  productId: string;
  productName: string;
  productSku: string;
  suggestedQuantity: number;
  calculationMethod: ReorderCalculationMethod;
  currentStock: number;
  reorderPoint: number;
  leadTimeDays: number;
  status: "DRAFT" | (string & {});
}

export interface PurchaseRequirementsResult {
  requirements: PurchaseRequirementDto[];
  generatedAt: string;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class ReorderApiError extends Error {
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
    this.name = "ReorderApiError";
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
      return "You don't have permission to manage reorder settings.";
    case 404:
      return "The requested reorder record no longer exists.";
    case 409:
      return "Purchase requirements were already generated for this product.";
    default:
      return `Request failed (HTTP ${status}).`;
  }
}

async function parseErrorResponse(res: Response): Promise<ReorderApiError> {
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

  return new ReorderApiError(message, { status: res.status, code, details });
}

// ─── Request plumbing ────────────────────────────────────────────────────────

const REORDER_BASE = `${API_BASE_URL}/api/v1/inventory/reorder`;
const PRODUCTS_BASE = `${API_BASE_URL}/api/v1/inventory/products`;

async function reorderRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${REORDER_BASE}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ReorderApiError(
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

async function productReorderRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${PRODUCTS_BASE}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ReorderApiError(
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
 * GET /inventory/reorder/dashboard — low-stock dashboard with urgency summary.
 * `urgency` filters by CRITICAL | HIGH | MEDIUM | LOW.
 */
export async function getReorderDashboard(
  query: { page?: number; limit?: number; urgency?: ReorderUrgency } = {},
): Promise<ReorderDashboardResult> {
  const result = await reorderRequest<{
    success: boolean;
    data: ReorderDashboardResult;
    meta: ReorderListMeta;
  }>(
    `/dashboard${buildQueryString({
      page: query.page,
      limit: query.limit,
      urgency: query.urgency,
    })}`,
  );
  return (
    result?.data ?? {
      items: [],
      summary: { critical: 0, high: 0, medium: 0, low: 0, totalItems: 0, totalSuggestedQuantity: 0 },
    }
  );
}

/** GET /inventory/reorder/suggestions — reorder suggestions incl. sales velocity. */
export async function getReorderSuggestions(
  query: { page?: number; limit?: number } = {},
): Promise<ReorderSuggestionsResult> {
  const result = await reorderRequest<{
    success: boolean;
    data: ReorderSuggestionDto[];
    meta: ReorderListMeta;
  }>(
    `/suggestions${buildQueryString({ page: query.page, limit: query.limit })}`,
  );
  return result ?? { data: [], meta: { page: 1, limit: query.limit ?? 20, total: 0, totalPages: 1 } };
}

/** GET /inventory/products/{productId}/reorder-config — product reorder settings. */
export async function getReorderConfig(productId: string): Promise<ReorderConfigDto> {
  const result = await productReorderRequest<{ success: boolean; data: ReorderConfigDto }>(
    `/${encodeURIComponent(productId)}/reorder-config`,
  );
  if (!result?.data) throw new ReorderApiError("Unexpected response from the server.");
  return result.data;
}

/** PUT /inventory/products/{productId}/reorder-config — update reorder settings. */
export async function updateReorderConfig(
  productId: string,
  input: UpdateReorderConfigInput,
): Promise<ReorderConfigDto> {
  const result = await productReorderRequest<{ success: boolean; data: ReorderConfigDto }>(
    `/${encodeURIComponent(productId)}/reorder-config`,
    { method: "PUT", body: JSON.stringify(input) },
  );
  if (!result?.data) throw new ReorderApiError("Unexpected response from the server.");
  return result.data;
}

/** POST /inventory/reorder/generate-purchase-requirements — create requirements. */
export async function generatePurchaseRequirements(): Promise<PurchaseRequirementsResult> {
  const result = await reorderRequest<{
    success: boolean;
    data: PurchaseRequirementsResult;
  }>("/generate-purchase-requirements", { method: "POST" });
  if (!result?.data) throw new ReorderApiError("Unexpected response from the server.");
  return result.data;
}
