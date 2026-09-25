import { useCallback, useEffect, useState } from "react"
import PageHeader from "../../components/ui/PageHeader"
import SearchInput from "../../components/ui/SearchInput"
import Modal from "../../components/ui/Modal"
import Button from "../../components/ui/Button"
import Pagination from "../../components/ui/Pagination"
import {
  listTransfers,
  getTransfer,
  createTransfer,
  updateTransfer,
  addTransferItem,
  updateTransferItem,
  deleteTransferItem,
  completeTransfer,
  cancelTransfer,
  TransfersApiError,
  type TransferDto,
  type TransferItemFullDto,
  type TransferStatusDto,
  type CreateTransferInput,
} from "../../features/inventory/transfersApi"
import { listProductBatches } from "../../features/inventory/batchesApi"
import {
  searchProducts,
  searchLocations,
} from "../../features/inventory/searchSelectors"
import { useProductUnits } from "../../features/inventory/useProductUnits"
import { toBaseQuantity } from "../../features/inventory/unitOptions"
import SearchableSelect from "../../components/ui/SearchableSelect"
import type { SearchableOption } from "../../components/ui/SearchableSelect"
import { useSearchableResource } from "../../hooks/useSearchableResource"
import DatePicker from "../../components/ui/DatePicker"

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function StatusBadge({ status }: { status: TransferStatusDto }) {
  const map: Record<TransferStatusDto, string> = {
    DRAFT: "bg-yellow-100 text-yellow-700",
    COMPLETED: "bg-green-100 text-green-700",
    CANCELLED: "bg-red-100 text-red-700",
  }
  return (
    <span
      className={`text-xs font-bold rounded-full px-2.5 py-0.5 ${map[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      {status}
    </span>
  )
}

function nameOf(ref: unknown, fallback: string): string {
  if (ref && typeof ref === "object" && "name" in ref) {
    const n = (ref as { name?: unknown }).name
    if (typeof n === "string" && n) return n
  }
  return fallback
}

function itemName(item: TransferItemFullDto): string {
  return nameOf(item.product, item.productId)
}

function itemBatch(item: TransferItemFullDto): string {
  return nameOf(item.batch, item.batchId ? item.batchId.slice(0, 8) : "—")
}

function itemUnit(item: TransferItemFullDto): string {
  return nameOf(item.unit, "")
}

/** ISO timestamp for "today" — the create endpoint expects a full datetime. */
function nowIso(): string {
  return new Date().toISOString()
}

/** `YYYY-MM-DD` slice for date inputs, from either a date or datetime string. */
function toDateInput(d: string): string {
  return d ? d.slice(0, 10) : ""
}

function loadErrorMessage(err: unknown): string {
  if (err instanceof TransfersApiError && err.status === 401) return err.message
  return err instanceof Error
    ? err.message
    : "Failed to load transfers. Please try again."
}

// ─── Root page ───────────────────────────────────────────────────────────────

type Screen = "list" | "detail" | "new"

export default function StockTransferPage() {
  const [screen, setScreen] = useState<Screen>("list")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // ── New Transfer screen ────────────────────────────────────────────────
  if (screen === "new") {
    return (
      <NewTransferScreen
        onBack={() => setScreen("list")}
        onCancel={() => setScreen("list")}
        onCreated={(id) => {
          setSelectedId(id)
          setScreen("detail")
        }}
      />
    )
  }

  // ── Transfer Details screen ────────────────────────────────────────────
  if (screen === "detail" && selectedId) {
    return (
      <TransferDetailsScreen
        transferId={selectedId}
        onBack={() => {
          setScreen("list")
          setSelectedId(null)
        }}
      />
    )
  }

  // ── List screen ────────────────────────────────────────────────────────
  return (
    <TransferListScreen
      onSelect={(id) => {
        setSelectedId(id)
        setScreen("detail")
      }}
      onNewTransfer={() => setScreen("new")}
    />
  )
}

// ─── Transfer List Screen (GET /inventory/transfers) ─────────────────────────

function TransferListScreen({
  onSelect,
  onNewTransfer,
}: {
  onSelect: (id: string) => void
  onNewTransfer: () => void
}) {
  const [transfers, setTransfers] = useState<TransferDto[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [fromFilter, setFromFilter] = useState("")
  const [toFilter, setToFilter] = useState("")

  const fromSearch = useSearchableResource(searchLocations)
  const toSearch = useSearchableResource(searchLocations)
  const fromFilterOptions: SearchableOption[] = fromSearch.options
  const toFilterOptions: SearchableOption[] = toSearch.options

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const result = await listTransfers({
        page,
        limit: 10,
        status: (statusFilter || undefined) as TransferStatusDto | undefined,
        fromLocationId: fromFilter || undefined,
        toLocationId: toFilter || undefined,
        search: search.trim() || undefined,
      })
      setTransfers(result.data)
      setTotalPages(Math.max(1, result.pagination?.totalPages ?? 1))
      setTotal(result.pagination?.total ?? result.data.length)
    } catch (err) {
      setLoadError(loadErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter, fromFilter, toFilter])

  useEffect(() => {
    load()
  }, [load])

  function reset() {
    setSearch("")
    setStatusFilter("")
    setFromFilter("")
    setToFilter("")
    setPage(1)
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb="Inventory / Transfers"
        title="Transfers"
        subtitle="Manage stock transfers between pharmacy locations."
        actions={
          <button
            onClick={onNewTransfer}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#B6C8AF] text-[#333333] px-3.5 py-2 text-sm font-semibold hover:bg-[#E6ECE2] transition-colors"
          >
            + New Transfer
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        {loadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 flex items-center justify-between gap-3">
            <span>{loadError}</span>
            <button
              onClick={load}
              className="text-xs font-semibold text-red-700 hover:underline whitespace-nowrap"
            >
              Retry
            </button>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <div className="flex-1">
              <SearchInput
                value={search}
                onChange={(v) => {
                  setSearch(v)
                  setPage(1)
                }}
                placeholder="Search transfers..."
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="sm:w-44 rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm focus:border-[#B6C8AF] focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">DRAFT</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
            <div className="sm:w-44">
              <SearchableSelect
                value={fromFilter || null}
                onChange={(v) => {
                  setFromFilter(v)
                  setPage(1)
                }}
                options={fromFilterOptions}
                onSearch={fromSearch.setTerm}
                loading={fromSearch.loading}
                error={fromSearch.error}
                onRetry={fromSearch.retry}
                allowClear
                placeholder="From Location"
                searchPlaceholder="Search locations..."
                emptyMessage="No locations found"
                noResultsMessage="No locations matching your search"
              />
            </div>
            <div className="sm:w-44">
              <SearchableSelect
                value={toFilter || null}
                onChange={(v) => {
                  setToFilter(v)
                  setPage(1)
                }}
                options={toFilterOptions}
                onSearch={toSearch.setTerm}
                loading={toSearch.loading}
                error={toSearch.error}
                onRetry={toSearch.retry}
                allowClear
                placeholder="To Location"
                searchPlaceholder="Search locations..."
                emptyMessage="No locations found"
                noResultsMessage="No locations matching your search"
              />
            </div>
            {(search || statusFilter || fromFilter || toFilter) && (
              <button
                onClick={reset}
                className="text-xs font-semibold text-[#7A9076] hover:underline whitespace-nowrap"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden flex-shrink-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#E6ECE2] text-left">
                  {["Date", "From", "To", "Status", "Items", ""].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 font-semibold text-[#333333]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="h-8 rounded-lg bg-[#E6ECE2]" />
                      </td>
                    </tr>
                  ))
                ) : transfers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-sm text-[#999]"
                    >
                      No transfers found.
                    </td>
                  </tr>
                ) : (
                  transfers.map((t, i) => (
                    <tr
                      key={t.id}
                      onClick={() => onSelect(t.id)}
                      className={`cursor-pointer transition-colors hover:bg-[#E6ECE2]/40 ${
                        i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/20"
                      }`}
                    >
                      <td className="px-4 py-3 text-[#666666] whitespace-nowrap">
                        {fmtDate(t.transferDate)}
                      </td>
                      <td className="px-4 py-3 text-[#333333]">
                        {nameOf(t.fromLocation, t.fromLocation.id)}
                      </td>
                      <td className="px-4 py-3 text-[#333333]">
                        {nameOf(t.toLocation, t.toLocation.id)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-4 py-3 text-[#666666]">
                        {t.items?.length ?? 0} item
                        {(t.items?.length ?? 0) !== 1 ? "s" : ""}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold text-[#7A9076]">
                          View →
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            label={
              <>
                Showing {total > 0 ? (page - 1) * 10 + 1 : 0}–
                {Math.min(page * 10, total)} of {total} transfers
              </>
            }
          />
        </div>
      </div>
    </div>
  )
}

// ─── NEW: Create Transfer Screen (POST /inventory/transfers) ─────────────────

function NewTransferScreen({
  onBack,
  onCancel,
  onCreated,
}: {
  onBack: () => void
  onCancel: () => void
  onCreated: (id: string) => void
}) {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [date, setDate] = useState(nowIso())
  const [reason, setReason] = useState("")

  // Pending items: { productId, batchId, unitId, quantity }
  type PendingItem = Omit<CreateTransferInput["items"][number], never> & {
    key: string
    productLabel?: string
    batchLabel?: string
    unitLabel?: string
  }
  const [items, setItems] = useState<PendingItem[]>([])
  const [addItemOpen, setAddItemOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState("")

  const fromSearch = useSearchableResource(searchLocations, true)
  const toSearch = useSearchableResource(searchLocations, true)
  const fromOptions: SearchableOption[] = [
    ...(from ? fromSearch.options.filter((o) => o.value === from) : []),
    ...fromSearch.options.filter((o) => o.value !== to),
  ]
  const toOptions: SearchableOption[] = [
    ...(to ? toSearch.options.filter((o) => o.value === to) : []),
    ...toSearch.options.filter((o) => o.value !== from),
  ]

  const sameLocation = !!from && !!to && from === to

  function handleAddItem(item: Omit<PendingItem, "key">) {
    setItems((prev) => [
      ...prev,
      {
        ...item,
        key: `${item.productId}:${item.batchId}:${item.unitId}:${Date.now()}`,
      },
    ])
    setAddItemOpen(false)
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key))
  }

  async function handleCreate() {
    if (!from) {
      setError("Please select a source location.")
      return
    }
    if (!to) {
      setError("Please select a destination location.")
      return
    }
    if (sameLocation) {
      setError("Source and destination must be different.")
      return
    }
    if (!date) {
      setError("Please select a transfer date.")
      return
    }
    if (items.length === 0) {
      setError("Please add at least one item to this transfer.")
      return
    }
    setError("")
    setCreating(true)
    try {
      const created = await createTransfer({
        fromLocationId: from,
        toLocationId: to,
        transferDate: date,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        items: items.map(({ productId, batchId, unitId, quantity }) => ({
          productId,
          batchId,
          unitId,
          quantity,
        })),
      })
      onCreated(created.id)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create the transfer. Please try again.",
      )
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#E6ECE2] px-6 pt-5 pb-5 flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-medium text-[#7A9076] hover:underline mb-3"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
              clipRule="evenodd"
            />
          </svg>
          Transfers
        </button>
        <h1 className="text-xl font-bold text-[#333333]">
          Create New Transfer
        </h1>
        <p className="text-sm text-[#666666] mt-1">
          Create a stock transfer between pharmacy locations.
        </p>
      </div>

      {/* ── Scrollable body ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 flex-shrink-0">
            {error}
          </div>
        )}

        {/* ── Card 1: Transfer Information ───────────────────── */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-visible flex-shrink-0">
          <div className="px-5 py-3 border-b border-[#E6ECE2]">
            <p className="text-xs font-bold text-[#666666] uppercase tracking-wide">
              Transfer Information
            </p>
          </div>
          <div className="px-5 py-5 grid sm:grid-cols-2 gap-x-5 gap-y-5">
            <FieldWrap label="From Location *">
              <SearchableSelect
                value={from || null}
                onChange={(v) => setFrom(v)}
                options={fromOptions}
                onSearch={fromSearch.setTerm}
                loading={fromSearch.loading}
                error={fromSearch.error}
                onRetry={fromSearch.retry}
                placeholder="Search and select source location..."
                searchPlaceholder="Search locations..."
                emptyMessage="No locations found"
                noResultsMessage="No locations matching your search"
              />
            </FieldWrap>

            <FieldWrap label="To Location *">
              <SearchableSelect
                value={to || null}
                onChange={(v) => setTo(v)}
                options={toOptions}
                onSearch={toSearch.setTerm}
                loading={toSearch.loading}
                error={toSearch.error}
                onRetry={toSearch.retry}
                placeholder="Search and select destination location..."
                searchPlaceholder="Search locations..."
                emptyMessage="No locations found"
                noResultsMessage="No locations matching your search"
              />
            </FieldWrap>

            {sameLocation && (
              <div className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                Source and destination must be different locations.
              </div>
            )}

            <FieldWrap label="Transfer Date *">
              <DatePicker
                value={toDateInput(date)}
                onChange={(v) =>
                  setDate(
                    v
                      ? new Date(`${v}T09:00:00.000Z`).toISOString()
                      : "",
                  )
                }
                placeholder="Select transfer date"
              />
            </FieldWrap>

            <FieldWrap label="Reason">
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={SELECT_CLS}
                placeholder="Enter reason for transfer"
              />
            </FieldWrap>
          </div>
        </div>

        {/* ── Card 2: Transfer Items ─────────────────────────── */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden flex-shrink-0">
          <div className="px-5 py-3 border-b border-[#E6ECE2] flex items-center justify-between">
            <p className="text-xs font-bold text-[#666666] uppercase tracking-wide">
              Transfer Items
              {items.length > 0 && (
                <span className="text-[#7A9076] ml-1">({items.length})</span>
              )}
            </p>
            <button
              onClick={() => setAddItemOpen(true)}
              className="rounded-xl border border-[#C6D4BF] bg-white px-3 py-1.5 text-xs font-semibold text-[#7A9076] hover:bg-[#E6ECE2]/50 transition-colors"
            >
              + Add Item
            </button>
          </div>

          {items.length === 0 ? (
            <div className="px-5 py-12 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#E6ECE2]/50 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-[#7A9076]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              </div>
              <p className="text-sm font-semibold text-[#333333]">
                No items added
              </p>
              <p className="text-xs text-[#999]">
                Add products to this transfer before creating it.
              </p>
              <button
                onClick={() => setAddItemOpen(true)}
                className="mt-1 rounded-xl bg-[#B6C8AF] px-4 py-2 text-sm font-semibold text-[#333333] hover:bg-[#A5B89E] transition-colors"
              >
                + Add Item
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#E6ECE2]/50 text-left">
                    <th className="px-4 py-3 font-semibold text-[#333333]">
                      Product
                    </th>
                    <th className="px-4 py-3 font-semibold text-[#333333]">
                      Batch
                    </th>
                    <th className="px-4 py-3 font-semibold text-[#333333]">
                      Unit
                    </th>
                    <th className="px-4 py-3 font-semibold text-[#333333] text-right">
                      Quantity
                    </th>
                    <th className="px-4 py-3 font-semibold text-[#333333]">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr
                      key={item.key}
                      className={idx % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/20"}
                    >
                      <td className="px-4 py-3 font-medium text-[#333333]">
                        {item.productLabel ?? item.productId.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[#666666]">
                        {item.batchLabel ?? item.batchId.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-[#666666]">
                        {item.unitLabel ?? item.unitId.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[#333333]">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => removeItem(item.key)}
                          className="text-xs font-semibold text-red-500 hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom actions (sticky) ─────────────────────────── */}
      <div className="bg-white border-t border-[#E6ECE2] px-6 py-4 flex justify-end gap-3 flex-shrink-0">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleCreate} loading={creating}>
          Create Transfer
        </Button>
      </div>

      {/* ── Add Item Modal ──────────────────────────────────── */}
      <AddTransferItemModal
        open={addItemOpen}
        onClose={() => setAddItemOpen(false)}
        onAdd={handleAddItem}
      />
    </div>
  )
}

// ─── Add Transfer Item Modal (pending item on the Create screen) ─────────────

function AddTransferItemModal({
  open,
  onClose,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  onAdd: (
    item: Omit<CreateTransferInput["items"][number], never> & {
      productLabel?: string
      batchLabel?: string
      unitLabel?: string
    },
  ) => void
}) {
  const [productId, setProductId] = useState("")
  const [batchId, setBatchId] = useState("")
  const [unitId, setUnitId] = useState("")
  const [quantity, setQuantity] = useState("")
  const [error, setError] = useState("")

  const [batches, setBatches] = useState<{ id: string; batchNumber: string }[]>(
    [],
  )
  const [loading, setLoading] = useState(false)

  const productSearch = useSearchableResource(searchProducts, open)
  const unitsApi = useProductUnits(productId)

  const selectedProductOption =
    productSearch.options.find((o) => o.value === productId) ?? null
  const productOptions: SearchableOption[] = selectedProductOption
    ? [
        selectedProductOption,
        ...productSearch.options.filter((o) => o.value !== productId),
      ]
    : productSearch.options

  useEffect(() => {
    if (!open || !productId) {
      setBatches([])
      return
    }
    let cancelled = false
    setLoading(true)
    listProductBatches(productId, { limit: 100 })
      .then((b) => {
        if (!cancelled)
          setBatches(
            b.data.map((row) => ({ id: row.id, batchNumber: row.batchNumber })),
          )
      })
      .catch(() => {
        if (!cancelled) setBatches([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, productId])

  useEffect(() => {
    if (!productId || !unitId) return
    const current = unitsApi.units.find((u) => u.unitId === unitId)
    if (!current) {
      const base = unitsApi.units.find((u) => u.isBaseUnit) ?? unitsApi.units[0]
      if (base) setUnitId(base.unitId)
    }
  }, [unitsApi.units, unitId, productId])

  function reset() {
    setProductId("")
    setBatchId("")
    setUnitId("")
    setQuantity("")
    setError("")
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleAdd() {
    if (!productId) {
      setError("Please select a product.")
      return
    }
    if (!batchId) {
      setError("Please select a batch.")
      return
    }
    if (!unitId) {
      setError("Please select a unit.")
      return
    }
    const qty = parseInt(quantity)
    if (!qty || qty <= 0) {
      setError("Quantity must be a positive number.")
      return
    }
    setError("")
    const selectedUnit = unitsApi.units.find((u) => u.unitId === unitId)
    const selectedBatch = batches.find((b) => b.id === batchId)
    onAdd({
      productId,
      batchId,
      unitId,
      quantity: qty,
      productLabel: selectedProductOption?.label,
      batchLabel: selectedBatch?.batchNumber,
      unitLabel: selectedUnit?.unit.name,
    })
    reset()
  }

  const selectedUnit = unitsApi.units.find((u) => u.unitId === unitId)
  const basePreview = toBaseQuantity(parseInt(quantity) || 0, selectedUnit)
  const baseLabel =
    basePreview !== null && unitsApi.baseUnit
      ? basePreview.toLocaleString() + " " + (unitsApi.baseUnit.name ?? "")
      : ""

  return (
    <Modal
      open={open}
      title="Add Transfer Item"
      onClose={handleClose}
      size="sm"
    >
      <div className="flex flex-col gap-4">
        {error && (
          <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <FieldWrap label="Product *">
          <SearchableSelect
            value={productId || null}
            onChange={(v) => {
              setProductId(v)
              setBatchId("")
              setUnitId("")
            }}
            options={productOptions}
            onSearch={productSearch.setTerm}
            loading={productSearch.loading}
            error={productSearch.error}
            onRetry={productSearch.retry}
            placeholder="Search and select a product..."
            searchPlaceholder="Search by name or SKU..."
            emptyMessage="No products found"
            noResultsMessage="No products matching your search"
          />
        </FieldWrap>

        <FieldWrap label="Batch *">
          <SearchableSelect
            value={batchId || null}
            onChange={setBatchId}
            options={batches.map((b) => ({
              value: b.id,
              label: b.batchNumber,
            }))}
            disabled={!productId || loading}
            placeholder={loading ? "Loading batches..." : "Select batch..."}
            searchPlaceholder="Search batches..."
            emptyMessage={loading ? "Loading batches..." : "No batches found"}
            noResultsMessage="No batches matching your search"
          />
        </FieldWrap>

        <FieldWrap label="Unit *">
          <SearchableSelect
            value={unitId || null}
            onChange={setUnitId}
            options={unitsApi.units.map((u) => ({
              value: u.unitId,
              label: `${u.unit.name}${u.isBaseUnit ? " (base)" : ""}`,
            }))}
            disabled={!productId || unitsApi.units.length === 0}
            placeholder={
              unitsApi.units.length === 0
                ? productId
                  ? "No units configured"
                  : "Select product first"
                : "Select unit..."
            }
            searchPlaceholder="Search units..."
            emptyMessage="No units available"
            noResultsMessage="No units matching your search"
          />
        </FieldWrap>

        <FieldWrap label="Quantity *">
          <div className="flex flex-col gap-1">
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className={SELECT_CLS}
              placeholder="0"
            />
            {baseLabel &&
              quantity &&
              selectedUnit &&
              !selectedUnit.isBaseUnit && (
                <p className="text-xs text-[#999]">= {baseLabel}</p>
              )}
          </div>
        </FieldWrap>

        <div className="flex gap-3 justify-end border-t border-[#E6ECE2] pt-4">
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleAdd}>Add Item</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Transfer Details Screen ─────────────────────────────────────────────────

// Loading skeleton for the Transfer Details screen. Mirrors the loaded layout
// (header, Transfer Information card, Transfer Items table, action bar) using
// the app's shimmer pattern (animate-pulse + sage-tinted placeholders) so the
// page doesn't jump when the data arrives.
function TransferDetailSkeleton() {
  return (
    <div className="flex-1 flex flex-col min-h-0 animate-pulse">
      {/* Header */}
      <div
        className="px-6 pt-5 pb-4"
        style={{
          background: "linear-gradient(135deg, #4F6B4A 0%, #3B4F35 100%)",
        }}
      >
        <div className="h-4 w-20 rounded bg-white/40 mb-3" />
        <div className="flex items-center gap-3 flex-wrap">
          <div className="h-6 w-52 rounded-lg bg-white/40" />
          <div className="h-6 w-16 rounded-full bg-white/30" />
        </div>
      </div>

      <div className="flex-1 p-6 flex flex-col gap-5">
        {/* Transfer Information */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden flex-shrink-0">
          <div className="px-5 py-3 border-b border-[#E6ECE2] flex items-center justify-between">
            <div className="h-3 w-36 rounded bg-[#E6ECE2]" />
            <div className="h-3 w-20 rounded bg-[#E6ECE2]" />
          </div>
          <div className="px-5 py-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[...Array(4)].map((_, i) => (
              <div key={i}>
                <div className="h-2.5 w-10 rounded bg-[#E6ECE2] mb-2" />
                <div className="h-4 w-28 rounded bg-[#E6ECE2]" />
              </div>
            ))}
          </div>
        </div>

        {/* Transfer Items */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden flex-shrink-0">
          <div className="px-5 py-3 border-b border-[#E6ECE2] flex items-center justify-between">
            <div className="h-3 w-40 rounded bg-[#E6ECE2]" />
            <div className="h-3 w-16 rounded bg-[#E6ECE2]" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#E6ECE2]/50 text-left">
                  {["w-16", "w-12", "w-10", "w-14", "w-16"].map((w, i) => (
                    <th
                      key={i}
                      className={`px-4 py-3 ${i === 3 ? "text-right" : ""}`}
                    >
                      <div
                        className={`h-3 rounded bg-[#E6ECE2] ${
                          i === 3 ? "ml-auto" : ""
                        } ${w}`}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...Array(3)].map((_, i) => (
                  <tr
                    key={i}
                    className={i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/20"}
                  >
                    <td className="px-4 py-3.5">
                      <div className="h-4 w-36 rounded bg-[#E6ECE2]" />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="h-3.5 w-20 rounded bg-[#E6ECE2]" />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="h-3.5 w-14 rounded bg-[#E6ECE2]" />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="h-4 w-12 rounded bg-[#E6ECE2] ml-auto" />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="h-3.5 w-16 rounded bg-[#E6ECE2]" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Transfer Actions */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] px-5 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="h-3 w-32 rounded bg-[#E6ECE2]" />
          <div className="flex gap-3">
            <div className="h-9 w-32 rounded-xl bg-[#E6ECE2]" />
            <div className="h-9 w-40 rounded-xl bg-[#E6ECE2]" />
          </div>
        </div>
      </div>
    </div>
  )
}

function TransferDetailsScreen({
  transferId,
  onBack,
}: {
  transferId: string
  onBack: () => void
}) {
  const [transfer, setTransfer] = useState<TransferDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")

  const [editTransferOpen, setEditTransferOpen] = useState(false)
  const [addItemOpen, setAddItemOpen] = useState(false)
  const [editItem, setEditItem] = useState<TransferItemFullDto | null>(null)
  const [deleteItem, setDeleteItem] = useState<TransferItemFullDto | null>(null)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false)
  const [actionError, setActionError] = useState("")
  const [actionBusy, setActionBusy] = useState(false)

  const reload = useCallback(async () => {
    try {
      setLoadError("")
      const dto = await getTransfer(transferId)
      setTransfer(dto)
    } catch (err) {
      setLoadError(loadErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [transferId])

  useEffect(() => {
    reload()
  }, [reload])

  const isReadOnly = transfer ? transfer.status !== "DRAFT" : true

  async function withAction(fn: () => Promise<unknown>, fallback: string) {
    setActionError("")
    setActionBusy(true)
    try {
      await fn()
      await reload()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : fallback)
    } finally {
      setActionBusy(false)
    }
  }

  if (loading) {
    return <TransferDetailSkeleton />
  }

  if (loadError || !transfer) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div
          className="px-6 pt-5 pb-4"
          style={{
            background: "linear-gradient(135deg, #4F6B4A 0%, #3B4F35 100%)",
          }}
        >
          <button
            onClick={onBack}
            className="text-sm text-white/80 hover:text-white"
          >
            ← Transfers
          </button>
        </div>
        <div className="flex-1 p-6">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 flex items-center justify-between gap-3">
            <span>{loadError || "Transfer not found."}</span>
            <button
              onClick={reload}
              className="text-xs font-semibold text-red-700 hover:underline whitespace-nowrap"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div
        className="px-6 pt-5 pb-4"
        style={{
          background: "linear-gradient(135deg, #4F6B4A 0%, #3B4F35 100%)",
        }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors mb-3"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
              clipRule="evenodd"
            />
          </svg>
          Transfers
        </button>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-white">
            Transfer #{transfer.transferNumber ?? transfer.id.slice(0, 8)}
          </h1>
          <StatusBadge status={transfer.status} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        {actionError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {actionError}
          </div>
        )}

        {/* Section 1: Transfer Information */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden flex-shrink-0">
          <div className="px-5 py-3 border-b border-[#E6ECE2] flex items-center justify-between">
            <p className="text-xs font-bold text-[#666666] uppercase tracking-wide">
              Transfer Information
            </p>
            {!isReadOnly && (
              <button
                onClick={() => setEditTransferOpen(true)}
                className="text-xs font-semibold text-[#7A9076] hover:underline"
              >
                Edit Transfer
              </button>
            )}
          </div>
          <div className="px-5 py-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              ["From", nameOf(transfer.fromLocation, transfer.fromLocation.id)],
              ["To", nameOf(transfer.toLocation, transfer.toLocation.id)],
              ["Date", fmtDate(transfer.transferDate)],
              ["Reason", transfer.reason || "—"],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-[#999] mb-0.5">{label}</p>
                <p className="text-sm font-semibold text-[#333333]">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: Transfer Items */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden flex-shrink-0">
          <div className="px-5 py-3 border-b border-[#E6ECE2] flex items-center justify-between">
            <p className="text-xs font-bold text-[#666666] uppercase tracking-wide">
              Transfer Items{" "}
              <span className="text-[#7A9076] ml-1">
                ({transfer.items?.length ?? 0})
              </span>
            </p>
            {!isReadOnly && (
              <button
                onClick={() => setAddItemOpen(true)}
                className="text-xs font-semibold text-[#7A9076] hover:underline"
              >
                + Add Item
              </button>
            )}
          </div>
          {(transfer.items?.length ?? 0) === 0 ? (
            <p className="px-5 py-8 text-sm text-center text-[#999]">
              No items added. Click "+ Add Item" to begin.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#E6ECE2]/50 text-left">
                    <th className="px-4 py-3 font-semibold text-[#333333]">
                      Product
                    </th>
                    <th className="px-4 py-3 font-semibold text-[#333333]">
                      Batch
                    </th>
                    <th className="px-4 py-3 font-semibold text-[#333333]">
                      Unit
                    </th>
                    <th className="px-4 py-3 font-semibold text-[#333333] text-right">
                      Quantity
                    </th>
                    {!isReadOnly && (
                      <th className="px-4 py-3 font-semibold text-[#333333]">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {transfer.items.map((item, idx) => (
                    <tr
                      key={item.id}
                      className={idx % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/20"}
                    >
                      <td className="px-4 py-3 font-medium text-[#333333]">
                        {itemName(item)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[#666666]">
                        {itemBatch(item)}
                      </td>
                      <td className="px-4 py-3 text-[#666666]">
                        {itemUnit(item) || "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[#333333]">
                        {item.quantity}
                      </td>
                      {!isReadOnly && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => setEditItem(item)}
                              className="text-xs font-semibold text-[#7A9076] hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => setDeleteItem(item)}
                              className="text-xs font-semibold text-red-500 hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section 3: Transfer Actions */}
        {!isReadOnly && (
          <div className="bg-white rounded-xl border border-[#E6ECE2] px-5 py-4 flex items-center justify-between flex-wrap gap-3">
            <p className="text-xs font-bold text-[#666666] uppercase tracking-wide">
              Transfer Actions
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setCancelConfirmOpen(true)}
                disabled={actionBusy}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel Transfer
              </button>
              <button
                onClick={() => setCompleteConfirmOpen(true)}
                disabled={actionBusy || (transfer.items?.length ?? 0) === 0}
                className="rounded-xl bg-[#B6C8AF] px-4 py-2 text-sm font-semibold text-[#333333] hover:bg-[#A5B89E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Complete Transfer
              </button>
            </div>
          </div>
        )}

        {isReadOnly && (
          <div
            className={`rounded-xl border px-5 py-4 text-sm font-medium ${
              transfer.status === "COMPLETED"
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            This transfer is <strong>{transfer.status}</strong> and is
            read-only.
          </div>
        )}
      </div>

      {/* Modals */}
      <EditTransferModal
        open={editTransferOpen}
        transfer={transfer}
        onClose={() => setEditTransferOpen(false)}
        onSave={async (info) => {
          setEditTransferOpen(false)
          await withAction(
            () =>
              updateTransfer(transfer.id, {
                transferDate: info.date,
                ...(info.reason !== undefined ? { reason: info.reason } : {}),
              }),
            "Failed to update the transfer.",
          )
        }}
      />
      <AddItemToExistingModal
        open={addItemOpen}
        transferId={transfer.id}
        onClose={() => setAddItemOpen(false)}
        onAdded={async () => {
          setAddItemOpen(false)
          await reload()
        }}
        onError={(message) => setActionError(message)}
      />
      {editItem && (
        <EditItemModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSave={async (quantity) => {
            setEditItem(null)
            await withAction(
              () => updateTransferItem(transfer.id, editItem.id, { quantity }),
              "Failed to update the item.",
            )
          }}
        />
      )}
      <ConfirmModal
        open={!!deleteItem}
        title="Remove this item?"
        message={`Remove ${
          deleteItem ? itemName(deleteItem) : "this item"
        } from this transfer?`}
        confirmLabel="Remove Item"
        confirmClass="bg-red-600 hover:bg-red-700 text-white"
        onClose={() => setDeleteItem(null)}
        onConfirm={async () => {
          const item = deleteItem
          setDeleteItem(null)
          if (item)
            await withAction(
              () => deleteTransferItem(transfer.id, item.id),
              "Failed to remove the item.",
            )
        }}
      />
      <ConfirmModal
        open={cancelConfirmOpen}
        title="Cancel Transfer?"
        message="Are you sure you want to cancel this transfer? This action will cancel the entire transfer."
        confirmLabel="Cancel Transfer"
        confirmClass="bg-red-600 hover:bg-red-700 text-white"
        onClose={() => setCancelConfirmOpen(false)}
        onConfirm={async () => {
          setCancelConfirmOpen(false)
          await withAction(
            () => cancelTransfer(transfer.id),
            "Failed to cancel the transfer.",
          )
        }}
      />
      <ConfirmModal
        open={completeConfirmOpen}
        title="Complete Transfer?"
        message={`This will complete the stock transfer from ${nameOf(transfer.fromLocation, "the source")} to ${nameOf(transfer.toLocation, "the destination")}.`}
        detail={`${transfer.items?.length ?? 0} item${
          (transfer.items?.length ?? 0) !== 1 ? "s" : ""
        } will be transferred.`}
        confirmLabel="Complete Transfer"
        confirmClass="bg-[#B6C8AF] hover:bg-[#A5B89E] text-[#333333]"
        onClose={() => setCompleteConfirmOpen(false)}
        onConfirm={async () => {
          setCompleteConfirmOpen(false)
          await withAction(
            () => completeTransfer(transfer.id),
            "Failed to complete the transfer.",
          )
        }}
      />
    </div>
  )
}

