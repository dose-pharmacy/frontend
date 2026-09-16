import { useState } from "react"
import PageHeader from "../../components/ui/PageHeader"
import SearchInput from "../../components/ui/SearchInput"
import Modal from "../../components/ui/Modal"
import Button from "../../components/ui/Button"

// ─── Types ─────────────────────────────────────────────────────────────────

type TransferStatus = "DRAFT" | "COMPLETED" | "CANCELLED"

interface TransferItem {
  id: string
  product: string
  batch: string
  unit: string
  quantity: number
}

interface Transfer {
  id: string
  transferNumber: string
  from: string
  to: string
  date: string
  reason: string
  status: TransferStatus
  items: TransferItem[]
}

// ─── Mock data ──────────────────────────────────────────────────────────────

const LOCATIONS = ["Main Store", "Branch Store", "Dispensing Area", "Cold Storage"]

const PRODUCTS = ["Amoxicillin 500mg", "Paracetamol 500mg", "Ibuprofen 400mg", "Metformin 850mg", "Omeprazole 20mg", "Cetirizine 10mg"]
const BATCHES: Record<string, string[]> = {
  "Amoxicillin 500mg": ["AMX-B1", "AMX-B2"],
  "Paracetamol 500mg": ["PCM-B1", "PCM-B2"],
  "Ibuprofen 400mg": ["IBU-B1"],
  "Metformin 850mg": ["MET-B1"],
  "Omeprazole 20mg": ["OMP-B1"],
  "Cetirizine 10mg": ["CTZ-B1"],
}
const UNITS = ["Box", "Strip", "Bottle", "Vial", "Tablet", "Capsule"]

let nextId = 5
let nextItemId = 10

const INITIAL_TRANSFERS: Transfer[] = [
  {
    id: "t1",
    transferNumber: "TR-001",
    from: "Main Store",
    to: "Branch Store",
    date: "2026-09-16",
    reason: "Branch replenishment",
    status: "DRAFT",
    items: [
      { id: "i1", product: "Paracetamol 500mg", batch: "PCM-B1", unit: "Box", quantity: 2 },
      { id: "i2", product: "Amoxicillin 500mg", batch: "AMX-B1", unit: "Box", quantity: 5 },
    ],
  },
  {
    id: "t2",
    transferNumber: "TR-002",
    from: "Main Store",
    to: "Dispensing Area",
    date: "2026-09-15",
    reason: "Dispensing restocking",
    status: "COMPLETED",
    items: [
      { id: "i3", product: "Ibuprofen 400mg", batch: "IBU-B1", unit: "Strip", quantity: 10 },
    ],
  },
  {
    id: "t3",
    transferNumber: "TR-003",
    from: "Main Store",
    to: "Branch Store",
    date: "2026-09-14",
    reason: "Emergency stock",
    status: "CANCELLED",
    items: [
      { id: "i4", product: "Metformin 850mg", batch: "MET-B1", unit: "Box", quantity: 3 },
    ],
  },
  {
    id: "t4",
    transferNumber: "TR-004",
    from: "Dispensing Area",
    to: "Main Store",
    date: "2026-09-13",
    reason: "Return to main",
    status: "DRAFT",
    items: [
      { id: "i5", product: "Omeprazole 20mg", batch: "OMP-B1", unit: "Bottle", quantity: 4 },
    ],
  },
]

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function StatusBadge({ status }: { status: TransferStatus }) {
  const map: Record<TransferStatus, string> = {
    DRAFT:     "bg-yellow-100 text-yellow-700",
    COMPLETED: "bg-green-100 text-green-700",
    CANCELLED: "bg-red-100 text-red-700",
  }
  return <span className={`text-xs font-bold rounded-full px-2.5 py-0.5 ${map[status]}`}>{status}</span>
}

// ─── Root page ───────────────────────────────────────────────────────────────

type Screen = "list" | "detail" | "new"

