import { useEffect, useMemo, useState } from "react"
import {
  getProducts,
  getAllTransactions,
  fetchProductOptions,
  type ProductOption,
} from "../../features/inventory/inventoryService"
import type { Product, Transaction } from "../../features/inventory/inventoryMock"
import {
  getStock,
  getProductTransactions,
  getBatchTransactions,
  getBinCard,
  createOpeningStock,
  StockApiError,
  type StockRowDto,
  type StockTransactionDto,
  type BinCardResult,
} from "../../features/inventory/stockApi"
import { listLocations } from "../../features/inventory/locationsApi"
import { listProductBatches, type BatchDto } from "../../features/inventory/batchesApi"
import { getProduct as getProductDetail } from "../../features/inventory/productsApi"
import PageHeader from "../../components/ui/PageHeader"
import SearchInput from "../../components/ui/SearchInput"
import Select from "../../components/ui/Select"
import Pagination from "../../components/ui/Pagination"
import EmptyState from "../../components/ui/EmptyState"
import Modal from "../../components/ui/Modal"
import Button from "../../components/ui/Button"
import Input from "../../components/ui/Input"

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
  const batch = (dto.batch ?? {}) as { batchNumber?: string; expiryDate?: string }
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
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function prettyType(t: string) {
  if (!t) return ""
  if (t === t.toUpperCase()) return t.charAt(0) + t.slice(1).toLowerCase()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function StatusLabel({ status }: { status: DerivedStatus }): { label: string; cls: string } {
  return status === "depleted"
    ? { label: "Depleted", cls: "bg-red-100 text-red-700" }
    : { label: "Available", cls: "bg-green-100 text-green-700" }
}

function TxTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    received:   "bg-green-100 text-green-700",
    sale:       "bg-blue-100 text-blue-700",
    transfer:   "bg-purple-100 text-purple-700",
    adjustment: "bg-orange-100 text-orange-700",
    opening:    "bg-[#DBEFF3] text-[#49B0C1]",
    disposal:   "bg-red-100 text-red-700",
    return:     "bg-yellow-100 text-yellow-700",
    // API transaction types (StockTransactionDto / bin card)
    receipt:    "bg-green-100 text-green-700",
  }
  return (
    <span className={`text-xs font-semibold rounded-full px-2 py-0.5 capitalize ${map[type.toLowerCase()] ?? "bg-gray-100 text-gray-600"}`}>
      {prettyType(type)}
    </span>
  )
}

