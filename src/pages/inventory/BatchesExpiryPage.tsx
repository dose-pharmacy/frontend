import { useEffect, useState, useMemo, useRef, useCallback } from "react"
import { useNavigate } from "react-router"
import {
  fetchBatches,
  fetchProductOptions,
  daysUntilExpiry,
  type ProductOption,
} from "../../features/inventory/inventoryService"
import type { Batch } from "../../features/inventory/inventoryMock"
import {
  listExpiryBatches,
  listExpiredProducts,
  getExpiryDashboard,
  createExpiryAction,
  dedupeBatchesById,
  ExpiryApiError,
  type ExpiryBatchDto,
  type ExpiredProductDto,
  type ExpiredProductBatchDto,
  type ExpiryDashboardResult,
} from "../../features/inventory/expiryApi"
import { searchLocations } from "../../features/inventory/searchSelectors"
import { useSearchableResource } from "../../hooks/useSearchableResource"
import SearchableSelect from "../../components/ui/SearchableSelect"
import type { SearchableOption } from "../../components/ui/SearchableSelect"
import PageHeader from "../../components/ui/PageHeader"
import Button from "../../components/ui/Button"
import SearchInput from "../../components/ui/SearchInput"
import Select from "../../components/ui/Select"
import EmptyState from "../../components/ui/EmptyState"
import Modal from "../../components/ui/Modal"
import Input from "../../components/ui/Input"
import FormError from "../../components/ui/FormError"
import ExpiryActionHistory from "../../components/ui/ExpiryActionHistory"
import Pagination from "../../components/ui/Pagination"
import StatusBadge from "../../components/ui/StatusBadge"
import NarcoticBadge from "../../components/ui/NarcoticBadge"
import BatchFormModal from "../../components/ui/BatchFormModal"

type Tab = "batches" | "expiring" | "expired"
type ExpiryAction = "return" | "clearance" | "dispose"

const PAGE_SIZE = 10
const EXPIRY_LIMIT = 100
// Thresholds for GET /inventory/expiry/dashboard — feed the two expiry
// summary cards ("Expiring Within 6 Months" / "Expiring Within 1 Year").
const EXPIRY_DASHBOARD_THRESHOLDS: number[] = [180, 365]

