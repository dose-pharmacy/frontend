import { useEffect, useState, useMemo } from "react"
import { useNavigate } from "react-router"
import { getBatches, getProducts, daysUntilExpiry } from "../../features/inventory/inventoryService"
import type { Batch, Product } from "../../features/inventory/inventoryMock"
import PageHeader from "../../components/ui/PageHeader"
import Button from "../../components/ui/Button"
import SearchInput from "../../components/ui/SearchInput"
import Select from "../../components/ui/Select"
import EmptyState from "../../components/ui/EmptyState"
import Modal from "../../components/ui/Modal"
import Input from "../../components/ui/Input"
import FormError from "../../components/ui/FormError"
import Pagination from "../../components/ui/Pagination"

type Tab = "batches" | "expiring" | "expired"
type ExpiryAction = "return" | "clearance" | "dispose"

const PAGE_SIZE = 10

export default function BatchesExpiryPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>("batches")
  const [products, setProducts] = useState<Product[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)

  // Batches tab filters
  const [batchSearch, setBatchSearch] = useState("")
  const [locationFilter, setLocationFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [batchPage, setBatchPage] = useState(1)

  // Expiry action modal
  const [actionBatch, setActionBatch] = useState<Batch | null>(null)
  const [actionType, setActionType] = useState<ExpiryAction>("return")
  const [actionForm, setActionForm] = useState({ supplier: "", returnQty: "", discount: "", notes: "", reason: "" })
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([getBatches(), getProducts()]).then(([b, p]) => {
      setBatches(b)
      setProducts(p)
      setLoading(false)
    })
  }, [])

  function productName(productId: string) {
    return products.find((p) => p.id === productId)?.name ?? productId
  }

  function productUnit(productId: string) {
    return products.find((p) => p.id === productId)?.baseUnit ?? ""
  }

  const locations = useMemo(() => [...new Set(batches.map((b) => b.location))], [batches])

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
    if (locationFilter) rows = rows.filter((b) => b.location === locationFilter)
    if (statusFilter) rows = rows.filter((b) => b.status === statusFilter)
    return rows
  }, [batches, batchSearch, locationFilter, statusFilter, products])

  const batchTotalPages = Math.max(1, Math.ceil(filteredBatches.length / PAGE_SIZE))
  const batchPaginated = filteredBatches.slice((batchPage - 1) * PAGE_SIZE, batchPage * PAGE_SIZE)

  // Expiry tabs
  const expiring = useMemo(
    () =>
      batches
        .filter((b) => {
          const d = daysUntilExpiry(b.expiryDate)
          return d >= 0 && d <= 90 && b.quantity > 0
        })
        .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()),
    [batches]
  )

  const expired = useMemo(
    () =>
      batches
        .filter((b) => daysUntilExpiry(b.expiryDate) < 0)
        .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()),
    [batches]
  )

  function openAction(b: Batch, type: ExpiryAction = "return") {
    setActionBatch(b)
    setActionType(type)
    setActionForm({ supplier: "", returnQty: "", discount: "", notes: "", reason: "" })
    setFormError(null)
  }

  async function handleConfirmAction() {
    setFormError(null)
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
    await new Promise((r) => setTimeout(r, 900))
    setSubmitting(false)
    setActionBatch(null)
    alert(`Action confirmed (mock): ${actionType} for ${actionBatch?.batchNumber}`)
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
  }

  function batchStatusBadge(status: string) {
    const cfg: Record<string, { label: string; cls: string }> = {
      available: { label: "Available", cls: "bg-green-100 text-green-700" },
      low_stock: { label: "Low Stock", cls: "bg-yellow-100 text-yellow-700" },
      depleted: { label: "Depleted", cls: "bg-gray-100 text-gray-500" },
      expired: { label: "Expired", cls: "bg-red-100 text-red-700" },
    }
    const c = cfg[status] ?? { label: status, cls: "bg-gray-100 text-gray-600" }
    return <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${c.cls}`}>{c.label}</span>
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
        actions={
          <Button onClick={() => alert("Add Batch — backend integration pending")}>
            + Add Batch
          </Button>
        }
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
                <Select value={locationFilter} onChange={(e) => { setLocationFilter(e.target.value); setBatchPage(1) }} className="sm:w-44">
                  <option value="">All Locations</option>
                  {locations.map((l) => <option key={l} value={l}>{l}</option>)}
                </Select>
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
                              <td className="px-4 py-3">{batchStatusBadge(b.status)}</td>
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
            {/* Summary counters */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Critical (≤ 30 days)", count: expiring.filter((b) => daysUntilExpiry(b.expiryDate) <= 30).length, cls: "border-red-200 bg-red-50", textCls: "text-red-600" },
                { label: "Within 60 days", count: expiring.filter((b) => { const d = daysUntilExpiry(b.expiryDate); return d > 30 && d <= 60 }).length, cls: "border-orange-200 bg-orange-50", textCls: "text-orange-600" },
                { label: "Within 90 days", count: expiring.filter((b) => { const d = daysUntilExpiry(b.expiryDate); return d > 60 && d <= 90 }).length, cls: "border-yellow-200 bg-yellow-50", textCls: "text-yellow-600" },
                { label: "Already Expired", count: expired.length, cls: "border-gray-200 bg-gray-50", textCls: "text-gray-600" },
              ].map(({ label, count, cls, textCls }) => (
                <div key={label} className={`rounded-xl border p-4 ${cls}`}>
                  <p className={`text-2xl font-bold ${textCls}`}>{count}</p>
                  <p className="text-xs text-[#666666] mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {loading ? (
              <LoadingSkeleton />
            ) : expiring.length === 0 ? (
              <EmptyState title="No expiring batches" description="No batches expiring within the next 90 days." />
            ) : (
              <>
                {/* Critical — ≤ 30 days */}
                <ExpiryGroup
                  title="Critical — Expiring within 30 days"
                  urgency="critical"
                  batches={expiring.filter((b) => daysUntilExpiry(b.expiryDate) <= 30)}
                  productName={productName}
                  productUnit={productUnit}
                  onAction={openAction}
                />
                {/* Warning — 31–60 days */}
                <ExpiryGroup
                  title="Expiring within 60 days"
                  urgency="warning"
                  batches={expiring.filter((b) => { const d = daysUntilExpiry(b.expiryDate); return d > 30 && d <= 60 })}
                  productName={productName}
                  productUnit={productUnit}
                  onAction={openAction}
                />
                {/* Notice — 61–90 days */}
                <ExpiryGroup
                  title="Expiring within 90 days"
                  urgency="notice"
                  batches={expiring.filter((b) => { const d = daysUntilExpiry(b.expiryDate); return d > 60 && d <= 90 })}
                  productName={productName}
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
            {loading ? (
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
                        <td className="px-4 py-3 font-medium text-[#333333]">{productName(b.productId)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-[#666666]">{b.batchNumber}</td>
                        <td className="px-4 py-3 text-red-600 font-semibold">{formatDate(b.expiryDate)}</td>
                        <td className="px-4 py-3 font-semibold text-[#333333]">
                          {b.quantity.toLocaleString()} {productUnit(b.productId)}s
                        </td>
                        <td className="px-4 py-3 text-[#666666] hidden sm:table-cell">{b.location}</td>
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

      {/* Expiry Action Modal */}
      <Modal open={!!actionBatch} title="Expiry Action" onClose={() => setActionBatch(null)} size="md">
        {actionBatch && (
          <div className="flex flex-col gap-5">
            <div className="rounded-xl bg-[#DBEFF3] p-4 grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-[#666666]">Product: </span><span className="font-semibold text-[#333333]">{productName(actionBatch.productId)}</span></div>
              <div><span className="text-[#666666]">Batch: </span><span className="font-mono font-semibold text-[#333333]">{actionBatch.batchNumber}</span></div>
              <div><span className="text-[#666666]">Qty: </span><span className="font-semibold text-[#333333]">{actionBatch.quantity.toLocaleString()} {productUnit(actionBatch.productId)}s</span></div>
              <div><span className="text-[#666666]">Expiry: </span><span className="font-semibold text-red-600">{actionBatch.expiryDate}</span></div>
            </div>
            <FormError message={formError} />
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
                <Input label="Return Quantity" type="number" min={1} value={actionForm.returnQty} onChange={(e) => setActionForm((f) => ({ ...f, returnQty: e.target.value }))} />
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
  title, urgency, batches, productName, productUnit, onAction,
}: {
  title: string
  urgency: "critical" | "warning" | "notice"
  batches: Batch[]
  productName: (id: string) => string
  productUnit: (id: string) => string
  onAction: (b: Batch, type: ExpiryAction) => void
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
          const days = daysUntilExpiry(b.expiryDate)
          return (
            <div key={b.id} className="flex items-center gap-4 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[#333333] truncate">{productName(b.productId)}</p>
                <p className="text-xs text-[#666666] font-mono">{b.batchNumber} · {b.location}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-sm font-bold ${dotCls}`}>{days} days</p>
                <p className="text-xs text-[#666666]">{b.quantity.toLocaleString()} {productUnit(b.productId)}s</p>
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
