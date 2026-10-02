import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "react-router"
import Button from "../../components/ui/Button"
import EmptyState from "../../components/ui/EmptyState"
import PageHeader from "../../components/ui/PageHeader"
import Pagination from "../../components/ui/Pagination"
import SearchableSelect from "../../components/ui/SearchableSelect"
import type { SearchableOption } from "../../components/ui/SearchableSelect"
import { searchProducts, searchSuppliers } from "../../features/inventory/searchSelectors"
import {
  listPurchaseReturns,
  PurchaseReturnsApiError,
  type PurchaseReturnDto,
  type PurchaseReturnReason,
} from "../../features/purchasing/purchaseReturnsApi"
import { useSearchableResource } from "../../hooks/useSearchableResource"
import NewPurchaseReturnForm from "./NewPurchaseReturnForm"
import { useReturnLabels } from "./purchaseReturnLabels"

const PAGE_SIZE = 20

const REASON_LABELS: Record<PurchaseReturnReason, string> = {
  EXPIRED: "Expired",
  DAMAGED: "Damaged",
  INCORRECT_DELIVERY: "Incorrect Delivery",
}

const REASON_BADGE: Record<PurchaseReturnReason, string> = {
  EXPIRED: "bg-red-100 text-red-700",
  DAMAGED: "bg-orange-100 text-orange-700",
  INCORRECT_DELIVERY: "bg-blue-100 text-blue-700",
}

const HEADERS = [
  "Return #",
  "Supplier",
  "Product",
  "Purchase Order",
  "Reason",
  "Qty",
  "Unit Cost",
  "Debit Note",
  "Applied to Payable",
  "Returned",
  "",
]

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "—"
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function fmtMoney(value: number | null | undefined): string {
  return `${Number(value ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ETB`
}

