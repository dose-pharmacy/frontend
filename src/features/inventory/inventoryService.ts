// Service layer — swap the mock implementations below with real API calls.
// UI components depend only on the function signatures, not on mock details.

import {
  MOCK_PRODUCTS, MOCK_BATCHES, MOCK_UNITS, MOCK_GROUPS,
  MOCK_TRANSACTIONS, MOCK_BIN_CARD, LOCATION_STOCK, REORDER_DATA,
  MASTER_UNITS, MOCK_LOCATIONS,
  type Product, type Batch, type Unit, type ProductGroup,
  type Transaction, type BinCardEntry, type MasterUnit, type Location,
} from "./inventoryMock";

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
export async function getBatches(productId?: string): Promise<Batch[]> {
  await delay();
  return productId
    ? MOCK_BATCHES.filter((b) => b.productId === productId)
    : [...MOCK_BATCHES];
}

export async function getBatch(id: string): Promise<Batch | null> {
  await delay(400);
  return MOCK_BATCHES.find((b) => b.id === id) ?? null;
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
