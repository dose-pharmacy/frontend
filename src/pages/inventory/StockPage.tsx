import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router"
import {
  getProducts,
  getBatches,
  getAllTransactions,
} from "../../features/inventory/inventoryService"
import type { Product, Batch, Transaction } from "../../features/inventory/inventoryMock"
import SearchInput from "../../components/ui/SearchInput"
import Select from "../../components/ui/Select"
import Pagination from "../../components/ui/Pagination"
import EmptyState from "../../components/ui/EmptyState"
import PageHeader from "../../components/ui/PageHeader"

const PAGE_SIZE = 10

type Tab = "stock" | "movements"

export default function StockPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>("stock")
  const [products, setProducts] = useState<Product[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  // Stock tab filters
  const [stockSearch, setStockSearch] = useState("")
  const [locationFilter, setLocationFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [stockPage, setStockPage] = useState(1)

  // Movements tab filters
  const [movSearch, setMovSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [movPage, setMovPage] = useState(1)

  useEffect(() => {
    Promise.all([getProducts(), getBatches(), getAllTransactions()]).then(
      ([p, b, t]) => {
        setProducts(p)
        setBatches(b.filter((x) => x.status !== "expired"))
        setTransactions(t)
        setLoading(false)
      }
    )
  }, [])

  function productById(id: string) {
    return products.find((p) => p.id === id)
  }

  // Current Stock — one row per non-expired batch
  const stockRows = useMemo(() => {
    let rows = batches
    if (stockSearch) {
      const q = stockSearch.toLowerCase()
      rows = rows.filter((b) => {
        const p = productById(b.productId)
        return (
          p?.name.toLowerCase().includes(q) ||
          b.batchNumber.toLowerCase().includes(q)
        )
      })
    }
    if (locationFilter)
      rows = rows.filter((b) => b.location === locationFilter)
    if (statusFilter)
      rows = rows.filter((b) => b.status === statusFilter)
    return rows
  }, [batches, stockSearch, locationFilter, statusFilter, products])

  const stockTotalPages = Math.max(1, Math.ceil(stockRows.length / PAGE_SIZE))
  const stockPaginated = stockRows.slice(
    (stockPage - 1) * PAGE_SIZE,
    stockPage * PAGE_SIZE
  )

  const locations = useMemo(
    () => [...new Set(batches.map((b) => b.location))],
    [batches]
  )

  // Movements
  const movRows = useMemo(() => {
    let rows = transactions
    if (movSearch) {
      const q = movSearch.toLowerCase()
      rows = rows.filter((t) => {
        const p = productById(t.productId)
        return (
          p?.name.toLowerCase().includes(q) ||
          t.reference.toLowerCase().includes(q)
        )
      })
    }
    if (typeFilter) rows = rows.filter((t) => t.type === typeFilter)
    return rows
  }, [transactions, movSearch, typeFilter, products])

  const movTotalPages = Math.max(1, Math.ceil(movRows.length / PAGE_SIZE))
  const movPaginated = movRows.slice(
    (movPage - 1) * PAGE_SIZE,
    movPage * PAGE_SIZE
  )

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
  }

  function batchStatusBadge(status: string) {
    const map: Record<string, string> = {
      available: "bg-green-100 text-green-700",
      low_stock: "bg-yellow-100 text-yellow-700",
      depleted: "bg-gray-100 text-gray-500",
    }
    const labels: Record<string, string> = {
      available: "Available",
      low_stock: "Low Stock",
      depleted: "Depleted",
    }
    return (
      <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
        {labels[status] ?? status}
      </span>
    )
  }

  function txTypeBadge(type: string) {
    const map: Record<string, string> = {
      received: "bg-green-100 text-green-700",
      sale: "bg-blue-100 text-blue-700",
      transfer: "bg-purple-100 text-purple-700",
      adjustment: "bg-orange-100 text-orange-700",
      opening: "bg-[#DBEFF3] text-[#49B0C1]",
      disposal: "bg-red-100 text-red-700",
      return: "bg-yellow-100 text-yellow-700",
    }
    return (
      <span className={`text-xs font-semibold rounded-full px-2 py-0.5 capitalize ${map[type] ?? "bg-gray-100 text-gray-600"}`}>
        {type}
      </span>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb="Inventory / Stock"
        title="Stock"
        subtitle="View current stock across pharmacy locations."
        actions={
          <button
            onClick={() => alert("Add Stock — backend integration pending")}
            className="inline-flex items-center gap-2 rounded-xl bg-[#49B0C1] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3a9aaa] transition-colors"
          >
            + Add Stock
          </button>
        }
      />

      {/* Tab bar */}
      <div className="bg-white border-b border-[#DBEFF3] px-6 flex gap-0">
        {(["stock", "movements"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-[#49B0C1] text-[#49B0C1]" : "border-transparent text-[#666666] hover:text-[#333333]"}`}
          >
            {t === "stock" ? "Current Stock" : "Movements"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        {tab === "stock" ? (
          <>
            {/* Stock Filters */}
            <div className="bg-white rounded-xl border border-[#DBEFF3] p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <SearchInput
                    value={stockSearch}
                    onChange={(v) => { setStockSearch(v); setStockPage(1) }}
                    placeholder="Search product or batch..."
                  />
                </div>
                <Select
                  value={locationFilter}
                  onChange={(e) => { setLocationFilter(e.target.value); setStockPage(1) }}
                  className="sm:w-44"
                >
                  <option value="">All Locations</option>
                  {locations.map((l) => <option key={l} value={l}>{l}</option>)}
                </Select>
                <Select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setStockPage(1) }}
                  className="sm:w-44"
                >
                  <option value="">All Statuses</option>
                  <option value="available">Available</option>
                  <option value="low_stock">Low Stock</option>
                  <option value="depleted">Depleted</option>
                </Select>
              </div>
            </div>

            {/* Stock Table */}
            <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
              {loading ? (
                <LoadingSkeleton />
              ) : stockRows.length === 0 ? (
                <EmptyState title="No stock records found" description="Adjust your filters or add stock to products." />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#DBEFF3] text-left">
                          <th className="px-4 py-3 font-semibold text-[#333333]">Product</th>
                          <th className="px-4 py-3 font-semibold text-[#333333]">Batch</th>
                          <th className="px-4 py-3 font-semibold text-[#333333]">Location</th>
                          <th className="px-4 py-3 font-semibold text-[#333333]">Quantity</th>
                          <th className="px-4 py-3 font-semibold text-[#333333] hidden md:table-cell">Expiry</th>
                          <th className="px-4 py-3 font-semibold text-[#333333]">Status</th>
                          <th className="px-4 py-3 font-semibold text-[#333333]">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stockPaginated.map((b, i) => {
                          const p = productById(b.productId)
                          return (
                            <tr key={b.id} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"}>
                              <td className="px-4 py-3">
                                <p className="font-medium text-[#333333]">{p?.name ?? b.productId}</p>
                                <p className="text-xs text-[#666666]">{p?.genericName}</p>
                              </td>
                              <td className="px-4 py-3 font-mono text-xs text-[#666666]">{b.batchNumber}</td>
                              <td className="px-4 py-3 text-[#666666]">{b.location}</td>
                              <td className="px-4 py-3 font-semibold text-[#333333]">
                                {b.quantity.toLocaleString()} {p?.baseUnit ?? ""}s
                              </td>
                              <td className="px-4 py-3 text-[#666666] hidden md:table-cell">
                                {formatDate(b.expiryDate)}
                              </td>
                              <td className="px-4 py-3">{batchStatusBadge(b.status)}</td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => navigate(`/inventory/batches/${b.id}`)}
                                  className="text-xs font-semibold text-[#49B0C1] hover:underline"
                                >
                                  View Batch
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <Pagination page={stockPage} totalPages={stockTotalPages} onPageChange={setStockPage} />
                </>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Movements Filters */}
            <div className="bg-white rounded-xl border border-[#DBEFF3] p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <SearchInput
                    value={movSearch}
                    onChange={(v) => { setMovSearch(v); setMovPage(1) }}
                    placeholder="Search product or reference..."
                  />
                </div>
                <Select
                  value={typeFilter}
                  onChange={(e) => { setTypeFilter(e.target.value); setMovPage(1) }}
                  className="sm:w-44"
                >
                  <option value="">All Types</option>
                  <option value="received">Received</option>
                  <option value="sale">Sale</option>
                  <option value="transfer">Transfer</option>
                  <option value="adjustment">Adjustment</option>
                  <option value="opening">Opening</option>
                  <option value="disposal">Disposal</option>
                  <option value="return">Return</option>
                </Select>
              </div>
            </div>

            {/* Movements Table */}
            <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
              {loading ? (
                <LoadingSkeleton />
              ) : movRows.length === 0 ? (
                <EmptyState title="No movements found" description="Stock movements will appear here as inventory is received, sold, or adjusted." />
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
                          <th className="px-4 py-3 font-semibold text-[#333333]">Qty In</th>
                          <th className="px-4 py-3 font-semibold text-[#333333]">Qty Out</th>
                          <th className="px-4 py-3 font-semibold text-[#333333] hidden md:table-cell">Balance</th>
                          <th className="px-4 py-3 font-semibold text-[#333333] hidden lg:table-cell">Reference</th>
                        </tr>
                      </thead>
                      <tbody>
                        {movPaginated.map((t, i) => {
                          const p = productById(t.productId)
                          const unit = p?.baseUnit ?? ""
                          const isIn = ["received", "opening", "return"].includes(t.type)
                          return (
                            <tr key={t.id} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"}>
                              <td className="px-4 py-3 text-[#666666] whitespace-nowrap">{formatDate(t.date)}</td>
                              <td className="px-4 py-3">
                                <p className="font-medium text-[#333333]">{p?.name ?? t.productId}</p>
                              </td>
                              <td className="px-4 py-3">{txTypeBadge(t.type)}</td>
                              <td className="px-4 py-3 text-[#666666] hidden sm:table-cell">{t.location}</td>
                              <td className="px-4 py-3 font-semibold text-green-700">
                                {isIn ? `+${t.quantity.toLocaleString()} ${unit}s` : "—"}
                              </td>
                              <td className="px-4 py-3 font-semibold text-red-600">
                                {!isIn ? `−${t.quantity.toLocaleString()} ${unit}s` : "—"}
                              </td>
                              <td className="px-4 py-3 text-[#333333] font-semibold hidden md:table-cell">
                                {t.balanceAfter.toLocaleString()} {unit}s
                              </td>
                              <td className="px-4 py-3 text-xs text-[#666666] font-mono hidden lg:table-cell">
                                {t.reference}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <Pagination page={movPage} totalPages={movTotalPages} onPageChange={setMovPage} />
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-3 animate-pulse">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-10 rounded-lg bg-[#DBEFF3]" />
      ))}
    </div>
  )
}
