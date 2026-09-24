import { useEffect, useMemo, useState, useCallback, useRef } from "react"
import { useSearchParams, useNavigate } from "react-router"
import {
  getStock,
  createOpeningStock,
  createStockAdjustment,
  StockApiError,
  type StockRowDto,
} from "../../features/inventory/stockApi"
import {
  listProductBatches,
  type BatchDto,
} from "../../features/inventory/batchesApi"
import {
  searchProducts,
  searchLocations,
} from "../../features/inventory/searchSelectors"
import { useProductUnits } from "../../features/inventory/useProductUnits"
import { toBaseQuantity } from "../../features/inventory/unitOptions"
import { formatFactor } from "../../features/inventory/unitOptions"
import { pluralizeUnit } from "../../utils/format"
import PageHeader from "../../components/ui/PageHeader"
import SearchInput from "../../components/ui/SearchInput"
import Pagination from "../../components/ui/Pagination"
import EmptyState from "../../components/ui/EmptyState"
import Modal from "../../components/ui/Modal"
import Button from "../../components/ui/Button"
import Input from "../../components/ui/Input"
import SearchableSelect from "../../components/ui/SearchableSelect"
import type { SearchableOption } from "../../components/ui/SearchableSelect"
import { useSearchableResource } from "../../hooks/useSearchableResource"

function describeError(err: unknown): string {
  if (err instanceof StockApiError) {
    const detail = err.details
      ? Object.values(err.details).filter(Boolean).join(" — ")
      : ""
    return detail ? `${err.message}: ${detail}` : err.message
  }
  return err instanceof Error
    ? err.message
    : "Something went wrong. Please try again."
}

type Tab = "stock" | "movements"

const PAGE_SIZE = 10

// ─── Adapted stock row (UI shape from GET /inventory/stock) ───────────────────

interface StockRow {
  id: string
  productId: string
  batchId: string
  locationId: string
  quantity: number
  reservedQuantity: number
  availableQuantity: number
  productName: string
  productSku: string
  batchNumber: string
  expiryDate: string
  locationName: string
  unitName: string
}

type DerivedStatus = "available" | "depleted"

function adaptStockRow(dto: StockRowDto): StockRow {
  const product = (dto.product ?? {}) as { name?: string; sku?: string }
  const batch = (dto.batch ?? {}) as {
    batchNumber?: string
    expiryDate?: string
  }
  const location = (dto.location ?? {}) as { name?: string }
  const baseUnit = (dto.baseUnit ?? {}) as { name?: string }
  return {
    id: dto.id,
    productId: dto.productId,
    batchId: dto.batchId,
    locationId: dto.locationId,
    quantity: dto.quantity ?? 0,
    reservedQuantity: dto.reservedQuantity ?? 0,
    availableQuantity: dto.availableQuantity ?? dto.quantity ?? 0,
    productName: product.name ?? dto.productId,
    productSku: product.sku ?? "",
    batchNumber: batch.batchNumber ?? "—",
    expiryDate: batch.expiryDate ?? "",
    locationName: location.name ?? "—",
    unitName: baseUnit.name ?? "",
  }
}

