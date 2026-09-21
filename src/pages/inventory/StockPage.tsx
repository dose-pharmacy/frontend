import { useEffect, useMemo, useState, useCallback, useRef } from "react"
import { useSearchParams, useNavigate } from "react-router"
import {
  getStock,
  getProductTransactions,
  getBatchTransactions,
  getBinCard,
  createOpeningStock,
  createStockAdjustment,
  StockApiError,
  type StockRowDto,
  type StockTransactionDto,
  type BinCardResult,
} from "../../features/inventory/stockApi"
import { listLocations } from "../../features/inventory/locationsApi"
import {
  listProductBatches,
  type BatchDto,
} from "../../features/inventory/batchesApi"
import {
  getProduct as getProductDetail,
  listInventoryProducts,
} from "../../features/inventory/productsApi"
import PageHeader from "../../components/ui/PageHeader"
import SearchInput from "../../components/ui/SearchInput"
import Select from "../../components/ui/Select"
import Pagination from "../../components/ui/Pagination"
import EmptyState from "../../components/ui/EmptyState"
import Modal from "../../components/ui/Modal"
import Button from "../../components/ui/Button"
import Input from "../../components/ui/Input"
import StatusChip, { type StatusTone } from "../../components/ui/StatusChip"

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

interface ProductOption {
  id: string
  name: string
  baseUnit: string | null
}

