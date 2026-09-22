// ── Searchable server-backed selectors ──────────────────────────────────────
// Adapters between the app's list APIs and the shared SearchableSelect /
// useSearchableResource hook. Each fetcher performs a debounced server-side
// search (all list endpoints expose `search`) paginated at 20 rows, and caches
// exact term+page reads via apiCache so identical lookups within the 10s TTL
// don't re-hit the server. Mutation invalidations in the individual API
// modules already clear these keys (they share the resource prefix).

import type { SearchableOption } from "../../components/ui/SearchableSelect";
import { cacheRead } from "./apiCache";
import { listInventoryProducts, type InventoryProductDto } from "./productsApi";
import { listLocations, type LocationDto } from "./locationsApi";
import { listProductGroups } from "./productGroupsApi";
import { listBatches, type BatchDto } from "./batchesApi";
import { listUnits, type UnitDto } from "./unitsApi";
import { listSuppliers, type SupplierDto } from "../purchasing/suppliersApi";

export const SEARCH_PAGE_SIZE = 20;

export interface SearchPageResult {
  items: SearchableOption[];
  hasMore: boolean;
  total?: number;
}

interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function pageResult<T>(data: T[], meta: PageMeta, toOption: (item: T) => SearchableOption): SearchPageResult {
  return {
    items: data.map(toOption),
    hasMore: meta.page < meta.totalPages,
    total: meta.total,
  };
}

function pickerQuery(page: number, term: string, extra: Record<string, string | number | boolean | undefined> = {}) {
  const query: { page: number; limit: number; search?: string } & Record<string, unknown> = {
    page,
    limit: SEARCH_PAGE_SIZE,
    ...(term ? { search: term } : {}),
  };
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== null && value !== "") query[key] = value;
  }
  return query;
}

// ─── Products ───────────────────────────────────────────────────────────────

function productOption(p: InventoryProductDto): SearchableOption {
  return {
    value: p.id,
    label: p.name,
    sub: p.brand ? `${p.sku} · ${p.brand}` : p.sku,
  };
}

/** Server-search the product catalog (no active filter — all products). */
export function searchProducts(term: string, page = 1): Promise<SearchPageResult> {
  const qs = pickerQuery(page, term);
  return cacheRead(`products:search:${JSON.stringify(qs)}`, async () => {
    const result = await listInventoryProducts(qs);
    return pageResult(result.data, result.meta, productOption);
  });
}

// ─── Product groups ─────────────────────────────────────────────────────────

function groupOption(g: { id: string; name: string }): SearchableOption {
  return { value: g.id, label: g.name };
}

/** Server-search product groups (active only). */
export function searchProductGroups(term: string, page = 1): Promise<SearchPageResult> {
  const qs = pickerQuery(page, term, { isActive: true });
  return cacheRead(`product-groups:search:${JSON.stringify(qs)}`, async () => {
    const result = await listProductGroups(qs);
    return pageResult(result.data, result.meta, groupOption);
  });
}

// ─── Suppliers ──────────────────────────────────────────────────────────────

function supplierOption(s: SupplierDto): SearchableOption {
  return {
    value: s.id,
    label: s.name,
    sub: s.contactPerson ? `${s.contactPerson}${s.email ? ` · ${s.email}` : ""}` : (s.email ?? undefined),
  };
}

/** Server-search suppliers (active only). */
export function searchSuppliers(term: string, page = 1): Promise<SearchPageResult> {
  const qs = pickerQuery(page, term, { isActive: true });
  return cacheRead(`suppliers:search:${JSON.stringify(qs)}`, async () => {
    const result = await listSuppliers(qs);
    return pageResult(result.data, result.meta, supplierOption);
  });
}

// ─── Locations ──────────────────────────────────────────────────────────────

function locationOption(l: LocationDto): SearchableOption {
  return {
    value: l.id,
    label: l.name,
    sub: l.description ?? undefined,
    hint: l.isActive ? undefined : "Inactive",
  };
}

/** Server-search storage locations (all, incl. inactive flagged). */
export function searchLocations(term: string, page = 1): Promise<SearchPageResult> {
  const qs = pickerQuery(page, term);
  return cacheRead(`locations:search:${JSON.stringify(qs)}`, async () => {
    const result = await listLocations(qs);
    return pageResult(result.data, result.meta, locationOption);
  });
}

// ─── Batches ────────────────────────────────────────────────────────────────

function batchOption(b: BatchDto): SearchableOption {
  return {
    value: b.id,
    label: b.batchNumber,
    sub: b.expiryDate ? `Expires ${new Date(b.expiryDate).toLocaleDateString()}` : undefined,
    hint: `${b.totalQuantity} in stock`,
  };
}

/** Server-search batches, optionally scoped to a product. */
export function searchBatches(term: string, page = 1, productId?: string): Promise<SearchPageResult> {
  const qs = pickerQuery(page, term, { productId });
  return cacheRead(`batches:search:${JSON.stringify(qs)}`, async () => {
    const result = await listBatches(qs);
    return pageResult(result.data, result.meta, batchOption);
  });
}

// ─── Units ───────────────────────────────────────────────────────────────────

function unitOption(u: UnitDto): SearchableOption {
  return { value: u.id, label: u.name, sub: u.symbol ?? undefined };
}

/** Server-search units (typeahead for unit configuration screens). */
export function searchUnits(term: string, page = 1): Promise<SearchPageResult> {
  const qs = pickerQuery(page, term);
  return cacheRead(`units:search:${JSON.stringify(qs)}`, async () => {
    const result = await listUnits(qs);
    return pageResult(result.data, result.meta, unitOption);
  });
}