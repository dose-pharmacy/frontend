// ── Dashboard API client ─────────────────────────────────────────────────────
// Talks to the pharmacy backend's dashboard endpoints:
//   GET /api/v1/dashboard/summary
//   GET /api/v1/dashboard/attention
//   GET /api/v1/dashboard/recent-activity
//
// These three endpoints are the single source of truth for the dashboard.
// The frontend renders the returned values as-is — it never derives stock
// value, low stock, expiring soon, outstanding invoices, sales totals, etc.
//
// All requests require the authenticated ADMIN session cookie
// (HTTP-only — sent automatically with `credentials: "include"`).

import { API_BASE_URL } from "../auth/authApi";

// ─── Types (mirror the backend response shapes) ──────────────────────────────

export interface DashboardSales {
  today: number;
  transactions: number;
  averageTransaction: number;
}

export interface DashboardInventory {
  stockValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  expiringSoonCount: number;
  expiredCount: number;
}

export interface DashboardPurchasing {
  openRequirements: number;
  awaitingDelivery: number;
  partiallyReceived: number;
  outstandingInvoices: number;
}

export interface DashboardSlowMoving {
  flaggedCount: number;
}

export interface DashboardSummary {
  sales: DashboardSales;
  inventory: DashboardInventory;
  purchasing: DashboardPurchasing;
  slowMoving: DashboardSlowMoving;
}

export interface LowStockAttentionItem {
  productId: string;
  productName: string;
  sku: string;
  availableStock: number;
  reorderPoint: number;
  baseUnitName?: string;
}

export interface ExpiringSoonAttentionItem {
  batchId: string;
  productId: string;
  productName: string;
  batchNumber: string;
  expiryDate: string;
  remainingQuantity: number;
  baseUnitName?: string;
}

export interface AwaitingDeliveryAttentionItem {
  purchaseOrderId: string;
  poNumber: string;
  supplierName: string;
  expectedDeliveryDate: string | null;
}

export interface OutstandingInvoiceAttentionItem {
  invoiceId: string;
  invoiceNumber: string;
  supplierName: string;
  outstandingBalance: number;
  dueDate: string | null;
}

export interface DashboardAttention {
  lowStock: LowStockAttentionItem[];
  expiringSoon: ExpiringSoonAttentionItem[];
  awaitingDelivery: AwaitingDeliveryAttentionItem[];
  outstandingInvoices: OutstandingInvoiceAttentionItem[];
}

export type RecentActivityType =
  | "SALE_COMPLETED"
  | "GOODS_RECEIVED"
  | "PURCHASE_ORDER_CREATED"
  | (string & {});

export interface RecentActivityItem {
  type: RecentActivityType;
  reference: string;
  description: string;
  createdAt: string;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class DashboardApiError extends Error {
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
    this.name = "DashboardApiError";
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
      return "You don't have permission to view the dashboard.";
    case 404:
      return "The dashboard data is not available.";
    default:
      return `Request failed (HTTP ${status}).`;
  }
}

// ─── Request plumbing ────────────────────────────────────────────────────────

const DASHBOARD_BASE = `${API_BASE_URL}/api/v1/dashboard`;

async function dashboardRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${DASHBOARD_BASE}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new DashboardApiError(
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
    throw new DashboardApiError(message, { status: res.status, code, details });
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

/** GET /dashboard/summary — today's activity + current operational counts. */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const result = await dashboardRequest<{ success: boolean; data: DashboardSummary }>("/summary");
  if (!result?.data) throw new DashboardApiError("Unexpected response from the server.");
  return result.data;
}

/** GET /dashboard/attention — actionable lists (max 5 per category). */
export async function getDashboardAttention(): Promise<DashboardAttention> {
  const result = await dashboardRequest<{ success: boolean; data: DashboardAttention }>(
    "/attention",
  );
  if (!result?.data) throw new DashboardApiError("Unexpected response from the server.");
  return result.data;
}

/** GET /dashboard/recent-activity — latest merged activity events (max 10). */
export async function getDashboardRecentActivity(): Promise<RecentActivityItem[]> {
  const result = await dashboardRequest<{ success: boolean; data: RecentActivityItem[] }>(
    "/recent-activity",
  );
  if (!result?.data) throw new DashboardApiError("Unexpected response from the server.");
  return result.data;
}