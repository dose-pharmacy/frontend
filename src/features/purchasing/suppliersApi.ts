// ── Suppliers API client ─────────────────────────────────────────────────────
// Talks to the pharmacy backend's purchasing supplier endpoints:
//   GET    /api/v1/purchasing/suppliers       (list, search, filter)
//   POST   /api/v1/purchasing/suppliers       (create)
//   GET    /api/v1/purchasing/suppliers/{id}  (detail: POs, invoices, counts)
//   PATCH  /api/v1/purchasing/suppliers/{id}  (update — partial body)
//   DELETE /api/v1/purchasing/suppliers/{id}  (delete; 409 when in use)
//   GET    /api/v1/purchasing/suppliers/{id}/products  (catalog lookup: products ordered from supplier)
//   GET    /api/v1/purchasing/suppliers/{id}/products/{productId}/batches  (catalog lookup: supplier-owned batches)
//
// All requests require the authenticated session cookie
// (HTTP-only — sent automatically with `credentials: "include"`).

import { API_BASE_URL } from "../auth/authApi";
import { cacheRead, invalidateCachePrefix } from "../inventory/apiCache";

// ─── Types (mirror the Swagger response shapes) ──────────────────────────────

export interface SupplierCountsDto {
  purchaseOrders: number;
  supplierInvoices: number;
  purchaseReturns: number;
}

export interface SupplierDto {
  id: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  paymentTerms: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  /** Present on list responses (and detail). */
  _count?: SupplierCountsDto;
  /** Outstanding payable balance in ETB — present on list/detail. */
  totalOutstanding?: number;
}

export interface SupplierPurchaseOrderDto {
  id: string;
  poNumber: string;
  status: string;
  orderDate: string;
  expectedDeliveryDate: string;
}

export interface SupplierInvoiceDto {
  id: string;
  invoiceNumber: string;
  status: string;
  invoiceAmount: number;
  outstandingBalance: number;
}

/** GET /suppliers/{id} and PATCH /suppliers/{id} responses embed relations. */
export interface SupplierDetailDto extends SupplierDto {
  purchaseOrders?: SupplierPurchaseOrderDto[];
  supplierInvoices?: SupplierInvoiceDto[];
}

export interface SupplierListMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SupplierListResult {
  data: SupplierDto[];
  meta: SupplierListMeta;
}

export interface SuppliersQuery {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

/** Body for POST /suppliers — only `name` is required by the backend. */
export interface CreateSupplierInput {
  name: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  paymentTerms?: string | null;
  isActive?: boolean;
}

/** Body for PATCH /suppliers/{id} — all fields optional. */
export type UpdateSupplierInput = Partial<CreateSupplierInput>;

// ─── Supplier catalog lookups (purchase-return flow) ─────────────────────────

/** Product ordered from the supplier — GET /suppliers/{id}/products. */
export interface SupplierProductDto {
  id: string;
  name: string;
  genericName: string | null;
  brand: string | null;
  sku: string;
  isActive: boolean;
  isNarcotic: boolean;
}

export interface SupplierProductsResult {
  data: SupplierProductDto[];
  meta: SupplierListMeta;
}

export interface SupplierProductsQuery {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

/** A batch of a product traceable to the supplier, with stock per location. */
export interface SupplierProductBatchLocationDto {
  locationId: string;
  locationName: string;
  availableQuantity: number;
}

export interface SupplierProductBatchDto {
  id: string;
  batchNumber: string;
  productId: string;
  productName: string;
  supplierId: string;
  expiryDate: string;
  purchaseCost: number | null;
  receivedDate: string | null;
  locations: SupplierProductBatchLocationDto[];
}

export interface SupplierBatchLookupSummary {
  supplier: { id: string; name: string };
  product: { id: string; name: string };
}

/** GET /suppliers/{id}/products/{productId}/batches — no meta (unpaginated). */
export interface SupplierBatchLookupResult {
  data: SupplierProductBatchDto[];
  summary?: SupplierBatchLookupSummary;
}

export interface SupplierProductBatchQuery {
  locationId?: string;
  inStock?: boolean;
  excludeExpired?: boolean;
}

/** GET /suppliers/{id}/products — products actually ordered from the supplier. */
export async function listSupplierProducts(
  supplierId: string,
  query: SupplierProductsQuery = {},
): Promise<SupplierProductsResult> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({
    page: query.page,
    limit: query.limit,
    search: query.search,
    isActive: query.isActive === undefined ? undefined : String(query.isActive),
  })) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  const key = `suppliers:products:${supplierId}:${qs}`;
  return cacheRead(key, async () => {
    const result = await suppliersRequest<SupplierProductsResult>(
      `/${encodeURIComponent(supplierId)}/products${qs ? `?${qs}` : ""}`,
    );
    return (
      result ?? { data: [], meta: { page: query.page ?? 1, limit: query.limit ?? 20, total: 0, totalPages: 1 } }
    );
  });
}

