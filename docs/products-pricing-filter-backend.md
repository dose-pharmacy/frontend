# Products Page — Pricing Status Filter: Backend Spec

**Status: IMPLEMENTED (frontend + backend). Backend change needs deploying.**
**Target:** the API repo behind `dose-backend-ky5q.onrender.com`.
**Client:** `figma-make-app` — `src/pages/inventory/ProductsPage.tsx`.

> **Update.** Sections 1–2 below describe the gap as found on 2026-10-03 against
> the live spec; that gap has since been closed in the backend repo, and the
> frontend work in section 3 has landed. Kept as the record of why the change
> was needed. Until the backend is deployed, `pricingStatus` sent to
> `/inventory/inventory-products` is silently stripped by the zod validator and
> the dropdown will appear to do nothing.

---

## 1. Why this is blocked

The Products table is fed by `GET /inventory/inventory-products`, and that
endpoint has **no pricing capability at all**. Verified against the live
OpenAPI document (`/api-docs`, 270,950 bytes):

**`GET /inventory/inventory-products` query parameters — the complete list:**

```
page, limit, search, productGroupId, brand, locationId, stockStatus, isActive
```

No `pricingStatus`. Its response `InventoryProductListResponse` publishes
`id, name, genericName, brand, sku, productGroup, isActive, isNarcotic,
minimumStock, reorderPoint, baseUnit, totalStock, selectedLocationStock,
nearestExpiry, stockStatus` — **no `pricing` object**, and no `422` response is
even documented for it.

**`pricingStatus` exists on exactly one endpoint in the whole document:**

```
GET /inventory/products ?pricingStatus=ALL|OK|BELOW_TARGET|BELOW_COST|NO_MARGIN_CONFIG|NO_PURCHASE_COST
```

whose `ProductListItem` carries `pricing: ProductPricing`
(`sellingPrice`, `targetMargin`, `costBasis`, `targetSellingPrice`,
`pricingStatus`). That endpoint documents a `422` — *"Validation error (e.g.
unknown pricingStatus)"* — which `inventory-products` does not.

The parameter's own description confirms the filtering semantics required
here: *"The status is evaluated and filtered IN THE DATABASE before
pagination."*

The backend source is **not available** to this repository (no backend
directory, `nest-cli.json`, or relevant `schema.prisma` anywhere on the
machine). Auth is enforced **before** query validation, so the behaviour cannot
be probed from outside either — both URLs return `401`:

```
GET /inventory/inventory-products?pricingStatus=BELOW_TARGET  -> 401
GET /inventory/products?pricingStatus=BELOW_TARGET             -> 401
GET /inventory/products-pricing                                -> 404  (control)
```

A `401` proves the route exists; it cannot prove the parameter is honoured.

**No frontend workaround is possible that is not a lie.** The two endpoints are
independently paginated and independently ordered:

```
inventory-products page 1 = products 1–20
products          page 1 = pricing products 1–20   ← not the same 20 rows
```

Merging them client-side, or paging through every page to simulate the filter,
was explicitly ruled out. Adding an optional `pricing` field to
`InventoryProductDto` would compile and render `—` on every row forever, which
is worse than not shipping it.

---

## 2. Required backend change

Extend `GET /inventory/inventory-products` to accept `pricingStatus` and to
return the pricing object. This is the preferred architecture because the
endpoint already supplies every column the table needs.

### 2.1 Query DTO — one optional field

```ts
@IsOptional()
@IsEnum(PricingStatusFilter)          // ALL | OK | BELOW_TARGET | BELOW_COST
                                      //   NO_MARGIN_CONFIG | NO_PURCHASE_COST
pricingStatus?: PricingStatusFilter;
```

`ALL` should mean "no filter", matching `/inventory/products`.

### 2.2 Reuse the existing pricing evaluation

`ProductPricing` and its five-value `pricingStatus` enum already exist and are
returned by `/inventory/products`. **Reuse that service/helper and that enum.**
Do not create a second pricing-status calculator — two implementations of
"below target" will drift.

### 2.3 Filter in the query layer, before pagination

This is the part that matters. The pricing status depends on the product
group's target margin and the latest received purchase cost, so it is derived
rather than a plain column. Push the predicate into the same query builder /
`WHERE` used by `/inventory/products` so `COUNT`, `page` and `totalPages` all
reflect the filtered set.

If the derived status cannot be expressed in SQL on this endpoint's query, then
`/inventory/inventory-products` cannot honestly support the filter and the
Products table should be moved onto `/inventory/products` with the inventory
columns added to `ProductListItem` instead. **Pick one and say which** — do not
filter after pagination.

