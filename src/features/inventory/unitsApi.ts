// ── Units API client ─────────────────────────────────────────────────────────
// Talks to the pharmacy backend's inventory units endpoints:
//   GET    /api/v1/inventory/units        (list, paginated)
//   POST   /api/v1/inventory/units        (create)
//   GET    /api/v1/inventory/units/{id}   (get one)
//   PATCH  /api/v1/inventory/units/{id}   (update)
//   DELETE /api/v1/inventory/units/{id}   (soft delete → deactivate)
//
// All requests require the authenticated admin session cookie
// (HTTP-only — sent automatically with `credentials: "include"`).

import { API_BASE_URL } from "../auth/authApi";
import { cacheRead, invalidateCache, invalidateCachePrefix } from "./apiCache";

// ─── Types (mirror the backend response shapes) ──────────────────────────────

export interface UnitDto {
  id: string;
  name: string;
  symbol: string;
  description: string | null;
  isActive: boolean;
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface UnitListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface UnitListResult {
  data: UnitDto[];
  meta: UnitListMeta;
}

export interface UnitInput {
  name: string;
  symbol: string;
  description?: string | null;
  isActive?: boolean;
}

export interface UnitsQuery {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class UnitsApiError extends Error {
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
    this.name = "UnitsApiError";
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
      return "You don't have permission to manage units.";
    case 404:
      return "This unit no longer exists.";
    case 409:
      return "A unit with that name or symbol already exists.";
    default:
      return `Request failed (HTTP ${status}).`;
  }
}

async function parseErrorResponse(res: Response): Promise<UnitsApiError> {
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
    if (body?.error?.code) code = body.error.code;
    if (body?.error?.details) details = body.error.details;
  } catch {
    // Non-JSON error body — keep the generic message.
  }

  return new UnitsApiError(message, { status: res.status, code, details });
}

// ─── Request plumbing ────────────────────────────────────────────────────────

const UNITS_BASE = `${API_BASE_URL}/api/v1/inventory/units`;

async function unitsRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${UNITS_BASE}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new UnitsApiError(
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

// ─── Endpoints ───────────────────────────────────────────────────────────────

/** GET /inventory/units — list units with optional pagination & filters. */
export async function listUnits(query: UnitsQuery = {}): Promise<UnitListResult> {
  const params = new URLSearchParams();
  if (query.page != null) params.set("page", String(query.page));
  if (query.limit != null) params.set("limit", String(query.limit));
  if (query.search) params.set("search", query.search);
  if (query.isActive != null) params.set("isActive", String(query.isActive));

  const qs = params.toString();
  // Reference list used by unit pickers and the units page — cache briefly;
  // invalidated by the unit mutations below.
  return cacheRead(`units:${qs}`, () => unitsRequest<UnitListResult>(qs ? `?${qs}` : ""))
    .then((result) => result ?? { data: [], meta: { page: 1, limit: query.limit ?? 20, total: 0, totalPages: 1 } });
}

/** POST /inventory/units — create a new unit. */
export async function createUnit(input: UnitInput): Promise<UnitDto> {
  const result = await unitsRequest<{ data: UnitDto }>("", {
    method: "POST",
    body: JSON.stringify({
      name: input.name.trim(),
      symbol: input.symbol.trim(),
      ...(input.description?.trim() ? { description: input.description.trim() } : {}),
      isActive: input.isActive ?? true,
    }),
  });
  invalidateCachePrefix("units:");
  if (result?.data) invalidateCache(`unit:${result.data.id}`);
  return result.data;
}

/** GET /inventory/units/{id} — fetch a single unit. */
export async function getUnit(id: string): Promise<UnitDto> {
  const result = await unitsRequest<{ data: UnitDto }>(
    `/${encodeURIComponent(id)}`,
  );
  return result.data;
}

/** PATCH /inventory/units/{id} — update an existing unit. */
export async function updateUnit(id: string, input: Partial<UnitInput>): Promise<UnitDto> {
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body.name = input.name.trim();
  if (input.symbol !== undefined) body.symbol = input.symbol.trim();
  if (input.description !== undefined) body.description = input.description?.trim() || null;
  if (input.isActive !== undefined) body.isActive = input.isActive;

  const result = await unitsRequest<{ data: UnitDto }>(
    `/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
  invalidateCachePrefix("units:");
  invalidateCache(`unit:${id}`);
  return result.data;
}

/**
 * DELETE /inventory/units/{id} — soft delete.
 * The unit stays in historical records but becomes inactive and can no longer
 * be attached to new products or transfers.
 */
export async function deactivateUnit(id: string): Promise<void> {
  await unitsRequest<null>(`/${encodeURIComponent(id)}`, { method: "DELETE" });
  invalidateCachePrefix("units:");
  invalidateCache(`unit:${id}`);
}
