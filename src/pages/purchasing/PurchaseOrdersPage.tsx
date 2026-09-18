import { useState, useRef, useEffect } from "react"
import { useNavigate } from "react-router"
import PageHeader from "../../components/ui/PageHeader"
import SearchInput from "../../components/ui/SearchInput"
import Modal from "../../components/ui/Modal"
import Button from "../../components/ui/Button"

// ─── Types ────────────────────────────────────────────────────────────────────

export type POStatus = "REGISTERED" | "AWAITING_DELIVERY" | "RECEIVED" | "CLOSED" | "CANCELLED"

export interface POItem {
  id: string
  product: string
  requirementRef: string
  quantity: number
  unitCost: number
}

export interface PurchaseOrder {
  id: string
  reference: string
  supplierId: string
  supplierName: string
  orderDate: string
  expectedDeliveryDate: string
  status: POStatus
  items: POItem[]
  notes: string
  requirementRef: string
}

// ─── Mock data ────────────────────────────────────────────────────────────────

export const MOCK_SUPPLIERS = [
  { id: "s1", name: "PharmaCo Ltd",     contact: "Ahmed Mohammed", phone: "+251 911 123 456", email: "info@pharmaco.com",    paymentTerms: "Net 30" },
  { id: "s2", name: "MediPharma",       contact: "Sara Tadesse",   phone: "+251 912 234 567", email: "orders@medipharma.et", paymentTerms: "Net 14" },
  { id: "s3", name: "GlobalMed Supply", contact: "Daniel Bekele",  phone: "+251 913 345 678", email: "supply@globalmed.com", paymentTerms: "Net 45" },
  { id: "s4", name: "EthioHealth",      contact: "Meron Haile",    phone: "+251 914 456 789", email: "info@ethiohealth.et",  paymentTerms: "Net 60" },
]

export const MOCK_REQUIREMENTS = [
  { id: "r1", reference: "REQ-001", label: "REQ-001 — Low Stock Replenishment" },
  { id: "r2", reference: "REQ-002", label: "REQ-002 — Urgent Restocking" },
  { id: "r3", reference: "REQ-004", label: "REQ-004 — Monthly Order" },
]

let nextPONum = 5