const IN_TYPES = ["received", "opening", "return"]
const isInType = (t: string) => IN_TYPES.includes(t.toLowerCase())

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StockPage() {
  const [tab, setTab] = useState<Tab>("stock")

  // Real API: GET /inventory/stock (Current Stock tab)
  const [rows, setRows] = useState<StockRow[]>([])
  const [stockLoading, setStockLoading] = useState(true)
  const [stockError, setStockError] = useState<string | null>(null)

  // Mock: movements tab — the stock API exposes transactions only per
  // product/batch, so a global ledger still comes from mock data until the
  // backend offers an "all transactions" endpoint.
  const [products, setProducts] = useState<Product[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])

  // modals
  const [addStockOpen, setAddStockOpen] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [stockDetail, setStockDetail] = useState<StockRow | null>(null)
  const [txDetail, setTxDetail] = useState<TxDetail | null>(null)

  async function loadStock() {
    setStockLoading(true)
    setStockError(null)
    try {
      // Walk the paginated endpoint so backend page-size caps can't hide rows.
      const first = await getStock({ page: 1, limit: 100 })
      const dtos = [...first.data]
      const totalPages = Math.min(first.pagination?.totalPages ?? 1, 10)
      for (let page = 2; page <= totalPages; page++) {
        const next = await getStock({ page, limit: 100 })
        dtos.push(...next.data)
      }
      setRows(dtos.map(adaptStockRow))
    } catch (err) {
      setStockError(
        err instanceof StockApiError || err instanceof Error
          ? err.message
          : "Failed to load stock. Please try again.",
      )
    } finally {
      setStockLoading(false)
    }
  }

  useEffect(() => {
    loadStock()
    // Movements tab (mock)
    Promise.all([getProducts(), getAllTransactions()]).then(([p, t]) => {
      setProducts(p)
      setTransactions(t)
    })
  }, [])

  function productById(id: string) { return products.find((p) => p.id === id) }

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
              className="inline-flex items-center gap-1.5 rounded-xl bg-white text-[#49B0C1] px-3.5 py-2 text-sm font-semibold hover:bg-[#DBEFF3] transition-colors"
            >
              + Add Stock
            </button>
            <button
              onClick={() => setAdjustOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/30 bg-white/10 px-3.5 py-2 text-sm font-medium text-white hover:bg-white/20 transition-colors"
            >
              Adjust Stock
            </button>
          </div>
        }
      />

      {/* Tab bar */}
      <div className="bg-white border-b border-[#DBEFF3] px-6 flex">
        {([["stock", "Current Stock"], ["movements", "Stock Movements"]] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === key ? "border-[#49B0C1] text-[#49B0C1]" : "border-transparent text-[#666666] hover:text-[#333333]"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        {tab === "stock" ? (
          <CurrentStockTab
            loading={stockLoading}
            loadError={stockError}
            rows={rows}
            onRetry={loadStock}
            onViewDetail={setStockDetail}
          />
        ) : (
          <MovementsTab
            transactions={transactions}
            productById={productById}
            onViewDetail={(t) => setTxDetail(adaptMockTransaction(t, productById(t.productId)))}
          />
        )}
      </div>

      {/* Modals */}
      <AddStockModal
        open={addStockOpen}
        onClose={() => setAddStockOpen(false)}
        onCreated={() => { setAddStockOpen(false); loadStock() }}
      />
      <AdjustStockModal open={adjustOpen} onClose={() => setAdjustOpen(false)} />
      {stockDetail && (
        <StockDetailModal
          row={stockDetail}
          allRows={rows}
          onClose={() => setStockDetail(null)}
          onOpenTransaction={(tx) => { setStockDetail(null); setTxDetail(adaptApiTransaction(tx)) }}
        />
      )}
      {txDetail && (
        <TxDetailModal
          tx={txDetail}
          onClose={() => setTxDetail(null)}
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

function adaptMockTransaction(t: Transaction, product?: Product): TxDetail {
  return {
    id: t.id,
    type: t.type,
    direction: isInType(t.type) ? "IN" : "OUT",
    quantity: t.quantity,
    balanceAfter: t.balanceAfter,
    date: t.date,
    reference: t.reference,
    notes: t.notes ?? "",
    productName: product?.name ?? t.productId,
    batchNumber: t.batchNumber ?? "—",
    locationName: t.location,
    unitName: t.unit,
    userName: t.user,
  }
}

function nameOf(ref: unknown, fallback: string): string {
  if (ref && typeof ref === "object" && "name" in (ref as Record<string, unknown>)) {
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
    reference: [tx.referenceType, tx.referenceId].filter(Boolean).join(" · ") || "—",
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
  loading, loadError, rows, onRetry, onViewDetail,
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

  const locations = useMemo(() => [...new Set(rows.map((r) => r.locationName).filter((l) => l && l !== "—"))], [rows])

  const filtered = useMemo(() => {
    let result = rows
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((r) =>
        r.productName.toLowerCase().includes(q) ||
        r.productSku.toLowerCase().includes(q) ||
        r.batchNumber.toLowerCase().includes(q),
      )
    }
    if (locationFilter) result = result.filter((r) => r.locationName === locationFilter)
    if (statusFilter) result = result.filter((r) => deriveStatus(r) === statusFilter)
    return result
  }, [rows, search, locationFilter, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const summary = useMemo(() => ({
    total: rows.reduce((a, r) => a + r.quantity, 0),
    available: rows.reduce((a, r) => a + r.availableQuantity, 0),
    reserved: rows.reduce((a, r) => a + r.reservedQuantity, 0),
    depleted: rows.filter((r) => deriveStatus(r) === "depleted").length,
  }), [rows])

  function reset() { setSearch(""); setLocationFilter(""); setStatusFilter(""); setPage(1) }

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SmallCard label="Total Stock" value={summary.total.toLocaleString()} sub="Base units" />
        <SmallCard label="Available" value={summary.available.toLocaleString()} sub="Units" accent="text-green-600" />
        <SmallCard label="Reserved" value={summary.reserved.toLocaleString()} sub="Units" accent="text-orange-600" />
        <SmallCard label="Depleted" value={summary.depleted} sub="Stock rows" accent="text-red-600" />
      </div>

      <div className="bg-white rounded-xl border border-[#DBEFF3] p-4 flex flex-col gap-3">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search product, SKU or batch..." />
        <div className="flex flex-wrap gap-3 items-center">
          <Select value={locationFilter} onChange={(e) => { setLocationFilter(e.target.value); setPage(1) }} className="flex-1 min-w-[150px]">
            <option value="">All Locations</option>
            {locations.map((l) => <option key={l} value={l}>{l}</option>)}
          </Select>
          <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className="flex-1 min-w-[150px]">
            <option value="">All Statuses</option>
            <option value="available">Available</option>
            <option value="depleted">Depleted</option>
          </Select>
          {(search || locationFilter || statusFilter) && (
            <button onClick={reset} className="text-xs font-semibold text-[#49B0C1] hover:underline whitespace-nowrap">
              Reset Filters
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
        {loadError ? (
          <div className="p-6">
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 flex items-center justify-between gap-3">
              <span>{loadError}</span>
              <button onClick={onRetry} className="text-xs font-semibold text-red-700 hover:underline whitespace-nowrap">Retry</button>
            </div>
          </div>
        ) : loading ? <LoadingSkeleton /> : filtered.length === 0 ? (
          <EmptyState title="No stock records found" description="Adjust your filters or add stock to products." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#DBEFF3] text-left">
                    <th className="px-4 py-3 font-semibold text-[#333333]">Product</th>
                    <th className="px-4 py-3 font-semibold text-[#333333]">Batch</th>
                    <th className="px-4 py-3 font-semibold text-[#333333] hidden sm:table-cell">Location</th>
                    <th className="px-4 py-3 font-semibold text-[#333333] text-right">Quantity</th>
                    <th className="px-4 py-3 font-semibold text-[#333333] hidden md:table-cell">Unit</th>
                    <th className="px-4 py-3 font-semibold text-[#333333] hidden lg:table-cell">Expiry</th>
                    <th className="px-4 py-3 font-semibold text-[#333333]">Status</th>
                    <th className="px-4 py-3 font-semibold text-[#333333]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((r, i) => {
                    const s = StatusLabel({ status: deriveStatus(r) })
                    return (
                      <tr key={r.id} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#333333]">{r.productName}</p>
                          {r.productSku && <p className="text-xs text-[#999] font-mono">{r.productSku}</p>}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[#666666]">{r.batchNumber}</td>
                        <td className="px-4 py-3 text-[#666666] hidden sm:table-cell">{r.locationName}</td>
                        <td className="px-4 py-3 text-right">
                          <p className="font-bold text-[#333333]">{r.quantity.toLocaleString()}</p>
                          {r.reservedQuantity > 0 && (
                            <p className="text-xs text-[#999]">{r.availableQuantity.toLocaleString()} available</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[#666666] hidden md:table-cell">{r.unitName ? `${r.unitName}s` : "—"}</td>
                        <td className="px-4 py-3 text-[#666666] hidden lg:table-cell">{fmtDate(r.expiryDate)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold rounded-full px-2.5 py-0.5 ${s.cls}`}>{s.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => onViewDetail(r)} className="text-xs font-semibold text-[#49B0C1] hover:underline">View</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-[#DBEFF3] flex items-center justify-between">
              <p className="text-xs text-[#666666]">
                Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} stock records
              </p>
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>
    </>
  )
}

// ─── Stock Movements Tab (mock data — see note in StockPage) ──────────────────

function MovementsTab({
  transactions, productById, onViewDetail,
}: {
  transactions: Transaction[]
  productById: (id: string) => Product | undefined
  onViewDetail: (t: Transaction) => void
}) {
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [locationFilter, setLocationFilter] = useState("")
  const [page, setPage] = useState(1)

  const locations = useMemo(() => [...new Set(transactions.map((t) => t.location))], [transactions])

  const filtered = useMemo(() => {
    let rows = [...transactions].sort((a, b) => b.date.localeCompare(a.date))
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter((t) => {
        const p = productById(t.productId)
        return p?.name.toLowerCase().includes(q) || t.reference.toLowerCase().includes(q)
      })
    }
    if (typeFilter) rows = rows.filter((t) => t.type === typeFilter)
    if (locationFilter) rows = rows.filter((t) => t.location === locationFilter)
    return rows
  }, [transactions, search, typeFilter, locationFilter, productById])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const summary = useMemo(() => ({
    total: filtered.length,
    in: filtered.filter((t) => isInType(t.type)).reduce((a, t) => a + t.quantity, 0),
    out: filtered.filter((t) => !isInType(t.type)).reduce((a, t) => a + t.quantity, 0),
  }), [filtered])

  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        <SmallCard label="Total Movements" value={summary.total.toLocaleString()} />
        <SmallCard label="Stock In" value={`+${summary.in.toLocaleString()}`} accent="text-green-600" />
        <SmallCard label="Stock Out" value={`−${summary.out.toLocaleString()}`} accent="text-red-600" />
      </div>

      <div className="bg-white rounded-xl border border-[#DBEFF3] p-4 flex flex-col gap-3">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search product, batch or reference..." />
        <div className="flex flex-wrap gap-3">
          <Select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }} className="flex-1 min-w-[150px]">
            <option value="">All Types</option>
            {["received","sale","transfer","adjustment","opening","disposal","return"].map((t) => (
              <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </Select>
          <Select value={locationFilter} onChange={(e) => { setLocationFilter(e.target.value); setPage(1) }} className="flex-1 min-w-[150px]">
            <option value="">All Locations</option>
            {locations.map((l) => <option key={l} value={l}>{l}</option>)}
          </Select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
        {filtered.length === 0 ? (
          <EmptyState title="No movements found" description="Stock movements appear here as inventory is received, sold, or adjusted." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#DBEFF3] text-left">
                    <th className="px-4 py-3 font-semibold text-[#333333]">Date</th>
                    <th className="px-4 py-3 font-semibold text-[#333333]">Product</th>
                    <th className="px-4 py-3 font-semibold text-[#333333]">Type</th>
                    <th className="px-4 py-3 font-semibold text-[#333333] hidden sm:table-cell">Location</th>
                    <th className="px-4 py-3 font-semibold text-[#333333] text-right">Qty In</th>
                    <th className="px-4 py-3 font-semibold text-[#333333] text-right">Qty Out</th>
                    <th className="px-4 py-3 font-semibold text-[#333333] text-right hidden md:table-cell">Balance</th>
                    <th className="px-4 py-3 font-semibold text-[#333333] hidden lg:table-cell">Reference</th>
                    <th className="px-4 py-3 font-semibold text-[#333333]">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((t, i) => {
                    const p = productById(t.productId)
                    const unit = p?.baseUnit ?? ""
                    const isIn = isInType(t.type)
                    return (
                      <tr key={t.id} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"}>
                        <td className="px-4 py-3 text-[#666666] whitespace-nowrap">{fmtDate(t.date)}</td>
                        <td className="px-4 py-3 font-medium text-[#333333]">{p?.name ?? t.productId}</td>
                        <td className="px-4 py-3"><TxTypeBadge type={t.type} /></td>
                        <td className="px-4 py-3 text-[#666666] hidden sm:table-cell">{t.location}</td>
                        <td className="px-4 py-3 text-right font-semibold text-green-700">
                          {isIn ? `+${t.quantity.toLocaleString()} ${unit}s` : <span className="text-[#999] font-normal">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-red-600">
                          {!isIn ? `−${t.quantity.toLocaleString()} ${unit}s` : <span className="text-[#999] font-normal">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-[#333333] font-semibold hidden md:table-cell">
                          {t.balanceAfter.toLocaleString()} {unit}s
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[#666666] hidden lg:table-cell">{t.reference}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => onViewDetail(t)} className="text-xs font-semibold text-[#49B0C1] hover:underline">View</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-[#DBEFF3] flex items-center justify-between">
              <p className="text-xs text-[#666666]">
                Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} movements
              </p>
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>
    </>
  )
}

// ─── Stock Detail Modal (3 views: batch | tx | bincard) ──────────────────────

type StockView = "batch" | "transactions" | "bincard"

function StockDetailModal({
  row, allRows, onClose, onOpenTransaction,
}: {
  row: StockRow
  allRows: StockRow[]
  onClose: () => void
  onOpenTransaction: (tx: StockTransactionDto) => void
}) {
  const [view, setView] = useState<StockView>("batch")

  return (
    <Modal
      open
      title={view === "batch" ? "Stock Detail" : view === "transactions" ? "Batch Transactions" : "Bin Card"}
      onClose={onClose}
      size={view === "bincard" ? "lg" : "md"}
    >
      {view === "batch" && (
        <BatchDetailView
          row={row}
          allRows={allRows}
          onViewTransactions={() => setView("transactions")}
          onViewBinCard={() => setView("bincard")}
        />
      )}

      {view === "transactions" && (
        <BatchTransactionsView
          row={row}
          onBack={() => setView("batch")}
          onViewTransaction={onOpenTransaction}
          onViewBinCard={() => setView("bincard")}
        />
      )}

      {view === "bincard" && (
        <BinCardView
          row={row}
          onBack={() => setView("batch")}
        />
      )}
    </Modal>
  )
}

// ─── VIEW 1: Batch Details ────────────────────────────────────────────────────

function BatchDetailView({
  row, allRows, onViewTransactions, onViewBinCard,
}: {
  row: StockRow
  allRows: StockRow[]
  onViewTransactions: () => void
  onViewBinCard: () => void
}) {
  const status = deriveStatus(row)
  const s = StatusLabel({ status })

  // Stock of the same product+batch across all locations (from loaded rows)
  const locationsForBatch = useMemo(() => {
    const groups = new Map<string, { location: string; qty: number }>()
    allRows
      .filter((r) => r.productId === row.productId && r.batchId === row.batchId)
      .forEach((r) => {
        const existing = groups.get(r.locationId)
        if (existing) existing.qty += r.quantity
        else groups.set(r.locationId, { location: r.locationName, qty: r.quantity })
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
          <span className="text-xs font-mono text-[#666666]">{row.batchNumber}</span>
          <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${s.cls}`}>{s.label}</span>
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
        <Row label="Quantity" value={`${row.quantity.toLocaleString()} ${row.unitName ? `${row.unitName}s` : ""}`.trim()} />
        <Row label="Reserved" value={row.reservedQuantity.toLocaleString()} />
        <Row label="Available" value={row.availableQuantity.toLocaleString()} />
        <Row label="Status" value={s.label} />
      </Section>

      {/* Location stock */}
      <div className="rounded-xl border border-[#DBEFF3] overflow-hidden">
        <div className="px-4 py-2.5 bg-[#DBEFF3]/50">
          <p className="text-xs font-semibold text-[#666666] uppercase tracking-wide">Location Stock</p>
        </div>
        <div className="divide-y divide-[#DBEFF3]">
          {locationsForBatch.map((l) => (
            <div key={l.location} className="flex items-center justify-between px-4 py-2.5">
              <span className="text-sm text-[#333333]">{l.location}</span>
              <span className="text-sm font-semibold text-[#333333]">{l.qty.toLocaleString()}</span>
            </div>
          ))}
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#DBEFF3]/30">
            <span className="text-sm font-semibold text-[#333333]">Total</span>
            <span className="text-sm font-bold text-[#333333]">{totalQty.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 border-t border-[#DBEFF3] pt-4">
        <Button variant="secondary" onClick={onViewTransactions}>View Transactions</Button>
        <Button variant="secondary" onClick={onViewBinCard}>View Bin Card</Button>
      </div>
    </div>
  )
}

// ─── VIEW 2: Batch Transactions (GET /inventory/batches/{id}/transactions) ────

function BatchTransactionsView({
  row, onBack, onViewTransaction, onViewBinCard,
}: {
  row: StockRow
  onBack: () => void
  onViewTransaction: (tx: StockTransactionDto) => void
  onViewBinCard: () => void
}) {
  const [txs, setTxs] = useState<StockTransactionDto[]>([])
  const [scopeNote, setScopeNote] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError("")
    // Prefer the batch ledger; fall back to the product ledger when the
    // batch itself has no movements yet.
    getBatchTransactions(row.batchId, { limit: 100 })
      .then(async (batchResult) => {
        if (cancelled) return
        if (batchResult.data.length > 0) {
          setTxs(sortTxsDesc(batchResult.data))
          setScopeNote(null)
          return
        }
        const productResult = await getProductTransactions(row.productId, { limit: 100 })
        if (cancelled) return
        setTxs(sortTxsDesc(productResult.data))
        setScopeNote("No movements for this batch yet — showing all transactions for the product.")
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load transactions.")
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [row.batchId, row.productId])

  const unit = row.unitName

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={onBack}
        className="self-start text-xs font-semibold text-[#49B0C1] hover:underline"
      >
        ← Back to Batch
      </button>

      <div>
        <p className="text-sm font-bold text-[#333333]">{row.productName}</p>
        <p className="text-xs font-mono text-[#666666] mt-0.5">{row.batchNumber}</p>
      </div>

      {scopeNote && (
        <p className="text-xs text-[#666666] bg-[#DBEFF3]/50 rounded-lg px-3 py-2">{scopeNote}</p>
      )}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      ) : loading ? (
        <LoadingSkeleton />
      ) : txs.length === 0 ? (
        <EmptyState title="No transactions" description="No stock movements recorded for this batch yet." />
      ) : (
        <div className="rounded-xl border border-[#DBEFF3] overflow-hidden">
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0">
                <tr className="bg-[#DBEFF3] text-left">
                  <th className="px-3 py-2.5 font-semibold text-[#333333]">Date</th>
                  <th className="px-3 py-2.5 font-semibold text-[#333333]">Type</th>
                  <th className="px-3 py-2.5 font-semibold text-[#333333] text-right">In</th>
                  <th className="px-3 py-2.5 font-semibold text-[#333333] text-right">Out</th>
                  <th className="px-3 py-2.5 font-semibold text-[#333333] text-right">Balance</th>
                  <th className="px-3 py-2.5 font-semibold text-[#333333]"></th>
                </tr>
              </thead>
              <tbody>
                {txs.map((t, i) => {
                  const isIn = t.direction === "IN"
                  return (
                    <tr key={t.id} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"}>
                      <td className="px-3 py-2.5 text-[#666666] whitespace-nowrap text-xs">{fmtDate(t.createdAt)}</td>
                      <td className="px-3 py-2.5"><TxTypeBadge type={t.transactionType} /></td>
                      <td className="px-3 py-2.5 text-right font-semibold text-green-700">
                        {isIn ? `+${t.quantity.toLocaleString()}` : <span className="text-[#999] font-normal">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-red-600">
                        {!isIn ? `−${t.quantity.toLocaleString()}` : <span className="text-[#999] font-normal">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-[#333333]">
                        {t.balanceAfter.toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => onViewTransaction(t)}
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
        </div>
      )}

      <div className="flex justify-end border-t border-[#DBEFF3] pt-4">
        <Button variant="secondary" onClick={onViewBinCard}>View Bin Card</Button>
      </div>
    </div>
  )
}

function sortTxsDesc(txs: StockTransactionDto[]): StockTransactionDto[] {
  return [...txs].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

// ─── VIEW 3: Bin Card (GET /inventory/bin-card) ───────────────────────────────

function BinCardView({
  row, onBack,
}: {
  row: StockRow
  onBack: () => void
}) {
  const [card, setCard] = useState<BinCardResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [typeFilter, setTypeFilter] = useState("")

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError("")
    getBinCard({ productId: row.productId, batchId: row.batchId })
      .then((result) => { if (!cancelled) setCard(result) })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load the bin card.")
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [row.productId, row.batchId])

  const unit = useMemo(() => {
    const name = nameOf(card?.baseUnit, "")
    return name || row.unitName
  }, [card, row.unitName])

  const hasFilters = !!(fromDate || toDate || typeFilter)

  // Server returns in/out/balance per transaction. When the user narrows the
  // window client-side, recompute running balances from the server's opening.
  const ledger = useMemo(() => {
    const all = card?.transactions ?? []
    const filtered = all.filter((t) => {
      if (fromDate && t.date < fromDate) return false
      if (toDate && t.date > toDate) return false
      if (typeFilter && t.transactionType !== typeFilter) return false
      return true
    })
    let running = card?.openingBalance ?? 0
    return filtered.map((t) => {
      running += t.in - t.out
      return { ...t, runningBalance: running }
    })
  }, [card, fromDate, toDate, typeFilter])

  const openingBalance = card?.openingBalance ?? 0
  const closing = ledger.length ? ledger[ledger.length - 1].runningBalance : openingBalance

  const totals = useMemo(() => ({
    totalIn: ledger.reduce((a, t) => a + t.in, 0),
    totalOut: ledger.reduce((a, t) => a + t.out, 0),
  }), [ledger])

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-xs font-semibold text-[#49B0C1] hover:underline"
        >
          ← Back to Batch
        </button>
        <button
          onClick={() => window.print()}
          className="text-xs font-semibold text-[#666666] hover:text-[#333333]"
        >
          Print
        </button>
      </div>

      {/* Header */}
      <div className="rounded-xl bg-[#DBEFF3]/40 p-4">
        <p className="text-lg font-bold text-[#333333]">{row.productName}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
          <div>
            <p className="text-[#999]">Batch</p>
            <p className="font-mono font-semibold text-[#333333]">{row.batchNumber}</p>
          </div>
          <div>
            <p className="text-[#999]">Location</p>
            <p className="font-semibold text-[#333333]">{row.locationName}</p>
          </div>
          <div>
            <p className="text-[#999]">Unit</p>
            <p className="font-semibold text-[#333333]">{unit ? `${unit}s` : "—"}</p>
          </div>
          <div>
            <p className="text-[#999]">Expiry</p>
            <p className="font-semibold text-[#333333]">{fmtDate(row.expiryDate)}</p>
          </div>
        </div>
      </div>

      {/* Opening balance */}
      <div className="rounded-xl border border-[#DBEFF3] p-4 flex items-center justify-between bg-white">
        <span className="text-xs font-semibold text-[#666666] uppercase tracking-wide">Opening Balance</span>
        <span className="text-xl font-bold text-[#333333]">
          {openingBalance.toLocaleString()} {unit ? `${unit}s` : ""}
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[150px]">
          <label className="text-xs font-medium text-[#666666] block mb-1">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full rounded-xl border border-[#ABDBE3] px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none"
          />
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="text-xs font-medium text-[#666666] block mb-1">To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full rounded-xl border border-[#ABDBE3] px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none"
          />
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="text-xs font-medium text-[#666666] block mb-1">Movement Type</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full rounded-xl border border-[#ABDBE3] px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none"
          >
            <option value="">All Movements</option>
            {["RECEIPT","SALE","TRANSFER","ADJUSTMENT","OPENING","DISPOSAL","RETURN"].map((t) => (
              <option key={t} value={t}>{prettyType(t)}</option>
            ))}
          </select>
        </div>
        {hasFilters && (
          <button
            onClick={() => { setFromDate(""); setToDate(""); setTypeFilter("") }}
            className="text-xs font-semibold text-[#49B0C1] hover:underline pb-2"
          >
            Clear
          </button>
        )}
      </div>

      {/* Body */}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      ) : loading ? (
        <LoadingSkeleton />
      ) : (
        <div className="rounded-xl border border-[#DBEFF3] overflow-hidden">
          <div className="overflow-x-auto max-h-[45vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#DBEFF3] text-left">
                  <th className="px-3 py-2.5 font-semibold text-[#333333]">Date</th>
                  <th className="px-3 py-2.5 font-semibold text-[#333333]">Reference</th>
                  <th className="px-3 py-2.5 font-semibold text-[#333333]">Type</th>
                  <th className="px-3 py-2.5 font-semibold text-[#333333] text-right">IN</th>
                  <th className="px-3 py-2.5 font-semibold text-[#333333] text-right">OUT</th>
                  <th className="px-3 py-2.5 font-semibold text-[#333333] text-right">Balance</th>
                  <th className="px-3 py-2.5 font-semibold text-[#333333] text-right hidden lg:table-cell">Cost</th>
                </tr>
              </thead>
              <tbody>
                {ledger.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-sm text-[#999]">
                      No movements in the selected range.
                    </td>
                  </tr>
                ) : (
                  ledger.map((t, i) => (
                    <tr key={t.transactionId} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"}>
                      <td className="px-3 py-2.5 text-[#666666] whitespace-nowrap text-xs">{fmtDate(t.date)}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-[#666666]">{t.reference || "—"}</td>
                      <td className="px-3 py-2.5"><TxTypeBadge type={t.transactionType} /></td>
                      <td className="px-3 py-2.5 text-right font-semibold text-green-700">
                        {t.in > 0 ? t.in.toLocaleString() : <span className="text-[#999] font-normal">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-red-600">
                        {t.out > 0 ? t.out.toLocaleString() : <span className="text-[#999] font-normal">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-[#333333]">
                        {t.runningBalance.toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-right text-[#666666] hidden lg:table-cell">
                        {t.costPrice != null ? `${t.costPrice.toLocaleString()} ETB` : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Totals / closing */}
          <div className="border-t border-[#DBEFF3] bg-[#DBEFF3]/20">
            <div className="grid grid-cols-3 px-4 py-3 text-sm">
              <div>
                <p className="text-xs text-[#999]">Total IN</p>
                <p className="font-bold text-green-700">+{totals.totalIn.toLocaleString()} {unit ? `${unit}s` : ""}</p>
              </div>
              <div>
                <p className="text-xs text-[#999]">Total OUT</p>
                <p className="font-bold text-red-600">−{totals.totalOut.toLocaleString()} {unit ? `${unit}s` : ""}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#999]">Closing Balance</p>
                <p className="font-bold text-[#333333]">{closing.toLocaleString()} {unit ? `${unit}s` : ""}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Transaction Detail Modal ─────────────────────────────────────────────────

function TxDetailModal({
  tx, onClose,
}: {
  tx: TxDetail
  onClose: () => void
}) {
  const { direction } = tx
  const unit = tx.unitName
  const isIn = direction === "IN"

  return (
    <Modal open title="Stock Movement" onClose={onClose} size="md">
      <div className="flex flex-col gap-4">
        {/* Type + direction */}
        <div className="flex items-center gap-3">
          <TxTypeBadge type={tx.type} />
          <span className={`text-xs font-bold rounded-full px-2.5 py-0.5 ${isIn ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            {direction}
          </span>
        </div>

        {/* Big quantity box */}
        <div className={`rounded-xl border p-4 flex items-center justify-between ${isIn ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
          <div>
            <p className="text-xs font-semibold text-[#666666] uppercase tracking-wide">Movement</p>
            <p className="text-xs text-[#999] mt-0.5">{direction === "IN" ? "Stock In" : "Stock Out"}</p>
          </div>
          <p className={`text-2xl font-bold ${isIn ? "text-green-700" : "text-red-700"}`}>
            {isIn ? "+" : "−"}{tx.quantity.toLocaleString()} <span className="text-sm font-medium">{unit ? `${unit}s` : ""}</span>
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
          <Row label="Quantity" value={`${tx.quantity.toLocaleString()} ${unit ? `${unit}s` : ""}`.trim()} />
          <Row label="Balance After" value={`${tx.balanceAfter.toLocaleString()} ${unit ? `${unit}s` : ""}`.trim()} />
        </Section>

        {/* Reference & audit */}
        <Section title="Reference & Audit">
          <Row label="Reference" value={tx.reference} mono />
          {tx.notes && <Row label="Notes" value={tx.notes} />}
          <Row label="Created By" value={tx.userName} />
        </Section>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 justify-end border-t border-[#DBEFF3] pt-4">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Add Stock Modal (POST /inventory/opening-stock) ──────────────────────────

function AddStockModal({
  open, onClose, onCreated,
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
  const [units, setUnits] = useState<{ unitId: string; name: string; isBaseUnit: boolean }[]>([])
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
            .filter((l) => l.isActive)
            .map((l) => ({ id: l.id, name: l.name })),
        )
      })
      .catch((err) => {
        if (!cancelled) setOptionsError(err instanceof Error ? err.message : "Failed to load form options.")
      })
      .finally(() => { if (!cancelled) setOptionsLoading(false) })
    return () => { cancelled = true }
  }, [open, productOptions.length])

  useEffect(() => {
    if (!productId) { setBatches([]); setUnits([]); setBatchId(""); setUnitId(""); return }
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
        if (!cancelled) { setBatches([]); setUnits([]) }
      })
      .finally(() => { if (!cancelled) setBatchesLoading(false) })
    return () => { cancelled = true }
  }, [productId])

  async function handleSubmit() {
    if (!productId || !batchId || !locationId || !qty) return
    const quantity = parseInt(qty)
    if (!quantity || quantity <= 0) { setError("Quantity must be a positive number."); return }
    if (!unitId) { setError("Please select a unit."); return }
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
      setError(err instanceof Error ? err.message : "Failed to record opening stock. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const selectedProduct = productOptions.find((p) => p.id === productId)

  return (
    <Modal open={open} title="Add Opening Stock" onClose={onClose} size="md">
      <p className="text-sm text-[#666666] -mt-2 mb-4">Add stock already physically available in the pharmacy.</p>
      <div className="flex flex-col gap-4">
        {(error || optionsError) && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error || optionsError}</p>
        )}

        <div>
          <label className="text-sm font-medium text-[#333333] block mb-1.5">Product</label>
          <select
            value={productId}
            onChange={(e) => { setProductId(e.target.value); setBatchId("") }}
            className="w-full rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm focus:border-[#49B0C1] focus:outline-none"
            disabled={optionsLoading}
          >
            <option value="">{optionsLoading ? "Loading products..." : "Select product..."}</option>
            {productOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-[#333333] block mb-1.5">Batch</label>
          <select
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            className="w-full rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm focus:border-[#49B0C1] focus:outline-none"
            disabled={!productId || batchesLoading}
          >
            <option value="">{batchesLoading ? "Loading batches..." : "Select batch..."}</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.batchNumber}{b.expiryDate ? ` — expires ${fmtDate(b.expiryDate)}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-[#333333] block mb-1.5">Location</label>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="w-full rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm focus:border-[#49B0C1] focus:outline-none"
            disabled={optionsLoading}
          >
            <option value="">{optionsLoading ? "Loading locations..." : "Select location..."}</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Quantity" type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" />
          <div>
            <label className="text-sm font-medium text-[#333333] block mb-1.5">Unit</label>
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              className="w-full rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm focus:border-[#49B0C1] focus:outline-none"
              disabled={!productId || units.length === 0}
            >
              {units.length === 0 ? (
                <option value="">{productId ? "No units configured" : "Select product first"}</option>
              ) : (
                units.map((u) => (
                  <option key={u.unitId} value={u.unitId}>
                    {u.name}{u.isBaseUnit ? " (base)" : ""}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
        {selectedProduct && (
          <p className="text-xs text-[#999]">Base unit for {selectedProduct.name}: {selectedProduct.baseUnit || "—"}</p>
        )}
        <div>
          <label className="text-sm font-medium text-[#333333] block mb-1.5">Notes</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Initial physical stock..." className="w-full rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm resize-none focus:border-[#49B0C1] focus:outline-none" />
        </div>
        <div className="flex gap-3 justify-end border-t border-[#DBEFF3] pt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={submitting} disabled={!productId || !batchId || !locationId || !qty}>Add Stock</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Adjust Stock Modal (POST /inventory/stock-adjustments — schema pending) ──

function AdjustStockModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  // NOTE: The exact POST /stock-adjustments request/response schema is not
  // confirmed yet, so this modal intentionally does NOT submit to the backend.
  // Wire it through stockApi.createStockAdjustment once the Swagger definition
  // is available.
  const [productId, setProductId] = useState("")
  const [batchId, setBatchId] = useState("")
  const [batches, setBatches] = useState<BatchDto[]>([])
  const [adjustment, setAdjustment] = useState("")
  const [reason, setReason] = useState("")
  const [notes, setNotes] = useState("")

  const [productOptions, setProductOptions] = useState<ProductOption[]>([])
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])
  const [locationId, setLocationId] = useState("")

  useEffect(() => {
    if (!open || productOptions.length > 0) return
    Promise.all([fetchProductOptions(), listLocations({ limit: 100 })])
      .then(([opts, locs]) => {
        setProductOptions(opts)
        setLocations(locs.data.filter((l) => l.isActive).map((l) => ({ id: l.id, name: l.name })))
      })
      .catch(() => {})
  }, [open, productOptions.length])

  useEffect(() => {
    if (!productId) { setBatches([]); setBatchId(""); return }
    let cancelled = false
    listProductBatches(productId, { limit: 100 })
      .then((b) => { if (!cancelled) setBatches(b.data) })
      .catch(() => { if (!cancelled) setBatches([]) })
    return () => { cancelled = true }
  }, [productId])

  const selectedBatch = batches.find((b) => b.id === batchId)
  const product = productOptions.find((p) => p.id === productId)
  const currentStock = selectedBatch?.totalQuantity ?? 0
  const adjNum = parseInt(adjustment) || 0
  const newStock = Math.max(0, currentStock + adjNum)

  function handleSubmit() {
    // Pending Swagger: show a notice instead of calling the backend with an
    // invented payload.
    onClose()
  }

  return (
    <Modal open={open} title="Adjust Stock" onClose={onClose} size="md">
      <p className="text-sm text-[#666666] -mt-2 mb-4">Correct recorded quantity after a physical stock count or other correction.</p>
      <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700 mb-4">
        Stock adjustments aren&apos;t submitted yet — the exact POST
        /stock-adjustments request schema is pending Swagger confirmation.
      </div>
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium text-[#333333] block mb-1.5">Product</label>
          <select value={productId} onChange={(e) => { setProductId(e.target.value); setBatchId("") }} className="w-full rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm focus:border-[#49B0C1] focus:outline-none">
            <option value="">Select product...</option>
            {productOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-[#333333] block mb-1.5">Batch</label>
          <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="w-full rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm focus:border-[#49B0C1] focus:outline-none" disabled={!productId}>
            <option value="">Select batch...</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.batchNumber}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-[#333333] block mb-1.5">Location</label>
          <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="w-full rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm focus:border-[#49B0C1] focus:outline-none">
            <option value="">Select location...</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>

        {selectedBatch && (
          <div className="rounded-xl bg-[#DBEFF3]/50 px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-[#666666]">Current Stock</span>
            <span className="text-sm font-bold text-[#333333]">{currentStock.toLocaleString()} {product?.baseUnit ? `${product.baseUnit}s` : ""}</span>
          </div>
        )}

        <Input
          label="Adjustment (use − for reduction, + for addition)"
          type="number"
          value={adjustment}
          onChange={(e) => setAdjustment(e.target.value)}
          placeholder="e.g. -5 or +10"
        />

        {adjustment && selectedBatch && (
          <div className={`rounded-xl px-4 py-3 flex items-center justify-between ${adjNum >= 0 ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
            <span className="text-sm text-[#666666]">New Stock</span>
            <span className={`text-sm font-bold ${adjNum >= 0 ? "text-green-700" : "text-red-700"}`}>{newStock.toLocaleString()} {product?.baseUnit ? `${product.baseUnit}s` : ""}</span>
          </div>
        )}

        <div>
          <label className="text-sm font-medium text-[#333333] block mb-1.5">Reason</label>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm focus:border-[#49B0C1] focus:outline-none">
            <option value="">Select reason...</option>
            <option>Physical Count Correction</option>
            <option>Damage / Breakage</option>
            <option>Theft / Loss</option>
            <option>System Error Correction</option>
            <option>Other</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-[#333333] block mb-1.5">Notes</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm resize-none focus:border-[#49B0C1] focus:outline-none" placeholder="Add context about this adjustment..." />
        </div>
        <div className="flex gap-3 justify-end border-t border-[#DBEFF3] pt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!productId || !batchId || !adjustment || !reason}>Save Adjustment</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Shared components ────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#DBEFF3] overflow-hidden">
      <div className="px-4 py-2.5 bg-[#DBEFF3]/50">
        <p className="text-xs font-semibold text-[#666666] uppercase tracking-wide">{title}</p>
      </div>
      <div className="divide-y divide-[#DBEFF3]">{children}</div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-xs text-[#999]">{label}</span>
      <span className={`text-sm font-medium text-[#333333] ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  )
}

function SmallCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="bg-white rounded-xl border border-[#DBEFF3] p-4">
      <p className="text-xs font-medium text-[#666666] uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent ?? "text-[#333333]"}`}>{value}</p>
      {sub && <p className="text-xs text-[#999] mt-0.5">{sub}</p>}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-3 animate-pulse">
      {[...Array(6)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-[#DBEFF3]" />)}
    </div>
  )
}