function describeError(error: unknown, fallback: string): string {
  if (error instanceof PurchaseReturnsApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}

/** Keeps the current selection visible even when it is outside the search hits. */
function withCurrent(
  options: SearchableOption[],
  value: string,
): SearchableOption[] {
  if (!value) return options
  const current = options.find((o) => o.value === value)
  return current ? [current, ...options.filter((o) => o.value !== value)] : options
}

export default function PurchaseReturnPage() {
  // ── Server-side filters (supplierId / productId / reason are the only ones
  //    the backend supports) ────────────────────────────────────────────────
  const [supplierId, setSupplierId] = useState("")
  const [productId, setProductId] = useState("")
  const [reason, setReason] = useState<PurchaseReturnReason | "">("")
  const [page, setPage] = useState(1)

  const [rows, setRows] = useState<PurchaseReturnDto[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState("")
  const [reloadTick, setReloadTick] = useState(0)

  const [showForm, setShowForm] = useState(false)
  const [success, setSuccess] = useState<PurchaseReturnDto | null>(null)

  const supplierSearch = useSearchableResource(searchSuppliers)
  const productSearch = useSearchableResource(searchProducts)

  const load = useCallback(
    async (targetPage: number) => {
      setLoading(true)
      setListError("")
      try {
        const result = await listPurchaseReturns({
          page: targetPage,
          limit: PAGE_SIZE,
          supplierId: supplierId || undefined,
          productId: productId || undefined,
          reason: reason || undefined,
        })
        setRows(result.data)
        setTotal(result.meta.total ?? result.data.length)
        setTotalPages(Math.max(1, result.meta.totalPages ?? 1))
      } catch (e) {
        // A failed request must never look like "no returns recorded".
        setRows([])
        setTotal(0)
        setTotalPages(1)
        setListError(describeError(e, "Failed to load purchase returns."))
      } finally {
        setLoading(false)
      }
    },
    [supplierId, productId, reason],
  )

  useEffect(() => {
    void load(page)
  }, [load, page, reloadTick])

  // Filter changes restart at page 1. Done in the change handlers rather than
  // in an effect so switching a filter never issues a request for the stale
  // page before the reset lands.
  function applyFilter(setter: (value: string) => void, value: string) {
    setter(value)
    setPage(1)
  }

  const labelSources = useMemo(
    () => rows.map((r) => ({ supplierId: r.supplierId, productId: r.productId, locationId: r.locationId })),
    [rows],
  )
  const labels = useReturnLabels(labelSources)

  const hasFilters = Boolean(supplierId || productId || reason)

  function clearFilters() {
    setSupplierId("")
    setProductId("")
    setReason("")
    setPage(1)
  }

  function handleCreated(record: PurchaseReturnDto) {
    setShowForm(false)
    setSuccess(record)
    // Refetch rather than splicing the new row into local state.
    setPage(1)
    setReloadTick((t) => t + 1)
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <PageHeader
        title="Purchase Returns"
        subtitle="Purchasing → Returns"
        actions={
          !showForm ? (
            <button
              onClick={() => {
                setSuccess(null)
                setShowForm(true)
              }}
              className="rounded-lg bg-[#B6C8AF] border border-[#B6C8AF] px-4 py-2 text-sm font-semibold text-[#333333] hover:bg-[#A5B89E] transition-colors"
            >
              + New Return
            </button>
          ) : null
        }
      />

      <div className="flex-1 overflow-y-auto pb-8 px-4 sm:px-6 py-4">
        {success && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-green-50 text-green-700 text-sm border border-green-200">
            <span>
              Purchase return <strong>{success.returnNumber}</strong> recorded —{" "}
              {fmtMoney(success.debitNoteAmount)} debited, {fmtMoney(success.appliedToPayable)}{" "}
              applied to payable.
            </span>
            <span className="flex items-center gap-3">
              <Link
                to={`/purchasing/returns/${success.id}`}
                className="font-semibold text-green-800 hover:underline"
              >
                View return →
              </Link>
              <button
                onClick={() => setSuccess(null)}
                className="text-green-700/70 hover:text-green-800"
                aria-label="Dismiss"
              >
                ✕
              </button>
            </span>
          </div>
        )}

        {showForm && (
          <div className="mb-5">
            <NewPurchaseReturnForm
              onCancel={() => setShowForm(false)}
              onCreated={handleCreated}
            />
          </div>
        )}

        {/* ── Filters ───────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] p-4 mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-[#666666] mb-1">Supplier</label>
              <SearchableSelect
                value={supplierId || null}
                onChange={(v) => applyFilter(setSupplierId, v)}
                options={withCurrent(supplierSearch.options, supplierId)}
                onSearch={supplierSearch.setTerm}
                loading={supplierSearch.loading}
                error={supplierSearch.error}
                onRetry={supplierSearch.retry}
                placeholder="All suppliers"
                searchPlaceholder="Search suppliers..."
                emptyMessage="No suppliers found"
                noResultsMessage="No suppliers matching your search"
              />
            </div>
            <div>
              <label className="block text-xs text-[#666666] mb-1">Product</label>
              <SearchableSelect
                value={productId || null}
                onChange={(v) => applyFilter(setProductId, v)}
                options={withCurrent(productSearch.options, productId)}
                onSearch={productSearch.setTerm}
                loading={productSearch.loading}
                error={productSearch.error}
                onRetry={productSearch.retry}
                placeholder="All products"
                searchPlaceholder="Search products..."
                emptyMessage="No products found"
                noResultsMessage="No products matching your search"
              />
            </div>
            <div>
              <label className="block text-xs text-[#666666] mb-1">Reason</label>
              <select
                value={reason}
                onChange={(e) => applyFilter((v) => setReason(v as PurchaseReturnReason | ""), e.target.value)}
                className="w-full rounded-lg border border-[#C6D4BF] bg-white px-3 py-2 text-sm focus:border-[#B6C8AF] focus:outline-none"
              >
                <option value="">All reasons</option>
                {Object.entries(REASON_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button variant="secondary" onClick={clearFilters} disabled={!hasFilters}>
                Clear filters
              </Button>
            </div>
          </div>
        </div>

        {/* ── History ───────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E6ECE2] flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold text-[#333333]">Return History</h3>
            <span className="text-sm text-[#666666]">
              {loading ? "Loading…" : `${total} record${total === 1 ? "" : "s"}`}
            </span>
          </div>

          {loading ? (
            // Skeleton rows only — never placeholder data that looks like records.
            <div className="p-4 space-y-2" aria-busy="true" aria-label="Loading purchase returns">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-9 rounded bg-[#E6ECE2]/60 animate-pulse" />
              ))}
            </div>
          ) : listError ? (
            <div className="p-6">
              <EmptyState
                title="Could not load purchase returns"
                description={listError}
                action={
                  <Button variant="secondary" onClick={() => void load(page)}>
                    Retry
                  </Button>
                }
              />
            </div>
          ) : rows.length === 0 ? (
            hasFilters ? (
              <EmptyState
                title="No purchase returns match these filters"
                description="Try widening or clearing the supplier, product and reason filters."
                action={
                  <Button variant="secondary" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title="No purchase returns found"
                description="Returns recorded against suppliers will appear here."
                action={
                  <Button
                    onClick={() => {
                      setSuccess(null)
                      setShowForm(true)
                    }}
                  >
                    + New Return
                  </Button>
                }
              />
            )
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1100px]">
                <thead>
                  <tr className="bg-[#E6ECE2]/50">
                    {HEADERS.map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left font-semibold text-[#333333] whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((ret, i) => (
                    <tr key={ret.id} className={i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/20"}>
                      <td className="px-4 py-3 font-mono text-xs text-[#666666] whitespace-nowrap">
                        {ret.returnNumber}
                      </td>
                      <td className="px-4 py-3 text-[#333333] whitespace-nowrap">
                        {labels.ready ? labels.supplierName(ret.supplierId) : "…"}
                      </td>
                      <td className="px-4 py-3 font-medium text-[#333333] whitespace-nowrap">
                        {labels.ready ? labels.productName(ret.productId) : "…"}
                      </td>
                      <td className="px-4 py-3 text-[#666666] whitespace-nowrap">
                        {ret.purchaseOrderItem?.purchaseOrder.poNumber ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            REASON_BADGE[ret.reason] ?? "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {REASON_LABELS[ret.reason] ?? ret.reason}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-[#333333]">{ret.quantity}</td>
                      <td className="px-4 py-3 text-right text-[#333333] whitespace-nowrap">
                        {fmtMoney(ret.unitCost)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[#333333] whitespace-nowrap">
                        {fmtMoney(ret.debitNoteAmount)}
                      </td>
                      <td className="px-4 py-3 text-right text-[#4F6B4A] whitespace-nowrap">
                        {fmtMoney(ret.appliedToPayable)}
                      </td>
                      <td className="px-4 py-3 text-[#666666] whitespace-nowrap">
                        {fmtDate(ret.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/purchasing/returns/${ret.id}`}
                          className="text-xs font-semibold text-[#7A9076] hover:underline whitespace-nowrap"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && !listError && totalPages > 1 && (
            <div className="px-4 py-3 border-t border-[#E6ECE2]">
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