export const INITIAL_POS: PurchaseOrder[] = [
  {
    id: "po1", reference: "PO-2026-001", supplierId: "s1", supplierName: "PharmaCo Ltd",
    orderDate: "2026-09-16", expectedDeliveryDate: "2026-09-21", status: "AWAITING_DELIVERY",
    requirementRef: "REQ-001",
    notes: "Urgent delivery required before month-end.",
    items: [
      { id: "i1", product: "Paracetamol 500mg", requirementRef: "REQ-001", quantity: 100, unitCost: 120 },
      { id: "i2", product: "Amoxicillin 500mg", requirementRef: "REQ-001", quantity: 50, unitCost: 85 },
      { id: "i3", product: "Vitamin C 1000mg",  requirementRef: "REQ-001", quantity: 75, unitCost: 60 },
    ],
  },
  {
    id: "po2", reference: "PO-2026-002", supplierId: "s2", supplierName: "MediPharma",
    orderDate: "2026-09-15", expectedDeliveryDate: "2026-09-19", status: "REGISTERED",
    requirementRef: "REQ-002",
    notes: "",
    items: [
      { id: "i4", product: "Ibuprofen 400mg", requirementRef: "REQ-002", quantity: 80, unitCost: 95 },
      { id: "i5", product: "Metformin 850mg", requirementRef: "REQ-002", quantity: 60, unitCost: 75 },
    ],
  },
  {
    id: "po3", reference: "PO-2026-003", supplierId: "s3", supplierName: "GlobalMed Supply",
    orderDate: "2026-09-10", expectedDeliveryDate: "2026-09-14", status: "RECEIVED",
    requirementRef: "",
    notes: "Manual purchase order for cold-chain products.",
    items: [
      { id: "i6", product: "Atorvastatin 20mg", requirementRef: "", quantity: 45, unitCost: 110 },
    ],
  },
  {
    id: "po4", reference: "PO-2026-004", supplierId: "s1", supplierName: "PharmaCo Ltd",
    orderDate: "2026-09-05", expectedDeliveryDate: "2026-09-09", status: "CLOSED",
    requirementRef: "REQ-004",
    notes: "",
    items: [
      { id: "i7", product: "Omeprazole 20mg",  requirementRef: "REQ-004", quantity: 120, unitCost: 55 },
      { id: "i8", product: "Cetirizine 10mg",  requirementRef: "REQ-004", quantity: 200, unitCost: 40 },
      { id: "i9", product: "Losartan 50mg",    requirementRef: "REQ-004", quantity: 60, unitCost: 90 },
    ],
  },
  {
    id: "po5", reference: "PO-2026-005", supplierId: "s4", supplierName: "EthioHealth",
    orderDate: "2026-09-12", expectedDeliveryDate: "2026-09-18", status: "CANCELLED",
    requirementRef: "",
    notes: "Supplier could not fulfill the order.",
    items: [
      { id: "i10", product: "Insulin Glargine", requirementRef: "", quantity: 20, unitCost: 850 },
    ],
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function fmtDate(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function fmtMoney(n: number) { return `${n.toLocaleString("en-ET")} ETB` }

function poTotal(po: PurchaseOrder) { return po.items.reduce((s, i) => s + i.quantity * i.unitCost, 0) }

const STATUS_CFG: Record<POStatus, { label: string; cls: string }> = {
  REGISTERED:       { label: "Registered",       cls: "bg-blue-100 text-blue-700" },
  AWAITING_DELIVERY:{ label: "Awaiting Delivery", cls: "bg-yellow-100 text-yellow-700" },
  RECEIVED:         { label: "Received",          cls: "bg-[#DBEFF3] text-[#49B0C1] border border-[#ABDBE3]" },
  CLOSED:           { label: "Closed",            cls: "bg-green-100 text-green-700" },
  CANCELLED:        { label: "Cancelled",         cls: "bg-gray-100 text-gray-500" },
}

export function StatusBadge({ status }: { status: POStatus }) {
  const cfg = STATUS_CFG[status]
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

function ConfirmModal({ open, title, message, detail, confirmLabel, confirmClass, cancelLabel = "Cancel", onClose, onConfirm }: {
  open: boolean; title: string; message: string; detail?: string
  confirmLabel: string; confirmClass: string; cancelLabel?: string
  onClose: () => void; onConfirm: () => Promise<void> | void
}) {
  const [loading, setLoading] = useState(false)
  async function go() { setLoading(true); await onConfirm(); setLoading(false) }
  return (
    <Modal open={open} title={title} onClose={onClose} size="sm">
      <p className="text-sm text-[#666666]">{message}</p>
      {detail && <p className="mt-2 text-xs text-[#999]">{detail}</p>}
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
  const [orders, setOrders] = useState<PurchaseOrder[]>(INITIAL_POS)
  const [suppFilter, setSuppFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [toast, setToast] = useState("")
  const [actionTarget, setActionTarget] = useState<{ po: PurchaseOrder; action: "markDelivery" | "close" | "cancel" } | null>(null)

  const PAGE_SIZE = 10

  const filtered = orders.filter((o) => {
    if (suppFilter && o.supplierId !== suppFilter) return false
    if (statusFilter && o.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!o.reference.toLowerCase().includes(q) && !o.supplierName.toLowerCase().includes(q)) return false
    }
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const summary = {
    total:    orders.length,
    registered:    orders.filter((o) => o.status === "REGISTERED").length,
    awaiting: orders.filter((o) => o.status === "AWAITING_DELIVERY").length,
    received: orders.filter((o) => o.status === "RECEIVED").length,
    closed:   orders.filter((o) => o.status === "CLOSED").length,
  }

  function updateStatus(id: string, status: POStatus) {
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status } : o))
  }

  function handleAction() {
    if (!actionTarget) return
    const { po, action } = actionTarget
    const next: POStatus = action === "markDelivery" ? "AWAITING_DELIVERY" : action === "close" ? "CLOSED" : "CANCELLED"
    const msgs: Record<string, string> = {
      markDelivery: "Purchase order marked as awaiting delivery.",
      close: "Purchase order closed.",
      cancel: "Purchase order cancelled.",
    }
    updateStatus(po.id, next)
    setActionTarget(null)
    setToast(msgs[action])
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
              {MOCK_SUPPLIERS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
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
          {filtered.length === 0 ? (
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
                      {["PO Number", "Supplier", "Order Date", "Expected Delivery", "Items", "Total Amount", "Status", "Actions"].map((h) => (
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
                        <td className="px-4 py-3 text-[#666666]">{po.items.length} item{po.items.length !== 1 ? "s" : ""}</td>
                        <td className="px-4 py-3 font-semibold text-[#333333]">{fmtMoney(poTotal(po))}</td>
                        <td className="px-4 py-3"><StatusBadge status={po.status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => navigate(`/purchasing/orders/${po.id}`)} className="text-xs font-semibold text-[#49B0C1] hover:underline whitespace-nowrap">View →</button>
                            <OverflowMenu items={[
                              { label: "View", onClick: () => navigate(`/purchasing/orders/${po.id}`) },
                              ...(po.status === "REGISTERED" ? [
                                { label: "Edit", onClick: () => navigate(`/purchasing/orders/${po.id}?edit=1`) },
                                { label: "Mark as Awaiting Delivery", onClick: () => setActionTarget({ po, action: "markDelivery" }) },
                                { label: "Cancel Order", danger: true, onClick: () => setActionTarget({ po, action: "cancel" }) },
                              ] : []),
                              ...(po.status === "AWAITING_DELIVERY" ? [
                                { label: "Cancel Order", danger: true, onClick: () => setActionTarget({ po, action: "cancel" }) },
                              ] : []),
                              ...(po.status === "RECEIVED" ? [
                                { label: "Close Purchase Order", onClick: () => setActionTarget({ po, action: "close" }) },
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
                  Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} orders
                </p>
                <div className="flex gap-1">
                  <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg px-3 py-1.5 text-xs border border-[#ABDBE3] text-[#666666] hover:bg-[#DBEFF3] disabled:opacity-40 transition-colors">←</button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button key={p} onClick={() => setPage(p)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${p === page ? "bg-[#49B0C1] text-white" : "border border-[#ABDBE3] text-[#666666] hover:bg-[#DBEFF3]"}`}>{p}</button>
                  ))}
                  <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg px-3 py-1.5 text-xs border border-[#ABDBE3] text-[#666666] hover:bg-[#DBEFF3] disabled:opacity-40 transition-colors">→</button>
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
          onClose={() => setActionTarget(null)}
          onConfirm={async () => { await new Promise((r) => setTimeout(r, 500)); handleAction() }}
        />
      )}
      {toast && <Toast message={toast} onDone={() => setToast("")} />}
    </div>
  )
}
