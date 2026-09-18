import { useState, useEffect, useRef } from "react"
import PageHeader from "../../components/ui/PageHeader"
import Modal from "../../components/ui/Modal"
import SearchInput from "../../components/ui/SearchInput"
import Button from "../../components/ui/Button"

// ─── Types ────────────────────────────────────────────────────────────────────

type ReqStatus = "OPEN" | "ASSIGNED" | "CLOSED"
type LineStatus = "OPEN" | "ASSIGNED"
type LineReason = "Low Stock" | "Reorder Alert" | "Manual" | ""

interface RequirementLine {
  id: string
  product: string
  quantityNeeded: number
  quantityDelivered: number
  reason: LineReason
  notes: string
  supplier: string
  status: LineStatus
}

interface Requirement {
  id: string
  reference: string
  requiredBy: string
  notes: string
  status: ReqStatus
  createdBy: string
  createdDate: string
  lines: RequirementLine[]
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const PRODUCTS = [
  "Paracetamol 500mg", "Amoxicillin 500mg", "Ibuprofen 400mg",
  "Metformin 850mg", "Omeprazole 20mg", "Cetirizine 10mg",
  "Atorvastatin 20mg", "Losartan 50mg", "Vitamin C 1000mg",
]

const SUPPLIERS = [
  { name: "ABC Pharmaceuticals", terms: "30 days" },
  { name: "MediPharma", terms: "14 days" },
  { name: "GlobalMed Supply", terms: "45 days" },
  { name: "EthioHealth", terms: "60 days" },
]

const REORDER_SUGGESTIONS = [
  { product: "Paracetamol 500mg", quantity: 100 },
  { product: "Amoxicillin 500mg", quantity: 50 },
  { product: "Vitamin C 1000mg", quantity: 75 },
  { product: "Omeprazole 20mg", quantity: 40 },
  { product: "Cetirizine 10mg", quantity: 60 },
  { product: "Losartan 50mg", quantity: 30 },
]

let nextReqNum = 4
let nextLineId = 20

function makeId() { return `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }
function makeLineId() { return `line-${++nextLineId}` }

const INITIAL_REQS: Requirement[] = [
  {
    id: "r1", reference: "REQ-001", requiredBy: "2026-09-25",
    notes: "Monthly stock replenishment",
    status: "OPEN", createdBy: "Lolly Lolo", createdDate: "2026-09-18",
    lines: [
      { id: "l1", product: "Paracetamol 500mg", quantityNeeded: 100, quantityDelivered: 0, reason: "Low Stock", notes: "Below reorder threshold", supplier: "", status: "OPEN" },
      { id: "l2", product: "Amoxicillin 500mg", quantityNeeded: 50, quantityDelivered: 0, reason: "Reorder Alert", notes: "Monthly replenishment", supplier: "ABC Pharmaceuticals", status: "ASSIGNED" },
      { id: "l3", product: "Vitamin C 1000mg", quantityNeeded: 75, quantityDelivered: 0, reason: "Manual", notes: "", supplier: "", status: "OPEN" },
      { id: "l4", product: "Omeprazole 20mg", quantityNeeded: 40, quantityDelivered: 0, reason: "Low Stock", notes: "", supplier: "", status: "OPEN" },
      { id: "l5", product: "Cetirizine 10mg", quantityNeeded: 60, quantityDelivered: 0, reason: "Reorder Alert", notes: "", supplier: "", status: "OPEN" },
    ],
  },
  {
    id: "r2", reference: "REQ-002", requiredBy: "2026-09-27",
    notes: "Urgent restocking",
    status: "ASSIGNED", createdBy: "Lolly Lolo", createdDate: "2026-09-18",
    lines: [
      { id: "l6", product: "Ibuprofen 400mg", quantityNeeded: 80, quantityDelivered: 0, reason: "Low Stock", notes: "", supplier: "MediPharma", status: "ASSIGNED" },
      { id: "l7", product: "Metformin 850mg", quantityNeeded: 60, quantityDelivered: 0, reason: "Reorder Alert", notes: "", supplier: "MediPharma", status: "ASSIGNED" },
      { id: "l8", product: "Losartan 50mg", quantityNeeded: 30, quantityDelivered: 0, reason: "Low Stock", notes: "", supplier: "ABC Pharmaceuticals", status: "ASSIGNED" },
    ],
  },
  {
    id: "r3", reference: "REQ-003", requiredBy: "2026-09-30",
    notes: "End of month order",
    status: "CLOSED", createdBy: "Lolly Lolo", createdDate: "2026-09-17",
    lines: [
      { id: "l9", product: "Atorvastatin 20mg", quantityNeeded: 45, quantityDelivered: 45, reason: "Reorder Alert", notes: "", supplier: "GlobalMed Supply", status: "ASSIGNED" },
      { id: "l10", product: "Paracetamol 500mg", quantityNeeded: 120, quantityDelivered: 120, reason: "Low Stock", notes: "", supplier: "ABC Pharmaceuticals", status: "ASSIGNED" },
      { id: "l11", product: "Omeprazole 20mg", quantityNeeded: 50, quantityDelivered: 50, reason: "Manual", notes: "", supplier: "EthioHealth", status: "ASSIGNED" },
      { id: "l12", product: "Ibuprofen 400mg", quantityNeeded: 70, quantityDelivered: 70, reason: "Low Stock", notes: "", supplier: "MediPharma", status: "ASSIGNED" },
      { id: "l13", product: "Metformin 850mg", quantityNeeded: 40, quantityDelivered: 40, reason: "Reorder Alert", notes: "", supplier: "GlobalMed Supply", status: "ASSIGNED" },
      { id: "l14", product: "Cetirizine 10mg", quantityNeeded: 80, quantityDelivered: 80, reason: "Manual", notes: "", supplier: "ABC Pharmaceuticals", status: "ASSIGNED" },
      { id: "l15", product: "Vitamin C 1000mg", quantityNeeded: 90, quantityDelivered: 90, reason: "Low Stock", notes: "", supplier: "EthioHealth", status: "ASSIGNED" },
    ],
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function delay(ms = 700) { return new Promise((r) => setTimeout(r, ms)) }

function ReqBadge({ status }: { status: ReqStatus }) {
  const map: Record<ReqStatus, string> = {
    OPEN:     "bg-[#DBEFF3] text-[#49B0C1] border border-[#ABDBE3]",
    ASSIGNED: "bg-blue-100 text-blue-700",
    CLOSED:   "bg-gray-100 text-gray-500",
  }
  return <span className={`text-xs font-bold rounded-full px-2.5 py-0.5 ${map[status]}`}>{status}</span>
}

function LineBadge({ status }: { status: LineStatus }) {
  return status === "ASSIGNED"
    ? <span className="text-xs font-bold rounded-full px-2.5 py-0.5 bg-blue-100 text-blue-700">ASSIGNED</span>
    : <span className="text-xs font-bold rounded-full px-2.5 py-0.5 bg-[#DBEFF3] text-[#49B0C1] border border-[#ABDBE3]">OPEN</span>
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-[#333333] px-5 py-3.5 text-sm text-white shadow-xl animate-in fade-in slide-in-from-bottom-4">
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
    <div ref={ref} className="relative inline-block">
      <button onClick={() => setOpen((v) => !v)} className="p-1.5 rounded-lg text-[#666666] hover:bg-[#DBEFF3] transition-colors" aria-label="More actions">
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-44 rounded-xl border border-[#DBEFF3] bg-white shadow-xl py-1">
          {items.map((item) => (
            <button
              key={item.label}
              onClick={() => { setOpen(false); item.onClick() }}
              className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-[#DBEFF3]/60 ${item.danger ? "text-red-600" : "text-[#333333]"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Root page ────────────────────────────────────────────────────────────────

export default function PurchaseRequirementsPage() {
  const [reqs, setReqs] = useState<Requirement[]>(INITIAL_REQS)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [toast, setToast] = useState("")
  const [newOpen, setNewOpen] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)

  function showToast(msg: string) { setToast(msg) }
  function updateReq(updated: Requirement) { setReqs((prev) => prev.map((r) => r.id === updated.id ? updated : r)) }
  function deleteReq(id: string) { setReqs((prev) => prev.filter((r) => r.id !== id)) }

  const detail = reqs.find((r) => r.id === detailId) ?? null

  if (detail) {
    return (
      <>
        <RequirementDetailScreen
          req={detail}
          onBack={() => setDetailId(null)}
          onUpdate={updateReq}
          onToast={showToast}
        />
        {toast && <Toast message={toast} onDone={() => setToast("")} />}
      </>
    )
  }

  return (
    <>
      <RequirementsListScreen
        reqs={reqs}
        onSelect={(id) => setDetailId(id)}
        onNewReq={() => setNewOpen(true)}
        onGenerate={() => setGenerateOpen(true)}
        onDelete={deleteReq}
        onToast={showToast}
      />
      <NewRequirementModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreate={(r) => { setReqs((prev) => [r, ...prev]); setNewOpen(false); showToast("Requirement created successfully.") }}
      />
      <GenerateFromReorderModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onCreate={(r) => { setReqs((prev) => [r, ...prev]); setGenerateOpen(false); showToast("Requirement generated from reorder suggestions.") }}
      />
      {toast && <Toast message={toast} onDone={() => setToast("")} />}
    </>
  )
}

// ─── Requirements List Screen ─────────────────────────────────────────────────

function RequirementsListScreen({ reqs, onSelect, onNewReq, onGenerate, onDelete, onToast }: {
  reqs: Requirement[]
  onSelect: (id: string) => void
  onNewReq: () => void
  onGenerate: () => void
  onDelete: (id: string) => void
  onToast: (msg: string) => void
}) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [loading] = useState(false)
  const [page, setPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<Requirement | null>(null)
  const PAGE_SIZE = 10

  const filtered = reqs.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!r.reference.toLowerCase().includes(q) && !r.createdBy.toLowerCase().includes(q)) return false
    }
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const summary = {
    open:     reqs.filter((r) => r.status === "OPEN").length,
    assigned: reqs.filter((r) => r.status === "ASSIGNED").length,
    closed:   reqs.filter((r) => r.status === "CLOSED").length,
    total:    reqs.length,
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb="Purchasing / Requirements"
        title="Purchase Requirements"
        subtitle="Manage products that need to be purchased and prepare them for supplier ordering."
        actions={
          <div className="flex gap-2">
            <button onClick={onNewReq} className="inline-flex items-center gap-1.5 rounded-xl bg-white text-[#49B0C1] px-3.5 py-2 text-sm font-semibold hover:bg-[#DBEFF3] transition-colors">
              + New Requirement
            </button>
            <button onClick={onGenerate} className="inline-flex items-center gap-1.5 rounded-xl border border-white/30 bg-white/10 px-3.5 py-2 text-sm font-medium text-white hover:bg-white/20 transition-colors">
              Generate from Reorder
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-[#DBEFF3] p-4 flex flex-col gap-3">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search requirements..." />
          <div className="flex flex-wrap gap-3 items-center">
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className="flex-1 min-w-[160px] rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm focus:border-[#49B0C1] focus:outline-none">
              <option value="">All Statuses</option>
              <option>OPEN</option>
              <option>ASSIGNED</option>
              <option>CLOSED</option>
            </select>
            {(search || statusFilter) && (
              <button onClick={() => { setSearch(""); setStatusFilter(""); setPage(1) }} className="text-xs font-semibold text-[#49B0C1] hover:underline">Reset</button>
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {([
            ["Open Requirements",     summary.open,     "text-[#49B0C1]",  "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"],
            ["Assigned Requirements", summary.assigned, "text-blue-600",   "M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0zM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632z"],
            ["Closed Requirements",   summary.closed,   "text-gray-500",   "M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25z"],
            ["Total Requirements",    summary.total,    "text-[#333333]",  "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9z"],
          ] as [string, number, string, string][]).map(([label, value, accent, iconPath]) => (
            <div key={label} className="bg-white rounded-xl border border-[#DBEFF3] p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl bg-[#DBEFF3] flex items-center justify-center shrink-0 ${accent}`}>
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
                </svg>
              </div>
              <div>
                <p className="text-xs text-[#666666]">{label}</p>
                <p className={`text-2xl font-bold ${accent}`}>{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3 animate-pulse">
              {[...Array(5)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-[#DBEFF3]" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="h-16 w-16 rounded-2xl bg-[#DBEFF3] flex items-center justify-center">
                <svg className="h-8 w-8 text-[#49B0C1]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="font-semibold text-[#333333]">No purchase requirements yet</p>
                <p className="text-sm text-[#666666] mt-1">Create a requirement manually or generate one from reorder suggestions.</p>
              </div>
              <div className="flex gap-2 mt-2">
                <Button onClick={onNewReq}>+ New Requirement</Button>
                <Button variant="secondary" onClick={onGenerate}>Generate from Reorder</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#DBEFF3] text-left">
                      {["Reference", "Required By", "Items", "Status", "Created By", "Created Date", "Actions"].map((h) => (
                        <th key={h} className="px-4 py-3 font-semibold text-[#333333]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((r, i) => (
                      <tr key={r.id} className={`hover:bg-[#DBEFF3]/30 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/15"}`}>
                        <td className="px-4 py-3">
                          <button onClick={() => onSelect(r.id)} className="font-semibold text-[#49B0C1] hover:underline">
                            {r.reference}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-[#666666] whitespace-nowrap">{fmtDate(r.requiredBy)}</td>
                        <td className="px-4 py-3 text-[#666666]">{r.lines.length} item{r.lines.length !== 1 ? "s" : ""}</td>
                        <td className="px-4 py-3"><ReqBadge status={r.status} /></td>
                        <td className="px-4 py-3 text-[#666666]">{r.createdBy}</td>
                        <td className="px-4 py-3 text-[#666666] whitespace-nowrap">{fmtDate(r.createdDate)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => onSelect(r.id)} className="text-xs font-semibold text-[#49B0C1] hover:underline whitespace-nowrap">
                              View →
                            </button>
                            <OverflowMenu items={[
                              { label: "View", onClick: () => onSelect(r.id) },
                              { label: "Edit", onClick: () => onSelect(r.id) },
                              ...(r.status !== "CLOSED" ? [{ label: "Delete", danger: true, onClick: () => setDeleteTarget(r) }] : []),
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
                  Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} requirements
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

      {/* Delete confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Requirement?"
        message={`Delete ${deleteTarget?.reference}?`}
        detail="This action cannot be undone."
        confirmLabel="Delete"
        confirmClass="bg-red-600 hover:bg-red-700 text-white"
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => { await delay(500); onDelete(deleteTarget!.id); setDeleteTarget(null); onToast("Requirement deleted successfully.") }}
      />
    </div>
  )
}

// ─── Requirement Detail Screen ────────────────────────────────────────────────

function RequirementDetailScreen({ req, onBack, onUpdate, onToast }: {
  req: Requirement
  onBack: () => void
  onUpdate: (r: Requirement) => void
  onToast: (msg: string) => void
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [addProductOpen, setAddProductOpen] = useState(false)
  const [editLine, setEditLine] = useState<RequirementLine | null>(null)
  const [assignLine, setAssignLine] = useState<RequirementLine | null>(null)
  const [deleteLine, setDeleteLine] = useState<RequirementLine | null>(null)
  const [closeOpen, setCloseOpen] = useState(false)

  const isReadOnly = req.status === "CLOSED"

  function updateLine(updated: RequirementLine) {
    onUpdate({ ...req, lines: req.lines.map((l) => l.id === updated.id ? updated : l) })
  }
  function removeLine(id: string) {
    onUpdate({ ...req, lines: req.lines.filter((l) => l.id !== id) })
  }
  function addLine(line: RequirementLine) {
    onUpdate({ ...req, lines: [...req.lines, line] })
  }
  function closeReq() {
    onUpdate({ ...req, status: "CLOSED" })
    setCloseOpen(false)
    onToast("Requirement closed successfully.")
  }

  const reqStatus: ReqStatus = req.lines.length > 0 && req.lines.every((l) => l.status === "ASSIGNED")
    ? "ASSIGNED"
    : req.status === "CLOSED"
    ? "CLOSED"
    : "OPEN"

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-6 pt-5 pb-4" style={{ background: "linear-gradient(135deg, #49B0C1 0%, #3a9aaa 100%)" }}>
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors mb-3">
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
          Requirements
        </button>
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <p className="text-xs text-white/60 font-medium mb-0.5 tracking-wide">Purchase Requirement</p>
            <h1 className="text-xl font-bold text-white">{req.reference}</h1>
          </div>
          <ReqBadge status={reqStatus} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        {/* Section 1: Requirement Information */}
        <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#DBEFF3] flex items-center justify-between">
            <p className="text-xs font-bold text-[#666666] uppercase tracking-wide">Requirement Information</p>
            {!isReadOnly && (
              <div className="flex gap-3">
                <button onClick={() => setEditOpen(true)} className="text-xs font-semibold text-[#49B0C1] hover:underline">Edit Requirement</button>
                <button onClick={() => setCloseOpen(true)} className="text-xs font-semibold text-orange-500 hover:underline">Close Requirement</button>
              </div>
            )}
          </div>
          <div className="px-5 py-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {([
              ["Reference",    req.reference],
              ["Required By",  fmtDate(req.requiredBy)],
              ["Created By",   req.createdBy],
              ["Created Date", fmtDate(req.createdDate)],
              ["Status",       reqStatus],
              ["Notes",        req.notes || "—"],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-[#999] mb-0.5">{label}</p>
                {label === "Status"
                  ? <ReqBadge status={value as ReqStatus} />
                  : <p className="text-sm font-semibold text-[#333333]">{value}</p>
                }
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: Requirement Items */}
        <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#DBEFF3] flex items-center justify-between">
            <p className="text-xs font-bold text-[#666666] uppercase tracking-wide">
              Requirement Items <span className="text-[#49B0C1] ml-1">({req.lines.length})</span>
            </p>
            {!isReadOnly && (
              <button onClick={() => setAddProductOpen(true)} className="text-xs font-semibold text-[#49B0C1] hover:underline">+ Add Product</button>
            )}
          </div>
          {req.lines.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-[#999]">No products added. Click "+ Add Product" to begin.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#DBEFF3]/50 text-left">
                    <th className="px-4 py-3 font-semibold text-[#333333]">Product</th>
                    <th className="px-4 py-3 font-semibold text-[#333333] text-right">Needed</th>
                    <th className="px-4 py-3 font-semibold text-[#333333] text-right hidden sm:table-cell">Delivered</th>
                    <th className="px-4 py-3 font-semibold text-[#333333] hidden md:table-cell">Reason</th>
                    <th className="px-4 py-3 font-semibold text-[#333333] hidden lg:table-cell">Supplier</th>
                    <th className="px-4 py-3 font-semibold text-[#333333]">Status</th>
                    {!isReadOnly && <th className="px-4 py-3 font-semibold text-[#333333]">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {req.lines.map((line, idx) => (
                    <tr key={line.id} className={idx % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"}>
                      <td className="px-4 py-3 font-medium text-[#333333]">{line.product}</td>
                      <td className="px-4 py-3 text-right font-bold text-[#333333]">{line.quantityNeeded}</td>
                      <td className="px-4 py-3 text-right text-[#666666] hidden sm:table-cell">{line.quantityDelivered}</td>
                      <td className="px-4 py-3 text-[#666666] hidden md:table-cell">{line.reason || "—"}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        {line.supplier
                          ? <span className="text-[#333333] font-medium">{line.supplier}</span>
                          : <span className="text-[#999]">—</span>
                        }
                      </td>
                      <td className="px-4 py-3"><LineBadge status={line.status} /></td>
                      {!isReadOnly && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {!line.supplier && (
                              <button onClick={() => setAssignLine(line)} className="text-xs font-semibold text-[#49B0C1] hover:underline whitespace-nowrap">Assign</button>
                            )}
                            <OverflowMenu items={[
                              { label: "Edit", onClick: () => setEditLine(line) },
                              { label: line.supplier ? "Change Supplier" : "Assign Supplier", onClick: () => setAssignLine(line) },
                              { label: "Remove", danger: true, onClick: () => setDeleteLine(line) },
                            ]} />
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

        {isReadOnly && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 text-sm font-medium text-gray-500">
            This requirement is <strong>CLOSED</strong> and cannot be modified.
          </div>
        )}
      </div>

      {/* Modals */}
      <EditRequirementModal open={editOpen} req={req} onClose={() => setEditOpen(false)} onSave={(updates) => { onUpdate({ ...req, ...updates }); setEditOpen(false); onToast("Requirement updated successfully.") }} />
      <AddProductModal open={addProductOpen} existingProducts={req.lines.map((l) => l.product)} onClose={() => setAddProductOpen(false)} onAdd={(line) => { addLine(line); setAddProductOpen(false); onToast("Product added to requirement.") }} />
      <EditLineModal open={!!editLine} line={editLine} onClose={() => setEditLine(null)} onSave={(updated) => { updateLine(updated); setEditLine(null); onToast("Requirement item updated.") }} />
      <AssignSupplierModal open={!!assignLine} line={assignLine} onClose={() => setAssignLine(null)} onSave={(updated) => { updateLine(updated); setAssignLine(null); onToast("Supplier assigned successfully.") }} />
      <ConfirmModal
        open={!!deleteLine}
        title="Remove Requirement Item?"
        message={`Remove ${deleteLine?.product} from ${req.reference}?`}
        detail="This action cannot be undone."
        confirmLabel="Remove"
        confirmClass="bg-red-600 hover:bg-red-700 text-white"
        onClose={() => setDeleteLine(null)}
        onConfirm={async () => { await delay(400); removeLine(deleteLine!.id); setDeleteLine(null); onToast("Item removed from requirement.") }}
      />
      <ConfirmModal
        open={closeOpen}
        title="Close Requirement?"
        message={`Are you sure you want to close ${req.reference}?`}
        detail="Closed requirements cannot be modified."
        confirmLabel="Close Requirement"
        confirmClass="bg-orange-600 hover:bg-orange-700 text-white"
        onClose={() => setCloseOpen(false)}
        onConfirm={closeReq}
      />
    </div>
  )
}

// ─── New Requirement Modal ────────────────────────────────────────────────────

interface NewLine { product: string; quantity: string; reason: LineReason; notes: string }

function NewRequirementModal({ open, onClose, onCreate }: {
  open: boolean
  onClose: () => void
  onCreate: (r: Requirement) => void
}) {
  const [requiredBy, setRequiredBy] = useState("")
  const [notes, setNotes] = useState("")
  const [lines, setLines] = useState<NewLine[]>([{ product: PRODUCTS[0], quantity: "", reason: "Low Stock", notes: "" }])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  function addLine() { setLines((l) => [...l, { product: "", quantity: "", reason: "Low Stock", notes: "" }]) }
  function removeLine(i: number) { setLines((l) => l.filter((_, idx) => idx !== i)) }
  function updateLine(i: number, field: keyof NewLine, value: string) {
    setLines((l) => l.map((row, idx) => idx === i ? { ...row, [field]: value } : row))
  }

  async function handleCreate() {
    if (!requiredBy) { setError("Required By date is required."); return }
    if (lines.length === 0) { setError("Add at least one product."); return }
    for (const l of lines) {
      if (!l.product) { setError("Select a product for each row."); return }
      if (!l.quantity || parseInt(l.quantity) <= 0) { setError("Quantity must be greater than zero."); return }
    }
    const products = lines.map((l) => l.product)
    if (new Set(products).size !== products.length) { setError("Duplicate products are not allowed."); return }
    setError("")
    setLoading(true)
    await delay()
    setLoading(false)
    const num = `REQ-00${++nextReqNum}`
    onCreate({
      id: makeId(),
      reference: num,
      requiredBy,
      notes,
      status: "OPEN",
      createdBy: "Current User",
      createdDate: new Date().toISOString().slice(0, 10),
      lines: lines.map((l) => ({
        id: makeLineId(),
        product: l.product,
        quantityNeeded: parseInt(l.quantity),
        quantityDelivered: 0,
        reason: l.reason,
        notes: l.notes,
        supplier: "",
        status: "OPEN",
      })),
    })
    setRequiredBy(""); setNotes(""); setLines([{ product: PRODUCTS[0], quantity: "", reason: "Low Stock", notes: "" }])
  }

  return (
    <Modal open={open} title="Create Purchase Requirement" onClose={onClose} size="lg">
      <div className="flex flex-col gap-5">
        {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <div className="grid sm:grid-cols-2 gap-4">
          <Fw label="Required By">
            <input type="date" value={requiredBy} onChange={(e) => setRequiredBy(e.target.value)} className={SC} />
          </Fw>
          <Fw label="Notes">
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add notes about this purchase requirement..." className={SC} />
          </Fw>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-[#333333]">Products</p>
            <button onClick={addLine} className="text-xs font-semibold text-[#49B0C1] hover:underline">+ Add Row</button>
          </div>
          <div className="rounded-xl border border-[#DBEFF3] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#DBEFF3]">
                    {["Product", "Qty Needed", "Reason", "Notes", ""].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold text-[#333333] text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"}>
                      <td className="px-3 py-2">
                        <select value={line.product} onChange={(e) => updateLine(i, "product", e.target.value)} className={SC}>
                          <option value="">Select product...</option>
                          {PRODUCTS.map((p) => <option key={p}>{p}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min={1} value={line.quantity} onChange={(e) => updateLine(i, "quantity", e.target.value)} className={`${SC} w-20`} placeholder="0" />
                      </td>
                      <td className="px-3 py-2">
                        <select value={line.reason} onChange={(e) => updateLine(i, "reason", e.target.value as LineReason)} className={SC}>
                          <option value="">No reason</option>
                          <option>Low Stock</option>
                          <option>Reorder Alert</option>
                          <option>Manual</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input value={line.notes} onChange={(e) => updateLine(i, "notes", e.target.value)} className={SC} placeholder="Optional..." />
                      </td>
                      <td className="px-3 py-2">
                        {lines.length > 1 && (
                          <button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600 p-1" title="Remove">
                            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end border-t border-[#DBEFF3] pt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} loading={loading}>Create Requirement</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Generate from Reorder Modal ──────────────────────────────────────────────

function GenerateFromReorderModal({ open, onClose, onCreate }: {
  open: boolean
  onClose: () => void
  onCreate: (r: Requirement) => void
}) {
  const [loading, setLoading] = useState(false)

  async function handleGenerate() {
    setLoading(true)
    await delay(900)
    setLoading(false)
    const num = `REQ-00${++nextReqNum}`
    onCreate({
      id: makeId(),
      reference: num,
      requiredBy: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      notes: "Auto-generated from reorder suggestions.",
      status: "OPEN",
      createdBy: "System",
      createdDate: new Date().toISOString().slice(0, 10),
      lines: REORDER_SUGGESTIONS.map((s) => ({
        id: makeLineId(),
        product: s.product,
        quantityNeeded: s.quantity,
        quantityDelivered: 0,
        reason: "Reorder Alert",
        notes: "",
        supplier: "",
        status: "OPEN",
      })),
    })
  }

  return (
    <Modal open={open} title="Generate Purchase Requirement" onClose={onClose} size="sm">
      <p className="text-sm text-[#666666] -mt-2 mb-4">The system will create a purchase requirement from the current reorder suggestions.</p>
      <div className="rounded-xl border border-[#DBEFF3] p-4 mb-5">
        <p className="text-xs font-bold text-[#666666] uppercase tracking-wide mb-3">Products to Purchase</p>
        <ul className="space-y-2">
          {REORDER_SUGGESTIONS.map((s) => (
            <li key={s.product} className="flex items-center justify-between text-sm">
              <span className="text-[#333333] font-medium">{s.product}</span>
              <span className="font-bold text-[#49B0C1]">{s.quantity}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-lg bg-[#DBEFF3]/60 px-4 py-2.5 mb-5 text-sm font-semibold text-[#333333]">
        {REORDER_SUGGESTIONS.length} products require purchasing
      </div>
      <div className="flex gap-3 justify-end">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleGenerate} loading={loading}>Generate Requirement</Button>
      </div>
    </Modal>
  )
}

// ─── Edit Requirement Modal ───────────────────────────────────────────────────

function EditRequirementModal({ open, req, onClose, onSave }: {
  open: boolean
  req: Requirement
  onClose: () => void
  onSave: (updates: { requiredBy: string; notes: string }) => void
}) {
  const [requiredBy, setRequiredBy] = useState(req.requiredBy)
  const [notes, setNotes] = useState(req.notes)
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    setLoading(true)
    await delay(500)
    setLoading(false)
    onSave({ requiredBy, notes })
  }

  return (
    <Modal open={open} title="Edit Requirement" onClose={onClose} size="sm">
      <div className="flex flex-col gap-4">
        <Fw label="Required By">
          <input type="date" value={requiredBy} onChange={(e) => setRequiredBy(e.target.value)} className={SC} />
        </Fw>
        <Fw label="Notes">
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${SC} resize-none`} placeholder="Add notes..." />
        </Fw>
        <div className="flex gap-3 justify-end border-t border-[#DBEFF3] pt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={loading}>Save Changes</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Add Product Modal ────────────────────────────────────────────────────────

function AddProductModal({ open, existingProducts, onClose, onAdd }: {
  open: boolean
  existingProducts: string[]
  onClose: () => void
  onAdd: (line: RequirementLine) => void
}) {
  const [product, setProduct] = useState("")
  const [quantity, setQuantity] = useState("")
  const [reason, setReason] = useState<LineReason>("Low Stock")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleAdd() {
    if (!product) { setError("Please select a product."); return }
    if (!quantity || parseInt(quantity) <= 0) { setError("Quantity must be greater than zero."); return }
    if (existingProducts.includes(product)) { setError("This product is already in the requirement."); return }
    setError("")
    setLoading(true)
    await delay(500)
    setLoading(false)
    onAdd({ id: makeLineId(), product, quantityNeeded: parseInt(quantity), quantityDelivered: 0, reason, notes, supplier: "", status: "OPEN" })
    setProduct(""); setQuantity(""); setReason("Low Stock"); setNotes("")
  }

  return (
    <Modal open={open} title="Add Product to Requirement" onClose={onClose} size="sm">
      <div className="flex flex-col gap-4">
        {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <Fw label="Product">
          <select value={product} onChange={(e) => setProduct(e.target.value)} className={SC}>
            <option value="">Select product...</option>
            {PRODUCTS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Fw>
        <Fw label="Quantity Needed">
          <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} className={SC} placeholder="0" />
        </Fw>
        <Fw label="Reason">
          <select value={reason} onChange={(e) => setReason(e.target.value as LineReason)} className={SC}>
            <option>Low Stock</option>
            <option>Reorder Alert</option>
            <option>Manual</option>
          </select>
        </Fw>
        <Fw label="Notes (optional)">
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${SC} resize-none`} placeholder="Optional notes..." />
        </Fw>
        <div className="flex gap-3 justify-end border-t border-[#DBEFF3] pt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAdd} loading={loading}>Add Product</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Edit Line Modal ──────────────────────────────────────────────────────────

function EditLineModal({ open, line, onClose, onSave }: {
  open: boolean
  line: RequirementLine | null
  onClose: () => void
  onSave: (updated: RequirementLine) => void
}) {
  const [quantity, setQuantity] = useState(line?.quantityNeeded.toString() ?? "")
  const [reason, setReason] = useState<LineReason>(line?.reason ?? "Low Stock")
  const [notes, setNotes] = useState(line?.notes ?? "")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (line) { setQuantity(line.quantityNeeded.toString()); setReason(line.reason); setNotes(line.notes) }
  }, [line])

  async function handleSave() {
    setLoading(true)
    await delay(500)
    setLoading(false)
    onSave({ ...line!, quantityNeeded: parseInt(quantity), reason, notes })
  }

  return (
    <Modal open={open} title="Edit Requirement Item" onClose={onClose} size="sm">
      <div className="flex flex-col gap-4">
        {line?.product && (
          <div className="rounded-xl bg-[#DBEFF3]/50 px-4 py-3">
            <p className="text-xs text-[#999]">Product</p>
            <p className="text-sm font-bold text-[#333333]">{line.product}</p>
            {line.supplier && <p className="text-xs text-[#666666] mt-1">Supplier: {line.supplier}</p>}
          </div>
        )}
        <Fw label="Quantity Needed">
          <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} className={SC} />
        </Fw>
        <Fw label="Reason">
          <select value={reason} onChange={(e) => setReason(e.target.value as LineReason)} className={SC}>
            <option>Low Stock</option>
            <option>Reorder Alert</option>
            <option>Manual</option>
          </select>
        </Fw>
        <Fw label="Notes">
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${SC} resize-none`} placeholder="Optional notes..." />
        </Fw>
        <div className="flex gap-3 justify-end border-t border-[#DBEFF3] pt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={loading}>Save Changes</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Assign Supplier Modal ────────────────────────────────────────────────────

function AssignSupplierModal({ open, line, onClose, onSave }: {
  open: boolean
  line: RequirementLine | null
  onClose: () => void
  onSave: (updated: RequirementLine) => void
}) {
  const [supplier, setSupplier] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (line) setSupplier(line.supplier || "") }, [line])

  const selectedSupplier = SUPPLIERS.find((s) => s.name === supplier)

  async function handleAssign() {
    if (!supplier) return
    setLoading(true)
    await delay(600)
    setLoading(false)
    onSave({ ...line!, supplier, status: "ASSIGNED" })
  }

  return (
    <Modal open={open} title="Assign Supplier" onClose={onClose} size="sm">
      <div className="flex flex-col gap-4">
        {line && (
          <div className="rounded-xl bg-[#DBEFF3]/50 px-4 py-3 grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-[#999]">Product</p>
              <p className="text-sm font-bold text-[#333333]">{line.product}</p>
            </div>
            <div>
              <p className="text-xs text-[#999]">Quantity Needed</p>
              <p className="text-sm font-bold text-[#333333]">{line.quantityNeeded}</p>
            </div>
          </div>
        )}
        <Fw label="Supplier">
          <select value={supplier} onChange={(e) => setSupplier(e.target.value)} className={SC}>
            <option value="">Select supplier...</option>
            {SUPPLIERS.map((s) => <option key={s.name}>{s.name}</option>)}
          </select>
        </Fw>
        {selectedSupplier && (
          <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-2.5 text-sm text-blue-700">
            Payment Terms: <strong>{selectedSupplier.terms}</strong>
          </div>
        )}
        <div className="flex gap-3 justify-end border-t border-[#DBEFF3] pt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAssign} loading={loading} disabled={!supplier}>Assign Supplier</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

function ConfirmModal({ open, title, message, detail, confirmLabel, confirmClass, onClose, onConfirm }: {
  open: boolean; title: string; message: string; detail?: string
  confirmLabel: string; confirmClass: string; onClose: () => void; onConfirm: () => void
}) {
  const [loading, setLoading] = useState(false)
  async function go() { setLoading(true); await onConfirm(); setLoading(false) }
  return (
    <Modal open={open} title={title} onClose={onClose} size="sm">
      <p className="text-sm text-[#666666]">{message}</p>
      {detail && <p className="mt-2 text-xs text-[#999]">{detail}</p>}
      <div className="flex gap-3 justify-end mt-6">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <button onClick={go} disabled={loading} className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${confirmClass}`}>
          {loading ? "..." : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

// ─── Shared atoms ─────────────────────────────────────────────────────────────

const SC = "w-full rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm focus:border-[#49B0C1] focus:outline-none bg-white"

function Fw({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium text-[#333333] block mb-1.5">{label}</label>
      {children}
    </div>
  )
}
