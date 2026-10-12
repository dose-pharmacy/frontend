// ── Unit selection helpers ───────────────────────────────────────────────────
// Convert a product's configured units into picker options and preview base-
// unit equivalents. The conversion factor between the product-unit and the
// product's BASE unit (1 unit = factor base) is authoritative from the
// backend — the frontend only ever displays it, never interprets it.

import type { SearchableOption } from "../../components/ui/SearchableSelect";
import type { ProductDetailDto, ProductUnitDto, UnitRefDto } from "./productsApi";

export function unitRefLabel(unit: { name: string; symbol?: string | null } | null | undefined): string {
  if (!unit) return "";
  return unit.symbol ? `${unit.name} (${unit.symbol})` : unit.name;
}

/** Sort product units base-first, then by name. */
export function sortProductUnits(units: ProductUnitDto[]): ProductUnitDto[] {
  return [...units].sort((a, b) => {
    if (a.isBaseUnit !== b.isBaseUnit) return a.isBaseUnit ? -1 : 1;
    return (a.unit?.name ?? a.unitId).localeCompare(b.unit?.name ?? b.unitId);
  });
}

/** Picker options for one product's sold/ordered units (base unit first). */
export function productUnitOptions(product: Pick<ProductDetailDto, "units"> | null | undefined): SearchableOption[] {
  if (!product || product.units.length === 0) return [];
  const base = product.units.find((u) => u.isBaseUnit);
  return sortProductUnits(product.units).map((u) => ({
    value: u.unitId,
    label: u.isBaseUnit ? `${unitRefLabel(u.unit)}` : unitRefLabel(u.unit),
    sub: u.isBaseUnit
      ? "Base unit" + (base ? "" : "")
      : `1 ${u.unit?.name ?? ""} = ${formatFactor(u.conversionFactor)} base`,
    hint: u.isBaseUnit ? "base unit" : undefined,
  }));
}

export function formatFactor(factor: number): string {
  return Number.isInteger(factor) ? String(factor) : factor.toFixed(4).replace(/\.?0+$/, "");
}

/**
 * Equivalent of `qty` units of the given product-unit in BASE units.
 * Returns null when the unit link is missing.
 */
export function toBaseQuantity(qty: number, productUnit?: Pick<ProductUnitDto, "conversionFactor"> | null): number | null {
  if (!productUnit) return null;
  return qty * productUnit.conversionFactor;
}

/** Convert a base-unit quantity into the given product-unit (returns null when factor missing). */
export function fromBaseQuantity(qty: number, productUnit?: Pick<ProductUnitDto, "conversionFactor"> | null): number | null {
  if (!productUnit || productUnit.conversionFactor <= 0) return null;
  return qty / productUnit.conversionFactor;
}

/** Format a base-unit quantity together with its base unit label. */
export function baseQuantityLabel(quantity: number | null | undefined, baseUnit: UnitRefDto | null | undefined): string {
  if (quantity === null || quantity === undefined) return "—";
  const value = Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(3);
  return baseUnit ? `${value} ${baseUnit.name ?? baseUnit.symbol ?? ""}`.trim() : value;
}

/** Find the selected product-unit record by unitId. */
export function findProductUnit(
  product: Pick<ProductDetailDto, "units"> | null | undefined,
  unitId: string | null | undefined,
): ProductUnitDto | null | undefined {
  if (!product || !unitId) return undefined;
  return product.units.find((u) => u.unitId === unitId);
}

/** Display label for a product unit row: "name (symbol)" or just "name". */
export function unitLabel(u: ProductUnitDto | null): string {
  if (!u) return "";
  return u.unit.symbol ? `${u.unit.name} (${u.unit.symbol})` : u.unit.name;
}

/**
 * Find the requirement line's unit in the product's unit configuration
 * (by id first, then by name). Falls back to the base unit when unmatched.
 */
export function findUnitForLine(
  list: ProductUnitDto[] | undefined,
  line: { unitId?: string | null; unitName?: string },
): ProductUnitDto | undefined {
  if (!list || list.length === 0) return undefined;
  if (line.unitId) {
    const byId = list.find((u) => u.unitId === line.unitId);
    if (byId) return byId;
  }
  if (line.unitName) {
    const lineUnitName = line.unitName.toLowerCase();
    const byName = list.find(
      (u) => u.unit.name.toLowerCase() === lineUnitName,
    );
    if (byName) return byName;
  }
  return undefined;
}

/**
 * Resolve the unit a line works in: an explicitly chosen unit wins, otherwise
 * the requirement line's unit, otherwise the product's base unit. `factor`
 * converts one selected unit into base units (base factor = 1).
 * Shared by the Requirements → Order modal and the Order Remaining modal so
 * both always apply the same unit selection and conversion rules.
 */
export function resolveUnitChoice(
  list: ProductUnitDto[] | undefined,
  draft: {
    unitId: string | null;
    line: { unitId?: string | null; unitName?: string };
  },
): {
  selected: ProductUnitDto | null;
  base: ProductUnitDto | null;
  factor: number;
} {
  const units = list ?? [];
  const base = units.find((u) => u.isBaseUnit) ?? units[0] ?? null;
  const explicit = draft.unitId
    ? units.find((u) => u.unitId === draft.unitId)
    : undefined;
  const selected = explicit ?? findUnitForLine(units, draft.line) ?? base;
  return { selected, base, factor: selected?.conversionFactor ?? 1 };
}