// ── Inventory Overview API client ────────────────────────────────────────────
// Talks to the pharmacy backend's inventory dashboard endpoint:
//   GET /api/v1/inventory/dashboard   (headline metrics, optional expiry thresholds)
//
// All requests require the authenticated admin session cookie
// (HTTP-only — sent automatically with `credentials: "include"`).

import { API_BASE_URL } from "../auth/authApi";

// ─── Types (mirror the Swagger response shapes) ──────────────────────────────

export interface InventoryMetricsDto {
  totalProducts: number;
  totalStock: number;
  lowStock: number;
  outOfStock: number;
  nearExpiry: number;
  expiredBatches: number;
  criticalExpiry: number;
}

export interface InventoryOverviewQuery {
  /** Comma-joined expiry thresholds in days, e.g. [30, 60, 90] -> "30,60,90". */
  thresholds?: number[];
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class InventoryOverviewApiError extends Error {
  readonly status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = "InventoryOverviewApiError";
    this.status = status;
  }
}

function friendlyStatusMessage(status: number): string {
  switch (status) {
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return "You don't have permission to view the inventory dashboard.";
    default:
      return `Request failed (HTTP ${status}).`;
  }
}

// ─── Request plumbing ────────────────────────────────────────────────────────

const DASHBOARD_BASE = `${API_BASE_URL}/api/v1/inventory/dashboard`;

/** GET /inventory/dashboard — headline inventory metrics. */
export async function getInventoryOverview(
  query: InventoryOverviewQuery = {},
): Promise<InventoryMetricsDto> {
  let res: Response;
  try {
    const params = new URLSearchParams();
    if (query.thresholds?.length) params.set("thresholds", query.thresholds.join(","));
    const qs = params.toString();
    res = await fetch(`${DASHBOARD_BASE}${qs ? `?${qs}` : ""}`, {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
  } catch {
    throw new InventoryOverviewApiError(
      "Cannot reach the server. Please check your connection and try again.",
    );
  }

  if (!res.ok) {
    let message = friendlyStatusMessage(res.status);
    try {
      const body = (await res.json()) as { error?: { message?: string }; message?: string } | null;
      if (body?.error?.message) message = body.error.message;
      else if (body?.message) message = body.message;
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    throw new InventoryOverviewApiError(message, res.status);
  }

  try {
    const body = (await res.json()) as { success: boolean; data: { metrics: InventoryMetricsDto } } | null;
    if (!body?.data?.metrics) {
      throw new InventoryOverviewApiError("Unexpected response from the server.");
    }
    return body.data.metrics;
  } catch (err) {
    if (err instanceof InventoryOverviewApiError) throw err;
    throw new InventoryOverviewApiError("Unexpected response from the server.");
  }
}
