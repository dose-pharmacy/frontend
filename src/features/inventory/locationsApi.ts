// ── Locations API client ─────────────────────────────────────────────────────
// Talks to the pharmacy backend's inventory locations endpoints:
//   GET    /api/v1/inventory/locations        (list, paginated & searchable)
//   POST   /api/v1/inventory/locations        (create)
//   GET    /api/v1/inventory/locations/{id}   (get one)
//   PATCH  /api/v1/inventory/locations/{id}   (update)
//   DELETE /api/v1/inventory/locations/{id}   (soft delete -> deactivate)
//
// All requests require the authenticated admin session cookie
// (HTTP-only — sent automatically with `credentials: "include"`).

import { API_BASE_URL } from "../auth/authApi";

// ─── Types (mirror the backend response shapes) ──────────────────────────────

export interface LocationDto {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LocationListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface LocationListResult {
  data: LocationDto[];
  meta: LocationListMeta;
}

export interface LocationInput {
  name: string;
  description?: string | null;
  isActive?: boolean;
}

export interface LocationsQuery {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class LocationsApiError extends Error {
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
    this.name = "LocationsApiError";
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
      return "You don't have permission to manage locations.";
    case 404:
      return "This location no longer exists.";
    case 409:
      return "A location with that name already exists.";
    default:
      return `Request failed (HTTP ${status}).`;
  }
}

async function parseErrorResponse(res: Response): Promise<LocationsApiError> {
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

  return new LocationsApiError(message, { status: res.status, code, details });
}

// ─── Request plumbing ────────────────────────────────────────────────────────

const LOCATIONS_BASE = `${API_BASE_URL}/api/v1/inventory/locations`;

async function locationsRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${LOCATIONS_BASE}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new LocationsApiError(
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

/** GET /inventory/locations — list locations with optional pagination & filters. */
export async function listLocations(
  query: LocationsQuery = {},
): Promise<LocationListResult> {
  const params = new URLSearchParams();
  if (query.page != null) params.set("page", String(query.page));
  if (query.limit != null) params.set("limit", String(query.limit));
  if (query.search) params.set("search", query.search);
  if (query.isActive != null) params.set("isActive", String(query.isActive));

  const qs = params.toString();
  const result = await locationsRequest<LocationListResult>(qs ? `?${qs}` : "");
  return (
    result ?? {
      data: [],
      meta: { page: 1, limit: query.limit ?? 20, total: 0, totalPages: 1 },
    }
  );
}

/** POST /inventory/locations — create a new location. */
export async function createLocation(input: LocationInput): Promise<LocationDto> {
  const result = await locationsRequest<{ data: LocationDto }>("", {
    method: "POST",
    body: JSON.stringify({
      name: input.name.trim(),
      ...(input.description?.trim() ? { description: input.description.trim() } : {}),
      isActive: input.isActive ?? true,
    }),
  });
  return result.data;
}

/** GET /inventory/locations/{id} — fetch a single location. */
export async function getLocation(id: string): Promise<LocationDto> {
  const result = await locationsRequest<{ data: LocationDto }>(
    `/${encodeURIComponent(id)}`,
  );
  return result.data;
}

/** PATCH /inventory/locations/{id} — update an existing location. */
export async function updateLocation(
  id: string,
  input: Partial<LocationInput>,
): Promise<LocationDto> {
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body.name = input.name.trim();
  if (input.description !== undefined)
    body.description = input.description?.trim() || null;
  if (input.isActive !== undefined) body.isActive = input.isActive;

  const result = await locationsRequest<{ data: LocationDto }>(
    `/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
  return result.data;
}

/**
 * DELETE /inventory/locations/{id} — soft delete (deactivate).
 * The backend's Swagger response example still shows `isActive: true`, so
 * this is intentionally copied from the working Products/Units clients: we
 * don't trust the response body and let the caller refresh from the list.
 */
export async function deactivateLocation(id: string): Promise<void> {
  await locationsRequest<unknown>(`/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
