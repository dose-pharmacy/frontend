// ── Products API client ──────────────────────────────────────────────────────
// Talks to the pharmacy backend's inventory product endpoints:
//   GET    /api/v1/inventory/products              (list, paginated & searchable)
//   GET    /api/v1/inventory/inventory-products    (list + stock/expiry info)
//   POST   /api/v1/inventory/products              (create, with units)
//   GET    /api/v1/inventory/products/{id}         (detail)
//   PATCH  /api/v1/inventory/products/{id}         (update, units optional)
//   DELETE /api/v1/inventory/products/{id}         (soft delete → deactivate)
//
// All requests require the authenticated admin session cookie
// (HTTP-only — sent automatically with `credentials: "include"`).

import { API_BASE_URL } from "../auth/authApi";
import { cacheRead, invalidateCache, invalidateCachePrefix } from "./apiCache";

// ─── Types (mirror the backend response shapes) ──────────────────────────────

export interface ProductGroupRefDto {
  id: string;
  name: string;
  /** Only present on get-one responses. */
  isActive?: boolean;
}

export interface UnitRefDto {
  id: string;
  name: string;
  symbol: string | null;
  isActive?: boolean;
}

/** Product unit link as returned by POST / PATCH / GET detail. */
export interface ProductUnitDto {
  id: string;
  productId: string;
  unitId: string;
  conversionFactor: number;
  sellPrice: number;
  purchasePrice: number;
  isBaseUnit: boolean;
  createdAt?: string;
  updatedAt?: string;
  unit: UnitRefDto;
}

/** Row of GET /inventory/products. */
export interface ProductDto {
  id: string;
  name: string;
  genericName: string | null;
  brand: string | null;
  sku: string;
  isActive: boolean;
  productGroup: ProductGroupRefDto | null;
}

/** Stock/expiry enrichment row of GET /inventory/inventory-products. */
export interface InventoryProductDto {
  id: string;
  name: string;
  genericName: string | null;
  brand: string | null;
  sku: string;
  productGroup: ProductGroupRefDto | null;
  isActive: boolean;
  minimumStock: number;
  reorderPoint: number | null;
  baseUnit: UnitRefDto | null;
  totalStock: number;
  selectedLocationStock: number | null;
  nearestExpiry: {
    batchId: string;
    batchNumber: string;
    expiryDate: string;
    quantity: number;
  } | null;
  stockStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
}

export interface LocationStockSummaryDto {
  locationId: string;
  locationName: string;
  quantity: number;
}

/** Response of GET /inventory/products/{id}. */
export interface ProductDetailDto {
  id: string;
  name: string;
  genericName: string | null;
  brand: string | null;
  sku: string;
  description: string | null;
  imageUrl: string | null;
  minimumStock: number;
  reorderPoint: number | null;
  isActive: boolean;
  productGroupId: string | null;
  createdAt: string;
  updatedAt: string;
  productGroup: ProductGroupRefDto | null;
  baseUnit: UnitRefDto | null;
  units: ProductUnitDto[];
  stockSummary: {
    totalQuantity: number;
    baseUnit: UnitRefDto | null;
    byLocation: LocationStockSummaryDto[];
  };
  batchCount: number;
  transactionCount: number;
  locationCount: number;
}

export interface ListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ProductListResult {
  data: ProductDto[];
  meta: ListMeta;
}

export interface InventoryProductListResult {
  data: InventoryProductDto[];
  meta: ListMeta;
}

/** Body for POST /inventory/products. */
export interface ProductUnitInput {
  unitId: string;
  conversionFactor: number;
  sellPrice: number;
  purchasePrice: number;
  isBaseUnit: boolean;
}

export interface CreateProductInput {
  name: string;
  genericName?: string | null;
  brand?: string | null;
  sku: string;
  productGroupId: string;
  description?: string | null;
  minimumStock: number;
  reorderPoint?: number | null;
  isActive?: boolean;
  units: ProductUnitInput[];
}

/** Body for PATCH /inventory/products/{id} — all fields optional. */
export interface UpdateProductInput {
  name?: string;
  genericName?: string | null;
  brand?: string | null;
  sku?: string;
  productGroupId?: string;
  description?: string | null;
  minimumStock?: number;
  reorderPoint?: number | null;
  isActive?: boolean;
  units?: ProductUnitInput[];
}

export interface ProductsQuery {
  page?: number;
  limit?: number;
  search?: string;
  productGroupId?: string;
  brand?: string;
  isActive?: boolean;
}

export interface InventoryProductsQuery {
  page?: number;
  limit?: number;
  search?: string;
  productGroupId?: string;
  brand?: string;
  locationId?: string;
  stockStatus?: string;
  isActive?: boolean;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class ProductsApiError extends Error {
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
    this.name = "ProductsApiError";
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
      return "You don't have permission to manage products.";
    case 404:
      return "This product no longer exists.";
    case 409:
      return "A product with that SKU already exists.";
    default:
      return `Request failed (HTTP ${status}).`;
  }
}

async function parseErrorResponse(res: Response): Promise<ProductsApiError> {
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

  return new ProductsApiError(message, { status: res.status, code, details });
}