function deriveStatus(row: StockRow): DerivedStatus {
  // The stock endpoint carries no status field — derive it from quantities.
  return row.quantity > 0 ? "available" : "depleted"
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function StatusLabel({ status }: { status: DerivedStatus }): {
  label: string
  cls: string
} {
  return status === "depleted"
    ? { label: "Depleted", cls: "bg-red-100 text-red-700" }
    : { label: "Available", cls: "bg-green-100 text-green-700" }
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StockPage() {
  const [params, setParams] = useSearchParams()
  const productIdQuery = params.get("productId") || ""
  const navigate = useNavigate()

  const [search, setSearch] = useState("")
  const [locationFilter, setLocationFilter] = useState("")
  const [page, setPage] = useState(1)

  const [rows, setRows] = useState<StockRow[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [stockLoading, setStockLoading] = useState(true)
  const [stockError, setStockError] = useState<string | null>(null)
  const requestSeq = useRef(0)

  // modals
  const [addStockOpen, setAddStockOpen] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [stockDetail, setStockDetail] = useState<StockRow | null>(null)

  const locationsSearch = useSearchableResource(searchLocations)
  const locationFilterOptions: SearchableOption[] = locationsSearch.options

  const loadStock = useCallback(
    async (searchTerm: string, locId: string, pageNum: number, pId: string) => {
      const seq = ++requestSeq.current
      setStockLoading(true)
      setStockError(null)
      try {
        const res = await getStock({
          page: pageNum,
          limit: PAGE_SIZE,
          search: searchTerm.trim() || undefined,
          locationId: locId || undefined,
          productId: pId || undefined,
        })
        if (seq !== requestSeq.current) return
        setRows(res.data.map(adaptStockRow))
        setTotalPages(res.pagination?.totalPages ?? 1)
        setTotal(res.pagination?.total ?? 0)
      } catch (err) {
        if (seq !== requestSeq.current) return
        setStockError(describeError(err))
      } finally {
        if (seq === requestSeq.current) setStockLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    const t = setTimeout(
      () => {
        loadStock(search, locationFilter, page, productIdQuery)
      },
      search ? 300 : 0,
    )
    return () => clearTimeout(t)
  }, [loadStock, search, locationFilter, page, productIdQuery])

  function reset() {
    setSearch("")
    setLocationFilter("")
    setPage(1)
    if (productIdQuery) setParams({})
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb="Inventory / Stock"
        title="Stock"
        subtitle="View and manage current inventory across pharmacy locations."
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setAddStockOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#B6C8AF] text-[#333333] px-3.5 py-2 text-sm font-semibold hover:bg-[#E6ECE2] transition-colors"
            >
              + Add Stock
            </button>
            <button
              onClick={() => setAdjustOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#C6D4BF] bg-white px-3.5 py-2 text-sm font-medium text-[#333333] hover:bg-[#E6ECE2] transition-colors"
            >
              Adjust Stock
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        <div className="bg-white rounded-xl border border-[#E6ECE2] p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <div className="flex-1">
              <SearchInput
                value={search}
                onChange={(v) => {
                  setSearch(v)
                  setPage(1)
                }}
                placeholder="Search product, SKU or batch..."
              />
            </div>
            <div className="sm:w-48">
              <SearchableSelect
                value={locationFilter || null}
                onChange={(v) => {
                  setLocationFilter(v)
                  setPage(1)
                }}
                options={locationFilterOptions}
                onSearch={locationsSearch.setTerm}
                loading={locationsSearch.loading}
                error={locationsSearch.error}
                onRetry={locationsSearch.retry}
                allowClear
                placeholder="All Locations"
                searchPlaceholder="Search locations..."
                emptyMessage="No locations available"
                noResultsMessage="No locations matching your search"
              />
            </div>
            {(search || locationFilter || productIdQuery) && (
              <button
                onClick={reset}
                className="text-xs font-semibold text-[#7A9076] hover:underline whitespace-nowrap"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden flex-shrink-0">
          {stockError ? (
            <div className="p-6">
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 flex items-center justify-between gap-3">
                <span>{stockError}</span>
                <button
                  onClick={() =>
                    loadStock(search, locationFilter, page, productIdQuery)
                  }
                  className="text-xs font-semibold text-red-700 hover:underline whitespace-nowrap"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : stockLoading ? (
            <LoadingSkeleton />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No stock records found"
              description="Adjust your filters or add stock to products."
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
                        Batch
                      </th>
                      <th className="px-4 py-3 font-semibold text-[#333333] hidden sm:table-cell">
                        Location
                      </th>
                      <th className="px-4 py-3 font-semibold text-[#333333] text-right">
                        Quantity
                      </th>
                      <th className="px-4 py-3 font-semibold text-[#333333] hidden md:table-cell">
                        Unit
                      </th>
                      <th className="px-4 py-3 font-semibold text-[#333333] hidden lg:table-cell">
                        Expiry
                      </th>
                      <th className="px-4 py-3 font-semibold text-[#333333]">
                        Status
                      </th>
                      <th className="px-4 py-3 font-semibold text-[#333333]">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const s = StatusLabel({ status: deriveStatus(r) })
                      return (
                        <tr
                          key={r.id}
                          className={
                            i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/20"
                          }
                        >
                          <td className="px-4 py-3">
                            <p className="font-medium text-[#333333]">
                              {r.productName}
                            </p>
                            {r.productSku && (
                              <p className="text-xs text-[#999] font-mono">
                                {r.productSku}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-[#666666]">
                            {r.batchNumber}
                          </td>
                          <td className="px-4 py-3 text-[#666666] hidden sm:table-cell">
                            {r.locationName}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <p className="font-bold text-[#333333]">
                              {r.quantity.toLocaleString()}
                            </p>
                            {r.reservedQuantity > 0 && (
                              <p className="text-xs text-[#999]">
                                {r.availableQuantity.toLocaleString()} available
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-[#666666] hidden md:table-cell">
                            {r.unitName ? pluralizeUnit(r.unitName) : "—"}
                          </td>
                          <td className="px-4 py-3 text-[#666666] hidden lg:table-cell">
                            {fmtDate(r.expiryDate)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-xs font-semibold rounded-full px-2.5 py-0.5 ${s.cls}`}
                            >
                              {s.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setStockDetail(r)}
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
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                label={
                  <>
                    Showing {total > 0 ? (page - 1) * PAGE_SIZE + 1 : 0}–
                    {Math.min(page * PAGE_SIZE, total)} of {total} stock records
                  </>
                }
              />
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      <AddStockModal
        open={addStockOpen}
        onClose={() => setAddStockOpen(false)}
        onCreated={() => {
          setAddStockOpen(false)
          loadStock(search, locationFilter, page, productIdQuery)
        }}
      />
      <AdjustStockModal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        onAdjusted={() => {
          setAdjustOpen(false)
          loadStock(search, locationFilter, page, productIdQuery)
        }}
      />
      {stockDetail && (
        <StockDetailModal
          row={stockDetail}
          allRows={rows}
          onClose={() => setStockDetail(null)}
        />
      )}
    </div>
  )
}

// ─── Stock Detail Modal ───────────────────────────────────────────────────────

function StockDetailModal({
  row,
  allRows,
  onClose,
}: {
  row: StockRow
  allRows: StockRow[]
  onClose: () => void
}) {
  return (
    <Modal open title="Stock Detail" onClose={onClose} size="md">
      <BatchDetailView row={row} allRows={allRows} />
    </Modal>
  )
}

// ─── VIEW 1: Batch Details ────────────────────────────────────────────────────

function BatchDetailView({
  row,
  allRows,
}: {
  row: StockRow
  allRows: StockRow[]
}) {
  const status = deriveStatus(row)
  const s = StatusLabel({ status })
  const navigate = useNavigate()

  // Stock of the same product+batch across all locations (from loaded rows)
  const locationsForBatch = useMemo(() => {
    const groups = new Map<string, { location: string; qty: number }>()
    allRows
      .filter((r) => r.productId === row.productId && r.batchId === row.batchId)
      .forEach((r) => {
        const existing = groups.get(r.locationId)
        if (existing) existing.qty += r.quantity
        else
          groups.set(r.locationId, {
            location: r.locationName,
            qty: r.quantity,
          })
      })
    return Array.from(groups.values())
  }, [allRows, row.productId, row.batchId, row.locationName, row.quantity])

  const totalQty = locationsForBatch.reduce((a, l) => a + l.qty, 0)

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <p className="text-lg font-bold text-[#333333]">{row.productName}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs font-mono text-[#666666]">
            {row.batchNumber}
          </span>
          <span
            className={`text-xs font-semibold rounded-full px-2 py-0.5 ${s.cls}`}
          >
            {s.label}
          </span>
        </div>
      </div>

      {/* Product */}
      <Section title="Product">
        <Row label="Name" value={row.productName} />
        <Row label="SKU" value={row.productSku || "—"} mono />
        <Row label="Base Unit" value={row.unitName || "—"} />
      </Section>

      {/* Batch info */}
      <Section title="Batch Information">
        <Row label="Batch Number" value={row.batchNumber} mono />
        <Row label="Expiry Date" value={fmtDate(row.expiryDate)} />
      </Section>

      {/* Stock */}
      <Section title="Stock">
        <Row
          label="Quantity"
          value={`${row.quantity.toLocaleString()} ${
            row.unitName ? pluralizeUnit(row.unitName) : ""
          }`.trim()}
        />
        <Row label="Reserved" value={row.reservedQuantity.toLocaleString()} />
        <Row label="Available" value={row.availableQuantity.toLocaleString()} />
        <Row label="Status" value={s.label} />
      </Section>

      {/* Location stock */}
      <div className="rounded-xl border border-[#E6ECE2] overflow-hidden">
        <div className="px-4 py-2.5 bg-[#E6ECE2]/50">
          <p className="text-xs font-semibold text-[#666666] uppercase tracking-wide">
            Location Stock
          </p>
        </div>
        <div className="divide-y divide-[#E6ECE2]">
          {locationsForBatch.map((l) => (
            <div
              key={l.location}
              className="flex items-center justify-between px-4 py-2.5"
            >
              <span className="text-sm text-[#333333]">{l.location}</span>
              <span className="text-sm font-semibold text-[#333333]">
                {l.qty.toLocaleString()} {row.unitName ?? ""}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#E6ECE2]/30">
            <span className="text-sm font-semibold text-[#333333]">Total</span>
            <span className="text-sm font-bold text-[#333333]">
              {totalQty.toLocaleString()} {row.unitName ?? ""}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 border-t border-[#E6ECE2] pt-4">
        <Button
          variant="secondary"
          onClick={() =>
            navigate(
              `/inventory/bin-card?productId=${row.productId}&locationId=${row.locationId}&batchId=${row.batchId}`,
            )
          }
        >
          View Bin Card
        </Button>
      </div>
    </div>
  )
}

// ─── Add Stock Modal (POST /inventory/opening-stock) ──────────────────────────

function AddStockModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [productId, setProductId] = useState("")
  const [batchId, setBatchId] = useState("")
  const [batches, setBatches] = useState<BatchDto[]>([])
  const [batchesLoading, setBatchesLoading] = useState(false)
  const [locationId, setLocationId] = useState("")
  const [qty, setQty] = useState("")
  const [unitId, setUnitId] = useState("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const productSearch = useSearchableResource(searchProducts, open)
  const locationsSearch = useSearchableResource(searchLocations, open)
  const unitsApi = useProductUnits(productId)

  const selectedProductOption =
    productSearch.options.find((o) => o.value === productId) ?? null
  const productOptions: SearchableOption[] = selectedProductOption
    ? [
        selectedProductOption,
        ...productSearch.options.filter((o) => o.value !== productId),
      ]
    : productSearch.options

  const selectedLocationOption =
    locationsSearch.options.find((o) => o.value === locationId) ?? null
  const locationOptions: SearchableOption[] = selectedLocationOption
    ? [
        selectedLocationOption,
        ...locationsSearch.options.filter((o) => o.value !== locationId),
      ]
    : locationsSearch.options

  useEffect(() => {
    if (!productId) {
      setBatches([])
      setBatchId("")
      return
    }
    let cancelled = false
    setBatchesLoading(true)
    listProductBatches(productId, { limit: 100 })
      .then((b) => {
        if (!cancelled) setBatches(b.data)
      })
      .catch(() => {
        if (!cancelled) setBatches([])
      })
      .finally(() => {
        if (!cancelled) setBatchesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [productId])

  useEffect(() => {
    if (unitsApi.units.length === 0) {
      setUnitId("")
      return
    }
    const current = unitsApi.units.find((u) => u.unitId === unitId)
    if (!current) {
      const base = unitsApi.units.find((u) => u.isBaseUnit) ?? unitsApi.units[0]
      setUnitId(base?.unitId ?? "")
    }
  }, [unitsApi.units, unitId])

  async function handleSubmit() {
    if (!productId || !batchId || !locationId || !qty) return
    const quantity = parseInt(qty)
    if (!quantity || quantity <= 0) {
      setError("Quantity must be a positive number.")
      return
    }
    if (!unitId) {
      setError("Please select a unit.")
      return
    }
    setError("")
    setSubmitting(true)
    try {
      await createOpeningStock({
        productId,
        batchId,
        locationId,
        quantity,
        unitId,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      })
      onCreated()
    } catch (err) {
      setError(describeError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const selectedUnit = unitsApi.units.find((u) => u.unitId === unitId)
  const basePreview = toBaseQuantity(parseInt(qty) || 0, selectedUnit)
  const baseLabel =
    basePreview !== null && unitsApi.baseUnit
      ? basePreview.toLocaleString() + " " + (unitsApi.baseUnit.name ?? "")
      : ""

  return (
    <Modal open={open} title="Add Opening Stock" onClose={onClose} size="md">
      <p className="text-sm text-[#666666] -mt-2 mb-4">
        Add stock already physically available in the pharmacy.
      </p>
      <div className="flex flex-col gap-4">
        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <SearchableSelect
          label="Product"
          value={productId || null}
          onChange={(v) => {
            setProductId(v)
            setBatchId("")
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

        <SearchableSelect
          label="Batch"
          value={batchId || null}
          onChange={setBatchId}
          options={batches.map((b) => ({
            value: b.id,
            label: b.batchNumber,
            sub: b.expiryDate ? `Expires ${fmtDate(b.expiryDate)}` : undefined,
          }))}
          disabled={!productId || batchesLoading}
          placeholder={
            batchesLoading ? "Loading batches..." : "Select batch..."
          }
          searchPlaceholder="Search batches..."
          emptyMessage={
            batchesLoading ? "Loading batches..." : "No batches found"
          }
          noResultsMessage="No batches matching your search"
        />

        <SearchableSelect
          label="Location"
          value={locationId || null}
          onChange={(v) => setLocationId(v)}
          options={locationOptions}
          onSearch={locationsSearch.setTerm}
          loading={locationsSearch.loading}
          error={locationsSearch.error}
          onRetry={locationsSearch.retry}
          placeholder="Search and select a location..."
          searchPlaceholder="Search locations..."
          emptyMessage="No locations found"
          noResultsMessage="No locations matching your search"
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Quantity"
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="0"
          />
          <SearchableSelect
            label="Unit"
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
        </div>
        {baseLabel &&
          qty &&
          unitsApi.baseUnit &&
          selectedUnit &&
          !selectedUnit.isBaseUnit && (
            <p className="text-xs text-[#999]">= {baseLabel}</p>
          )}
        <div>
          <label className="text-sm font-medium text-[#333333] block mb-1.5">
            Notes
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Initial physical stock..."
            className="w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm resize-none focus:border-[#B6C8AF] focus:outline-none"
          />
        </div>
        <div className="flex gap-3 justify-end border-t border-[#E6ECE2] pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={submitting}
            disabled={!productId || !batchId || !locationId || !qty}
          >
            Add Stock
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Adjust Stock Modal (POST /inventory/stock-adjustments — schema pending) ──

function AdjustStockModal({
  open,
  onClose,
  onAdjusted,
}: {
  open: boolean
  onClose: () => void
  onAdjusted: () => void
}) {
  const [productId, setProductId] = useState("")
  const [batchId, setBatchId] = useState("")
  const [batches, setBatches] = useState<BatchDto[]>([])
  const [batchesLoading, setBatchesLoading] = useState(false)
  const [unitId, setUnitId] = useState("")
  const [locationId, setLocationId] = useState("")
  const [adjustment, setAdjustment] = useState("")
  const [reason, setReason] = useState("")
  const [notes, setNotes] = useState("")

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const productSearch = useSearchableResource(searchProducts, open)
  const locationsSearch = useSearchableResource(searchLocations, open)
  const unitsApi = useProductUnits(productId)

  const selectedProductOption =
    productSearch.options.find((o) => o.value === productId) ?? null
  const productOptions: SearchableOption[] = selectedProductOption
    ? [
        selectedProductOption,
        ...productSearch.options.filter((o) => o.value !== productId),
      ]
    : productSearch.options

  const selectedLocationOption =
    locationsSearch.options.find((o) => o.value === locationId) ?? null
  const locationOptions: SearchableOption[] = selectedLocationOption
    ? [
        selectedLocationOption,
        ...locationsSearch.options.filter((o) => o.value !== locationId),
      ]
    : locationsSearch.options

  useEffect(() => {
    if (!productId) {
      setBatches([])
      setBatchId("")
      return
    }
    let cancelled = false
    setBatchesLoading(true)
    listProductBatches(productId, { limit: 100 })
      .then((b) => {
        if (!cancelled) setBatches(b.data)
      })
      .catch(() => {
        if (!cancelled) setBatches([])
      })
      .finally(() => {
        if (!cancelled) setBatchesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [productId])

  useEffect(() => {
    if (unitsApi.units.length === 0) {
      setUnitId("")
      return
    }
    const current = unitsApi.units.find((u) => u.unitId === unitId)
    if (!current) {
      const base = unitsApi.units.find((u) => u.isBaseUnit) ?? unitsApi.units[0]
      setUnitId(base?.unitId ?? "")
    }
  }, [unitsApi.units, unitId])

  const selectedBatch = batches.find((b) => b.id === batchId)
  const currentStock = selectedBatch?.totalQuantity ?? 0
  const adjNum = parseInt(adjustment) || 0
  const selectedUnit = unitsApi.units.find((u) => u.unitId === unitId)
  // currentStock is the batch's BASE-unit total. Convert the adjustment to
  // base units too so the preview never mixes units (e.g. 2 Box onto a
  // 30-Tablet stock adjusts to 50, not 32).
  const baseAdjPreview = toBaseQuantity(Math.abs(adjNum), selectedUnit)
  const baseAdj = baseAdjPreview !== null ? (adjNum >= 0 ? baseAdjPreview : -baseAdjPreview) : adjNum
  const newStock = Math.max(0, currentStock + baseAdj)
  const baseAdjLabel =
    baseAdjPreview !== null && unitsApi.baseUnit
      ? baseAdjPreview.toLocaleString() + " " + pluralizeUnit(unitsApi.baseUnit.name)
      : ""

  function reset() {
    setProductId("")
    setBatchId("")
    setLocationId("")
    setUnitId("")
    setAdjustment("")
    setReason("")
    setNotes("")
    setError("")
  }

  async function handleSubmit() {
    if (
      !productId ||
      !batchId ||
      !locationId ||
      !adjustment ||
      !reason ||
      !unitId
    )
      return
    const magnitude = Math.abs(adjNum)
    if (!magnitude) {
      setError("Adjustment quantity can't be zero.")
      return
    }
    setError("")
    setSubmitting(true)
    try {
      await createStockAdjustment({
        productId,
        batchId,
        locationId,
        direction: adjNum >= 0 ? "IN" : "OUT",
        quantity: magnitude,
        unitId,
        reason,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      })
      reset()
      onAdjusted()
    } catch (err) {
      setError(describeError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Adjust Stock"
      onClose={() => {
        reset()
        onClose()
      }}
      size="md"
    >
      <p className="text-sm text-[#666666] -mt-2 mb-4">
        Correct recorded quantity after a physical stock count or other
        correction.
      </p>
      <div className="flex flex-col gap-4">
        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <SearchableSelect
          label="Product"
          value={productId || null}
          onChange={(v) => {
            setProductId(v)
            setBatchId("")
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

        <SearchableSelect
          label="Batch"
          value={batchId || null}
          onChange={setBatchId}
          options={batches.map((b) => ({
            value: b.id,
            label: b.batchNumber,
            sub: b.expiryDate ? `Expires ${fmtDate(b.expiryDate)}` : undefined,
          }))}
          disabled={!productId || batchesLoading}
          placeholder={
            batchesLoading ? "Loading batches..." : "Select batch..."
          }
          searchPlaceholder="Search batches..."
          emptyMessage={
            batchesLoading ? "Loading batches..." : "No batches found"
          }
          noResultsMessage="No batches matching your search"
        />

        <SearchableSelect
          label="Location"
          value={locationId || null}
          onChange={(v) => setLocationId(v)}
          options={locationOptions}
          onSearch={locationsSearch.setTerm}
          loading={locationsSearch.loading}
          error={locationsSearch.error}
          onRetry={locationsSearch.retry}
          placeholder="Search and select a location..."
          searchPlaceholder="Search locations..."
          emptyMessage="No locations found"
          noResultsMessage="No locations matching your search"
        />

        {selectedBatch && (
          <div className="rounded-lg bg-[#E6ECE2]/50 px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-[#666666]">Current Stock</span>
            <span className="text-sm font-bold text-[#333333]">
              {currentStock.toLocaleString()}{" "}
              {unitsApi.baseUnit?.name ?? selectedUnit?.unit.name ?? ""}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 items-start">
          <Input
            label="Adjustment"
            type="number"
            value={adjustment}
            onChange={(e) => setAdjustment(e.target.value)}
            placeholder="e.g. -5 or 10"
          />
          <SearchableSelect
            label="Unit"
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
        </div>
        {adjustment &&
          baseAdjLabel &&
          selectedUnit &&
          !selectedUnit.isBaseUnit && (
            <p className="text-xs text-[#999]">Adjustment = {baseAdjLabel}</p>
          )}

        {adjustment && selectedBatch && (
          <div
            className={`rounded-lg px-4 py-3 flex items-center justify-between ${
              adjNum >= 0
                ? "bg-green-50 border border-green-200"
                : "bg-red-50 border border-red-200"
            }`}
          >
            <span className="text-sm text-[#666666]">New Stock</span>
            <span
              className={`text-sm font-bold ${
                adjNum >= 0 ? "text-green-700" : "text-red-700"
              }`}
            >
              {newStock.toLocaleString()}{" "}
              {unitsApi.baseUnit?.name ?? selectedUnit?.unit.name ?? ""}
            </span>
          </div>
        )}

        <div>
          <label className="text-sm font-medium text-[#333333] block mb-1.5">
            Reason
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border border-[#C6D4BF] bg-white px-3.5 py-2.5 text-sm text-[#333333] focus:border-[#B6C8AF] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/20"
          >
            <option value="">Select reason...</option>
            <option>Physical Count Correction</option>
            <option>Damage / Breakage</option>
            <option>Theft / Loss</option>
            <option>System Error Correction</option>
            <option>Other</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-[#333333] block mb-1.5">
            Notes
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-[#C6D4BF] bg-white px-3.5 py-2.5 text-sm text-[#333333] placeholder:text-[#999] resize-none focus:border-[#B6C8AF] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/20"
            placeholder="Add context about this adjustment..."
          />
        </div>
        <div className="flex gap-3 justify-end border-t border-[#E6ECE2] pt-4">
          <Button
            variant="secondary"
            onClick={() => {
              reset()
              onClose()
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={submitting}
            disabled={
              !productId ||
              !batchId ||
              !locationId ||
              !adjustment ||
              !reason ||
              !unitId
            }
          >
            Save Adjustment
          </Button>
        </div>
      </div>
    </Modal>
  )
}
// ─── Shared components ────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-[#E6ECE2] overflow-hidden">
      <div className="px-4 py-2.5 bg-[#E6ECE2]/50">
        <p className="text-xs font-semibold text-[#666666] uppercase tracking-wide">
          {title}
        </p>
      </div>
      <div className="divide-y divide-[#E6ECE2]">{children}</div>
    </div>
  )
}

function Row({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-xs text-[#999]">{label}</span>
      <span
        className={`text-sm font-medium text-[#333333] ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </span>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-3 animate-pulse">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-10 rounded-lg bg-[#E6ECE2]" />
      ))}
    </div>
  )
}