async function fetchProductOptions(): Promise<ProductOption[]> {
  const res = await listInventoryProducts({ limit: 1000 })
  return res.data.map((p) => ({
    id: p.id,
    name: p.name,
    baseUnit: p.baseUnit?.name ?? null,
  }))
}

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

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function prettyType(t: string) {
  if (!t) return ""
  if (t === t.toUpperCase()) return t.charAt(0) + t.slice(1).toLowerCase()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function StatusLabel({ status }: { status: DerivedStatus }): {
  label: string
  tone: StatusTone
} {
  return status === "depleted"
    ? { label: "Depleted", tone: "red" }
    : { label: "Available", tone: "green" }
}

function TxTypeBadge({ type }: { type: string }) {
  const map: Record<string, StatusTone> = {
    received: "green",
    sale: "blue",
    transfer: "purple",
    adjustment: "orange",
    opening: "sage",
    disposal: "red",
    return: "amber",
    // API transaction types (StockTransactionDto / bin card)
    receipt: "green",
  }
  return (
    <StatusChip
      label={prettyType(type)}
      tone={map[type.toLowerCase()] ?? "gray"}
    />
  )
}

const IN_TYPES = ["received", "opening", "return"]
const isInType = (t: string) => IN_TYPES.includes(t.toLowerCase())

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
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])
  const requestSeq = useRef(0)

  // modals
  const [addStockOpen, setAddStockOpen] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [stockDetail, setStockDetail] = useState<StockRow | null>(null)
  const [txDetail, setTxDetail] = useState<TxDetail | null>(null)

  useEffect(() => {
    listLocations({ limit: 100 })
      .then((res) => setLocations(res.data))
      .catch(() => {})
  }, [])

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
              className="inline-flex items-center gap-1.5 rounded-xl bg-white text-[#7A9076] px-3.5 py-2 text-sm font-semibold hover:bg-[#E6ECE2] transition-colors"
            >
              + Add Stock
            </button>
            <button
              onClick={() => setAdjustOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#C6D4BF] bg-white px-3.5 py-2 text-sm font-semibold text-[#7A9076] hover:bg-[#E6ECE2] transition-colors"
            >
              Adjust Stock
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        <div className="bg-white rounded-xl border border-[#E6ECE2] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1 min-w-[200px]">
              <SearchInput
                value={search}
                onChange={(v) => {
                  setSearch(v)
                  setPage(1)
                }}
                placeholder="Search product, SKU or batch..."
              />
            </div>
            <Select
              value={locationFilter}
              onChange={(e) => {
                setLocationFilter(e.target.value)
                setPage(1)
              }}
              className="sm:w-48"
            >
              <option value="">All Locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
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

        <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden">
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
                            {r.unitName ? `${r.unitName}s` : "—"}
                          </td>
                          <td className="px-4 py-3 text-[#666666] hidden lg:table-cell">
                            {fmtDate(r.expiryDate)}
                          </td>
                          <td className="px-4 py-3">
                            <StatusChip label={s.label} tone={s.tone} />
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
                total={total}
                pageSize={PAGE_SIZE}
                itemLabel="stock records"
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

// ─── Transaction detail (normalized across mock & API shapes) ────────────────

interface TxDetail {
  id: string
  type: string
  direction: "IN" | "OUT"
  quantity: number
  balanceAfter: number
  date: string
  reference: string
  notes: string
  productName: string
  batchNumber: string
  locationName: string
  unitName: string
  userName: string
}

function nameOf(ref: unknown, fallback: string): string {
  if (
    ref &&
    typeof ref === "object" &&
    "name" in ref as Record<string, unknown>
  ) {
    const n = (ref as { name?: unknown }).name
    if (typeof n === "string" && n) return n
  }
  return fallback
}

function adaptApiTransaction(tx: StockTransactionDto): TxDetail {
  return {
    id: tx.id,
    type: tx.transactionType,
    direction: tx.direction,
    quantity: tx.quantity,
    balanceAfter: tx.balanceAfter,
    date: tx.createdAt,
    reference:
      [tx.referenceType, tx.referenceId].filter(Boolean).join(" · ") || "—",
    notes: tx.notes ?? "",
    productName: nameOf(tx.product, tx.productId),
    batchNumber: tx.batchId ? nameOf(tx.batch, "—") : "—",
    locationName: nameOf(tx.location, tx.locationId),
    unitName: nameOf(tx.baseUnit, ""),
    userName: nameOf(tx.createdBy, "—"),
  }
}

// ─── Current Stock Tab ────────────────────────────────────────────────────────

function CurrentStockTab({
  loading,
  loadError,
  rows,
  onRetry,
  onViewDetail,
}: {
  loading: boolean
  loadError: string | null
  rows: StockRow[]
  onRetry: () => void
  onViewDetail: (row: StockRow) => void
}) {
  const [search, setSearch] = useState("")
  const [locationFilter, setLocationFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [page, setPage] = useState(1)

  const locations = useMemo(
    () => [
      ...new Set(rows.map((r) => r.locationName).filter((l) => l && l !== "—")),
    ],
    [rows],
  )

  const filtered = useMemo(() => {
    let result = rows
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (r) =>
          r.productName.toLowerCase().includes(q) ||
          r.productSku.toLowerCase().includes(q) ||
          r.batchNumber.toLowerCase().includes(q),
      )
    }
    if (locationFilter)
      result = result.filter((r) => r.locationName === locationFilter)
    if (statusFilter)
      result = result.filter((r) => deriveStatus(r) === statusFilter)
    return result
  }, [rows, search, locationFilter, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const summary = useMemo(
    () => ({
      total: rows.reduce((a, r) => a + r.quantity, 0),
      available: rows.reduce((a, r) => a + r.availableQuantity, 0),
      reserved: rows.reduce((a, r) => a + r.reservedQuantity, 0),
      depleted: rows.filter((r) => deriveStatus(r) === "depleted").length,
    }),
    [rows],
  )

  function reset() {
    setSearch("")
    setLocationFilter("")
    setStatusFilter("")
    setPage(1)
  }

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SmallCard
          label="Total Stock"
          value={summary.total.toLocaleString()}
          sub="Base units"
        />
        <SmallCard
          label="Available"
          value={summary.available.toLocaleString()}
          sub="Units"
          accent="text-green-600"
        />
        <SmallCard
          label="Reserved"
          value={summary.reserved.toLocaleString()}
          sub="Units"
          accent="text-orange-600"
        />
        <SmallCard
          label="Depleted"
          value={summary.depleted}
          sub="Stock rows"
          accent="text-red-600"
        />
      </div>

      <div className="bg-white rounded-xl border border-[#E6ECE2] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1 min-w-[200px]">
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v)
                setPage(1)
              }}
              placeholder="Search product, SKU or batch..."
            />
          </div>
          <Select
            value={locationFilter}
            onChange={(e) => {
              setLocationFilter(e.target.value)
              setPage(1)
            }}
            className="sm:w-40"
          >
            <option value="">All Locations</option>
            {locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </Select>
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="sm:w-40"
          >
            <option value="">All Statuses</option>
            <option value="available">Available</option>
            <option value="depleted">Depleted</option>
          </Select>
          {(search || locationFilter || statusFilter) && (
            <button
              onClick={reset}
              className="text-xs font-semibold text-[#7A9076] hover:underline whitespace-nowrap"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden">
        {loadError ? (
          <div className="p-6">
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 flex items-center justify-between gap-3">
              <span>{loadError}</span>
              <button
                onClick={onRetry}
                className="text-xs font-semibold text-red-700 hover:underline whitespace-nowrap"
              >
                Retry
              </button>
            </div>
          </div>
        ) : loading ? (
          <LoadingSkeleton />
        ) : filtered.length === 0 ? (
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
                  {paginated.map((r, i) => {
                    const s = StatusLabel({ status: deriveStatus(r) })
                    return (
                      <tr
                        key={r.id}
                        className={i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/20"}
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
                          {r.unitName ? `${r.unitName}s` : "—"}
                        </td>
                        <td className="px-4 py-3 text-[#666666] hidden lg:table-cell">
                          {fmtDate(r.expiryDate)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusChip label={s.label} tone={s.tone} />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => onViewDetail(r)}
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
              total={filtered.length}
              pageSize={PAGE_SIZE}
              itemLabel="stock records"
            />
          </>
        )}
      </div>
    </>
  )
}

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
          <StatusChip label={s.label} tone={s.tone} />
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
            row.unitName ? `${row.unitName}s` : ""
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
                {l.qty.toLocaleString()}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#E6ECE2]/30">
            <span className="text-sm font-semibold text-[#333333]">Total</span>
            <span className="text-sm font-bold text-[#333333]">
              {totalQty.toLocaleString()}
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

// ─── Transaction Detail Modal ─────────────────────────────────────────────────

function TxDetailModal({ tx, onClose }: { tx: TxDetail; onClose: () => void }) {
  const { direction } = tx
  const unit = tx.unitName
  const isIn = direction === "IN"

  return (
    <Modal open title="Stock Movement" onClose={onClose} size="md">
      <div className="flex flex-col gap-4">
        {/* Type + direction */}
        <div className="flex items-center gap-3">
          <TxTypeBadge type={tx.type} />
          <StatusChip
            label={isIn ? "In" : "Out"}
            tone={isIn ? "green" : "red"}
          />
        </div>

        {/* Big quantity box */}
        <div
          className={`rounded-xl border p-4 flex items-center justify-between ${
            isIn ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
          }`}
        >
          <div>
            <p className="text-xs font-semibold text-[#666666] uppercase tracking-wide">
              Movement
            </p>
            <p className="text-xs text-[#999] mt-0.5">
              {direction === "IN" ? "Stock In" : "Stock Out"}
            </p>
          </div>
          <p
            className={`text-2xl font-bold ${
              isIn ? "text-green-700" : "text-red-700"
            }`}
          >
            {isIn ? "+" : "−"}
            {tx.quantity.toLocaleString()}{" "}
            <span className="text-sm font-medium">
              {unit ? `${unit}s` : ""}
            </span>
          </p>
        </div>

        {/* Transaction info */}
        <Section title="Transaction Information">
          <Row label="Transaction ID" value={tx.id} mono />
          <Row label="Type" value={prettyType(tx.type)} />
          <Row label="Direction" value={direction} />
          <Row label="Date" value={fmtDateTime(tx.date)} />
        </Section>

        {/* Product info */}
        <Section title="Product Information">
          <Row label="Product" value={tx.productName} />
          <Row label="Batch" value={tx.batchNumber} mono />
          <Row label="Base Unit" value={unit || "—"} />
        </Section>

        {/* Stock info */}
        <Section title="Stock Information">
          <Row label="Location" value={tx.locationName} />
          <Row
            label="Quantity"
            value={`${tx.quantity.toLocaleString()} ${
              unit ? `${unit}s` : ""
            }`.trim()}
          />
          <Row
            label="Balance After"
            value={`${tx.balanceAfter.toLocaleString()} ${
              unit ? `${unit}s` : ""
            }`.trim()}
          />
        </Section>

        {/* Reference & audit */}
        <Section title="Reference & Audit">
          <Row label="Reference" value={tx.reference} mono />
          {tx.notes && <Row label="Notes" value={tx.notes} />}
          <Row label="Created By" value={tx.userName} />
        </Section>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 justify-end border-t border-[#E6ECE2] pt-4">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
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
  // Real pickers: products & locations load once; batches & units per product.
  const [productOptions, setProductOptions] = useState<ProductOption[]>([])
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [optionsError, setOptionsError] = useState("")

  const [productId, setProductId] = useState("")
  const [batchId, setBatchId] = useState("")
  const [batches, setBatches] = useState<BatchDto[]>([])
  const [batchesLoading, setBatchesLoading] = useState(false)
  const [locationId, setLocationId] = useState("")
  const [qty, setQty] = useState("")
  const [units, setUnits] = useState<{
    unitId: string
    name: string
    isBaseUnit: boolean
  }[]>([])
  const [unitId, setUnitId] = useState("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open || productOptions.length > 0) return
    let cancelled = false
    setOptionsLoading(true)
    setOptionsError("")
    Promise.all([fetchProductOptions(), listLocations({ limit: 100 })])
      .then(([opts, locs]) => {
        if (cancelled) return
        setProductOptions(opts)
        setLocations(
          locs.data
            .filter((l: any) => l.isActive)
            .map((l: any) => ({ id: l.id, name: l.name })),
        )
      })
      .catch((err) => {
        if (!cancelled)
          setOptionsError(
            err instanceof Error ? err.message : "Failed to load form options.",
          )
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, productOptions.length])

  useEffect(() => {
    if (!productId) {
      setBatches([])
      setUnits([])
      setBatchId("")
      setUnitId("")
      return
    }
    let cancelled = false
    setBatchesLoading(true)
    Promise.all([
      listProductBatches(productId, { limit: 100 }),
      getProductDetail(productId),
    ])
      .then(([b, p]) => {
        if (cancelled) return
        setBatches(b.data)
        const productUnits = p.units.map((u) => ({
          unitId: u.unitId,
          name: u.unit.name,
          isBaseUnit: u.isBaseUnit,
        }))
        setUnits(productUnits)
        const base = productUnits.find((u) => u.isBaseUnit) ?? productUnits[0]
        setUnitId(base?.unitId ?? "")
      })
      .catch(() => {
        if (!cancelled) {
          setBatches([])
          setUnits([])
        }
      })
      .finally(() => {
        if (!cancelled) setBatchesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [productId])

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

  const selectedProduct = productOptions.find((p) => p.id === productId)

  return (
    <Modal open={open} title="Add Opening Stock" onClose={onClose} size="md">
      <p className="text-sm text-[#666666] -mt-2 mb-4">
        Add stock already physically available in the pharmacy.
      </p>
      <div className="flex flex-col gap-4">
        {(error || optionsError) && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error || optionsError}
          </p>
        )}

        <div>
          <label className="text-sm font-medium text-[#333333] block mb-1.5">
            Product
          </label>
          <select
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value)
              setBatchId("")
            }}
            className="w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm focus:border-[#B6C8AF] focus:outline-none"
            disabled={optionsLoading}
          >
            <option value="">
              {optionsLoading ? "Loading products..." : "Select product..."}
            </option>
            {productOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-[#333333] block mb-1.5">
            Batch
          </label>
          <select
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            className="w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm focus:border-[#B6C8AF] focus:outline-none"
            disabled={!productId || batchesLoading}
          >
            <option value="">
              {batchesLoading ? "Loading batches..." : "Select batch..."}
            </option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.batchNumber}
                {b.expiryDate ? ` — expires ${fmtDate(b.expiryDate)}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-[#333333] block mb-1.5">
            Location
          </label>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm focus:border-[#B6C8AF] focus:outline-none"
            disabled={optionsLoading}
          >
            <option value="">
              {optionsLoading ? "Loading locations..." : "Select location..."}
            </option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Quantity"
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="0"
          />
          <div>
            <label className="text-sm font-medium text-[#333333] block mb-1.5">
              Unit
            </label>
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              className="w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm focus:border-[#B6C8AF] focus:outline-none"
              disabled={!productId || units.length === 0}
            >
              {units.length === 0 ? (
                <option value="">
                  {productId ? "No units configured" : "Select product first"}
                </option>
              ) : (
                units.map((u) => (
                  <option key={u.unitId} value={u.unitId}>
                    {u.name}
                    {u.isBaseUnit ? " (base)" : ""}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
        {selectedProduct && (
          <p className="text-xs text-[#999]">
            Base unit for {selectedProduct.name}:{" "}
            {selectedProduct.baseUnit || "—"}
          </p>
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
  const [units, setUnits] = useState<{
    unitId: string
    name: string
    isBaseUnit: boolean
  }[]>([])
  const [unitId, setUnitId] = useState("")
  const [locationId, setLocationId] = useState("")
  const [adjustment, setAdjustment] = useState("")
  const [reason, setReason] = useState("")
  const [notes, setNotes] = useState("")

  const [productOptions, setProductOptions] = useState<ProductOption[]>([])
  const [locations, setLocations] = useState<{ id: string name: string }[]>([])
  const [optionsLoading, setOptionsLoading] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open || productOptions.length > 0) return
    setOptionsLoading(true)
    Promise.all([fetchProductOptions(), listLocations({ limit: 100 })])
      .then(([opts, locs]) => {
        setProductOptions(opts)
        setLocations(
          locs.data
            .filter((l: any) => l.isActive)
            .map((l: any) => ({ id: l.id, name: l.name })),
        )
      })
      .catch(() => {})
      .finally(() => setOptionsLoading(false))
  }, [open, productOptions.length])

  useEffect(() => {
    if (!productId) {
      setBatches([])
      setBatchId("")
      setUnits([])
      setUnitId("")
      return
    }
    let cancelled = false
    setBatchesLoading(true)
    Promise.all([
      listProductBatches(productId, { limit: 100 }),
      getProductDetail(productId),
    ])
      .then(([b, p]) => {
        if (cancelled) return
        setBatches(b.data)
        const productUnits = p.units.map((u) => ({
          unitId: u.unitId,
          name: u.unit.name,
          isBaseUnit: u.isBaseUnit,
        }))
        setUnits(productUnits)
        const base = productUnits.find((u) => u.isBaseUnit) ?? productUnits[0]
        setUnitId(base?.unitId ?? "")
      })
      .catch(() => {
        if (!cancelled) {
          setBatches([])
          setUnits([])
        }
      })
      .finally(() => {
        if (!cancelled) setBatchesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [productId])

  const selectedBatch = batches.find((b) => b.id === batchId)
  const product = productOptions.find((p) => p.id === productId)
  const currentStock = selectedBatch?.totalQuantity ?? 0
  const adjNum = parseInt(adjustment) || 0
  const newStock = Math.max(0, currentStock + adjNum)

  function reset() {
    setProductId("")
    setBatchId("")
    setLocationId("")
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

        <div>
          <label className="text-sm font-medium text-[#333333] block mb-1.5">
            Product
          </label>
          <select
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value)
              setBatchId("")
            }}
            className="w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm focus:border-[#B6C8AF] focus:outline-none"
            disabled={optionsLoading}
          >
            <option value="">
              {optionsLoading ? "Loading products..." : "Select product..."}
            </option>
            {productOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-[#333333] block mb-1.5">
            Batch
          </label>
          <select
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            className="w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm focus:border-[#B6C8AF] focus:outline-none"
            disabled={!productId || batchesLoading}
          >
            <option value="">
              {batchesLoading ? "Loading batches..." : "Select batch..."}
            </option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.batchNumber}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-[#333333] block mb-1.5">
            Location
          </label>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm focus:border-[#B6C8AF] focus:outline-none"
            disabled={optionsLoading}
          >
            <option value="">Select location...</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        {selectedBatch && (
          <div className="rounded-xl bg-[#E6ECE2]/50 px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-[#666666]">Current Stock</span>
            <span className="text-sm font-bold text-[#333333]">
              {currentStock.toLocaleString()}{" "}
              {product?.baseUnit ? `${product.baseUnit}s` : ""}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Adjustment (use − for reduction, + for addition)"
            type="number"
            value={adjustment}
            onChange={(e) => setAdjustment(e.target.value)}
            placeholder="e.g. -5 or 10"
          />
          <div>
            <label className="text-sm font-medium text-[#333333] block mb-1.5">
              Unit
            </label>
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              className="w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm focus:border-[#B6C8AF] focus:outline-none"
              disabled={!productId || units.length === 0}
            >
              {units.length === 0 ? (
                <option value="">
                  {productId ? "No units configured" : "Select product first"}
                </option>
              ) : (
                units.map((u) => (
                  <option key={u.unitId} value={u.unitId}>
                    {u.name}
                    {u.isBaseUnit ? " (base)" : ""}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {adjustment && selectedBatch && (
          <div
            className={`rounded-xl px-4 py-3 flex items-center justify-between ${
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
              {product?.baseUnit ? `${product.baseUnit}s` : ""}
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
            className="w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm focus:border-[#B6C8AF] focus:outline-none"
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
            className="w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm resize-none focus:border-[#B6C8AF] focus:outline-none"
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

function SmallCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-[#E6ECE2] p-4">
      <p className="text-xs font-medium text-[#666666] uppercase tracking-wide">
        {label}
      </p>
      <p className={`text-2xl font-bold mt-1 ${accent ?? "text-[#333333]"}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-[#999] mt-0.5">{sub}</p>}
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
