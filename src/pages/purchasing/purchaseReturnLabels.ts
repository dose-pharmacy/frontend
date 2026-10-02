// ── Name resolution for purchase-return records ──────────────────────────────
// `PurchaseReturn` publishes only `supplierId`, `productId`, `batchId` and
// `locationId` — it embeds no supplier/product/batch/location objects and no
// user. Rather than invent nested fields, the UI resolves names through
// endpoints the app already uses, and it does so with a bounded number of
// requests per page rather than one request per table row:
//
//   • suppliers — one paged read of GET /purchasing/suppliers
//   • locations — one paged read of GET /inventory/locations
//   • products  — one read of GET /purchasing/suppliers/{id}/products per
//                 DISTINCT supplier present on the page (a return row always
//                 carries both ids, so this maps every product we can show)
//
// All three read paths are already memoised by `apiCache`, so revisiting a
// page does not re-fetch. Anything the catalogue pages do not contain renders
// as "—" rather than a guess.

import { useEffect, useMemo, useState } from "react"
import { listSupplierProducts, listSuppliers } from "../../features/purchasing/suppliersApi"
import { listLocations } from "../../features/inventory/locationsApi"

/** Reference-list page size. Large enough for a single pharmacy's catalogue. */
const LOOKUP_PAGE_SIZE = 100

/** The ids on one `PurchaseReturn` row that need a human-readable name. */
export interface ReturnLabelSource {
  supplierId: string
  productId: string
  locationId: string
}

export interface ReturnLabels {
  /** False while the reference lists are still in flight. */
  ready: boolean
  supplierName: (id: string | null | undefined) => string
  productName: (id: string | null | undefined) => string
  locationName: (id: string | null | undefined) => string
}

const EMPTY_NAME = "—"

function pick(
  map: Map<string, string>,
  id: string | null | undefined,
): string {
  if (!id) return EMPTY_NAME
  return map.get(id) ?? EMPTY_NAME
}

export function useReturnLabels(sources: ReturnLabelSource[]): ReturnLabels {
  const [suppliers, setSuppliers] = useState<Map<string, string>>(new Map())
  const [locations, setLocations] = useState<Map<string, string>>(new Map())
  const [products, setProducts] = useState<Map<string, string>>(new Map())
  const [ready, setReady] = useState(false)

  // Distinct ids only, so a re-render with the same rows never refetches.
  const supplierIds = useMemo(
    () => Array.from(new Set(sources.map((s) => s.supplierId).filter(Boolean))).sort(),
    [sources],
  )
  const locationIds = useMemo(
    () => Array.from(new Set(sources.map((s) => s.locationId).filter(Boolean))).sort(),
    [sources],
  )
  const supplierKey = supplierIds.join(",")
  const locationKey = locationIds.join(",")

  useEffect(() => {
    let cancelled = false

    async function load() {
      setReady(false)

      const [supplierResult, locationResult, productBySupplier] = await Promise.all([
        listSuppliers({ page: 1, limit: LOOKUP_PAGE_SIZE }).catch(() => null),
        listLocations({ page: 1, limit: LOOKUP_PAGE_SIZE }).catch(() => null),
        Promise.all(
          supplierIds.map(async (supplierId) => {
            const result = await listSupplierProducts(supplierId, {
              page: 1,
              limit: LOOKUP_PAGE_SIZE,
            }).catch(() => null)
            return [supplierId, result?.data ?? []] as const
          }),
        ),
      ])

      if (cancelled) return

      setSuppliers(
        new Map((supplierResult?.data ?? []).map((s) => [s.id, s.name])),
      )
      setLocations(
        new Map((locationResult?.data ?? []).map((l) => [l.id, l.name])),
      )

      // Products are scoped per supplier, so the same product id can appear
      // under two suppliers with two lookups; last write wins harmlessly
      // because the name is identical either way.
      const productMap = new Map<string, string>()
      for (const [, list] of productBySupplier) {
        for (const p of list) productMap.set(p.id, p.name)
      }
      setProducts(productMap)
      setReady(true)
    }

    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierKey, locationKey])

  return {
    ready,
    supplierName: (id) => pick(suppliers, id),
    productName: (id) => pick(products, id),
    locationName: (id) => pick(locations, id),
  }
}