export default function BatchesExpiryPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>("batches")
  const [products, setProducts] = useState<ProductOption[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [expiringBatches, setExpiringBatches] = useState<ExpiryBatchDto[]>([])
  const [expiredProducts, setExpiredProducts] = useState<ExpiredProductDto[]>([])
  const [expiredTotal, setExpiredTotal] = useState(0)
  const [expiredTotalPages, setExpiredTotalPages] = useState(1)
  const [expiredPage, setExpiredPage] = useState(1)
  const [expiredSearch, setExpiredSearch] = useState("")
  const [expiredSearchTerm, setExpiredSearchTerm] = useState("")
  const [expiredProductsLoading, setExpiredProductsLoading] = useState(false)
  const [expiredProductsError, setExpiredProductsError] = useState<string | null>(null)
  const [expiryError, setExpiryError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const expiredSearchTimer = useRef<number | null>(null)

  // Batches tab filters
  const [batchSearch, setBatchSearch] = useState("")
  const [locationFilter, setLocationFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [batchPage, setBatchPage] = useState(1)

  // Expiry action modal
  const [actionBatch, setActionBatch] = useState<ExpiryBatchDto | null>(null)
  const [actionType, setActionType] = useState<ExpiryAction>("return")
  const [actionForm, setActionForm] = useState({ supplier: "", returnQty: "", discount: "", notes: "", reason: "" })
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [actionRefreshKey, setActionRefreshKey] = useState(0)

  // Add Batch modal (shared component — also used by the Add Stock form)
  const [addOpen, setAddOpen] = useState(false)

  const locationSearch = useSearchableResource(searchLocations)
  const locationFilterOptions: SearchableOption[] = locationSearch.options

  useEffect(() => {
    fetchProductOptions()
      .then((opts) => setProducts(opts))
      .catch(() => setProducts([]))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchBatches(locationFilter || undefined)
      .then((b) => {
        if (cancelled) return
        setBatches(b)
        setLoadError(null)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(
          err instanceof Error
            ? err.message
            : "Failed to load batches. Please try again.",
        )
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [locationFilter])

  function reloadBatches() {
    return fetchBatches(locationFilter || undefined)
      .then((b) => setBatches(b))
      .catch((err) =>
        setLoadError(
          err instanceof Error
            ? err.message
            : "Failed to refresh batches. Please try again.",
        ),
      )
  }

  // ── Expiring batches from GET /inventory/expiry/batches ──
  // (Feeds the "Expiring Soon (n)" tab badge; the cards and the table below
  // them use GET /inventory/expiry/dashboard.) 
  useEffect(() => {
    let cancelled = false
    listExpiryBatches({ thresholds: [30, 60, 90], limit: EXPIRY_LIMIT, page: 1 })
      .then((res) => {
        if (cancelled) return
        // The backend can emit one row per matching threshold window — dedupe.
        const rows = dedupeBatchesById(res.data)
        setExpiringBatches(rows.filter((b) => b.daysRemaining >= 0 && b.daysRemaining <= 90 && b.stock.quantity > 0))
        setExpiryError(null)
      })
      .catch((err) => {
        if (cancelled) return
        setExpiryError(
          err instanceof ExpiryApiError
            ? err.message
            : "Failed to load expiring batches. Please try again."
        )
      })
    return () => {
      cancelled = true
    }
  }, [])

  // ── Expiry summary cards from GET /inventory/expiry/dashboard ──
  // Thresholds 180/365 feed the "Expiring Within 6 Months" and
  // "Expiring Within 1 Year" cards (windows mapped below by daysFrom/daysTo).
  const [expiryDashboard, setExpiryDashboard] = useState<ExpiryDashboardResult | null>(null)
  const [expiryDashboardLoading, setExpiryDashboardLoading] = useState(true)
  const [expiryDashboardError, setExpiryDashboardError] = useState<string | null>(null)
  const dashboardSeq = useRef(0)
  const loadExpiryDashboard = useCallback(async () => {
    const seq = ++dashboardSeq.current
    setExpiryDashboardLoading(true)
    setExpiryDashboardError(null)
    try {
      const res = await getExpiryDashboard({ thresholds: EXPIRY_DASHBOARD_THRESHOLDS })
      if (seq !== dashboardSeq.current) return
      setExpiryDashboard(res)
    } catch (err) {
      if (seq !== dashboardSeq.current) return
      setExpiryDashboardError(
        err instanceof ExpiryApiError
          ? err.message
          : "Failed to load the expiry summary. Please try again."
      )
    } finally {
      if (seq === dashboardSeq.current) setExpiryDashboardLoading(false)
    }
  }, [])
  useEffect(() => {
    void loadExpiryDashboard()
    return () => {
      dashboardSeq.current++
    }
  }, [loadExpiryDashboard])

  // ── Expired products from GET /inventory/expired-products ──
  const expiredSeq = useRef(0)
  const loadExpiredProducts = useCallback(async () => {
    const seq = ++expiredSeq.current
    setExpiredProductsLoading(true)
    setExpiredProductsError(null)
    try {
      const res = await listExpiredProducts({
        page: expiredPage,
        limit: 50,
        search: expiredSearchTerm || undefined,
        locationId: locationFilter || undefined,
      })
      if (seq !== expiredSeq.current) return
      setExpiredProducts(res.data)
      setExpiredTotal(res.meta.total)
      setExpiredTotalPages(Math.max(1, res.meta.totalPages))
    } catch (err) {
      if (seq !== expiredSeq.current) return
      setExpiredProductsError(
        err instanceof ExpiryApiError
          ? err.message
          : "Failed to load expired products. Please try again."
      )
    } finally {
      if (seq === expiredSeq.current) setExpiredProductsLoading(false)
    }
  }, [expiredPage, expiredSearchTerm, locationFilter])

  useEffect(() => {
    void loadExpiredProducts()
    return () => {
      expiredSeq.current++
    }
  }, [loadExpiredProducts])

  // Debounce the expired-tab search box.
  useEffect(() => {
    if (expiredSearchTimer.current) window.clearTimeout(expiredSearchTimer.current)
    expiredSearchTimer.current = window.setTimeout(() => {
      setExpiredSearchTerm(expiredSearch.trim())
      setExpiredPage(1)
    }, 300)
    return () => {
      if (expiredSearchTimer.current) window.clearTimeout(expiredSearchTimer.current)
    }
  }, [expiredSearch])

  function productName(productId: string) {
    return products.find((p) => p.id === productId)?.name ?? productId
  }

  function productUnit(productId: string) {
    const unit = products.find((p) => p.id === productId)?.baseUnit ?? ""
    return unit
  }

  // Backend list rows carry no location info, so the location filter narrows
  // server-side (each choice refetches) instead of filtering client-side.

  // Batches tab
  const filteredBatches = useMemo(() => {
    let rows = batches
    if (batchSearch) {
      const q = batchSearch.toLowerCase()
      rows = rows.filter(
        (b) =>
          productName(b.productId).toLowerCase().includes(q) ||
          b.batchNumber.toLowerCase().includes(q)
      )
    }
    if (statusFilter) rows = rows.filter((b) => b.status === statusFilter)
    return rows
  }, [batches, batchSearch, statusFilter, products])

  const batchTotalPages = Math.max(1, Math.ceil(filteredBatches.length / PAGE_SIZE))
  const batchPaginated = filteredBatches.slice((batchPage - 1) * PAGE_SIZE, batchPage * PAGE_SIZE)

  // Expiry tab
  const expiring = useMemo(
    () =>
      [...expiringBatches]
        .sort((a, b) => a.daysRemaining - b.daysRemaining),
    [expiringBatches]
  )

  // Expiry summary cards. Counts come from the expiry dashboard's `windows`
  // array — matched by daysFrom/daysTo (never by the backend's label string,
  // and never from the `critical`/`expiringSoon`/`warning` summary fields).
  // The 6-month window is a subset of the 1-year window; nothing is subtracted.
  const expiryCards = useMemo(() => {
    const windows = expiryDashboard?.windows ?? []
    const windowCount = (targetEnd: number): number => {
      // Prefer the window that starts the range (daysFrom 0) and ends on or
      // after the target; fall back to the window whose end is closest.
      const covering = windows
        .filter((w) => w.daysFrom <= 0 && w.daysTo >= targetEnd)
        .sort((a, b) => a.daysTo - b.daysTo)[0]
      if (covering) return covering.batchCount
      const closest = windows
        .slice()
        .sort(
          (a, b) =>
            Math.abs(a.daysTo - targetEnd) - Math.abs(b.daysTo - targetEnd),
        )[0]
      return closest?.batchCount ?? 0
    }
    return [
      {
        label: "Expiring Within 6 Months",
        count: windowCount(180),
        cls: "border-[#C6D4BF] bg-[#E6ECE2]/60",
        textCls: "text-[#4F6B4A]",
      },
      {
        label: "Expiring Within 1 Year",
        count: windowCount(365),
        cls: "border-[#C6D4BF] bg-white",
        textCls: "text-[#4F6B4A]",
      },
    ]
  }, [expiryDashboard])

  // Batches for the single table below the summary cards — taken from the
  // dashboard's returned `windows[].batches` (a batch inside 6 months also
  // appears in the 1-year window, so rows are deduped by id). Only
  // not-yet-expired, in-stock batches within the next year are shown.
  const expiryTableRows = useMemo(() => {
    const all = (expiryDashboard?.windows ?? []).flatMap((w) => w.batches)
    return dedupeBatchesById(all)
      .filter((b) => b.daysRemaining >= 0 && b.daysRemaining <= 365 && b.stock.quantity > 0)
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
  }, [expiryDashboard])

  function daysUntil(d: string): number {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const exp = new Date(d)
    exp.setHours(0, 0, 0, 0)
    return Math.round((exp.getTime() - today.getTime()) / 86_400_000)
  }

  /** Adapt an expired (product, batch) row to the shared expiry-action modal shape. */
  function toActionBatch(p: ExpiredProductDto, row: ExpiredProductBatchDto): ExpiryBatchDto {
    return {
      id: row.id,
      batchNumber: row.batchNumber,
      expiryDate: row.expiryDate,
      daysRemaining: daysUntil(row.expiryDate),
      purchaseCost: row.purchaseCost ?? 0,
      status: "EXPIRED",
      product: { id: p.productId, name: p.productName, sku: p.sku, brand: p.brand ?? "" },
      stock: { quantity: row.quantity, location: { id: row.locationId, name: row.locationName } },
    }
  }

  const expiredRows = useMemo(
    () => expiredProducts.flatMap((p) => p.expiredBatches.map((row) => ({ product: p, row }))),
    [expiredProducts]
  )

  function openAction(b: ExpiryBatchDto, type: ExpiryAction = "return") {
    setActionBatch(b)
    setActionType(type)
    setActionForm({ supplier: "", returnQty: "", discount: "", notes: "", reason: "" })
    setFormError(null)
  }

  async function handleConfirmAction() {
    if (!actionBatch) return
    setFormError(null)
    const qty = Number(actionForm.returnQty)
    if (actionType === "return" && (!actionForm.supplier || !actionForm.returnQty)) {
      setFormError("Supplier and return quantity are required.")
      return
    }
    if (actionType === "clearance" && !actionForm.discount) {
      setFormError("Discount percentage is required.")
      return
    }
    if (actionType === "dispose" && !actionForm.reason) {
      setFormError("Reason is required.")
      return
    }
    setSubmitting(true)
    try {
      if (actionType === "return") {
        await createExpiryAction(actionBatch.id, {
          actionType: "RETURN_TO_SUPPLIER",
          quantity: qty,
          locationId: actionBatch.stock.location.id,
          discountPercent: 0,
          reason: `Return to supplier: ${actionForm.supplier}`,
          ...(actionForm.notes.trim() ? { notes: actionForm.notes.trim() } : {}),
        })
      } else if (actionType === "clearance") {
        // No dedicated clearance endpoint — sent as a discounted supplier
        // return, matching the API's supplierId/discountPercent schema.
        await createExpiryAction(actionBatch.id, {
          actionType: "RETURN_TO_SUPPLIER",
          quantity: actionBatch.stock.quantity,
          locationId: actionBatch.stock.location.id,
          discountPercent: Number(actionForm.discount) || 0,
          reason: "Clearance sale",
          ...(actionForm.notes.trim() ? { notes: actionForm.notes.trim() } : {}),
        })
      } else {
        await createExpiryAction(actionBatch.id, {
          actionType: "DISPOSE",
          quantity: actionBatch.stock.quantity,
          locationId: actionBatch.stock.location.id,
          reason: actionForm.reason,
          ...(actionForm.notes.trim() ? { notes: actionForm.notes.trim() } : {}),
        })
      }
      setActionBatch(null)
      setActionRefreshKey((k) => k + 1)
      // Refresh the expiring sweep, the expired-products list, and the
      // expiry-dashboard summary cards.
      listExpiryBatches({ thresholds: [30, 60, 90], limit: EXPIRY_LIMIT, page: 1 })
        .then((res) => {
          const rows = dedupeBatchesById(res.data)
          setExpiringBatches(rows.filter((b) => b.daysRemaining >= 0 && b.daysRemaining <= 90 && b.stock.quantity > 0))
          setExpiryError(null)
        })
        .catch(() => setExpiryError("Failed to refresh expiring batches."))
      void loadExpiryDashboard()
      await loadExpiredProducts()
      await reloadBatches()
    } catch (err) {
      setFormError(
        err instanceof ExpiryApiError
          ? err.message
          : "Failed to perform the expiry action. Please try again."
      )
    } finally {
      setSubmitting(false)
    }
  }

  // ── Add Batch ──
  function openAdd() {
    setAddOpen(true)
  }

  function formatDate(d: string) {
    if (!d) return "—"
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
  }

  const TAB_LABELS: { key: Tab; label: string }[] = [
    { key: "batches", label: "All Batches" },
    { key: "expiring", label: `Expiring Soon (${expiring.length})` },
    { key: "expired", label: `Expired (${expiredTotal})` },
  ]

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb="Inventory / Batches & Expiry"
        title="Batches & Expiry"
        subtitle="Monitor product batches, expiration dates, and stock."
        actions={<Button onClick={openAdd}>+ Add Batch</Button>}
      />

      {/* Tab bar */}
      <div className="bg-white border-b border-[#E6ECE2] px-6 flex gap-0">
        {TAB_LABELS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === key
                ? "border-[#B6C8AF] text-[#7A9076]"
                : "border-transparent text-[#666666] hover:text-[#333333]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6 pb-12 flex flex-col gap-6">
        {loadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {loadError}
          </div>
        )}
        {expiryError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {expiryError}
          </div>
        )}

        {/* ── ALL BATCHES TAB ── */}
        {tab === "batches" && (
          <>
            <div className="bg-white rounded-xl border border-[#E6ECE2] p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <SearchInput
                    value={batchSearch}
                    onChange={(v) => { setBatchSearch(v); setBatchPage(1) }}
                    placeholder="Search batch number or product..."
                  />
                </div>
                <div className="sm:w-44">
                  <SearchableSelect
                    value={locationFilter || null}
                    onChange={(v) => { setLocationFilter(v); setBatchPage(1) }}
                    options={locationFilterOptions}
                    onSearch={locationSearch.setTerm}
                    loading={locationSearch.loading}
                    error={locationSearch.error}
                    onRetry={locationSearch.retry}
                    allowClear
                    placeholder="All Locations"
                    searchPlaceholder="Search locations..."
                    emptyMessage="No locations found"
                    noResultsMessage="No locations matching your search"
                  />
                </div>
                <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setBatchPage(1) }} className="sm:w-44">
                  <option value="">All Statuses</option>
                  <option value="available">Available</option>
                  <option value="low_stock">Low Stock</option>
                  <option value="depleted">Depleted</option>
                  <option value="expired">Expired</option>
                </Select>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden flex-shrink-0">
              {loading ? (
                <LoadingSkeleton />
              ) : filteredBatches.length === 0 ? (
                <EmptyState title="No batches found" description="Adjust your filters or add stock to see batches." />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#E6ECE2] text-left">
                          <th className="px-4 py-3 font-semibold text-[#333333]">Product</th>
                          <th className="px-4 py-3 font-semibold text-[#333333]">Batch</th>
                          <th className="px-4 py-3 font-semibold text-[#333333] hidden sm:table-cell">Received</th>
                          <th className="px-4 py-3 font-semibold text-[#333333]">Expiry</th>
                          <th className="px-4 py-3 font-semibold text-[#333333]">Stock</th>
                          <th className="px-4 py-3 font-semibold text-[#333333] hidden md:table-cell">Location</th>
                          <th className="px-4 py-3 font-semibold text-[#333333]">Status</th>
                          <th className="px-4 py-3 font-semibold text-[#333333]">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batchPaginated.map((b, i) => {
                          const days = daysUntilExpiry(b.expiryDate)
                          const isExpiring = days >= 0 && days <= 30
                          return (
                            <tr key={b.id} className={i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/20"}>
                              <td className="px-4 py-3 font-medium text-[#333333]">{productName(b.productId)}</td>
                              <td className="px-4 py-3 font-mono text-xs text-[#666666]">{b.batchNumber}</td>
                              <td className="px-4 py-3 text-[#666666] hidden sm:table-cell">{formatDate(b.receivedDate)}</td>
                              <td className="px-4 py-3">
                                <span className={isExpiring ? "font-semibold text-orange-600" : "text-[#666666]"}>
                                  {formatDate(b.expiryDate)}
                                </span>
                                {isExpiring && (
                                  <span className="ml-1 text-xs text-orange-500">({days}d)</span>
                                )}
                              </td>
                              <td className="px-4 py-3 font-semibold text-[#333333]">
                                {b.quantity.toLocaleString()} {productUnit(b.productId)}s
                              </td>
                              <td className="px-4 py-3 text-[#666666] hidden md:table-cell">{b.location}</td>
                              <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => navigate(`/inventory/batches/${b.id}`)}
                                  className="text-xs font-semibold text-[#7A9076] hover:underline"
                                >
                                  View
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <Pagination page={batchPage} totalPages={batchTotalPages} onPageChange={setBatchPage} />
                </>
              )}
            </div>
          </>
        )}

        {/* ── EXPIRING SOON TAB ── */}
        {tab === "expiring" && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {expiryDashboardLoading ? (
                <>
                  <div className="rounded-xl border border-[#E6ECE2] p-4 animate-pulse">
                    <div className="h-8 w-16 rounded bg-[#E6ECE2]" />
                    <div className="h-3 w-36 rounded bg-[#E6ECE2] mt-2.5" />
                  </div>
                  <div className="rounded-xl border border-[#E6ECE2] p-4 animate-pulse">
                    <div className="h-8 w-16 rounded bg-[#E6ECE2]" />
                    <div className="h-3 w-36 rounded bg-[#E6ECE2] mt-2.5" />
                  </div>
                </>
              ) : expiryDashboardError ? (
                <div className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {expiryDashboardError}
                </div>
              ) : (
                expiryCards.map(({ label, count, cls, textCls }) => (
                  <div key={label} className={`rounded-xl border p-4 ${cls}`}>
                    <p className={`text-2xl font-bold ${textCls}`}>{count}</p>
                    <p className="text-xs text-[#666666] mt-0.5">{label}</p>
                  </div>
                ))
              )}
            </div>

            {expiryDashboardLoading ? (
              <LoadingSkeleton />
            ) : expiryDashboardError ? null : expiryTableRows.length === 0 ? (
              <EmptyState title="No expiring batches" description="No batches expiring within the next 1 year." />
            ) : (
              <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden flex-shrink-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#E6ECE2] text-left">
                        <th className="px-4 py-3 font-semibold text-[#333333]">Product</th>
                        <th className="px-4 py-3 font-semibold text-[#333333]">Batch</th>
                        <th className="px-4 py-3 font-semibold text-[#333333] hidden sm:table-cell">Location</th>
                        <th className="px-4 py-3 font-semibold text-[#333333]">Expiry Date</th>
                        <th className="px-4 py-3 font-semibold text-[#333333] text-right">Days Remaining</th>
                        <th className="px-4 py-3 font-semibold text-[#333333] text-right">Quantity</th>
                        <th className="px-4 py-3 font-semibold text-[#333333]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expiryTableRows.map((b, i) => (
                        <tr key={b.id} className={i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/20"}>
                          <td className="px-4 py-3 font-medium text-[#333333]">{b.product.name}</td>
                          <td className="px-4 py-3 font-mono text-xs text-[#666666]">{b.batchNumber}</td>
                          <td className="px-4 py-3 text-[#666666] hidden sm:table-cell">{b.stock.location.name}</td>
                          <td className="px-4 py-3 text-[#666666]">{formatDate(b.expiryDate)}</td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-semibold text-orange-600">{b.daysRemaining} days</span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-[#333333]">
                            {b.stock.quantity.toLocaleString()} {productUnit(b.product.id)}s
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button onClick={() => openAction(b, "return")} className="text-xs font-semibold text-[#7A9076] hover:underline">Return</button>
                              <button onClick={() => openAction(b, "clearance")} className="text-xs font-semibold text-orange-500 hover:underline">Clearance</button>
                              <button onClick={() => openAction(b, "dispose")} className="text-xs font-semibold text-red-500 hover:underline">Dispose</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── EXPIRED TAB ── */}
        {tab === "expired" && (
          <>
            <div className="bg-white rounded-xl border border-[#DBEFF3] p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <SearchInput
                    value={expiredSearch}
                    onChange={setExpiredSearch}
                    placeholder="Search expired product, brand or SKU..."
                  />
                </div>
                <div className="sm:w-44">
                  <SearchableSelect
                    value={locationFilter || null}
                    onChange={(v) => { setLocationFilter(v); setExpiredPage(1) }}
                    options={locationFilterOptions}
                    onSearch={locationSearch.setTerm}
                    loading={locationSearch.loading}
                    error={locationSearch.error}
                    onRetry={locationSearch.retry}
                    allowClear
                    placeholder="All Locations"
                    searchPlaceholder="Search locations..."
                    emptyMessage="No locations found"
                    noResultsMessage="No locations matching your search"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
              {expiredProductsLoading ? (
                <LoadingSkeleton />
              ) : expiredProductsError ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4 px-6">
                  <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 max-w-md text-center">{expiredProductsError}</p>
                  <Button onClick={() => void loadExpiredProducts()}>Retry</Button>
                </div>
              ) : expiredRows.length === 0 ? (
                <EmptyState title="No expired products" description="No products have batches past their expiry date with stock on hand." />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-red-50 text-left">
                          <th className="px-4 py-3 font-semibold text-[#333333]">Product</th>
                          <th className="px-4 py-3 font-semibold text-[#333333]">Batch</th>
                          <th className="px-4 py-3 font-semibold text-[#333333]">Expired</th>
                          <th className="px-4 py-3 font-semibold text-[#333333]">Quantity</th>
                          <th className="px-4 py-3 font-semibold text-[#333333]">Unit Cost</th>
                          <th className="px-4 py-3 font-semibold text-[#333333] hidden sm:table-cell">Location</th>
                          <th className="px-4 py-3 font-semibold text-[#333333]">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expiredRows.map(({ product: p, row }, i) => {
                          const b = toActionBatch(p, row)
                          return (
                            <tr key={`${row.id}-${row.locationId}`} className={i % 2 === 0 ? "bg-white" : "bg-red-50/40"}>
                              <td className="px-4 py-3 font-medium text-[#333333]">
                                {p.productName}
                                {p.isNarcotic && <NarcoticBadge className="ml-2 align-middle" />}
                              </td>
                              <td className="px-4 py-3 font-mono text-xs text-[#666666]">{row.batchNumber}</td>
                              <td className="px-4 py-3 text-red-600 font-semibold">{formatDate(row.expiryDate)}</td>
                              <td className="px-4 py-3 font-semibold text-[#333333]">
                                {row.quantity.toLocaleString()} {productUnit(p.productId)}s
                              </td>
                              <td className="px-4 py-3 text-[#666666]">
                                {row.purchaseCost != null ? `${Number(row.purchaseCost).toFixed(2)} ETB` : "—"}
                              </td>
                              <td className="px-4 py-3 text-[#666666] hidden sm:table-cell">{row.locationName}</td>
                              <td className="px-4 py-3">
                                <div className="flex gap-2">
                                  <button onClick={() => openAction(b, "return")} className="text-xs font-semibold text-[#49B0C1] hover:underline">Return</button>
                                  <button onClick={() => openAction(b, "dispose")} className="text-xs font-semibold text-red-500 hover:underline">Dispose</button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="px-5 py-3 border-t border-[#DBEFF3] flex items-center justify-between flex-wrap gap-2">
                    <p className="text-xs text-[#666666]">
                      {expiredTotal} expired {expiredTotal === 1 ? "product" : "products"} · page {expiredPage} of {expiredTotalPages}
                    </p>
                    <Pagination page={expiredPage} totalPages={expiredTotalPages} onPageChange={setExpiredPage} />
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Add Batch modal (shared — also used by the Add Stock form) */}
      <BatchFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={async () => {
          await reloadBatches()
        }}
      />

      {/* ─────────── Expiry Action Modal ─────────── */}
      <Modal open={!!actionBatch} title="Expiry Action" onClose={() => setActionBatch(null)} size="md">
        {actionBatch && (
          <div className="flex flex-col gap-5">
            <div className="rounded-xl bg-[#E6ECE2] p-4 grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-[#666666]">Product: </span><span className="font-semibold text-[#333333]">{actionBatch.product.name}</span></div>
              <div><span className="text-[#666666]">Batch: </span><span className="font-mono font-semibold text-[#333333]">{actionBatch.batchNumber}</span></div>
              <div><span className="text-[#666666]">Qty: </span><span className="font-semibold text-[#333333]">{actionBatch.stock.quantity.toLocaleString()} {productUnit(actionBatch.product.id)}s</span></div>
              <div><span className="text-[#666666]">Expiry: </span><span className="font-semibold text-red-600">{formatDate(actionBatch.expiryDate)}</span></div>
              <div className="col-span-2"><span className="text-[#666666]">Days remaining: </span>
                <span className="font-bold text-orange-600">{actionBatch.daysRemaining}</span>
              </div>
            </div>
            <FormError message={formError} />
            <ExpiryActionHistory batchId={actionBatch.id} refreshKey={actionRefreshKey} />
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-[#333333]">Select Action</p>
              {(["return", "clearance", "dispose"] as ExpiryAction[]).map((a) => (
                <label key={a} className="flex items-center gap-3 cursor-pointer rounded-lg border border-[#C6D4BF] px-4 py-3 hover:bg-[#E6ECE2]/50 transition-colors">
                  <input type="radio" name="action" value={a} checked={actionType === a} onChange={() => setActionType(a)} className="accent-[#B6C8AF]" />
                  <span className="text-sm font-medium capitalize text-[#333333]">
                    {a === "return" ? "Return to Supplier" : a === "clearance" ? "Clearance Sale" : "Dispose"}
                  </span>
                </label>
              ))}
            </div>
            {actionType === "return" && (
              <div className="flex flex-col gap-3">
                <Input label="Supplier" placeholder="Supplier name" value={actionForm.supplier} onChange={(e) => setActionForm((f) => ({ ...f, supplier: e.target.value }))} />
                <Input label="Return Quantity" type="number" min={1} max={actionBatch.stock.quantity} value={actionForm.returnQty} onChange={(e) => setActionForm((f) => ({ ...f, returnQty: e.target.value }))} />
              </div>
            )}
            {actionType === "clearance" && (
              <div className="flex flex-col gap-3">
                <Input label="Discount (%)" type="number" min={1} max={100} value={actionForm.discount} onChange={(e) => setActionForm((f) => ({ ...f, discount: e.target.value }))} />
              </div>
            )}
            {actionType === "dispose" && (
              <Input label="Reason for Disposal" value={actionForm.reason} onChange={(e) => setActionForm((f) => ({ ...f, reason: e.target.value }))} />
            )}
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setActionBatch(null)}>Cancel</Button>
              <Button onClick={handleConfirmAction} loading={submitting}>Confirm Action</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-3 animate-pulse">
      {[...Array(5)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-[#E6ECE2]" />)}
    </div>
  )
}