// ─── Request plumbing ────────────────────────────────────────────────────────

const PRODUCTS_BASE = `${API_BASE_URL}/api/v1/inventory/products`;
const INVENTORY_PRODUCTS_BASE = `${API_BASE_URL}/api/v1/inventory/inventory-products`;

async function productsRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
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
    throw new ProductsApiError(
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

async function inventoryProductsRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${INVENTORY_PRODUCTS_BASE}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ProductsApiError(
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

function buildQueryString(query: Record<string, string | number | boolean | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

// ─── Endpoints ───────────────────────────────────────────────────────────────

/** GET /inventory/products — product list with optional pagination & filters. */
export async function listProducts(
  query: ProductsQuery = {},
): Promise<ProductListResult> {
  const qs = buildQueryString({
    page: query.page,
    limit: query.limit,
    search: query.search,
    productGroupId: query.productGroupId,
    brand: query.brand,
    isActive: query.isActive,
  });
  const result = await productsRequest<ProductListResult>(qs);
  return (
    result ?? {
      data: [],
      meta: { page: 1, limit: query.limit ?? 20, total: 0, totalPages: 1 },
    }
  );
}

/**
 * GET /inventory/inventory-products — product list enriched with stock,
 * nearest expiry, base unit and stock status.
 */
export async function listInventoryProducts(
  query: InventoryProductsQuery = {},
): Promise<InventoryProductListResult> {
  const qs = buildQueryString({
    page: query.page,
    limit: query.limit,
    search: query.search,
    productGroupId: query.productGroupId,
    brand: query.brand,
    locationId: query.locationId,
    stockStatus: query.stockStatus,
    isActive: query.isActive,
  });
  // Reference list used by pickers all over the app — cache briefly; the
  // product mutations below invalidate on create/update/deactivate.
  return cacheRead(`inventory-products:${qs}`, async () => {
    const result = await inventoryProductsRequest<InventoryProductListResult>(qs);
    return (
      result ?? {
        data: [],
        meta: { page: 1, limit: query.limit ?? 20, total: 0, totalPages: 1 },
      }
    );
  });
}

/** POST /inventory/products — create a product with its units & pricing. */
export async function createProduct(input: CreateProductInput): Promise<ProductDetailDto> {
  const result = await productsRequest<{ data: ProductDetailDto }>("", {
    method: "POST",
    body: JSON.stringify({
      name: input.name.trim(),
      ...(input.genericName?.trim() ? { genericName: input.genericName.trim() } : {}),
      ...(input.brand?.trim() ? { brand: input.brand.trim() } : {}),
      sku: input.sku.trim(),
      productGroupId: input.productGroupId,
      ...(input.description?.trim() ? { description: input.description.trim() } : {}),
      minimumStock: input.minimumStock,
      ...(input.reorderPoint != null ? { reorderPoint: input.reorderPoint } : {}),
      isActive: input.isActive ?? true,
      units: input.units,
    }),
  });
  invalidateCachePrefix("inventory-products:");
  if (result?.data) invalidateCache(`product:${result.data.id}`);
  return result.data;
}

/** GET /inventory/products/{id} — full product detail incl. units & stock. */
export async function getProduct(id: string): Promise<ProductDetailDto> {
  // Cached briefly: pickers/modal loads call this repeatedly. Invalidated by
  // product mutations (below) and by stock-changing mutations (stockApi,
  // purchaseReturnsApi) so stock figures stay fresh.
  return cacheRead(`product:${id}`, async () => {
    const result = await productsRequest<{ data: ProductDetailDto }>(
      `/${encodeURIComponent(id)}`,
    );
    if (!result?.data) throw new ProductsApiError("Product not found.");
    return result.data;
  });
}

/**
 * PATCH /inventory/products/{id} — update product fields.
 * Include `units` only when changing the unit configuration
 * (it must contain exactly one base unit with conversionFactor 1).
 */
export async function updateProduct(
  id: string,
  input: UpdateProductInput,
): Promise<ProductDetailDto> {
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body.name = input.name.trim();
  if (input.genericName !== undefined)
    body.genericName = input.genericName?.trim() || null;
  if (input.brand !== undefined) body.brand = input.brand?.trim() || null;
  if (input.sku !== undefined) body.sku = input.sku.trim();
  if (input.productGroupId !== undefined) body.productGroupId = input.productGroupId;
  if (input.description !== undefined)
    body.description = input.description?.trim() || null;
  if (input.minimumStock !== undefined) body.minimumStock = input.minimumStock;
  if (input.reorderPoint !== undefined) body.reorderPoint = input.reorderPoint;
  if (input.isActive !== undefined) body.isActive = input.isActive;
  if (input.units !== undefined) body.units = input.units;

  const result = await productsRequest<{ data: ProductDetailDto }>(
    `/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(body) },
  );
  invalidateCache(`product:${id}`);
  invalidateCachePrefix("inventory-products:");
  return result.data;
}

/**
 * DELETE /inventory/products/{id} — soft delete (deactivate).
 */
export async function deactivateProduct(id: string): Promise<void> {
  await productsRequest<unknown>(`/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  invalidateCache(`product:${id}`);
  invalidateCachePrefix("inventory-products:");
}
