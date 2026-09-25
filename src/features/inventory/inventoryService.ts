// Service layer — swap the mock implementations below with real API calls.
// UI components depend only on the function signatures, not on mock details.

import {
  MOCK_PRODUCTS, MOCK_BATCHES, MOCK_UNITS, MOCK_GROUPS,
  MOCK_TRANSACTIONS, MOCK_BIN_CARD, LOCATION_STOCK, REORDER_DATA,
  MASTER_UNITS, MOCK_LOCATIONS,
  type Product, type Batch, type BatchStatus, type Unit, type ProductGroup,
  type Transaction, type BinCardEntry, type MasterUnit, type Location,
} from "./inventoryMock";
import {
  listBatches as listBatchesApi,
  getBatch as getBatchApi,
  createBatch as createBatchApi,
  updateBatch as updateBatchApi,
  deactivateBatch as deactivateBatchApi,
  BatchesApiError,
  type BatchDto,
  type BatchStatusDto,
  type BatchDetailDto,
} from "./batchesApi";
import { listInventoryProducts, type InventoryProductDto } from "./productsApi";
import { getStock } from "./stockApi";

const delay = (ms = 600) => new Promise((r) => setTimeout(r, ms));

// ─── Products ──────────────────────────────────────────────────────────────
export async function getProducts(): Promise<Product[]> {
  await delay();
  return [...MOCK_PRODUCTS];
}

export async function getProduct(id: string): Promise<Product | null> {
  await delay(400);
  return MOCK_PRODUCTS.find((p) => p.id === id) ?? null;
}

// ─── Batches ───────────────────────────────────────────────────────────────
// NOTE: getBatches() below still serves MOCK_BATCHES for the pages whose
// endpoints are not wired up yet (Stock, Bin Card, dashboards, transfers…).
// The three batch pages (BatchManagementPage, BatchesExpiryPage,
// BatchDetailPage) use the real backend through fetchBatches/fetchBatchById
// + createBatch/updateBatch/deleteBatch (see ./batchesApi).

export async function getBatches(productId?: string): Promise<Batch[]> {
  await delay();
  return productId
    ? MOCK_BATCHES.filter((b) => b.productId === productId)
    : [...MOCK_BATCHES];
}

function toUiStatus(status: BatchStatusDto | undefined): BatchStatus {
  return (status ?? "AVAILABLE").toLowerCase() as BatchStatus;
}

function isoDate(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "";
}

function primaryLocation(dto: BatchDto, locationsByBatch?: Map<string, string>): string {
  const fromMap = locationsByBatch?.get(dto.id);
  if (fromMap) return fromMap;

  // Detail responses embed locationStock; list rows (handled above) don't.
  const stock = (dto as BatchDetailDto).locationStock;
  if (Array.isArray(stock) && stock.length > 0) {
    const top = [...stock].sort((a, b) => (b.quantity ?? 0) - (a.quantity ?? 0))[0];
    if (top?.locationName) return top.locationName;
  }
  return "—";
}

/** Adapt a backend BatchDto to the UI's mock `Batch` shape. */
function adaptBatch(dto: BatchDto, locationsByBatch?: Map<string, string>): Batch {
  return {
    id: dto.id,
    productId: dto.productId,
    batchNumber: dto.batchNumber,
    quantity: dto.totalQuantity ?? 0,
    expiryDate: isoDate(dto.expiryDate),
    receivedDate: isoDate(dto.receivedDate),
    supplier: dto.supplierReference ?? "—",
    location: primaryLocation(dto, locationsByBatch),
    status: toUiStatus(dto.status),
    purchaseCost: dto.purchaseCost ?? undefined,
    supplierReference: dto.supplierReference ?? undefined,
  };
}

function adaptBatchDetail(dto: BatchDto, fallbackName?: string): BatchDetail {
  return {
    ...adaptBatch(dto),
    productName: dto.product?.name ?? fallbackName ?? dto.productId,
  };
}

