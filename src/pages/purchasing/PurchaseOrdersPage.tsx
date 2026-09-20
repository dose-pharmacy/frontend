import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router"
import PageHeader from "../../components/ui/PageHeader"
import SearchInput from "../../components/ui/SearchInput"
import Modal from "../../components/ui/Modal"
import Button from "../../components/ui/Button"
import {
  listPurchaseOrders,
  markPurchaseOrderAwaitingDelivery,
  cancelPurchaseOrder,
  closePurchaseOrder,
  PurchaseOrdersApiError,
  type PurchaseOrderDto,
} from "../../features/purchasing/purchaseOrdersApi"
import { listSuppliers, type SupplierDto } from "../../features/purchasing/suppliersApi"

// ─── Types ────────────────────────────────────────────────────────────────────

export type POStatus = "REGISTERED" | "AWAITING_DELIVERY" | "RECEIVED" | "CLOSED" | "CANCELLED"

export interface POItem {
  id: string
  productId: string
  /** Product display name when known (list rows from the API only carry the id). */
  product: string
  requirementLineId: string | null
  quantity: number
  unitCost: number
}

export interface PurchaseOrder {
  id: string
  reference: string
  supplierId: string
  supplierName: string
  /** ISO8601 — stamped by the backend on creation (GET /purchase-orders). */
  orderDate: string
  expectedDeliveryDate: string
  status: POStatus
  items: POItem[]
  /** Item count as reported by the backend `_count.items` (list rows). */
  itemsCount: number
  notes: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function fmtDate(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function fmtMoney(n: number) { return `${n.toLocaleString("en-ET")} ETB` }

/** Map an API purchase order onto the UI row shape. */
export function toUiPO(dto: PurchaseOrderDto): PurchaseOrder {
  const items: POItem[] = (dto.items ?? []).map((it) => ({
    id: it.id,
    productId: it.productId,
    product: it.product?.name ?? "",
    requirementLineId: it.requirementLineId ?? null,
    quantity: it.quantityOrdered ?? 0,
    unitCost: it.unitCost ?? 0,
  }))
  return {
    id: dto.id,
    reference: dto.poNumber,
    supplierId: dto.supplierId,
    supplierName: dto.supplier?.name ?? "—",
    orderDate: dto.orderDate ?? "",
    expectedDeliveryDate: dto.expectedDeliveryDate ?? "",
    status: (dto.status as POStatus) ?? "REGISTERED",
    notes: dto.notes ?? "",
    itemsCount: dto._count?.items ?? items.length,
    items,
  }
}

const STATUS_CFG: Record<POStatus, { label: string; cls: string }> = {
  REGISTERED:       { label: "Registered",       cls: "bg-blue-100 text-blue-700" },
  AWAITING_DELIVERY:{ label: "Awaiting Delivery", cls: "bg-yellow-100 text-yellow-700" },
  RECEIVED:         { label: "Received",          cls: "bg-[#DBEFF3] text-[#49B0C1] border border-[#ABDBE3]" },
  CLOSED:           { label: "Closed",            cls: "bg-green-100 text-green-700" },
  CANCELLED:        { label: "Cancelled",         cls: "bg-gray-100 text-gray-500" },
}

export function StatusBadge({ status }: { status: POStatus }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.REGISTERED
  return <span className={`text-xs font-bold rounded-full px-2.5 py-0.5 ${cfg.cls}`}>{cfg.label}</span>
}

// ─── Toast ────────────────────────────────────────────────────────────────────

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t) }, [onDone])
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-[#333333] px-5 py-3.5 text-sm text-white shadow-xl">
      <svg className="h-4 w-4 shrink-0 text-[#49B0C1]" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
      </svg>
      {message}
    </div>
  )
}

// ─── OverflowMenu ─────────────────────────────────────────────────────────────