/**
 * GET /suppliers/{id}/products/{productId}/batches — batches owned by the
 * supplier (Batch.supplierId), FEFO-sorted, with availableQuantity per
 * location.
 */
export async function getSupplierProductBatches(
  supplierId: string,
  productId: string,
  query: SupplierProductBatchQuery = {},
): Promise<SupplierBatchLookupResult> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({
    locationId: query.locationId,
    inStock: query.inStock === undefined ? undefined : String(query.inStock),
    excludeExpired: query.excludeExpired === undefined ? undefined : String(query.excludeExpired),
  })) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  const key = `suppliers:batches:${supplierId}:${productId}:${qs}`;
  return cacheRead(key, async () => {
    const result = await suppliersRequest<SupplierBatchLookupResult>(
      `/${encodeURIComponent(supplierId)}/products/${encodeURIComponent(productId)}/batches${qs ? `?${qs}` : ""}`,
    );
    return result ?? { data: [] };
  });
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class SuppliersApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, options: { status: number; code?: string } = { status: 0 }) {
    super(message);
    this.name = "SuppliersApiError";
    this.status = options.status;
    this.code = options.code;
  }
}

function friendlyStatusMessage(status: number, code?: string): string {
  switch (status) {
    case 400:
      return "The supplier data was rejected — please check the fields.";
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return "You don't have permission to manage suppliers.";
    case 404:
      return "This supplier no longer exists.";
    case 409:
      if (code === "DUPLICATE_SUPPLIER") return "A supplier with this name already exists.";
      if (code === "SUPPLIER_IN_USE")
        return "This supplier has related purchase orders, invoices, or returns and cannot be deleted.";
      return "This supplier conflicts with existing data.";
    case 422:
      return "The supplier details are invalid — please check the fields.";
    default:
      return `Request failed (HTTP ${status}).`;
  }
}

// ─── Request plumbing ────────────────────────────────────────────────────────

const SUPPLIERS_BASE = `${API_BASE_URL}/api/v1/purchasing/suppliers`;

async function suppliersRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${SUPPLIERS_BASE}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new SuppliersApiError(
      "Cannot reach the server. Please check your connection and try again.",
    );
  }

  if (!res.ok) {
    let message = friendlyStatusMessage(res.status);
    let code: string | undefined;
    try {
      const body = (await res.json()) as {
        error?: { code?: string; message?: string };
        message?: string;
      } | null;
      if (body?.error?.code) {
        code = body.error.code;
        message = friendlyStatusMessage(res.status, code);
      }
      if (body?.error?.message) message = body.error.message;
      else if (body?.message) message = body.message;
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    throw new SuppliersApiError(message, { status: res.status, code });
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

/** GET /suppliers — paginated supplier list with search + active filter. */
export async function listSuppliers(query: SuppliersQuery = {}): Promise<SupplierListResult> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({
    page: query.page,
    limit: query.limit,
    search: query.search,
    isActive: query.isActive === undefined ? undefined : String(query.isActive),
  })) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  const key = `suppliers:list:${qs}`;
  return cacheRead(key, async () => {
    const result = await suppliersRequest<SupplierListResult>(qs ? `?${qs}` : "");
    return result ?? { data: [], meta: { page: 1, limit: query.limit ?? 20, total: 0, totalPages: 1 } };
  });
}

/** POST /suppliers — create a supplier (only `name` is required). */
export async function createSupplier(input: CreateSupplierInput): Promise<SupplierDto> {
  const result = await suppliersRequest<{ success: boolean; data: SupplierDto }>("", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!result?.data) throw new SuppliersApiError("Unexpected response from the server.");
  invalidateCachePrefix("suppliers:");
  return result.data;
}

/** GET /suppliers/{id} — supplier detail with POs, invoices and counts. */
export async function getSupplierById(id: string): Promise<SupplierDetailDto> {
  return cacheRead(`suppliers:detail:${id}`, async () => {
    const result = await suppliersRequest<{ success: boolean; data: SupplierDetailDto }>(
      `/${encodeURIComponent(id)}`,
    );
    if (!result?.data) throw new SuppliersApiError("Unexpected response from the server.");
    return result.data;
  });
}

/** PATCH /suppliers/{id} — partial update; returns the full detail shape. */
export async function updateSupplier(
  id: string,
  patch: UpdateSupplierInput,
): Promise<SupplierDetailDto> {
  const result = await suppliersRequest<{ success: boolean; data: SupplierDetailDto }>(
    `/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
  if (!result?.data) throw new SuppliersApiError("Unexpected response from the server.");
  invalidateCachePrefix("suppliers:");
  return result.data;
}

/**
 * DELETE /suppliers/{id} — remove a supplier.
 * Fails with 409 SUPPLIER_IN_USE when the supplier still has related records.
 */
export async function deleteSupplier(id: string): Promise<void> {
  await suppliersRequest<{ success: boolean; data: null }>(`/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  invalidateCachePrefix("suppliers:");
}