/** `Batch` plus the product name embedded in the backend batch detail. */
export interface BatchDetail extends Batch {
  productName: string;
}

/** Light product shape for pickers/name lookups on the batch pages. */
export interface ProductOption {
  id: string;
  name: string;
  baseUnit: string;
}

/**
 * GET /inventory/batches — live batches for the batch pages, optionally
 * filtered server-side by location (list rows carry no location data).
 * Walks the paginated endpoint so backend page-size caps can't hide rows.
 */
export async function fetchBatches(locationId?: string): Promise<Batch[]> {
  const [first, locationsByBatch] = await Promise.all([
    listBatchesApi({ limit: 100, locationId }),
    buildBatchLocationMap(),
  ]);
  const rows = [...first.data];
  const totalPages = Math.min(first.meta?.totalPages ?? 1, 10);
  for (let page = 2; page <= totalPages; page++) {
    const next = await listBatchesApi({ page, limit: 100, locationId });
    rows.push(...next.data);
  }
  return rows.map((dto) => adaptBatch(dto, locationsByBatch));
}


/** Build batchId → location name(s) from live stock rows (the batch list
 *  endpoint itself carries no location data). Batches split across more
 *  than one location are joined with ", ". */
async function buildBatchLocationMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const first = await getStock({ page: 1, limit: 100 });
    const rows = [...first.data];
    const totalPages = Math.min(first.pagination?.totalPages ?? 1, 10);
    for (let page = 2; page <= totalPages; page++) {
      const next = await getStock({ page, limit: 100 });
      rows.push(...next.data);
    }
    for (const row of rows) {
      const name = (row.location as { name?: string } | undefined)?.name;
      if (!row.batchId || !name) continue;
      const existing = map.get(row.batchId);
      map.set(row.batchId, existing && !existing.includes(name) ? `${existing}, ${name}` : (existing ?? name));
    }
  } catch {
    // Location enrichment is best-effort — batches still load without it.
  }
  return map;
}


/** GET /inventory/batches/{id} — live single batch; null when not found. */
export async function fetchBatchById(id: string): Promise<BatchDetail | null> {
  try {
    return adaptBatchDetail(await getBatchApi(id));
  } catch (err) {
    if (err instanceof BatchesApiError && err.status === 404) return null;
    throw err;
  }
}

/**
 * GET /inventory/inventory-products — real product options for batch pages.
 * Walks the paginated endpoint (page + limit) — the backend rejects oversized
 * `limit` values and requires `page`, so a single large page fetch is not an
 * option.
 */
export async function fetchProductOptions(): Promise<ProductOption[]> {
  const rows: InventoryProductDto[] = [];
  const first = await listInventoryProducts({ page: 1, limit: 100 });
  rows.push(...first.data);
  const totalPages = Math.min(first.meta?.totalPages ?? 1, 30);
  for (let page = 2; page <= totalPages; page++) {
    const next = await listInventoryProducts({ page, limit: 100 });
    rows.push(...next.data);
  }
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    baseUnit: p.baseUnit?.name ?? "",
  }));
}

// PATCH /inventory/batches/{id}
// ⚠️ The backend REQUIRES batchNumber on every PATCH — callers must pass the
// batch's current batch number through unchanged unless renaming it.
export interface UpdateBatchPayload {
  batchNumber: string
  expiryDate?: string
  purchaseCost?: number
  supplierReference?: string
}

export async function updateBatch(
  id: string,
  payload: UpdateBatchPayload,
  currentProductName?: string,
): Promise<BatchDetail> {
  const dto = await updateBatchApi(id, {
    batchNumber: payload.batchNumber,
    expiryDate: payload.expiryDate,
    purchaseCost: payload.purchaseCost,
    supplierReference: payload.supplierReference,
  });
  // PATCH responses don't embed the product — keep the name the page loaded.
  return adaptBatchDetail(dto, currentProductName);
}