### 2.4 Response

Add one optional object to the inventory-product row:

```ts
pricing?: {
  sellingPrice: number | null;
  targetMargin: number | null;
  costBasis: number | null;
  targetSellingPrice: number | null;
  pricingStatus: 'OK' | 'BELOW_TARGET' | 'BELOW_COST' | 'NO_MARGIN_CONFIG' | 'NO_PURCHASE_COST';
}
```

and a `422` response for an unknown `pricingStatus`, matching
`/inventory/products`.

---

## 3. Frontend work — ready to land once §2 ships

Small and additive. Nothing below has been applied yet.

### `src/features/inventory/productsApi.ts`

- `InventoryProductsQuery` — add `pricingStatus?: PricingStatusFilter`.
- `InventoryProductDto` — add `pricing?: ProductPricing`.
- Add `export type PricingStatus = 'OK' | 'BELOW_TARGET' | 'BELOW_COST' | 'NO_MARGIN_CONFIG' | 'NO_PURCHASE_COST'`
  and `export interface ProductPricing { … }`.
- `listInventoryProducts` — pass `pricingStatus` into the existing
  `buildQueryString` call.

No new client function, no second API module — `productsApi.ts` already serves
both endpoints (`PRODUCTS_BASE` and `INVENTORY_PRODUCTS_BASE`).

§13 is already satisfied: `buildQueryString` drops `undefined` and `""`, so
returning to "All Pricing Statuses" omits the parameter entirely.

### `src/pages/inventory/ProductsPage.tsx`

- `const [pricingFilter, setPricingFilter] = useState("")`
- Thread it through `reload(...)` alongside the existing `search`,
  `statusFilter`, `groupFilter`, `page` — same request/refetch flow, no separate
  data system. Reset `page` to 1 in the change handler, as the existing filters
  already do.
- A `<Select>` beside Status and Group, `sm:w-52`, matching the existing
  `statusFilter` control. Options are the documented enum:

  | Label | Value |
  |---|---|
  | All Pricing Statuses | `""` (omitted) |
  | OK | `OK` |
  | Below Target | `BELOW_TARGET` |
  | Below Cost | `BELOW_COST` |
  | No Margin Config | `NO_MARGIN_CONFIG` |
  | No Purchase Cost | `NO_PURCHASE_COST` |

- One `<th>Pricing</th>` and one `<td>` reading **only**
  `product.pricing?.pricingStatus`, rendering `—` when absent. Labels per §9.
  The backend is the source of truth — never derive it from
  `sellingPrice` / `costBasis` / `targetSellingPrice` in React.

### Badge

`StatusBadge` currently accepts only
`in_stock | low_stock | out_of_stock | available | depleted | expired` and has
no pricing mapping. Rather than overloading a stock badge, add a small
`PricingStatusBadge` in `src/components/ui/` reusing the same visual language
(`rounded-full px-2.5 py-0.5 text-xs font-medium`):

| Status | Suggested tone |
|---|---|
| `OK` | green |
| `BELOW_TARGET` | yellow |
| `BELOW_COST` | red |
| `NO_MARGIN_CONFIG` | gray |
| `NO_PURCHASE_COST` | gray |

### §21 reuse

Checked: **no page currently consumes `/inventory/products` pricing.** The only
`pricing` identifiers in the app are `ProductFormModal`'s own local
sell/purchase-price summary and the literal heading *"Units & Pricing"* on
`ProductDetailPage`. `ProductDto` has no `pricing` field and `ProductsQuery` has
no `pricingStatus`, so there is no existing badge or enum to reuse. These would
all be new.

---

## 4. Once the backend ships — verification steps

1. `GET /inventory/inventory-products?pricingStatus=BELOW_TARGET&page=1&limit=20`
   → every row `pricing.pricingStatus === "BELOW_TARGET"`.
2. `meta.total` / `meta.totalPages` reflect the **filtered** set, not the full
   catalogue. Confirm `total` differs between `pricingStatus=ALL` and
   `pricingStatus=NO_PURCHASE_COST`.
3. Combined with `search` + `productGroupId` + `stockStatus` + `locationId` +
   `isActive` in one request.
4. Page 2 of a filtered set contains different products than page 1, with no
   repeats — proves filtering precedes pagination.
5. `pricingStatus=NOT_A_STATUS` → `422` with the backend's own message surfaced.
6. Unfiltered view: `pricing` present on every row, no regression to Search,
   Group, Status, Pagination or View.
7. Loading skeleton appears on filter change; no stale rows shown as current.
8. A filter combination with no matches shows the existing empty state — no
   fabricated rows.