function OverflowMenu({ items }: { items: { label: string; danger?: boolean; onClick: () => void }[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function close(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} className="p-1.5 rounded-lg text-[#666666] hover:bg-[#DBEFF3] transition-colors">
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-52 rounded-xl border border-[#DBEFF3] bg-white shadow-xl py-1">
          {items.map((item) => (
            <button key={item.label} onClick={() => { setOpen(false); item.onClick() }} className={`w-full text-left px-4 py-2 text-sm hover:bg-[#DBEFF3]/60 transition-colors ${item.danger ? "text-red-600" : "text-[#333333]"}`}>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

function ConfirmModal({ open, title, message, detail, error, confirmLabel, confirmClass, cancelLabel = "Cancel", onClose, onConfirm }: {
  open: boolean; title: string; message: string; detail?: string; error?: string
  confirmLabel: string; confirmClass: string; cancelLabel?: string
  onClose: () => void; onConfirm: () => Promise<void> | void
}) {
  const [loading, setLoading] = useState(false)
  async function go() { setLoading(true); await onConfirm(); setLoading(false) }
  return (
    <Modal open={open} title={title} onClose={onClose} size="sm">
      <p className="text-sm text-[#666666]">{message}</p>
      {detail && <p className="mt-2 text-xs text-[#999]">{detail}</p>}
      {error && <p className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex gap-3 justify-end mt-6">
        <Button variant="secondary" onClick={onClose}>{cancelLabel}</Button>
        <button onClick={go} disabled={loading} className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${confirmClass}`}>
          {loading ? "Processing..." : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PurchaseOrdersPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [reloadTick, setReloadTick] = useState(0)
  const [suppFilter, setSuppFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [toast, setToast] = useState("")
  const [actionError, setActionError] = useState("")
  const [actionTarget, setActionTarget] = useState<{ po: PurchaseOrder; action: "markDelivery" | "close" | "cancel" } | null>(null)

  const PAGE_SIZE = 20

  // Real suppliers for the filter dropdown.
  useEffect(() => {
    let active = true
    listSuppliers({ limit: 100, isActive: true })
      .then((res) => { if (active) setSuppliers(res.data) })
      .catch(() => { /* dropdown simply stays empty */ })
    return () => { active = false }
  }, [])

  // Real purchase orders with backend pagination.
  useEffect(() => {
    let active = true
    setLoading(true)
    setError("")
    const params: any = { page, limit: PAGE_SIZE }
    if (search) params.search = search
    if (suppFilter) params.supplierId = suppFilter
    if (statusFilter) params.status = statusFilter
    listPurchaseOrders(params)
      .then((res) => {
        if (!active) return
        setOrders(res.data.map(toUiPO))
        setTotalPages(res.meta.totalPages)
        setTotalCount(res.meta.total)
      })
      .catch((err) => {
        if (!active) return
        setError(err instanceof PurchaseOrdersApiError ? err.message : "Failed to load purchase orders.")
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [reloadTick, page, search, suppFilter, statusFilter])

  function refresh() { setReloadTick((t) => t + 1) }

  const summary = {
    total:    totalCount,
    registered:    orders.filter((o) => o.status === "REGISTERED").length,
    awaiting: orders.filter((o) => o.status === "AWAITING_DELIVERY").length,
    received: orders.filter((o) => o.status === "RECEIVED").length,
    closed:   orders.filter((o) => o.status === "CLOSED").length,
  }

  // For backward compatibility with table rendering
  const filtered = orders
  const paginated = orders

  /** Runs the confirmed status transition against the real endpoint. */
  async function runStatusAction() {
    if (!actionTarget) return
    const { po, action } = actionTarget
    setActionError("")
    try {
      if (action === "markDelivery") await markPurchaseOrderAwaitingDelivery(po.id)
      else if (action === "close") await closePurchaseOrder(po.id)
      else await cancelPurchaseOrder(po.id)
      setActionTarget(null)
      setToast(
        action === "markDelivery"
          ? "Purchase order marked as awaiting delivery."
          : action === "close"
          ? "Purchase order closed."
          : "Purchase order cancelled.",
      )
      refresh()
    } catch (err) {
      setActionError(err instanceof PurchaseOrdersApiError ? err.message : "The action failed. Please try again.")
    }
  }

  const confirmCfg = actionTarget ? {
    markDelivery: { title: "Mark as Awaiting Delivery?", message: `Send ${actionTarget.po.reference} to the supplier and mark it as awaiting delivery?`, confirmLabel: "Mark Awaiting Delivery", confirmClass: "bg-yellow-600 hover:bg-yellow-700 text-white", cancelLabel: "Cancel" },
    close:        { title: "Close Purchase Order?", message: `This purchase order has been received. Closing it will mark the purchasing cycle as complete.`, confirmLabel: "Close Purchase Order", confirmClass: "bg-[#49B0C1] hover:bg-[#3a9aaa] text-white", cancelLabel: "Cancel" },
    cancel:       { title: "Cancel Purchase Order?", message: `Are you sure you want to cancel ${actionTarget.po.reference}? This action will mark the order as cancelled.`, confirmLabel: "Cancel Purchase Order", confirmClass: "bg-red-600 hover:bg-red-700 text-white", cancelLabel: "Keep Order" },
  }[actionTarget.action] : null

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb="Purchasing / Orders"
        title="Purchase Orders"
        subtitle="Create and manage supplier purchase orders."
        actions={
          <button onClick={() => navigate("/purchasing/orders/new")} className="inline-flex items-center gap-1.5 rounded-xl bg-white text-[#49B0C1] px-3.5 py-2 text-sm font-semibold hover:bg-[#DBEFF3] transition-colors">
            + Create Purchase Order
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {([
            ["Total Orders",     summary.total,      "text-[#333333]"],
            ["Registered",       summary.registered, "text-blue-600"],
            ["Awaiting Delivery",summary.awaiting,   "text-yellow-600"],
            ["Received",         summary.received,   "text-[#49B0C1]"],
            ["Closed",           summary.closed,     "text-green-600"],
          ] as [string, number, string][]).map(([label, val, accent]) => (
            <div key={label} className="bg-white rounded-xl border border-[#DBEFF3] p-4">
              <p className="text-xs text-[#666666]">{label}</p>
              <p className={`text-2xl font-bold mt-0.5 ${accent}`}>{val}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-[#DBEFF3] p-4 flex flex-col gap-3">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search purchase orders..." />
          <div className="flex flex-wrap gap-3 items-center">
            <select value={suppFilter} onChange={(e) => { setSuppFilter(e.target.value); setPage(1) }} className="flex-1 min-w-[160px] rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm focus:border-[#49B0C1] focus:outline-none">
              <option value="">All Suppliers</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className="flex-1 min-w-[160px] rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm focus:border-[#49B0C1] focus:outline-none">
              <option value="">All Statuses</option>
              <option value="REGISTERED">Registered</option>
              <option value="AWAITING_DELIVERY">Awaiting Delivery</option>
              <option value="RECEIVED">Received</option>
              <option value="CLOSED">Closed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            {(search || suppFilter || statusFilter) && (
              <button onClick={() => { setSearch(""); setSuppFilter(""); setStatusFilter(""); setPage(1) }} className="text-xs font-semibold text-[#49B0C1] hover:underline">
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="h-8 w-8 rounded-full border-4 border-[#DBEFF3] border-t-[#49B0C1] animate-spin" />
              <p className="text-sm text-[#666666]">Loading purchase orders...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 px-6">
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 max-w-md text-center">{error}</p>
              <Button onClick={refresh}>Retry</Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="h-14 w-14 rounded-2xl bg-[#DBEFF3] flex items-center justify-center">
                <svg className="h-7 w-7 text-[#49B0C1]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="font-semibold text-[#333333]">No purchase orders found</p>
                <p className="text-sm text-[#666666] mt-1">
                  {(search || suppFilter || statusFilter)
                    ? "No purchase orders match your filters."
                    : "Purchase orders will appear here once they are created."}
                </p>
              </div>
              {(search || suppFilter || statusFilter) ? (
                <button onClick={() => { setSearch(""); setSuppFilter(""); setStatusFilter(""); setPage(1) }} className="text-sm font-semibold text-[#49B0C1] hover:underline">Clear Filters</button>
              ) : (
                <Button onClick={() => navigate("/purchasing/orders/new")}>+ Create Purchase Order</Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#DBEFF3] text-left">
                      {["PO Number", "Supplier", "Order Date", "Expected Delivery", "Items", "Status", "Actions"].map((h) => (
                        <th key={h} className="px-4 py-3 font-semibold text-[#333333]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((po, i) => (
                      <tr key={po.id} className={`hover:bg-[#DBEFF3]/30 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/15"}`}>
                        <td className="px-4 py-3">
                          <button onClick={() => navigate(`/purchasing/orders/${po.id}`)} className="font-semibold text-[#49B0C1] hover:underline">{po.reference}</button>
                        </td>
                        <td className="px-4 py-3 text-[#333333]">{po.supplierName}</td>
                        <td className="px-4 py-3 text-[#666666] whitespace-nowrap">{fmtDate(po.orderDate)}</td>
                        <td className="px-4 py-3 text-[#666666] whitespace-nowrap">{fmtDate(po.expectedDeliveryDate)}</td>
                        <td className="px-4 py-3 text-[#666666]">{po.itemsCount} item{po.itemsCount !== 1 ? "s" : ""}</td>
                        <td className="px-4 py-3"><StatusBadge status={po.status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => navigate(`/purchasing/orders/${po.id}`)} className="text-xs font-semibold text-[#49B0C1] hover:underline whitespace-nowrap">View →</button>
                            <OverflowMenu items={[
                              { label: "View", onClick: () => navigate(`/purchasing/orders/${po.id}`) },
                              ...(po.status === "REGISTERED" ? [
                                { label: "Edit", onClick: () => navigate(`/purchasing/orders/${po.id}?edit=1`) },
                                { label: "Mark as Awaiting Delivery", onClick: () => { setActionError(""); setActionTarget({ po, action: "markDelivery" }) } },
                                { label: "Cancel Order", danger: true, onClick: () => { setActionError(""); setActionTarget({ po, action: "cancel" }) } },
                              ] : []),
                              ...(po.status === "AWAITING_DELIVERY" ? [
                                { label: "Cancel Order", danger: true, onClick: () => { setActionError(""); setActionTarget({ po, action: "cancel" }) } },
                              ] : []),
                              ...(po.status === "RECEIVED" ? [
                                { label: "Close Purchase Order", onClick: () => { setActionError(""); setActionTarget({ po, action: "close" }) } },
                              ] : []),
                            ]} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-[#DBEFF3] flex items-center justify-between">
                <p className="text-xs text-[#666666]">
                  Showing {Math.min((page - 1) * PAGE_SIZE + 1, totalCount)}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount} orders
                </p>
                <div className="flex gap-1">
                  <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg px-3 py-1.5 text-xs border border-[#ABDBE3] text-[#666666] hover:bg-[#DBEFF3] disabled:opacity-40 transition-colors">Prev</button>
                  {(() => {
                    const pages: number[] = []
                    for (let i = 1; i <= totalPages; i++) pages.push(i)
                    return pages.map((p: number) => (
                      <button key={p} onClick={() => setPage(p)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${p === page ? "bg-[#49B0C1] text-white" : "border border-[#ABDBE3] text-[#666666] hover:bg-[#DBEFF3]"}`}>{p}</button>
                    ))
                  })()}
                  <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg px-3 py-1.5 text-xs border border-[#ABDBE3] text-[#666666] hover:bg-[#DBEFF3] disabled:opacity-40 transition-colors">Next</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {actionTarget && confirmCfg && (
        <ConfirmModal
          open
          title={confirmCfg.title}
          message={confirmCfg.message}
          confirmLabel={confirmCfg.confirmLabel}
          confirmClass={confirmCfg.confirmClass}
          cancelLabel={confirmCfg.cancelLabel}
          error={actionError}
          onClose={() => { setActionTarget(null); setActionError("") }}
          onConfirm={runStatusAction}
        />
      )}
      {toast && <Toast message={toast} onDone={() => setToast("")} />}
    </div>
  )
}