// DELETE /inventory/batches/{id} — soft delete / deactivate
export async function deleteBatch(id: string): Promise<void> {
  await deactivateBatchApi(id);
}

// POST /inventory/batches
export interface CreateBatchPayload {
  productId: string;
  unitId: string;
  batchNumber: string;
  receivedDate: string; // "YYYY-MM-DD"
  expiryDate: string;   // "YYYY-MM-DD"
  purchaseCost: number;
  supplierReference: string;
}

export async function createBatch(payload: CreateBatchPayload): Promise<Batch> {
  const dto = await createBatchApi({
    productId: payload.productId,
    unitId: payload.unitId,
    batchNumber: payload.batchNumber,
    receivedDate: payload.receivedDate,
    expiryDate: payload.expiryDate,
    purchaseCost: payload.purchaseCost,
    supplierReference: payload.supplierReference?.trim() || undefined,
  });
  // POST responses don't embed product/quantity/status — the pages refetch
  // the list right after creating, so a plain adaptation is fine here.
  return adaptBatch(dto);
}

// ─── Units ─────────────────────────────────────────────────────────────────
export async function getUnits(productId: string): Promise<Unit[]> {
  await delay(400);
  return MOCK_UNITS.filter((u) => u.productId === productId);
}

// ─── Groups ────────────────────────────────────────────────────────────────
export async function getGroups(): Promise<ProductGroup[]> {
  await delay();
  return [...MOCK_GROUPS];
}

// ─── Transactions ──────────────────────────────────────────────────────────
export async function getTransactions(productId: string): Promise<Transaction[]> {
  await delay(400);
  return MOCK_TRANSACTIONS.filter((t) => t.productId === productId);
}

// ─── Bin Card ──────────────────────────────────────────────────────────────
export async function getBinCard(productId: string, batchId?: string): Promise<BinCardEntry[]> {
  await delay();
  let entries = MOCK_BIN_CARD.filter((e) => e.productId === productId);
  if (batchId) entries = entries.filter((e) => e.batchId === batchId || e.batchId === null);
  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Location Stock ────────────────────────────────────────────────────────
export async function getLocationStock() {
  await delay();
  return [...LOCATION_STOCK];
}

// ─── Reorder Data ──────────────────────────────────────────────────────────
export async function getReorderData() {
  await delay();
  return [...REORDER_DATA];
}

// ─── Master Units ──────────────────────────────────────────────────────────
export async function getMasterUnits(): Promise<MasterUnit[]> {
  await delay(400);
  return [...MASTER_UNITS];
}

// ─── Locations ─────────────────────────────────────────────────────────────
// NOTE: locations are now served by the real API client in ./locationsApi
// (listLocations, createLocation, getLocation, updateLocation, deactivateLocation).
// The mock getLocations below is kept only until every page stops using it.
export async function getLocations(): Promise<Location[]> {
  await delay(400);
  return [...MOCK_LOCATIONS];
}

// ─── All Transactions (for stock page) ────────────────────────────────────
export async function getAllTransactions(): Promise<Transaction[]> {
  await delay();
  return [...MOCK_TRANSACTIONS].sort((a, b) => b.date.localeCompare(a.date));
}

// ─── Utility helpers ───────────────────────────────────────────────────────
export function daysUntilExpiry(dateStr: string): number {
  const today = new Date();
  const expiry = new Date(dateStr);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function convertUnits(fromQty: number, fromUnit: Unit, toUnit: Unit, allUnits: Unit[]): number {
  // Simple conversion via root: walk hierarchy up from each unit, compute factor
  function factorToRoot(unit: Unit): number {
    if (!unit.parentId) return 1;
    const parent = allUnits.find((u) => u.id === unit.parentId);
    if (!parent) return 1;
    return (unit.quantityInParent ?? 1) * factorToRoot(parent);
  }
  const fromFactor = factorToRoot(fromUnit);
  const toFactor = factorToRoot(toUnit);
  return (fromQty * fromFactor) / toFactor;
}
