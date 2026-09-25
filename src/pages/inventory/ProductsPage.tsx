import { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router"
import {
  listInventoryProducts,
  ProductsApiError,
  type InventoryProductDto,
  type ListMeta,
} from "../../features/inventory/productsApi"
import { searchProductGroups } from "../../features/inventory/searchSelectors"
import { useSearchableResource } from "../../hooks/useSearchableResource"
import SearchInput from "../../components/ui/SearchInput"
import SearchableSelect from "../../components/ui/SearchableSelect"
import type { SearchableOption } from "../../components/ui/SearchableSelect"
import Select from "../../components/ui/Select"
import StatusBadge from "../../components/ui/StatusBadge"
import Pagination from "../../components/ui/Pagination"
import EmptyState from "../../components/ui/EmptyState"
import Button from "../../components/ui/Button"
import PageHeader from "../../components/ui/PageHeader"
import NarcoticBadge from "../../components/ui/NarcoticBadge"
import ProductFormModal from "../../components/ui/ProductFormModal"

const PAGE_SIZE = 20

function apiErrorMessage(err: unknown, fallback: string): string {
  return err instanceof ProductsApiError ? err.message : fallback
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────
export default function ProductsPage() {
  const navigate = useNavigate()

  // ── Product list ──
  const [products, setProducts] = useState<InventoryProductDto[]>([])
  const [meta, setMeta] = useState<ListMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const groupFilterSearch = useSearchableResource(searchProductGroups)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [groupFilter, setGroupFilter] = useState("")
  const [page, setPage] = useState(1)
  const requestSeq = useRef(0)

  // ── Create modal state ──
  const [createOpen, setCreateOpen] = useState(false)

  const selectedFilterGroup =
    groupFilterSearch.options.find((o) => o.value === groupFilter) ?? null
  const groupFilterOptions: SearchableOption[] = selectedFilterGroup
    ? [
        selectedFilterGroup,
        ...groupFilterSearch.options.filter((o) => o.value !== groupFilter),
      ]
    : groupFilterSearch.options

  // ── Load products ──
  const reload = useCallback(
    async (
      searchTerm: string,
      status: string,
      groupId: string,
      pageNum: number,
    ) => {
      const seq = ++requestSeq.current
      setLoading(true)
      setLoadError(null)
      try {
        const res = await listInventoryProducts({
          page: pageNum,
          limit: PAGE_SIZE,
          search: searchTerm.trim() || undefined,
          productGroupId: groupId || undefined,
          stockStatus: status || undefined,
        })
        if (seq !== requestSeq.current) return
        setProducts(res.data)
        setMeta(res.meta)
      } catch (err) {
        if (seq !== requestSeq.current) return
        setLoadError(
          apiErrorMessage(err, "Failed to load products. Please try again."),
        )
      } finally {
        if (seq === requestSeq.current) setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    const t = setTimeout(
      () => void reload(search, statusFilter, groupFilter, page),
      search ? 300 : 0,
    )
    return () => clearTimeout(t)
  }, [reload, search, statusFilter, groupFilter, page])

  const filtered = products
  const totalPages = meta?.totalPages ?? 1

  function handleSearch(v: string) {
    setSearch(v)
    setPage(1)
  }

  function formatExpiry(dateStr: string) {
    const d = new Date(dateStr)
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  }

  // ─────────────────────────────────────────────────────────
  // Create modal
  // ─────────────────────────────────────────────────────────
  function openCreate() {
    setCreateOpen(true)
  }

  function closeCreate() {
    setCreateOpen(false)
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        title="Products"
        subtitle="Manage medicines and inventory items."
        actions={<Button onClick={openCreate}>+ Add Product</Button>}
      />

      <div className="flex-1 overflow-y-auto p-6 pb-12 flex flex-col gap-6">
        {loadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-red-700">{loadError}</p>
            <button
              type="button"
              onClick={() =>
                void reload(search, statusFilter, groupFilter, page)
              }
              className="text-sm font-semibold text-red-700 hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <SearchInput
                value={search}
                onChange={handleSearch}
                placeholder="Search by name, SKU, generic name, brand..."
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="sm:w-44"
            >
              <option value="">All Statuses</option>
              <option value="IN_STOCK">In Stock</option>
              <option value="LOW_STOCK">Low Stock</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
            </Select>
            <div className="sm:w-48">
              <SearchableSelect
                value={groupFilter || null}
                onChange={(v) => {
                  setGroupFilter(v)
                  setPage(1)
                }}
                options={groupFilterOptions}
                onSearch={groupFilterSearch.setTerm}
                loading={groupFilterSearch.loading}
                error={groupFilterSearch.error}
                onRetry={groupFilterSearch.retry}
                allowClear
                placeholder="All Groups"
                searchPlaceholder="Search groups..."
                emptyMessage="No groups found"
                noResultsMessage="No groups matching your search"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden flex-shrink-0">
          {loading ? (
            <LoadingSkeleton />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No products found"
              description="Try adjusting your search or filters."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#E6ECE2] text-left">
                      <th className="px-4 py-3 font-semibold text-[#333333]">
                        Product
                      </th>
                      <th className="px-4 py-3 font-semibold text-[#333333]">
                        SKU
                      </th>
                      <th className="px-4 py-3 font-semibold text-[#333333] hidden sm:table-cell">
                        Group
                      </th>
                      <th className="px-4 py-3 font-semibold text-[#333333]">
                        Stock
                      </th>
                      <th className="px-4 py-3 font-semibold text-[#333333] hidden md:table-cell">
                        Base Unit
                      </th>
                      <th className="px-4 py-3 font-semibold text-[#333333] hidden lg:table-cell w-40 min-w-[10rem]">
                        Nearest Expiry
                      </th>
                      <th className="px-4 py-3 font-semibold text-[#333333] w-40 min-w-[10rem]">
                        Status
                      </th>
                      <th className="px-4 py-3 font-semibold text-[#333333]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((product, i) => (
                      <tr
                        key={product.id}
                        className={i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/20"}
                      >
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-[#333333]">
                              {product.name}
                              {product.isNarcotic && <NarcoticBadge />}
                            </p>
                            <p className="text-xs text-[#666666]">
                              {product.genericName ?? "—"} ·{" "}
                              {product.brand ?? "—"}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[#666666]">
                          {product.sku}
                        </td>
                        <td className="px-4 py-3 text-[#666666] hidden sm:table-cell">
                          {product.productGroup?.name ?? "—"}
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#333333]">
                          {product.totalStock.toLocaleString()}
                          {product.baseUnit?.name
                            ? ` ${product.baseUnit.name}`
                            : ""}
                        </td>
                        <td className="px-4 py-3 text-[#666666] hidden md:table-cell">
                          {product.baseUnit?.name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-[#666666] hidden lg:table-cell">
                          {product.nearestExpiry
                            ? formatExpiry(product.nearestExpiry.expiryDate)
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge
                            status={mapStockStatus(product.stockStatus)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() =>
                              navigate(`/inventory/products/${product.id}`)
                            }
                            className="text-xs font-semibold text-[#7A9076] hover:underline"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                label={
                  <>
                    Showing{" "}
                    {filtered.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0}–
                    {Math.min(page * PAGE_SIZE, meta?.total ?? 0)} of{" "}
                    {meta?.total ?? 0} products
                  </>
                }
              />
            </>
          )}
        </div>
      </div>

      {/* Add Product modal (shared — also used by the Add Stock form) */}
      <ProductFormModal
        open={createOpen}
        onClose={closeCreate}
        onSaved={async () => {
          await reload(search, statusFilter, groupFilter, 1)
          setPage(1)
        }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function mapStockStatus(
  status: InventoryProductDto["stockStatus"],
): "in_stock" | "low_stock" | "out_of_stock" {
  switch (status) {
    case "LOW_STOCK":
      return "low_stock"
    case "OUT_OF_STOCK":
      return "out_of_stock"
    default:
      return "in_stock"
  }
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-3 animate-pulse">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-10 rounded-lg bg-[#E6ECE2]" />
      ))}
    </div>
  )
}

function BoxIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
      />
    </svg>
  )
}
function CheckIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  )
}
function WarnIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
      />
    </svg>
  )
}
function AlertIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  )
}