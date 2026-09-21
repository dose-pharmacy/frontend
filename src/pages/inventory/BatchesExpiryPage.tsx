import { useEffect, useState, useMemo } from "react"
import { useNavigate } from "react-router"
import {
  fetchBatches,
  fetchProductOptions,
  daysUntilExpiry,
  createBatch,
  type ProductOption,
} from "../../features/inventory/inventoryService"
import type { Batch } from "../../features/inventory/inventoryMock"
import {
  listExpiryBatches,
  createExpiryAction,
  dedupeBatchesById,
  ExpiryApiError,
  type ExpiryBatchDto,
} from "../../features/inventory/expiryApi"
import { searchProducts, searchLocations } from "../../features/inventory/searchSelectors"
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

type Tab = "batches" | "expiring" | "expired"
type ExpiryAction = "return" | "clearance" | "dispose"

const PAGE_SIZE = 10
const EXPIRY_LIMIT = 100

interface AddBatchForm {
  productId: string
  batchNumber: string
  receivedDate: string
  expiryDate: string
  purchaseCost: string
  supplierReference: string
}

function emptyBatchForm(): AddBatchForm {
  const today = new Date().toISOString().slice(0, 10)
  return {
    productId: "",
    batchNumber: "",
    receivedDate: today,
    expiryDate: "",
    purchaseCost: "",
    supplierReference: "",
  }
}

function addBatchErrors(f: AddBatchForm) {
  const e: Partial<Record<keyof AddBatchForm, string>> = {}
  if (!f.productId) e.productId = "Product is required."
  if (!f.batchNumber.trim()) e.batchNumber = "Batch number is required."
  if (!f.receivedDate) e.receivedDate = "Received date is required."
  if (!f.expiryDate) e.expiryDate = "Expiry date is required."
  else if (f.expiryDate < f.receivedDate)
    e.expiryDate = "Expiry must be after received date."
  if (f.purchaseCost.trim() === "") e.purchaseCost = "Purchase cost is required."
  else if (Number.isNaN(Number(f.purchaseCost)) || Number(f.purchaseCost) < 0)
    e.purchaseCost = "Purchase cost must be a non-negative number."
  return e
}

