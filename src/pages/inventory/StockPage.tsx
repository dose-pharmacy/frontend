import { useEffect, useMemo, useState } from "react"
import {
  getProducts,
  getBatches,
  getAllTransactions,
} from "../../features/inventory/inventoryService"
import type { Product, Batch, Transaction } from "../../features/inventory/inventoryMock"
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

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function BatchStatusLabel(status: string): { label: string; cls: string } {
  const map: Record<string, { label: string; cls: string }> = {
    available: { label: "Available", cls: "bg-green-100 text-green-700" },
    low_stock:  { label: "Low Stock",  cls: "bg-orange-100 text-orange-700" },
    depleted:   { label: "Depleted",   cls: "bg-red-100 text-red-700" },
    expired:    { label: "Expired",    cls: "bg-gray-100 text-gray-500" },
  }
  return map[status] ?? { label: status, cls: "bg-gray-100 text-gray-600" }
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
  }
  return (
    <span className={`text-xs font-semibold rounded-full px-2 py-0.5 capitalize ${map[type] ?? "bg-gray-100 text-gray-600"}`}>
      {type}
    </span>
  )
}

const IN_TYPES = ["received", "opening", "return"]
const isInType = (t: string) => IN_TYPES.includes(t)

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StockPage() {
  const [tab, setTab] = useState<Tab>("stock")
  const [products, setProducts] = useState<Product[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  // modals
  const [addStockOpen, setAddStockOpen] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [stockDetail, setStockDetail] = useState<Batch | null>(null)
  const [txDetail, setTxDetail] = useState<Transaction | null>(null)

  useEffect(() => {
    Promise.all([getProducts(), getBatches(), getAllTransactions()]).then(([p, b, t]) => {
      setProducts(p)
      setBatches(b)
      setTransactions(t)
      setLoading(false)
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
            loading={loading}
            batches={batches}
            productById={productById}
            onViewDetail={setStockDetail}
          />
        ) : (
          <MovementsTab
            loading={loading}
            transactions={transactions}
            productById={productById}
            onViewDetail={setTxDetail}
          />
        )}
      </div>

      {/* Modals */}
      <AddStockModal open={addStockOpen} products={products} batches={batches} onClose={() => setAddStockOpen(false)} />
      <AdjustStockModal open={adjustOpen} products={products} batches={batches} onClose={() => setAdjustOpen(false)} />
      {stockDetail && (
        <StockDetailModal
          batch={stockDetail}
          product={productById(stockDetail.productId)}
          allBatches={batches}
          transactions={transactions}
          productById={productById}
          onClose={() => setStockDetail(null)}
          onOpenTransaction={(t) => { setStockDetail(null); setTxDetail(t) }}
        />
      )}
      {txDetail && (
        <TxDetailModal
          tx={txDetail}
          product={productById(txDetail.productId)}
          batch={batches.find((b) => b.id === txDetail.batchId)}
          onClose={() => setTxDetail(null)}
          onOpenBinCard={(batch, product) => {
            setTxDetail(null)
            setStockDetail(batch)
          }}
        />
      )}
    </div>
  )
}

// ─── Current Stock Tab ────────────────────────────────────────────────────────

function CurrentStockTab({
  loading, batches, productById, onViewDetail,
}: {
  loading: boolean
  batches: Batch[]
  productById: (id: string) => Product | undefined
  onViewDetail: (b: Batch) => void
}) {
  const [search, setSearch] = useState("")
  const [locationFilter, setLocationFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [page, setPage] = useState(1)

  const locations = useMemo(() => [...new Set(batches.map((b) => b.location))], [batches])

  const filtered = useMemo(() => {
    let rows = batches.filter((b) => b.status !== "expired")
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter((b) => {
        const p = productById(b.productId)
        return (
          p?.name.toLowerCase().includes(q) ||
          p?.sku?.toLowerCase().includes(q) ||
          b.batchNumber.toLowerCase().includes(q)
        )
      })
    }
    if (locationFilter) rows = rows.filter((b) => b.location === locationFilter)
    if (statusFilter)   rows = rows.filter((b) => b.status === statusFilter)
    return rows
  }, [batches, search, locationFilter, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const summary = useMemo(() => ({
    total:     batches.reduce((a, b) => a + b.quantity, 0),
    available: batches.filter((b) => b.status === "available").reduce((a, b) => a + b.quantity, 0),
    lowStock:  batches.filter((b) => b.status === "low_stock").length,
    depleted:  batches.filter((b) => b.status === "depleted").length,
  }), [batches])

  function reset() { setSearch(""); setLocationFilter(""); setStatusFilter(""); setPage(1) }

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SmallCard label="Total Stock" value={summary.total.toLocaleString()} sub="Base units" />
        <SmallCard label="Available" value={summary.available.toLocaleString()} sub="Units" accent="text-green-600" />
        <SmallCard label="Low Stock" value={summary.lowStock} sub="Batches" accent="text-orange-600" />
        <SmallCard label="Depleted" value={summary.depleted} sub="Batches" accent="text-red-600" />
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
            <option value="low_stock">Low Stock</option>
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
        {loading ? <LoadingSkeleton /> : filtered.length === 0 ? (
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
                  {paginated.map((b, i) => {
                    const p = productById(b.productId)
                    const s = BatchStatusLabel(b.status)
                    return (
                      <tr key={b.id} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#333333]">{p?.name ?? b.productId}</p>
                          {p?.sku && <p className="text-xs text-[#999] font-mono">{p.sku}</p>}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[#666666]">{b.batchNumber}</td>
                        <td className="px-4 py-3 text-[#666666] hidden sm:table-cell">{b.location}</td>
                        <td className="px-4 py-3 text-right font-bold text-[#333333]">{b.quantity.toLocaleString()}</td>
                        <td className="px-4 py-3 text-[#666666] hidden md:table-cell">{p?.baseUnit ?? ""}s</td>
                        <td className="px-4 py-3 text-[#666666] hidden lg:table-cell">{fmtDate(b.expiryDate)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold rounded-full px-2.5 py-0.5 ${s.cls}`}>{s.label}</span>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => onViewDetail(b)} className="text-xs font-semibold text-[#49B0C1] hover:underline">View</button>
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
              <Pagination page={page} totalPages={Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>
    </>
  )
}

// ─── Stock Movements Tab ──────────────────────────────────────────────────────

function MovementsTab({
  loading, transactions, productById, onViewDetail,
}: {
  loading: boolean
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
  }, [transactions, search, typeFilter, locationFilter])

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
        {loading ? <LoadingSkeleton /> : filtered.length === 0 ? (
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
  batch, product, allBatches, transactions, productById, onClose, onOpenTransaction,
}: {
  batch: Batch
  product?: Product
  allBatches: Batch[]
  transactions: Transaction[]
  productById: (id: string) => Product | undefined
  onClose: () => void
  onOpenTransaction: (t: Transaction) => void
}) {
  const [view, setView] = useState<StockView>("batch")

  // Transactions relevant to this product (and this batch where possible)
  const productTxs = useMemo(
    () =>
      transactions
        .filter((t) => t.productId === batch.productId)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [transactions, batch.productId],
  )

  const batchTxs = useMemo(
    () => productTxs.filter((t) => t.batchId === batch.id),
    [productTxs, batch.id],
  )

  return (
    <Modal
      open
      title={view === "batch" ? "Stock Detail" : view === "transactions" ? "Batch Transactions" : "Bin Card"}
      onClose={onClose}
      size={view === "bincard" ? "lg" : "md"}
    >
      {view === "batch" && (
        <BatchDetailView
          batch={batch}
          product={product}
          allBatches={allBatches}
          onViewTransactions={() => setView("transactions")}
          onViewBinCard={() => setView("bincard")}
        />
      )}

      {view === "transactions" && (
        <BatchTransactionsView
          batch={batch}
          product={product}
          transactions={batchTxs.length ? batchTxs : productTxs}
          onBack={() => setView("batch")}
          onViewTransaction={onOpenTransaction}
          onViewBinCard={() => setView("bincard")}
        />
      )}

      {view === "bincard" && (
        <BinCardView
          batch={batch}
          product={product}
          allBatches={allBatches}
          transactions={productTxs}
          productById={productById}
          onBack={() => setView("batch")}
        />
      )}
    </Modal>
  )
}

// ─── VIEW 1: Batch Details ────────────────────────────────────────────────────

function BatchDetailView({
  batch, product, allBatches, onViewTransactions, onViewBinCard,
}: {
  batch: Batch
  product?: Product
  allBatches: Batch[]
  onViewTransactions: () => void
  onViewBinCard: () => void
}) {
  const s = BatchStatusLabel(batch.status)

  // Stock of this batch across all locations
  const locationsForBatch = useMemo(() => {
    const groups = new Map<string, { location: string; qty: number }>()
    // Match by batchNumber (same physical batch) across locations
    allBatches
      .filter((b) => b.batchNumber === batch.batchNumber)
      .forEach((b) => {
        const existing = groups.get(b.location)
        if (existing) existing.qty += b.quantity
        else groups.set(b.location, { location: b.location, qty: b.quantity })
      })
    return Array.from(groups.values())
  }, [allBatches, batch.batchNumber])

  const totalQty = locationsForBatch.reduce((a, l) => a + l.qty, 0)

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <p className="text-lg font-bold text-[#333333]">{product?.name ?? batch.productId}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs font-mono text-[#666666]">{batch.batchNumber}</span>
          <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${s.cls}`}>{s.label}</span>
        </div>
      </div>

      {/* Product */}
      <Section title="Product">
        <Row label="Name" value={product?.name ?? batch.productId} />
        <Row label="SKU" value={product?.sku ?? "—"} mono />
        <Row label="Base Unit" value={product?.baseUnit ?? "—"} />
      </Section>

      {/* Batch info */}
      <Section title="Batch Information">
        <Row label="Batch Number" value={batch.batchNumber} mono />
        <Row label="Received Date" value={fmtDate(batch.receivedDate)} />
        <Row label="Expiry Date" value={fmtDate(batch.expiryDate)} />
      </Section>

      {/* Stock */}
      <Section title="Stock">
        <Row label="Total Quantity" value={`${totalQty.toLocaleString()} ${product?.baseUnit ?? ""}s`} />
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

      {/* Purchase */}
      <Section title="Purchase Information">
        <Row label="Purchase Cost" value={batch.purchaseCost ? `${batch.purchaseCost.toLocaleString()} ETB` : "—"} />
        <Row label="Supplier" value={batch.supplier || "—"} />
      </Section>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 border-t border-[#DBEFF3] pt-4">
        <Button variant="secondary" onClick={onViewTransactions}>View Transactions</Button>
        <Button variant="secondary" onClick={onViewBinCard}>View Bin Card</Button>
      </div>
    </div>
  )
}

// ─── VIEW 2: Batch Transactions ───────────────────────────────────────────────

function BatchTransactionsView({
  batch, product, transactions, onBack, onViewTransaction, onViewBinCard,
}: {
  batch: Batch
  product?: Product
  transactions: Transaction[]
  onBack: () => void
  onViewTransaction: (t: Transaction) => void
  onViewBinCard: () => void
}) {
  const sorted = useMemo(
    () => [...transactions].sort((a, b) => b.date.localeCompare(a.date)),
    [transactions],
  )

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={onBack}
        className="self-start text-xs font-semibold text-[#49B0C1] hover:underline"
      >
        ← Back to Batch
      </button>

      <div>
        <p className="text-sm font-bold text-[#333333]">{product?.name ?? batch.productId}</p>
        <p className="text-xs font-mono text-[#666666] mt-0.5">{batch.batchNumber}</p>
      </div>

      {sorted.length === 0 ? (
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
                {sorted.map((t, i) => {
                  const isIn = isInType(t.type)
                  return (
                    <tr key={t.id} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"}>
                      <td className="px-3 py-2.5 text-[#666666] whitespace-nowrap text-xs">{fmtDate(t.date)}</td>
                      <td className="px-3 py-2.5"><TxTypeBadge type={t.type} /></td>
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

// ─── VIEW 3: Bin Card ─────────────────────────────────────────────────────────

function BinCardView({
  batch, product, allBatches, transactions, productById, onBack,
}: {
  batch: Batch
  product?: Product
  allBatches: Batch[]
  transactions: Transaction[]
  productById: (id: string) => Product | undefined
  onBack: () => void
}) {
  const unit = product?.baseUnit ?? ""
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [typeFilter, setTypeFilter] = useState("")

  // Build ledger from all transactions for this product, sorted ascending
  const ledger = useMemo(() => {
    let rows = [...transactions].sort((a, b) => a.date.localeCompare(b.date))
    if (fromDate) rows = rows.filter((t) => t.date >= fromDate)
    if (toDate)   rows = rows.filter((t) => t.date <= toDate)
    if (typeFilter) rows = rows.filter((t) => t.type === typeFilter)
    return rows
  }, [transactions, fromDate, toDate, typeFilter])

  // Opening balance = balanceAfter of the last tx before the filtered window
  const openingBalance = useMemo(() => {
    const allSorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))
    if (fromDate) {
      const before = allSorted.filter((t) => t.date < fromDate)
      return before.length ? before[before.length - 1].balanceAfter : 0
    }
    return allSorted.length ? allSorted[0].balanceAfter - (isInType(allSorted[0].type) ? allSorted[0].quantity : -allSorted[0].quantity) : 0
  }, [transactions, fromDate])

  // Compute running balances for the filtered window
  const withRunning = useMemo(() => {
    let running = openingBalance
    return ledger.map((t) => {
      running += isInType(t.type) ? t.quantity : -t.quantity
      return { ...t, runningBalance: running }
    })
  }, [ledger, openingBalance])

  const closing = withRunning.length ? withRunning[withRunning.length - 1].runningBalance : openingBalance

  const totals = useMemo(() => {
    const totalIn  = withRunning.filter((t) => isInType(t.type)).reduce((a, t) => a + t.quantity, 0)
    const totalOut = withRunning.filter((t) => !isInType(t.type)).reduce((a, t) => a + t.quantity, 0)
    return { totalIn, totalOut }
  }, [withRunning])

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
        <p className="text-lg font-bold text-[#333333]">{product?.name ?? batch.productId}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
          <div>
            <p className="text-[#999]">Batch</p>
            <p className="font-mono font-semibold text-[#333333]">{batch.batchNumber}</p>
          </div>
          <div>
            <p className="text-[#999]">Location</p>
            <p className="font-semibold text-[#333333]">{batch.location}</p>
          </div>
          <div>
            <p className="text-[#999]">Unit</p>
            <p className="font-semibold text-[#333333]">{unit}s</p>
          </div>
          <div>
            <p className="text-[#999]">Expiry</p>
            <p className="font-semibold text-[#333333]">{fmtDate(batch.expiryDate)}</p>
          </div>
        </div>
      </div>

      {/* Opening balance */}
      <div className="rounded-xl border border-[#DBEFF3] p-4 flex items-center justify-between bg-white">
        <span className="text-xs font-semibold text-[#666666] uppercase tracking-wide">Opening Balance</span>
        <span className="text-xl font-bold text-[#333333]">
          {openingBalance.toLocaleString()} {unit}s
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
            {["received","sale","transfer","adjustment","opening","disposal","return"].map((t) => (
              <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
        {(fromDate || toDate || typeFilter) && (
          <button
            onClick={() => { setFromDate(""); setToDate(""); setTypeFilter("") }}
            className="text-xs font-semibold text-[#49B0C1] hover:underline pb-2"
          >
            Clear
          </button>
        )}
      </div>

      {/* Ledger table */}
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
              </tr>
            </thead>
            <tbody>
              {withRunning.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-[#999]">
                    No movements in the selected range.
                  </td>
                </tr>
              ) : (
                withRunning.map((t, i) => {
                  const isIn = isInType(t.type)
                  return (
                    <tr key={t.id} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"}>
                      <td className="px-3 py-2.5 text-[#666666] whitespace-nowrap text-xs">{fmtDate(t.date)}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-[#666666]">{t.reference}</td>
                      <td className="px-3 py-2.5"><TxTypeBadge type={t.type} /></td>
                      <td className="px-3 py-2.5 text-right font-semibold text-green-700">
                        {isIn ? t.quantity.toLocaleString() : <span className="text-[#999] font-normal">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-red-600">
                        {!isIn ? t.quantity.toLocaleString() : <span className="text-[#999] font-normal">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-[#333333]">
                        {t.runningBalance.toLocaleString()}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Totals / closing */}
        <div className="border-t border-[#DBEFF3] bg-[#DBEFF3]/20">
          <div className="grid grid-cols-3 px-4 py-3 text-sm">
            <div>
              <p className="text-xs text-[#999]">Total IN</p>
              <p className="font-bold text-green-700">+{totals.totalIn.toLocaleString()} {unit}s</p>
            </div>
            <div>
              <p className="text-xs text-[#999]">Total OUT</p>
              <p className="font-bold text-red-600">−{totals.totalOut.toLocaleString()} {unit}s</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#999]">Closing Balance</p>
              <p className="font-bold text-[#333333]">{closing.toLocaleString()} {unit}s</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Transaction Detail Modal ─────────────────────────────────────────────────

function TxDetailModal({
  tx, product, batch, onClose, onOpenBinCard,
}: {
  tx: Transaction
  product?: Product
  batch?: Batch
  onClose: () => void
  onOpenBinCard: (batch: Batch, product?: Product) => void
}) {
  const direction = isInType(tx.type) ? "IN" : "OUT"
  const unit = product?.baseUnit ?? ""
  const isIn = isInType(tx.type)

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
            {isIn ? "+" : "−"}{tx.quantity.toLocaleString()} <span className="text-sm font-medium">{unit}s</span>
          </p>
        </div>

        {/* Transaction info */}
        <Section title="Transaction Information">
          <Row label="Transaction ID" value={tx.id} mono />
          <Row label="Type" value={tx.type.charAt(0).toUpperCase() + tx.type.slice(1)} />
          <Row label="Direction" value={direction} />
          <Row label="Date" value={fmtDateTime(tx.date)} />
        </Section>

        {/* Product info */}
        <Section title="Product Information">
          <Row label="Product" value={product?.name ?? tx.productId} />
          <Row label="Batch" value={batch?.batchNumber ?? "—"} mono />
          <Row label="Base Unit" value={unit || "—"} />
        </Section>

        {/* Stock info */}
        <Section title="Stock Information">
          <Row label="Location" value={tx.location} />
          <Row label="Quantity" value={`${tx.quantity.toLocaleString()} ${unit}s`} />
          <Row label="Balance After" value={`${tx.balanceAfter.toLocaleString()} ${unit}s`} />
        </Section>

        {/* Reference & audit */}
        <Section title="Reference & Audit">
          <Row label="Reference" value={tx.reference} mono />
          <Row label="Created By" value={tx.user} />
        </Section>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 justify-end border-t border-[#DBEFF3] pt-4">
          {batch && (
            <Button variant="secondary" onClick={() => onOpenBinCard(batch, product)}>
              View Bin Card
            </Button>
          )}
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Add Stock Modal ──────────────────────────────────────────────────────────

function AddStockModal({ open, products, batches, onClose }: { open: boolean; products: Product[]; batches: Batch[]; onClose: () => void }) {
  const [productId, setProductId] = useState("")
  const [batchId, setBatchId] = useState("")
  const [location, setLocation] = useState("Main Store")
  const [qty, setQty] = useState("")
  const [unit, setUnit] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)

  const productBatches = batches.filter((b) => b.productId === productId)
  const selectedProduct = products.find((p) => p.id === productId)

  async function handleSubmit() {
    if (!productId || !qty || !location) return
    setLoading(true)
    await new Promise((r) => setTimeout(r, 800))
    setLoading(false)
    onClose()
    alert("Opening stock recorded (mock). Backend integration pending.")
  }

  return (
    <Modal open={open} title="Add Opening Stock" onClose={onClose} size="md">
      <p className="text-sm text-[#666666] -mt-2 mb-4">Add stock already physically available in the pharmacy.</p>
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium text-[#333333] block mb-1.5">Product</label>
          <select value={productId} onChange={(e) => { setProductId(e.target.value); setBatchId("") }} className="w-full rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm focus:border-[#49B0C1] focus:outline-none">
            <option value="">Select product...</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-[#333333] block mb-1.5">Batch</label>
          <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="w-full rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm focus:border-[#49B0C1] focus:outline-none" disabled={!productId}>
            <option value="">Select batch...</option>
            {productBatches.map((b) => <option key={b.id} value={b.id}>{b.batchNumber}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-[#333333] block mb-1.5">Location</label>
          <select value={location} onChange={(e) => setLocation(e.target.value)} className="w-full rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm focus:border-[#49B0C1] focus:outline-none">
            <option>Main Store</option>
            <option>Dispensing Area</option>
            <option>Cold Storage</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Quantity" type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" />
          <div>
            <label className="text-sm font-medium text-[#333333] block mb-1.5">Unit</label>
            <select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm focus:border-[#49B0C1] focus:outline-none">
              <option value="">{selectedProduct?.baseUnit ?? "Select unit"}</option>
              <option>Strip</option>
              <option>Box</option>
              <option>Bottle</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-[#333333] block mb-1.5">Notes</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Initial physical stock..." className="w-full rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm resize-none focus:border-[#49B0C1] focus:outline-none" />
        </div>
        <div className="flex gap-3 justify-end border-t border-[#DBEFF3] pt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={loading} disabled={!productId || !qty}>Add Stock</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Adjust Stock Modal ───────────────────────────────────────────────────────

function AdjustStockModal({ open, products, batches, onClose }: { open: boolean; products: Product[]; batches: Batch[]; onClose: () => void }) {
  const [productId, setProductId] = useState("")
  const [batchId, setBatchId] = useState("")
  const [location, setLocation] = useState("Main Store")
  const [adjustment, setAdjustment] = useState("")
  const [reason, setReason] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)

  const productBatches = batches.filter((b) => b.productId === productId)
  const selectedBatch = batches.find((b) => b.id === batchId)
  const product = products.find((p) => p.id === productId)
  const currentStock = selectedBatch?.quantity ?? 0
  const adjNum = parseInt(adjustment) || 0
  const newStock = Math.max(0, currentStock + adjNum)

  async function handleSubmit() {
    if (!productId || !batchId || !adjustment || !reason) return
    setLoading(true)
    await new Promise((r) => setTimeout(r, 800))
    setLoading(false)
    onClose()
    alert("Stock adjustment recorded (mock). Backend integration pending.")
  }

  return (
    <Modal open={open} title="Adjust Stock" onClose={onClose} size="md">
      <p className="text-sm text-[#666666] -mt-2 mb-4">Correct recorded quantity after a physical stock count or other correction.</p>
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-sm font-medium text-[#333333] block mb-1.5">Product</label>
          <select value={productId} onChange={(e) => { setProductId(e.target.value); setBatchId("") }} className="w-full rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm focus:border-[#49B0C1] focus:outline-none">
            <option value="">Select product...</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-[#333333] block mb-1.5">Batch</label>
          <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="w-full rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm focus:border-[#49B0C1] focus:outline-none" disabled={!productId}>
            <option value="">Select batch...</option>
            {productBatches.map((b) => <option key={b.id} value={b.id}>{b.batchNumber}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-[#333333] block mb-1.5">Location</label>
          <select value={location} onChange={(e) => setLocation(e.target.value)} className="w-full rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm focus:border-[#49B0C1] focus:outline-none">
            <option>Main Store</option>
            <option>Dispensing Area</option>
            <option>Cold Storage</option>
          </select>
        </div>

        {selectedBatch && (
          <div className="rounded-xl bg-[#DBEFF3]/50 px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-[#666666]">Current Stock</span>
            <span className="text-sm font-bold text-[#333333]">{currentStock.toLocaleString()} {product?.baseUnit ?? ""}s</span>
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
            <span className={`text-sm font-bold ${adjNum >= 0 ? "text-green-700" : "text-red-700"}`}>{newStock.toLocaleString()} {product?.baseUnit ?? ""}s</span>
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
          <Button onClick={handleSubmit} loading={loading} disabled={!productId || !batchId || !adjustment || !reason}>Save Adjustment</Button>
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