// ── Product Groups API client ────────────────────────────────────────────────
// Talks to the pharmacy backend's inventory product-groups endpoints:
//   GET    /api/v1/inventory/product-groups        (list, paginated & searchable)
//   POST   /api/v1/inventory/product-groups        (create)
//   GET    /api/v1/inventory/product-groups/{id}   (get one)
//   PATCH  /api/v1/inventory/product-groups/{id}   (update)
//   DELETE /api/v1/inventory/product-groups/{id}   (soft delete -> deactivate)
//
// All requests require the authenticated admin session cookie
// (HTTP-only — sent automatically with `credentials: "include"`).

import { API_BASE_URL } from "../auth/authApi";

// ─── Types (mirror the backend response shapes) ──────────────────────────────

export interface ProductGroupProductDto {
  id: string;
  name?: string;
  sku?: string;
}

export interface ProductGroupDto {
  id: string;
  name: string;
  description: string | null;
  defaultProfitMargin: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  /** Included on GET /{id} — products assigned to this group. */
  products?: ProductGroupProductDto[];
  /** Included on list & get-one responses. */
  _count?: { products: number };
}

export interface ProductGroupListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ProductGroupListResult {
  data: ProductGroupDto[];
  meta: ProductGroupListMeta;
}

export interface ProductGroupInput {
  name: string;
  description?: string | null;
  defaultProfitMargin?: number;
  isActive?: boolean;
}

export interface ProductGroupsQuery {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class ProductGroupsApiError extends Error {
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
    this.name = "ProductGroupsApiError";
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
      return "You don't have permission to manage product groups.";
    case 404:
      return "This product group no longer exists.";
    case 409:
      return "A product group with that name already exists.";
    default:
      return `Request failed (HTTP ${status}).`;
  }
}

async function parseErrorResponse(res: Response): Promise<ProductGroupsApiError> {
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

  return new ProductGroupsApiError(message, { status: res.status, code, details });
}

// ─── Request plumbing ────────────────────────────────────────────────────────

const GROUPS_BASE = `${API_BASE_URL}/api/v1/inventory/product-groups`;

async function groupsRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${GROUPS_BASE}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ProductGroupsApiError(
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

/** GET /inventory/product-groups — list groups with optional pagination & filters. */
export async function listProductGroups(
  query: ProductGroupsQuery = {},
): Promise<ProductGroupListResult> {
  const params = new URLSearchParams();
  if (query.page != null) params.set("page", String(query.page));
  if (query.limit != null) params.set("limit", String(query.limit));
  if (query.search) params.set("search", query.search);
  if (query.isActive != null) params.set("isActive", String(query.isActive));

  const qs = params.toString();
  const result = await groupsRequest<ProductGroupListResult>(qs ? `?${qs}` : "");
  return (
    result ?? {
      data: [],
      meta: { page: 1, limit: query.limit ?? 20, total: 0, totalPages: 1 },
    }
  );
}

/** POST /inventory/product-groups — create a new product group. */
export async function createProductGroup(
  input: ProductGroupInput,
): Promise<ProductGroupDto> {
  const result = await groupsRequest<{ data: ProductGroupDto }>("", {
    method: "POST",
    body: JSON.stringify({
      name: input.name.trim(),
      ...(input.description?.trim() ? { description: input.description.trim() } : {}),
      ...(input.defaultProfitMargin !== undefined
        ? { defaultProfitMargin: input.defaultProfitMargin }
        : {}),
      isActive: input.isActive ?? true,
    }),
  });
  return result.data;
}

/** GET /inventory/product-groups/{id} — fetch a single group (with its products). */
export async function getProductGroup(id: string): Promise<ProductGroupDto> {
  const result = await groupsRequest<{ data: ProductGroupDto }>(
    `/${encodeURIComponent(id)}`,
  );
  return result.data;
}

/** PATCH /inventory/product-groups/{id} — update an existing product group. */
export async function updateProductGroup(
  id: string,
  input: Partial<ProductGroupInput>,
): Promise<ProductGroupDto> {
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body.name = input.name.trim();
  if (input.description !== undefined) body.description = input.description?.trim() || null;
  if (input.defaultProfitMargin !== undefined)
    body.defaultProfitMargin = input.defaultProfitMargin;
  if (input.isActive !== undefined) body.isActive = input.isActive;

  const result = await groupsRequest<{ data: ProductGroupDto }>(
    `/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
  return result.data;
}

/**
 * DELETE /inventory/product-groups/{id} — soft delete.
 * The group stays in historical records but becomes inactive and can no
 * longer be assigned to new products.
 */
export async function deactivateProductGroup(id: string): Promise<void> {
  await groupsRequest<null>(`/${encodeURIComponent(id)}`, { method: "DELETE" });
}