// ─── Edit Transfer Modal (PATCH /inventory/transfers/{id}) ───────────────────

function EditTransferModal({
  open,
  transfer,
  onClose,
  onSave,
}: {
  open: boolean
  transfer: TransferDto
  onClose: () => void
  onSave: (info: { date: string; reason?: string }) => void
}) {
  const [date, setDate] = useState(toDateInput(transfer.transferDate))
  const [reason, setReason] = useState(transfer.reason ?? "")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  function handleSave() {
    if (!date) {
      setError("Please select a transfer date.")
      return
    }
    setError("")
    setSaving(true)
    try {
      onSave({
        date: new Date(`${date}T09:00:00.000Z`).toISOString(),
        reason: reason.trim(),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} title="Edit Transfer" onClose={onClose} size="sm">
      <div className="flex flex-col gap-4">
        {error && (
          <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div className="rounded-xl bg-[#E6ECE2]/50 px-4 py-3 text-xs text-[#666666]">
          Only the date and reason can be edited — source/destination locations
          and items are managed on their own.
        </div>
        <FieldWrap label="Date">
          <DatePicker
            value={date}
            onChange={setDate}
            placeholder="Select transfer date"
          />
        </FieldWrap>
        <FieldWrap label="Reason">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={SELECT_CLS}
            placeholder="Transfer reason..."
          />
        </FieldWrap>
        <div className="flex gap-3 justify-end border-t border-[#E6ECE2] pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving}>
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Add Item to an existing transfer (POST /transfers/{id}/items) ────────────

function AddItemToExistingModal({
  open,
  transferId,
  onClose,
  onAdded,
  onError,
}: {
  open: boolean
  transferId: string
  onClose: () => void
  onAdded: () => void
  onError: (message: string) => void
}) {
  const [productId, setProductId] = useState("")
  const [batchId, setBatchId] = useState("")
  const [unitId, setUnitId] = useState("")
  const [quantity, setQuantity] = useState("")
  const [batches, setBatches] = useState<{ id: string; batchNumber: string }[]>(
    [],
  )
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const productSearch = useSearchableResource(searchProducts, open)
  const unitsApi = useProductUnits(productId)
  const selectedProductOption =
    productSearch.options.find((o) => o.value === productId) ?? null
  const productOptions: SearchableOption[] = selectedProductOption
    ? [
        selectedProductOption,
        ...productSearch.options.filter((o) => o.value !== productId),
      ]
    : productSearch.options

  useEffect(() => {
    if (!productId) {
      setBatches([])
      setBatchId("")
      return
    }
    let cancelled = false
    setLoadingOptions(true)
    listProductBatches(productId, { limit: 100 })
      .then((b) => {
        if (!cancelled)
          setBatches(
            b.data.map((row) => ({ id: row.id, batchNumber: row.batchNumber })),
          )
      })
      .catch(() => {
        if (!cancelled) setBatches([])
      })
      .finally(() => {
        if (!cancelled) setLoadingOptions(false)
      })
    return () => {
      cancelled = true
    }
  }, [productId])

  useEffect(() => {
    if (!productId || !unitId) return
    const current = unitsApi.units.find((u) => u.unitId === unitId)
    if (!current) {
      const base = unitsApi.units.find((u) => u.isBaseUnit) ?? unitsApi.units[0]
      if (base) setUnitId(base.unitId)
    }
  }, [unitsApi.units, unitId, productId])

  async function handleAdd() {
    if (!productId) {
      setError("Please select a product.")
      return
    }
    if (!batchId) {
      setError("Please select a batch.")
      return
    }
    if (!unitId) {
      setError("Please select a unit.")
      return
    }
    const qty = parseInt(quantity)
    if (!qty || qty <= 0) {
      setError("Quantity must be a positive number.")
      return
    }
    setError("")
    setSubmitting(true)
    try {
      await addTransferItem(transferId, {
        productId,
        batchId,
        unitId,
        quantity: qty,
      })
      onAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add the item.")
      onError("Item add failed — see the message in the dialog.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} title="Add Transfer Item" onClose={onClose} size="sm">
      <div className="flex flex-col gap-4">
        {error && (
          <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <FieldWrap label="Product *">
          <SearchableSelect
            value={productId || null}
            onChange={(v) => {
              setProductId(v)
              setBatchId("")
              setUnitId("")
            }}
            options={productOptions}
            onSearch={productSearch.setTerm}
            loading={productSearch.loading}
            error={productSearch.error}
            onRetry={productSearch.retry}
            placeholder="Search and select a product..."
            searchPlaceholder="Search by name or SKU..."
            emptyMessage="No products found"
            noResultsMessage="No products matching your search"
          />
        </FieldWrap>
        <FieldWrap label="Batch *">
          <SearchableSelect
            value={batchId || null}
            onChange={setBatchId}
            options={batches.map((b) => ({
              value: b.id,
              label: b.batchNumber,
            }))}
            disabled={!productId || loadingOptions}
            placeholder={
              loadingOptions ? "Loading batches..." : "Select batch..."
            }
            searchPlaceholder="Search batches..."
            emptyMessage={
              loadingOptions ? "Loading batches..." : "No batches found"
            }
            noResultsMessage="No batches matching your search"
          />
        </FieldWrap>
        <FieldWrap label="Unit *">
          <SearchableSelect
            value={unitId || null}
            onChange={setUnitId}
            options={unitsApi.units.map((u) => ({
              value: u.unitId,
              label: `${u.unit.name}${u.isBaseUnit ? " (base)" : ""}`,
            }))}
            disabled={!productId || unitsApi.units.length === 0}
            placeholder={
              unitsApi.units.length === 0
                ? productId
                  ? "No units configured"
                  : "Select product first"
                : "Select unit..."
            }
            searchPlaceholder="Search units..."
            emptyMessage="No units available"
            noResultsMessage="No units matching your search"
          />
        </FieldWrap>
        <FieldWrap label="Quantity *">
          <div className="flex flex-col gap-1">
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className={SELECT_CLS}
              placeholder="0"
            />
            {(() => {
              const sel = unitsApi.units.find((u) => u.unitId === unitId)
              const preview = toBaseQuantity(parseInt(quantity) || 0, sel)
              return preview !== null &&
                unitsApi.baseUnit &&
                quantity &&
                sel &&
                !sel.isBaseUnit ? (
                <p className="text-xs text-[#999]">
                  = {preview.toLocaleString()} {unitsApi.baseUnit.name ?? ""}
                </p>
              ) : null
            })()}
          </div>
        </FieldWrap>
        <div className="flex gap-3 justify-end border-t border-[#E6ECE2] pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAdd} loading={submitting}>
            Add Item
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Edit Item Modal (PATCH /transfers/{transferId}/items/{itemId}) ───────────

function EditItemModal({
  item,
  onClose,
  onSave,
}: {
  item: TransferItemFullDto
  onClose: () => void
  onSave: (quantity: number) => void
}) {
  const [quantity, setQuantity] = useState(String(item.quantity))
  const [error, setError] = useState("")

  function handleSave() {
    const qty = parseInt(quantity)
    if (!qty || qty <= 0) {
      setError("Quantity must be a positive number.")
      return
    }
    setError("")
    onSave(qty)
  }

  return (
    <Modal open title="Edit Transfer Item" onClose={onClose} size="sm">
      <div className="flex flex-col gap-4">
        {error && (
          <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div className="rounded-xl bg-[#E6ECE2]/50 px-4 py-3 grid grid-cols-3 gap-3 text-xs">
          <div>
            <p className="text-[#999] mb-0.5">Product</p>
            <p className="font-semibold text-[#333333]">{itemName(item)}</p>
          </div>
          <div>
            <p className="text-[#999] mb-0.5">Batch</p>
            <p className="font-mono font-semibold text-[#333333]">
              {itemBatch(item)}
            </p>
          </div>
          <div>
            <p className="text-[#999] mb-0.5">Unit</p>
            <p className="font-semibold text-[#333333]">
              {itemUnit(item) || "—"}
            </p>
          </div>
        </div>
        <FieldWrap label="Quantity *">
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={SELECT_CLS}
            placeholder="0"
          />
        </FieldWrap>
        <div className="flex gap-3 justify-end border-t border-[#E6ECE2] pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Confirm Modal ───────────────────────────────────────────────────────────

function ConfirmModal({
  open,
  title,
  message,
  detail,
  confirmLabel,
  confirmClass,
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  message: string
  detail?: string
  confirmLabel: string
  confirmClass: string
  onClose: () => void
  onConfirm: () => void | Promise<void>
}) {
  return (
    <Modal open={open} title={title} onClose={onClose} size="sm">
      <p className="text-sm text-[#666666]">{message}</p>
      {detail && (
        <p className="mt-3 rounded-lg bg-[#E6ECE2]/60 px-4 py-2.5 text-sm font-semibold text-[#333333]">
          {detail}
        </p>
      )}
      <div className="flex gap-3 justify-end mt-6">
        <Button variant="secondary" onClick={onClose}>
          Go Back
        </Button>
        <button
          onClick={() => {
            void onConfirm()
          }}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${confirmClass}`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

// ─── Shared micro-components ──────────────────────────────────────────────────

const SELECT_CLS =
  "w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm focus:border-[#B6C8AF] focus:outline-none bg-white"

function FieldWrap({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="text-sm font-medium text-[#333333] block mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}
