// ── Base-unit lookup for product ids ─────────────────────────────────────────
// Two endpoints report a quantity in BASE units without echoing the unit itself:
//
//   • `PurchaseReturn.quantity` — documented "Base units"; the DTO has no `unit`
//     field at all (see `purchaseReturnsApi.ts`).
//   • `GET /financials/reports/narcotics` — undocumented route; its batch objects
//     carry only `currentQuantity` (see `reportsApi.ts`).
//
// In both cases the authoritative unit is the PRODUCT'S OWN BASE UNIT, which the
// app already reads from two memoised catalogue endpoints:
//
//   • GET /inventory/inventory-products → `InventoryProductDto.baseUnit`
//   • GET /inventory/products/{id}     → `ProductDetailDto.baseUnit`
//
// This hook reuses those existing reads. It adds no new endpoint, no second
// product/unit mapping and no unit of its own; a product whose base unit cannot
// be read stays unresolved and the caller renders the app's "—" fallback.
//
// Read strategy mirrors `purchaseReturnLabels`: ONE batched catalogue read
// normally covers every product on the page, and only the ids that read did not
// include are topped up individually (both endpoints are memoised by `apiCache`,
// so revisiting a page does not re-fetch). A failed lookup is swallowed here —
// the tables must still render their quantities when only the unit is missing.

import { useEffect, useMemo, useState } from "react";
import {
  getProduct,
  listInventoryProducts,
} from "../features/inventory/productsApi";
import { unitName } from "../utils/format";

/** Catalogue page size — one read, the same bound the other lookups use. */
const CATALOGUE_PAGE_SIZE = 100;

export interface ProductBaseUnits {
  /** False while the lookup is in flight. */
  ready: boolean;
  /** The product's base-unit name, or `""` when it could not be resolved. */
  unitOf: (productId: string | null | undefined) => string;
}

export function useProductBaseUnits(
  productIds: Array<string | null | undefined>,
): ProductBaseUnits {
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [ready, setReady] = useState(false);

  // Distinct ids only, so a re-render with the same rows never refetches. The
  // dependency is the joined key because callers pass a freshly built array.
  const idsKey = Array.from(new Set(productIds.filter(Boolean) as string[]))
    .sort()
    .join(",");
  const ids = useMemo(
    () => (idsKey ? idsKey.split(",") : []),
    [idsKey],
  );

  useEffect(() => {
    if (ids.length === 0) {
      setNames(new Map());
      setReady(true);
      return;
    }

    let cancelled = false;
    setReady(false);

    async function load() {
      const catalogue = await listInventoryProducts({
        limit: CATALOGUE_PAGE_SIZE,
      }).catch(() => null);
      if (cancelled) return;

      const map = new Map<string, string>();
      const notInCatalogue: string[] = [];
      for (const id of ids) {
        const row = catalogue?.data.find((p) => p.id === id);
        // A product the batched read returned WITH a null `baseUnit` has no base
        // unit at all — that is missing data, so no further request is made for
        // it. Only a product the read did not include (page limit, or the read
        // itself failed) is worth asking for individually.
        if (!row && catalogue) notInCatalogue.push(id);
        const name = unitName(row?.baseUnit);
        if (name) map.set(id, name);
      }

      // Everything was covered by the single catalogue read.
      if (notInCatalogue.length === 0) {
        setNames(map);
        setReady(true);
        return;
      }

      // The catalogue read did not include these products (page limit). Ask for
      // just those, so a unit is never silently dropped for a valid product.
      const details = await Promise.all(
        notInCatalogue.map((id) => getProduct(id).catch(() => null)),
      );
      if (cancelled) return;

      notInCatalogue.forEach((id, i) => {
        const name = unitName(details[i]?.baseUnit);
        if (name) map.set(id, name);
      });
      setNames(map);
      setReady(true);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [ids]);

  return {
    ready,
    unitOf: (productId) => (productId ? (names.get(productId) ?? "") : ""),
  };
}