export default function BatchesExpiryPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>("batches")
  const [products, setProducts] = useState<ProductOption[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [expiringBatches, setExpiringBatches] = useState<ExpiryBatchDto[]>([])
  const [expiredBatches, setExpiredBatches] = useState<ExpiryBatchDto[]>([])
  const [expiryLoading, setExpiryLoading] = useState(false)
  const [expiryError, setExpiryError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

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

  // Add Batch modal
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState<AddBatchForm>(emptyBatchForm())
  const [addErrors, setAddErrors] = useState<Partial<Record<keyof AddBatchForm, string>>>({})
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

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

  // ── Expiring / expired batches from GET /inventory/expiry/batches ──
  // One paginated sweep covers both tabs; the API only exposes a single
  // "days remaining" window, so the tabs slice the same rows client-side.
  useEffect(() => {
    let cancelled = false
    setExpiryLoading(true)
    listExpiryBatches({ thresholds: [30, 60, 90], limit: EXPIRY_LIMIT, page: 1 })
      .then((res) => {
        if (cancelled) return
        // The backend can emit one row per matching threshold window — dedupe.
        const rows = dedupeBatchesById(res.data)
        setExpiringBatches(rows.filter((b) => b.daysRemaining >= 0 && b.daysRemaining <= 90 && b.stock.quantity > 0))
        setExpiredBatches(rows.filter((b) => b.daysRemaining < 0))
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
      .finally(() => {
        if (!cancelled) setExpiryLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

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

  // Expiry tabs
  const expiring = useMemo(
    () =>
      [...expiringBatches]
        .sort((a, b) => a.daysRemaining - b.daysRemaining),
    [expiringBatches]
  )

  const expired = useMemo(
    () =>
      [...expiredBatches]
        .sort((a, b) => a.daysRemaining - b.daysRemaining),
    [expiredBatches]
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
      // Refresh both the expiry sweep and the all-batches list.
      listExpiryBatches({ thresholds: [30, 60, 90], limit: EXPIRY_LIMIT, page: 1 })
        .then((res) => {
          const rows = dedupeBatchesById(res.data)
          setExpiringBatches(rows.filter((b) => b.daysRemaining >= 0 && b.daysRemaining <= 90 && b.stock.quantity > 0))
          setExpiredBatches(rows.filter((b) => b.daysRemaining < 0))
          setExpiryError(null)
        })
        .catch(() => setExpiryError("Failed to refresh expiring batches."))
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
    setAddForm(emptyBatchForm())
    setAddErrors({})
    setAddError(null)
    setAddOpen(true)
  }

  async function handleAddBatch() {
    const e = addBatchErrors(addForm)
    if (Object.keys(e).length) {
      setAddErrors(e)
      return
    }
    setAdding(true)
    setAddError(null)
    try {
      await createBatch({
        productId: addForm.productId,
        batchNumber: addForm.batchNumber.trim(),
        receivedDate: addForm.receivedDate,
        expiryDate: addForm.expiryDate,
        purchaseCost: Number(addForm.purchaseCost),
        supplierReference: addForm.supplierReference.trim(),
      })
      setAddOpen(false)
      await reloadBatches()
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to create batch.")
    } finally {
      setAdding(false)
    }
  }

  function formatDate(d: string) {
    if (!d) return "—"
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
  }

  const TAB_LABELS: { key: Tab; label: string }[] = [
    { key: "batches", label: "All Batches" },
    { key: "expiring", label: `Expiring Soon (${expiring.length})` },
    { key: "expired", label: `Expired (${expired.length})` },
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
      <div className="bg-white border-b border-[#DBEFF3] px-6 flex gap-0">
        {TAB_LABELS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === key
                ? "border-[#49B0C1] text-[#49B0C1]"
                : "border-transparent text-[#666666] hover:text-[#333333]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
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
            <div className="bg-white rounded-xl border border-[#DBEFF3] p-4">
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

            <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
              {loading ? (
                <LoadingSkeleton />
              ) : filteredBatches.length === 0 ? (
                <EmptyState title="No batches found" description="Adjust your filters or add stock to see batches." />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#DBEFF3] text-left">
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
                            <tr key={b.id} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"}>
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
                                  className="text-xs font-semibold text-[#49B0C1] hover:underline"
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
  { label: "Critical (≤ 30 days)", count: expiring.filter((b) => b.daysRemaining <= 30).length, cls: "border-red-200 bg-red-50", textCls: "text-red-600" },
  { label: "Within 60 days", count: expiring.filter((b) => b.daysRemaining > 30 && b.daysRemaining <= 60).length, cls: "border-orange-200 bg-orange-50", textCls: "text-orange-600" },
  { label: "Within 90 days", count: expiring.filter((b) => b.daysRemaining > 60 && b.daysRemaining <= 90).length, cls: "border-yellow-200 bg-yellow-50", textCls: "text-yellow-600" },
  { label: "Already Expired", count: expired.length, cls: "border-gray-200 bg-gray-50", textCls: "text-gray-600" },
].map(({ label, count, cls, textCls }) => (
                <div key={label} className={`rounded-xl border p-4 ${cls}`}>
                  <p className={`text-2xl font-bold ${textCls}`}>{count}</p>
                  <p className="text-xs text-[#666666] mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {expiryLoading ? (
              <LoadingSkeleton />
            ) : expiring.length === 0 ? (
              <EmptyState title="No expiring batches" description="No batches expiring within the next 90 days." />
            ) : (
              <>
                <ExpiryGroup
                  title="Critical — Expiring within 30 days"
                  urgency="critical"
                  batches={expiring.filter((b) => b.daysRemaining <= 30)}
                  productUnit={productUnit}
                  onAction={openAction}
                />
                <ExpiryGroup
                  title="Expiring within 60 days"
                  urgency="warning"
                  batches={expiring.filter((b) => b.daysRemaining > 30 && b.daysRemaining <= 60)}
                  productUnit={productUnit}
                  onAction={openAction}
                />
                <ExpiryGroup
                  title="Expiring within 90 days"
                  urgency="notice"
                  batches={expiring.filter((b) => b.daysRemaining > 60 && b.daysRemaining <= 90)}
                  productUnit={productUnit}
                  onAction={openAction}
                />
                
                
              </>
            )}
          </>
        )}

        {/* ── EXPIRED TAB ── */}
        {tab === "expired" && (
          <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
            {expiryLoading ? (
              <LoadingSkeleton />
            ) : expired.length === 0 ? (
              <EmptyState title="No expired batches" description="All batches are within their expiry date." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-red-50 text-left">
                      <th className="px-4 py-3 font-semibold text-[#333333]">Product</th>
                      <th className="px-4 py-3 font-semibold text-[#333333]">Batch</th>
                      <th className="px-4 py-3 font-semibold text-[#333333]">Expired</th>
                      <th className="px-4 py-3 font-semibold text-[#333333]">Quantity</th>
                      <th className="px-4 py-3 font-semibold text-[#333333] hidden sm:table-cell">Location</th>
                      <th className="px-4 py-3 font-semibold text-[#333333]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expired.map((b, i) => (
                      <tr key={b.id} className={i % 2 === 0 ? "bg-white" : "bg-red-50/40"}>
                        <td className="px-4 py-3 font-medium text-[#333333]">{b.product.name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-[#666666]">{b.batchNumber}</td>
                        <td className="px-4 py-3 text-red-600 font-semibold">{formatDate(b.expiryDate)}</td>
                        <td className="px-4 py-3 font-semibold text-[#333333]">
                          {b.stock.quantity.toLocaleString()} {productUnit(b.product.id)}s
                        </td>
                        <td className="px-4 py-3 text-[#666666] hidden sm:table-cell">{b.stock.location.name}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button onClick={() => openAction(b, "return")} className="text-xs font-semibold text-[#49B0C1] hover:underline">Return</button>
                            <button onClick={() => openAction(b, "dispose")} className="text-xs font-semibold text-red-500 hover:underline">Dispose</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─────────── Add Batch Modal ─────────── */}
      <Modal
        open={addOpen}
        title="Add Batch"
        onClose={() => !adding && setAddOpen(false)}
        size="md"
      >
        <div className="flex flex-col gap-4">
          <FormError message={addError} />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#333333]">Product</label>
            <Select
              value={addForm.productId}
              onChange={(e) => {
                setAddForm((f) => ({ ...f, productId: e.target.value }))
                setAddErrors((er) => ({ ...er, productId: undefined }))
              }}
            >
              <option value="">Select a product…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            {addErrors.productId && (
              <p className="text-xs text-red-500">{addErrors.productId}</p>
            )}
          </div>

          <Input
            label="Batch Number"
            value={addForm.batchNumber}
            onChange={(e) => {
              setAddForm((f) => ({ ...f, batchNumber: e.target.value }))
              setAddErrors((er) => ({ ...er, batchNumber: undefined }))
            }}
            error={addErrors.batchNumber}
            placeholder="e.g. PCM001"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Received Date"
              type="date"
              value={addForm.receivedDate}
              onChange={(e) => {
                setAddForm((f) => ({ ...f, receivedDate: e.target.value }))
                setAddErrors((er) => ({ ...er, receivedDate: undefined }))
              }}
              error={addErrors.receivedDate}
            />
            <Input
              label="Expiry Date"
              type="date"
              value={addForm.expiryDate}
              onChange={(e) => {
                setAddForm((f) => ({ ...f, expiryDate: e.target.value }))
                setAddErrors((er) => ({ ...er, expiryDate: undefined }))
              }}
              error={addErrors.expiryDate}
            />
          </div>

          <Input
            label="Purchase Cost"
            type="number"
            min={0}
            step="0.01"
            value={addForm.purchaseCost}
            onChange={(e) => {
              setAddForm((f) => ({ ...f, purchaseCost: e.target.value }))
              setAddErrors((er) => ({ ...er, purchaseCost: undefined }))
            }}
            error={addErrors.purchaseCost}
            placeholder="e.g. 110"
          />

          <Input
            label="Supplier Reference"
            value={addForm.supplierReference}
            onChange={(e) =>
              setAddForm((f) => ({ ...f, supplierReference: e.target.value }))
            }
            placeholder="e.g. ABC Pharma invoice 1042"
          />

          <div className="flex gap-3 justify-end pt-2">
            <Button
              variant="secondary"
              onClick={() => setAddOpen(false)}
              disabled={adding}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleAddBatch()} loading={adding}>
              Create Batch
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─────────── Expiry Action Modal ─────────── */}
      <Modal open={!!actionBatch} title="Expiry Action" onClose={() => setActionBatch(null)} size="md">
        {actionBatch && (
          <div className="flex flex-col gap-5">
            <div className="rounded-xl bg-[#DBEFF3] p-4 grid grid-cols-2 gap-3 text-sm">
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
                <label key={a} className="flex items-center gap-3 cursor-pointer rounded-lg border border-[#ABDBE3] px-4 py-3 hover:bg-[#DBEFF3]/50 transition-colors">
                  <input type="radio" name="action" value={a} checked={actionType === a} onChange={() => setActionType(a)} className="accent-[#49B0C1]" />
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

function ExpiryGroup({
  title, urgency, batches, productUnit, onAction,
}: {
  title: string
  urgency: "critical" | "warning" | "notice"
  batches: ExpiryBatchDto[]
  productUnit: (id: string) => string
  onAction: (b: ExpiryBatchDto, type: ExpiryAction) => void
}) {
  if (batches.length === 0) return null
  const headerCls = urgency === "critical" ? "bg-red-500" : urgency === "warning" ? "bg-orange-400" : "bg-yellow-400"
  const dotCls = urgency === "critical" ? "text-red-600" : urgency === "warning" ? "text-orange-500" : "text-yellow-500"

  return (
    <section>
      <div className={`${headerCls} px-4 py-2.5 rounded-t-xl flex items-center justify-between`}>
        <p className="text-sm font-bold text-white">{title}</p>
        <span className="text-xs text-white/80">{batches.length} batch{batches.length !== 1 ? "es" : ""}</span>
      </div>
      <div className="bg-white rounded-b-xl border border-t-0 border-[#DBEFF3] divide-y divide-[#DBEFF3]">
        {batches.map((b) => {
          const days = b.daysRemaining
          return (
            <div key={b.id} className="flex items-center gap-4 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#333333] truncate">{b.product.name}</p>
                <p className="text-xs text-[#666666] font-mono">{b.batchNumber} · {b.stock.location.name}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-sm font-bold ${dotCls}`}>{days} days</p>
                <p className="text-xs text-[#666666]">{b.stock.quantity.toLocaleString()} {productUnit(b.product.id)}s</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => onAction(b, "return")} className="text-xs font-semibold text-[#49B0C1] hover:underline">Return</button>
                <button onClick={() => onAction(b, "clearance")} className="text-xs font-semibold text-orange-500 hover:underline">Clearance</button>
                <button onClick={() => onAction(b, "dispose")} className="text-xs font-semibold text-red-500 hover:underline">Dispose</button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-3 animate-pulse">
      {[...Array(5)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-[#DBEFF3]" />)}
    </div>
  )
}