export default function StockTransferPage() {
  const [transfers, setTransfers] = useState<Transfer[]>(INITIAL_TRANSFERS)
  const [screen, setScreen] = useState<Screen>("list")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = transfers.find((t) => t.id === selectedId) ?? null

  function updateTransfer(updated: Transfer) {
    setTransfers((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
  }

  function createTransfer(data: {
    from: string
    to: string
    date: string
    reason: string
    items: TransferItem[]
  }) {
    const id = `t${nextId++}`
    const num = `TR-00${nextId}`
    const transfer: Transfer = {
      id,
      transferNumber: num,
      from: data.from,
      to: data.to,
      date: data.date,
      reason: data.reason,
      status: "DRAFT",
      items: data.items,
    }
    setTransfers((prev) => [transfer, ...prev])
    setScreen("list")
    setSelectedId(null)
  }

  // ── New Transfer screen ────────────────────────────────────────────────
  if (screen === "new") {
    return (
      <NewTransferScreen
        onBack={() => setScreen("list")}
        onCancel={() => setScreen("list")}
        onCreate={createTransfer}
      />
    )
  }

  // ── Transfer Details screen ────────────────────────────────────────────
  if (screen === "detail" && selected) {
    return (
      <TransferDetailsScreen
        transfer={selected}
        onBack={() => { setScreen("list"); setSelectedId(null) }}
        onUpdate={updateTransfer}
      />
    )
  }

  // ── List screen ────────────────────────────────────────────────────────
  return (
    <TransferListScreen
      transfers={transfers}
      onSelect={(id) => { setSelectedId(id); setScreen("detail") }}
      onNewTransfer={() => setScreen("new")}
    />
  )
}

// ─── Transfer List Screen ────────────────────────────────────────────────────

function TransferListScreen({
  transfers, onSelect, onNewTransfer,
}: {
  transfers: Transfer[]
  onSelect: (id: string) => void
  onNewTransfer: () => void
}) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [fromFilter, setFromFilter] = useState("")
  const [toFilter, setToFilter] = useState("")

  const filtered = transfers.filter((t) => {
    if (search) {
      const q = search.toLowerCase()
      if (!t.transferNumber.toLowerCase().includes(q) && !t.from.toLowerCase().includes(q) && !t.to.toLowerCase().includes(q)) return false
    }
    if (statusFilter && t.status !== statusFilter) return false
    if (fromFilter && t.from !== fromFilter) return false
    if (toFilter && t.to !== toFilter) return false
    return true
  })

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb="Inventory / Transfers"
        title="Transfers"
        subtitle="Manage stock transfers between pharmacy locations."
        actions={
          <button
            onClick={onNewTransfer}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white text-[#49B0C1] px-3.5 py-2 text-sm font-semibold hover:bg-[#DBEFF3] transition-colors"
          >
            + New Transfer
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-[#DBEFF3] p-4 flex flex-col gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search transfers..." />
          <div className="flex flex-wrap gap-3 items-center">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="flex-1 min-w-[140px] rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm focus:border-[#49B0C1] focus:outline-none">
              <option value="">All Statuses</option>
              <option>DRAFT</option>
              <option>COMPLETED</option>
              <option>CANCELLED</option>
            </select>
            <select value={fromFilter} onChange={(e) => setFromFilter(e.target.value)} className="flex-1 min-w-[140px] rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm focus:border-[#49B0C1] focus:outline-none">
              <option value="">From Location</option>
              {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
            </select>
            <select value={toFilter} onChange={(e) => setToFilter(e.target.value)} className="flex-1 min-w-[140px] rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm focus:border-[#49B0C1] focus:outline-none">
              <option value="">To Location</option>
              {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
            </select>
            {(search || statusFilter || fromFilter || toFilter) && (
              <button onClick={() => { setSearch(""); setStatusFilter(""); setFromFilter(""); setToFilter("") }} className="text-xs font-semibold text-[#49B0C1] hover:underline whitespace-nowrap">
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#DBEFF3] text-left">
                  {["Transfer #", "From", "To", "Status", "Date", "Items", ""].map((h) => (
                    <th key={h} className="px-4 py-3 font-semibold text-[#333333]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-[#999]">No transfers found.</td>
                  </tr>
                ) : filtered.map((t, i) => (
                  <tr
                    key={t.id}
                    onClick={() => onSelect(t.id)}
                    className={`cursor-pointer transition-colors hover:bg-[#DBEFF3]/40 ${i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"}`}
                  >
                    <td className="px-4 py-3 font-semibold text-[#49B0C1]">{t.transferNumber}</td>
                    <td className="px-4 py-3 text-[#333333]">{t.from}</td>
                    <td className="px-4 py-3 text-[#333333]">{t.to}</td>
                    <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3 text-[#666666] whitespace-nowrap">{fmtDate(t.date)}</td>
                    <td className="px-4 py-3 text-[#666666]">{t.items.length} item{t.items.length !== 1 ? "s" : ""}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold text-[#49B0C1]">View →</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── NEW: Create Transfer Screen (Add Transfer page) ────────────────────────

function NewTransferScreen({
  onBack, onCancel, onCreate,
}: {
  onBack: () => void
  onCancel: () => void
  onCreate: (data: { from: string; to: string; date: string; reason: string; items: TransferItem[] }) => void
}) {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState("")
  const [items, setItems] = useState<TransferItem[]>([])
  const [addItemOpen, setAddItemOpen] = useState(false)
  const [error, setError] = useState("")

  function handleAddItem(item: TransferItem) {
    setItems((prev) => [...prev, item])
    setAddItemOpen(false)
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  function handleCreate() {
    if (!from) { setError("Please select a source location."); return }
    if (!to)   { setError("Please select a destination location."); return }
    if (from === to) { setError("Source and destination must be different."); return }
    if (!date) { setError("Please select a transfer date."); return }
    if (items.length === 0) { setError("Please add at least one item to this transfer."); return }
    setError("")
    onCreate({ from, to, date, reason, items })
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#DBEFF3] px-6 pt-5 pb-5 flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-medium text-[#49B0C1] hover:underline mb-3"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
          Transfers
        </button>
        <h1 className="text-xl font-bold text-[#333333]">Create New Transfer</h1>
        <p className="text-sm text-[#666666] mt-1">Create a stock transfer between pharmacy locations.</p>
      </div>

      {/* ── Scrollable body ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 flex-shrink-0">
            {error}
          </div>
        )}

        {/* ── Card 1: Transfer Information ───────────────────── */}
        <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-visible flex-shrink-0">
          <div className="px-5 py-3 border-b border-[#DBEFF3]">
            <p className="text-xs font-bold text-[#666666] uppercase tracking-wide">Transfer Information</p>
          </div>
          <div className="px-5 py-5 grid sm:grid-cols-2 gap-x-5 gap-y-5">
            <FieldWrap label="From Location *">
              <select
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className={SELECT_CLS}
              >
                <option value="">Select source location</option>
                {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </FieldWrap>

            <FieldWrap label="To Location *">
              <select
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className={SELECT_CLS}
              >
                <option value="">Select destination location</option>
                {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </FieldWrap>

            <FieldWrap label="Transfer Date *">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={SELECT_CLS}
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
        <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#DBEFF3] flex items-center justify-between">
            <p className="text-xs font-bold text-[#666666] uppercase tracking-wide">
              Transfer Items
              {items.length > 0 && <span className="text-[#49B0C1] ml-1">({items.length})</span>}
            </p>
            <button
              onClick={() => setAddItemOpen(true)}
              className="rounded-xl border border-[#ABDBE3] bg-white px-3 py-1.5 text-xs font-semibold text-[#49B0C1] hover:bg-[#DBEFF3]/50 transition-colors"
            >
              + Add Item
            </button>
          </div>

          {items.length === 0 ? (
            <div className="px-5 py-12 flex flex-col items-center justify-center text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#DBEFF3]/50 flex items-center justify-center">
                <svg className="w-6 h-6 text-[#49B0C1]" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-[#333333]">No items added</p>
              <p className="text-xs text-[#999]">Add products to this transfer before creating it.</p>
              <button
                onClick={() => setAddItemOpen(true)}
                className="mt-1 rounded-xl bg-[#49B0C1] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3a9aaa] transition-colors"
              >
                + Add Item
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#DBEFF3]/50 text-left">
                    <th className="px-4 py-3 font-semibold text-[#333333]">Product</th>
                    <th className="px-4 py-3 font-semibold text-[#333333]">Batch</th>
                    <th className="px-4 py-3 font-semibold text-[#333333]">Unit</th>
                    <th className="px-4 py-3 font-semibold text-[#333333] text-right">Quantity</th>
                    <th className="px-4 py-3 font-semibold text-[#333333]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"}>
                      <td className="px-4 py-3 font-medium text-[#333333]">{item.product}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[#666666]">{item.batch}</td>
                      <td className="px-4 py-3 text-[#666666]">{item.unit}</td>
                      <td className="px-4 py-3 text-right font-bold text-[#333333]">{item.quantity}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => removeItem(item.id)}
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
      <div className="bg-white border-t border-[#DBEFF3] px-6 py-4 flex justify-end gap-3 flex-shrink-0">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleCreate}>Create Transfer</Button>
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

// ─── Add Transfer Item Modal ────────────────────────────────────────────────

function AddTransferItemModal({
  open, onClose, onAdd,
}: {
  open: boolean
  onClose: () => void
  onAdd: (item: TransferItem) => void
}) {
  const [product, setProduct] = useState("")
  const [batch, setBatch] = useState("")
  const [unit, setUnit] = useState("")
  const [quantity, setQuantity] = useState("")
  const [error, setError] = useState("")

  const batchOptions = product ? BATCHES[product] ?? [] : []

  function reset() {
    setProduct("")
    setBatch("")
    setUnit("")
    setQuantity("")
    setError("")
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleAdd() {
    if (!product) { setError("Please select a product."); return }
    if (!batch)   { setError("Please select a batch."); return }
    if (!unit)    { setError("Please select a unit."); return }
    const qty = parseInt(quantity)
    if (!qty || qty <= 0) { setError("Quantity must be a positive number."); return }
    setError("")
    onAdd({
      id: `i${++nextItemId}`,
      product,
      batch,
      unit,
      quantity: qty,
    })
    reset()
  }

  return (
    <Modal open={open} title="Add Transfer Item" onClose={handleClose} size="sm">
      <div className="flex flex-col gap-4">
        {error && (
          <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <FieldWrap label="Product *">
          <select
            value={product}
            onChange={(e) => { setProduct(e.target.value); setBatch("") }}
            className={SELECT_CLS}
          >
            <option value="">Select product...</option>
            {PRODUCTS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </FieldWrap>

        <FieldWrap label="Batch *">
          <select
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            className={SELECT_CLS}
            disabled={!product}
          >
            <option value="">Select batch...</option>
            {batchOptions.map((b) => <option key={b}>{b}</option>)}
          </select>
        </FieldWrap>

        <FieldWrap label="Unit *">
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className={SELECT_CLS}
          >
            <option value="">Select unit...</option>
            {UNITS.map((u) => <option key={u}>{u}</option>)}
          </select>
        </FieldWrap>

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

        <div className="flex gap-3 justify-end border-t border-[#DBEFF3] pt-4">
          <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleAdd}>Add Item</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Transfer Details Screen ─────────────────────────────────────────────────

function TransferDetailsScreen({
  transfer, onBack, onUpdate,
}: {
  transfer: Transfer
  onBack: () => void
  onUpdate: (t: Transfer) => void
}) {
  const [editTransferOpen, setEditTransferOpen] = useState(false)
  const [addItemOpen, setAddItemOpen] = useState(false)
  const [editItem, setEditItem] = useState<TransferItem | null>(null)
  const [deleteItem, setDeleteItem] = useState<TransferItem | null>(null)
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false)
  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false)

  const isReadOnly = transfer.status !== "DRAFT"

  function saveTransferInfo(info: { from: string; to: string; date: string; reason: string }) {
    onUpdate({ ...transfer, ...info })
  }

  function saveItem(item: TransferItem) {
    const exists = transfer.items.find((i) => i.id === item.id)
    const items = exists
      ? transfer.items.map((i) => (i.id === item.id ? item : i))
      : [...transfer.items, item]
    onUpdate({ ...transfer, items })
  }

  function removeItem(id: string) {
    onUpdate({ ...transfer, items: transfer.items.filter((i) => i.id !== id) })
  }

  function completeTransfer() {
    onUpdate({ ...transfer, status: "COMPLETED" })
    setCompleteConfirmOpen(false)
  }

  function cancelTransfer() {
    onUpdate({ ...transfer, status: "CANCELLED" })
    setCancelConfirmOpen(false)
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div
        className="px-6 pt-5 pb-4"
        style={{ background: "linear-gradient(135deg, #49B0C1 0%, #3a9aaa 100%)" }}
      >
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors mb-3">
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
          Transfers
        </button>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-white">Transfer #{transfer.transferNumber}</h1>
          <StatusBadge status={transfer.status} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        {/* Section 1: Transfer Information */}
        <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#DBEFF3] flex items-center justify-between">
            <p className="text-xs font-bold text-[#666666] uppercase tracking-wide">Transfer Information</p>
            {!isReadOnly && (
              <button onClick={() => setEditTransferOpen(true)} className="text-xs font-semibold text-[#49B0C1] hover:underline">
                Edit Transfer
              </button>
            )}
          </div>
          <div className="px-5 py-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              ["From", transfer.from],
              ["To", transfer.to],
              ["Date", fmtDate(transfer.date)],
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
        <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#DBEFF3] flex items-center justify-between">
            <p className="text-xs font-bold text-[#666666] uppercase tracking-wide">
              Transfer Items <span className="text-[#49B0C1] ml-1">({transfer.items.length})</span>
            </p>
            {!isReadOnly && (
              <button onClick={() => setAddItemOpen(true)} className="text-xs font-semibold text-[#49B0C1] hover:underline">
                + Add Item
              </button>
            )}
          </div>
          {transfer.items.length === 0 ? (
            <p className="px-5 py-8 text-sm text-center text-[#999]">No items added. Click "+ Add Item" to begin.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#DBEFF3]/50 text-left">
                    <th className="px-4 py-3 font-semibold text-[#333333]">Product</th>
                    <th className="px-4 py-3 font-semibold text-[#333333]">Batch</th>
                    <th className="px-4 py-3 font-semibold text-[#333333]">Unit</th>
                    <th className="px-4 py-3 font-semibold text-[#333333] text-right">Quantity</th>
                    {!isReadOnly && <th className="px-4 py-3 font-semibold text-[#333333]">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {transfer.items.map((item, idx) => (
                    <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"}>
                      <td className="px-4 py-3 font-medium text-[#333333]">{item.product}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[#666666]">{item.batch}</td>
                      <td className="px-4 py-3 text-[#666666]">{item.unit}</td>
                      <td className="px-4 py-3 text-right font-bold text-[#333333]">{item.quantity}</td>
                      {!isReadOnly && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <button onClick={() => setEditItem(item)} className="text-xs font-semibold text-[#49B0C1] hover:underline">Edit</button>
                            <button onClick={() => setDeleteItem(item)} className="text-xs font-semibold text-red-500 hover:underline">Delete</button>
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
          <div className="bg-white rounded-xl border border-[#DBEFF3] px-5 py-4 flex items-center justify-between flex-wrap gap-3">
            <p className="text-xs font-bold text-[#666666] uppercase tracking-wide">Transfer Actions</p>
            <div className="flex gap-3">
              <button
                onClick={() => setCancelConfirmOpen(true)}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors"
              >
                Cancel Transfer
              </button>
              <button
                onClick={() => setCompleteConfirmOpen(true)}
                disabled={transfer.items.length === 0}
                className="rounded-xl bg-[#49B0C1] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3a9aaa] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Complete Transfer
              </button>
            </div>
          </div>
        )}

        {isReadOnly && (
          <div className={`rounded-xl border px-5 py-4 text-sm font-medium ${transfer.status === "COMPLETED" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>
            This transfer is <strong>{transfer.status}</strong> and is read-only.
          </div>
        )}
      </div>

      {/* Modals */}
      <EditTransferModal
        open={editTransferOpen}
        transfer={transfer}
        onClose={() => setEditTransferOpen(false)}
        onSave={(info) => { saveTransferInfo(info); setEditTransferOpen(false) }}
      />
      <ItemModal
        open={addItemOpen || !!editItem}
        item={editItem}
        onClose={() => { setAddItemOpen(false); setEditItem(null) }}
        onSave={(item) => { saveItem(item); setAddItemOpen(false); setEditItem(null) }}
      />
      <ConfirmModal
        open={!!deleteItem}
        title="Remove this item?"
        message={`Remove ${deleteItem?.product} (${deleteItem?.batch}) from this transfer?`}
        confirmLabel="Remove Item"
        confirmClass="bg-red-600 hover:bg-red-700 text-white"
        onClose={() => setDeleteItem(null)}
        onConfirm={() => { removeItem(deleteItem!.id); setDeleteItem(null) }}
      />
      <ConfirmModal
        open={cancelConfirmOpen}
        title="Cancel Transfer?"
        message="Are you sure you want to cancel this transfer? This action will cancel the entire transfer."
        confirmLabel="Cancel Transfer"
        confirmClass="bg-red-600 hover:bg-red-700 text-white"
        onClose={() => setCancelConfirmOpen(false)}
        onConfirm={cancelTransfer}
      />
      <ConfirmModal
        open={completeConfirmOpen}
        title="Complete Transfer?"
        message={`This will complete the stock transfer from ${transfer.from} to ${transfer.to}.`}
        detail={`${transfer.items.length} item${transfer.items.length !== 1 ? "s" : ""} will be transferred.`}
        confirmLabel="Complete Transfer"
        confirmClass="bg-[#49B0C1] hover:bg-[#3a9aaa] text-white"
        onClose={() => setCompleteConfirmOpen(false)}
        onConfirm={completeTransfer}
      />
    </div>
  )
}

// ─── Edit Transfer Modal ─────────────────────────────────────────────────────

function EditTransferModal({
  open, transfer, onClose, onSave,
}: {
  open: boolean
  transfer: Transfer
  onClose: () => void
  onSave: (info: { from: string; to: string; date: string; reason: string }) => void
}) {
  const [from, setFrom] = useState(transfer.from)
  const [to, setTo] = useState(transfer.to)
  const [date, setDate] = useState(transfer.date)
  const [reason, setReason] = useState(transfer.reason)
  const [error, setError] = useState("")

  function handleSave() {
    if (from === to) { setError("Source and destination must be different."); return }
    setError("")
    onSave({ from, to, date, reason })
  }

  return (
    <Modal open={open} title="Edit Transfer" onClose={onClose} size="sm">
      <div className="flex flex-col gap-4">
        {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <FieldWrap label="From Location">
          <select value={from} onChange={(e) => setFrom(e.target.value)} className={SELECT_CLS}>
            {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
          </select>
        </FieldWrap>
        <FieldWrap label="To Location">
          <select value={to} onChange={(e) => setTo(e.target.value)} className={SELECT_CLS}>
            {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
          </select>
        </FieldWrap>
        <FieldWrap label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={SELECT_CLS} />
        </FieldWrap>
        <FieldWrap label="Reason">
          <input value={reason} onChange={(e) => setReason(e.target.value)} className={SELECT_CLS} placeholder="Transfer reason..." />
        </FieldWrap>
        <div className="flex gap-3 justify-end border-t border-[#DBEFF3] pt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Add / Edit Item Modal (Details screen) ─────────────────────────────────

function ItemModal({
  open, item, onClose, onSave,
}: {
  open: boolean
  item: TransferItem | null
  onClose: () => void
  onSave: (item: TransferItem) => void
}) {
  const isEdit = !!item
  const [product, setProduct] = useState(item?.product ?? PRODUCTS[0])
  const [batch, setBatch] = useState(item?.batch ?? "")
  const [unit, setUnit] = useState(item?.unit ?? UNITS[0])
  const [quantity, setQuantity] = useState(item?.quantity.toString() ?? "")
  const [error, setError] = useState("")

  const batchOptions = BATCHES[product] ?? []

  function handleSave() {
    const qty = parseInt(quantity)
    if (!batch) { setError("Please select a batch."); return }
    if (!qty || qty <= 0) { setError("Quantity must be a positive number."); return }
    setError("")
    onSave({
      id: item?.id ?? `i${++nextItemId}`,
      product,
      batch,
      unit,
      quantity: qty,
    })
  }

  return (
    <Modal open={open} title={isEdit ? "Edit Transfer Item" : "Add Transfer Item"} onClose={onClose} size="sm">
      <div className="flex flex-col gap-4">
        {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <FieldWrap label="Product">
          <select value={product} onChange={(e) => { setProduct(e.target.value); setBatch("") }} className={SELECT_CLS}>
            {PRODUCTS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </FieldWrap>
        <FieldWrap label="Batch">
          <select value={batch} onChange={(e) => setBatch(e.target.value)} className={SELECT_CLS}>
            <option value="">Select batch...</option>
            {batchOptions.map((b) => <option key={b}>{b}</option>)}
          </select>
        </FieldWrap>
        <FieldWrap label="Unit">
          <select value={unit} onChange={(e) => setUnit(e.target.value)} className={SELECT_CLS}>
            {UNITS.map((u) => <option key={u}>{u}</option>)}
          </select>
        </FieldWrap>
        <FieldWrap label="Quantity">
          <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} className={SELECT_CLS} placeholder="0" />
        </FieldWrap>
        <div className="flex gap-3 justify-end border-t border-[#DBEFF3] pt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>{isEdit ? "Save Changes" : "Add Item"}</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Confirm Modal ───────────────────────────────────────────────────────────

function ConfirmModal({
  open, title, message, detail, confirmLabel, confirmClass, onClose, onConfirm,
}: {
  open: boolean
  title: string
  message: string
  detail?: string
  confirmLabel: string
  confirmClass: string
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Modal open={open} title={title} onClose={onClose} size="sm">
      <p className="text-sm text-[#666666]">{message}</p>
      {detail && (
        <p className="mt-3 rounded-lg bg-[#DBEFF3]/60 px-4 py-2.5 text-sm font-semibold text-[#333333]">{detail}</p>
      )}
      <div className="flex gap-3 justify-end mt-6">
        <Button variant="secondary" onClick={onClose}>Go Back</Button>
        <button onClick={onConfirm} className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${confirmClass}`}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

// ─── Shared micro-components ──────────────────────────────────────────────────

const SELECT_CLS = "w-full rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm focus:border-[#49B0C1] focus:outline-none bg-white"

function FieldWrap({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium text-[#333333] block mb-1.5">{label}</label>
      {children}
    </div>
  )
}