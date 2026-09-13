import { useState, useMemo } from "react"
import PageHeader from "../../components/ui/PageHeader"
import SearchInput from "../../components/ui/SearchInput"
import Select from "../../components/ui/Select"
import Pagination from "../../components/ui/Pagination"
import EmptyState from "../../components/ui/EmptyState"
import Modal from "../../components/ui/Modal"
import Button from "../../components/ui/Button"

// ─── Types ────────────────────────────────────────────────────────────────────

type PaymentMethod = "Cash" | "Card" | "Digital Transfer" | "Insurance"
type SaleStatus = "completed" | "voided" | "refunded"

interface SaleItem {
  product: string
  brand: string
  batch: string
  unit: string
  qty: number
  unitPrice: number
  discount: number
}

interface SalePayment {
  method: PaymentMethod
  amount: number
}

interface Sale {
  id: string
  invoice: string
  date: string
  time: string
  cashier: string
  items: SaleItem[]
  payments: SalePayment[]
  subtotal: number
  discount: number
  tax: number
  total: number
  status: SaleStatus
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_SALES: Sale[] = [
  {
    id: "s1",
    invoice: "INV-00131",
    date: "Sep 13, 2026",
    time: "16:42",
    cashier: "Hana",
    items: [
      { product: "Paracetamol 500mg", brand: "MediCore", batch: "PCT-2024-001", unit: "Strip", qty: 3, unitPrice: 25, discount: 0 },
      { product: "Vitamin C 500mg", brand: "VitaPlus", batch: "VIT-2024-003", unit: "Bottle", qty: 1, unitPrice: 95, discount: 0 },
    ],
    payments: [{ method: "Cash", amount: 170 }],
    subtotal: 170, discount: 0, tax: 0, total: 170, status: "completed",
  },
  {
    id: "s2",
    invoice: "INV-00130",
    date: "Sep 13, 2026",
    time: "15:18",
    cashier: "Sara",
    items: [
      { product: "Amoxicillin 500mg", brand: "Pharma Plus", batch: "AMX-2024-002", unit: "Box", qty: 1, unitPrice: 120, discount: 0 },
      { product: "Ibuprofen 400mg", brand: "PainAway", batch: "IBU-2024-001", unit: "Strip", qty: 2, unitPrice: 35, discount: 5 },
    ],
    payments: [{ method: "Card", amount: 185 }],
    subtotal: 190, discount: 5, tax: 0, total: 185, status: "completed",
  },
  {
    id: "s3",
    invoice: "INV-00129",
    date: "Sep 13, 2026",
    time: "13:55",
    cashier: "Hana",
    items: [
      { product: "Atorvastatin 20mg", brand: "CardioLife", batch: "ATV-2024-001", unit: "Strip", qty: 3, unitPrice: 145, discount: 0 },
    ],
    payments: [{ method: "Digital Transfer", amount: 435 }],
    subtotal: 435, discount: 0, tax: 65.25, total: 500.25, status: "completed",
  },
  {
    id: "s4",
    invoice: "INV-00128",
    date: "Sep 13, 2026",
    time: "11:30",
    cashier: "Sara",
    items: [
      { product: "Omeprazole 20mg", brand: "GastroShield", batch: "OMP-2024-001", unit: "Strip", qty: 2, unitPrice: 45, discount: 0 },
      { product: "Cetirizine 10mg", brand: "AllerFree", batch: "CTZ-2024-001", unit: "Strip", qty: 1, unitPrice: 20, discount: 0 },
    ],
    payments: [{ method: "Cash", amount: 110 }],
    subtotal: 110, discount: 0, tax: 0, total: 110, status: "completed",
  },
  {
    id: "s5",
    invoice: "INV-00127",
    date: "Sep 13, 2026",
    time: "09:12",
    cashier: "Hana",
    items: [
      { product: "Losartan 50mg", brand: "PressureX", batch: "LOS-2024-001", unit: "Strip", qty: 1, unitPrice: 60, discount: 0 },
    ],
    payments: [{ method: "Cash", amount: 60 }],
    subtotal: 60, discount: 0, tax: 0, total: 60, status: "voided",
  },
  {
    id: "s6",
    invoice: "INV-00126",
    date: "Sep 12, 2026",
    time: "17:05",
    cashier: "Sara",
    items: [
      { product: "Paracetamol 500mg", brand: "MediCore", batch: "PCT-2024-001", unit: "Box", qty: 2, unitPrice: 25, discount: 0 },
      { product: "Amoxicillin 500mg", brand: "Pharma Plus", batch: "AMX-2024-001", unit: "Strip", qty: 4, unitPrice: 12, discount: 10 },
      { product: "Cetirizine 10mg", brand: "AllerFree", batch: "CTZ-2024-001", unit: "Tablet", qty: 10, unitPrice: 2, discount: 0 },
    ],
    payments: [{ method: "Insurance", amount: 98 }],
    subtotal: 108, discount: 10, tax: 0, total: 98, status: "completed",
  },
  {
    id: "s7",
    invoice: "INV-00125",
    date: "Sep 12, 2026",
    time: "14:33",
    cashier: "Hana",
    items: [
      { product: "Metformin 850mg", brand: "GlucoMed", batch: "MET-2023-003", unit: "Strip", qty: 5, unitPrice: 35, discount: 0 },
      { product: "Atorvastatin 20mg", brand: "CardioLife", batch: "ATV-2024-001", unit: "Strip", qty: 2, unitPrice: 145, discount: 20 },
    ],
    payments: [
      { method: "Cash", amount: 300 },
      { method: "Card", amount: 115 },
    ],
    subtotal: 435, discount: 20, tax: 0, total: 415, status: "refunded",
  },
  {
    id: "s8",
    invoice: "INV-00124",
    date: "Sep 12, 2026",
    time: "11:20",
    cashier: "Sara",
    items: [
      { product: "Ibuprofen 400mg", brand: "PainAway", batch: "IBU-2024-001", unit: "Box", qty: 1, unitPrice: 35, discount: 0 },
    ],
    payments: [{ method: "Cash", amount: 35 }],
    subtotal: 35, discount: 0, tax: 0, total: 35, status: "completed",
  },
  {
    id: "s9",
    invoice: "INV-00123",
    date: "Sep 11, 2026",
    time: "16:00",
    cashier: "Hana",
    items: [
      { product: "Omeprazole 20mg", brand: "GastroShield", batch: "OMP-2024-001", unit: "Capsule", qty: 10, unitPrice: 4.5, discount: 0 },
      { product: "Losartan 50mg", brand: "PressureX", batch: "LOS-2024-001", unit: "Tablet", qty: 14, unitPrice: 6, discount: 0 },
    ],
    payments: [{ method: "Digital Transfer", amount: 129 }],
    subtotal: 129, discount: 0, tax: 19.35, total: 148.35, status: "completed",
  },
  {
    id: "s10",
    invoice: "INV-00122",
    date: "Sep 11, 2026",
    time: "10:45",
    cashier: "Sara",
    items: [
      { product: "Cetirizine 10mg", brand: "AllerFree", batch: "CTZ-2024-001", unit: "Box", qty: 2, unitPrice: 20, discount: 0 },
      { product: "Vitamin C 500mg", brand: "VitaPlus", batch: "VIT-2024-003", unit: "Bottle", qty: 2, unitPrice: 95, discount: 10 },
    ],
    payments: [{ method: "Card", amount: 220 }],
    subtotal: 230, discount: 10, tax: 0, total: 220, status: "completed",
  },
]

const CASHIERS = [...new Set(MOCK_SALES.map((s) => s.cashier))]
const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "Card", "Digital Transfer", "Insurance"]

const PAGE_SIZE = 8

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SalesPage() {
  const [search, setSearch] = useState("")
  const [dateFilter, setDateFilter] = useState("")
  const [methodFilter, setMethodFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [cashierFilter, setCashierFilter] = useState("")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Sale | null>(null)

  const filtered = useMemo(() => {
    let rows = MOCK_SALES
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(
        (s) =>
          s.invoice.toLowerCase().includes(q) ||
          s.cashier.toLowerCase().includes(q) ||
          s.items.some((i) => i.product.toLowerCase().includes(q))
      )
    }
    if (statusFilter) rows = rows.filter((s) => s.status === statusFilter)
    if (cashierFilter) rows = rows.filter((s) => s.cashier === cashierFilter)
    if (methodFilter)
      rows = rows.filter((s) =>
        s.payments.some((p) => p.method === methodFilter)
      )
    return rows
  }, [search, statusFilter, cashierFilter, methodFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const summary = useMemo(() => ({
    total: filtered.length,
    revenue: filtered.filter((s) => s.status === "completed").reduce((acc, s) => acc + s.total, 0),
    voided: filtered.filter((s) => s.status === "voided").length,
    refunded: filtered.filter((s) => s.status === "refunded").length,
  }), [filtered])

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        title="Sales"
        subtitle="View and manage completed sales transactions, receipts, payments, and sale details."
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => alert("Export — backend integration pending")}
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20 transition-colors"
            >
              <DownloadIcon /> Export
            </button>
            <button
              onClick={() => alert("Print — backend integration pending")}
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20 transition-colors"
            >
              <PrintIcon /> Print
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        {/* Summary strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SummaryCard label="Transactions" value={summary.total} />
          <SummaryCard label="Revenue" value={`${summary.revenue.toLocaleString("en-ET", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`} />
          <SummaryCard label="Voided" value={summary.voided} accent="text-orange-600" />
          <SummaryCard label="Refunded" value={summary.refunded} accent="text-red-600" />
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-[#DBEFF3] p-4 flex flex-col gap-3">
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); setPage(1) }}
            placeholder="Search invoice, product, cashier..."
          />
          <div className="flex flex-wrap gap-3">
            <Select value={methodFilter} onChange={(e) => { setMethodFilter(e.target.value); setPage(1) }} className="flex-1 min-w-[140px]">
              <option value="">All Payment Methods</option>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
            <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className="flex-1 min-w-[130px]">
              <option value="">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="voided">Voided</option>
              <option value="refunded">Refunded</option>
            </Select>
            <Select value={cashierFilter} onChange={(e) => { setCashierFilter(e.target.value); setPage(1) }} className="flex-1 min-w-[130px]">
              <option value="">All Cashiers</option>
              {CASHIERS.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
          {filtered.length === 0 ? (
            <EmptyState title="No sales found" description="Adjust your search or filters." />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#DBEFF3] text-left">
                      <th className="px-4 py-3 font-semibold text-[#333333] whitespace-nowrap">Date & Time</th>
                      <th className="px-4 py-3 font-semibold text-[#333333]">Invoice #</th>
                      <th className="px-4 py-3 font-semibold text-[#333333]">Items</th>
                      <th className="px-4 py-3 font-semibold text-[#333333] hidden md:table-cell">Cashier</th>
                      <th className="px-4 py-3 font-semibold text-[#333333] hidden lg:table-cell">Payment</th>
                      <th className="px-4 py-3 font-semibold text-[#333333] hidden sm:table-cell text-right">Subtotal</th>
                      <th className="px-4 py-3 font-semibold text-[#333333] hidden xl:table-cell text-right">Discount</th>
                      <th className="px-4 py-3 font-semibold text-[#333333] hidden xl:table-cell text-right">Tax</th>
                      <th className="px-4 py-3 font-semibold text-[#333333] text-right">Total</th>
                      <th className="px-4 py-3 font-semibold text-[#333333]">Status</th>
                      <th className="px-4 py-3 font-semibold text-[#333333]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((sale, i) => (
                      <tr
                        key={sale.id}
                        onClick={() => setSelected(sale)}
                        className={`cursor-pointer hover:bg-[#DBEFF3]/30 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/10"}`}
                      >
                        <td className="px-4 py-3 text-[#666666] whitespace-nowrap">
                          <span className="block text-xs text-[#999]">{sale.date}</span>
                          <span className="text-sm font-medium text-[#333333]">{sale.time}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-sm font-semibold text-[#333333]">{sale.invoice}</td>
                        <td className="px-4 py-3 text-[#666666]">
                          {sale.items.length} item{sale.items.length !== 1 ? "s" : ""}
                        </td>
                        <td className="px-4 py-3 text-[#666666] hidden md:table-cell">{sale.cashier}</td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {sale.payments.map((p) => (
                              <PaymentBadge key={p.method} method={p.method} />
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-[#666666] hidden sm:table-cell">
                          {sale.subtotal.toLocaleString()} ETB
                        </td>
                        <td className="px-4 py-3 text-right hidden xl:table-cell">
                          {sale.discount > 0 ? (
                            <span className="text-orange-600">−{sale.discount} ETB</span>
                          ) : (
                            <span className="text-[#999]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right hidden xl:table-cell">
                          {sale.tax > 0 ? (
                            <span className="text-[#666666]">{sale.tax.toLocaleString()} ETB</span>
                          ) : (
                            <span className="text-[#999]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-[#333333] whitespace-nowrap">
                          {sale.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={sale.status} />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelected(sale) }}
                            className="text-xs font-semibold text-[#49B0C1] hover:underline whitespace-nowrap"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </>
          )}
        </div>
      </div>

      {/* Sale Detail Modal */}
      {selected && (
        <SaleDetailModal sale={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

// ─── Sale Detail Modal ─────────────────────────────────────────────────────────

function SaleDetailModal({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const itemTotal = (item: SaleItem) => item.qty * item.unitPrice - item.discount

  return (
    <Modal open title={`Sale ${sale.invoice}`} onClose={onClose} size="lg">
      <div className="flex flex-col gap-5">
        {/* Header meta */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetaCell label="Date" value={`${sale.date} ${sale.time}`} />
          <MetaCell label="Cashier" value={sale.cashier} />
          <MetaCell label="Status" value={<StatusBadge status={sale.status} />} />
          <MetaCell label="Payment" value={
            <div className="flex flex-wrap gap-1">
              {sale.payments.map((p) => <PaymentBadge key={p.method} method={p.method} />)}
            </div>
          } />
        </div>

        {/* Items */}
        <div>
          <p className="text-xs font-semibold text-[#666666] uppercase tracking-wide mb-2">Items</p>
          <div className="rounded-xl border border-[#DBEFF3] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#DBEFF3] text-left">
                    {["Product", "Brand", "Batch", "Unit", "Qty", "Unit Price", "Discount", "Total"].map((h) => (
                      <th key={h} className="px-3 py-2.5 font-semibold text-[#333333] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sale.items.map((item, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"}>
                      <td className="px-3 py-2.5 font-medium text-[#333333]">{item.product}</td>
                      <td className="px-3 py-2.5 text-[#666666]">{item.brand}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-[#666666]">{item.batch}</td>
                      <td className="px-3 py-2.5 text-[#666666]">{item.unit}</td>
                      <td className="px-3 py-2.5 text-center font-semibold text-[#333333]">{item.qty}</td>
                      <td className="px-3 py-2.5 text-right text-[#333333]">{item.unitPrice.toLocaleString()} ETB</td>
                      <td className="px-3 py-2.5 text-right">
                        {item.discount > 0 ? (
                          <span className="text-orange-600">−{item.discount} ETB</span>
                        ) : (
                          <span className="text-[#999]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-[#333333]">
                        {itemTotal(item).toLocaleString()} ETB
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Summary + Payment side by side */}
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Summary */}
          <div className="bg-[#DBEFF3]/40 rounded-xl p-4 flex flex-col gap-2">
            <p className="text-xs font-semibold text-[#666666] uppercase tracking-wide mb-1">Summary</p>
            <SummaryRow label="Subtotal" value={`${sale.subtotal.toLocaleString()} ETB`} />
            <SummaryRow label="Discount" value={sale.discount > 0 ? `−${sale.discount} ETB` : "—"} accent={sale.discount > 0} />
            <SummaryRow label="Tax" value={sale.tax > 0 ? `${sale.tax.toLocaleString()} ETB` : "—"} />
            <div className="border-t border-[#ABDBE3] pt-2 mt-1">
              <SummaryRow label="Total" value={`${sale.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`} bold />
            </div>
          </div>

          {/* Payment breakdown */}
          <div className="bg-[#DBEFF3]/40 rounded-xl p-4 flex flex-col gap-2">
            <p className="text-xs font-semibold text-[#666666] uppercase tracking-wide mb-1">Payment</p>
            {sale.payments.map((p) => (
              <SummaryRow key={p.method} label={p.method} value={`${p.amount.toLocaleString()} ETB`} />
            ))}
            <div className="border-t border-[#ABDBE3] pt-2 mt-1">
              <SummaryRow
                label="Total Paid"
                value={`${sale.payments.reduce((a, p) => a + p.amount, 0).toLocaleString()} ETB`}
                bold
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 justify-between border-t border-[#DBEFF3] pt-4">
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => alert("Print Receipt — backend pending")}>
              <PrintIcon /> Print Receipt
            </Button>
            {sale.status === "completed" && (
              <>
                <Button variant="secondary" onClick={() => alert("Void Sale — backend pending")}>
                  Void Sale
                </Button>
                <Button variant="secondary" onClick={() => alert("Return / Refund — backend pending")}>
                  Return / Refund
                </Button>
              </>
            )}
          </div>
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Small components ─────────────────────────────────────────────────────────

function SummaryCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="bg-white rounded-xl border border-[#DBEFF3] p-4">
      <p className="text-xs font-medium text-[#666666] uppercase tracking-wide">{label}</p>
      <p className={`text-xl font-bold mt-1 ${accent ?? "text-[#333333]"}`}>{value}</p>
    </div>
  )
}

function MetaCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-[#666666]">{label}</p>
      <div className="mt-0.5 text-sm font-medium text-[#333333]">{value}</div>
    </div>
  )
}

function SummaryRow({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${bold ? "font-semibold text-[#333333]" : "text-[#666666]"}`}>{label}</span>
      <span className={`text-sm ${bold ? "font-bold text-[#333333]" : accent ? "text-orange-600 font-medium" : "text-[#333333]"}`}>{value}</span>
    </div>
  )
}

function StatusBadge({ status }: { status: SaleStatus }) {
  const cfg: Record<SaleStatus, { label: string; cls: string }> = {
    completed: { label: "Completed", cls: "bg-green-100 text-green-700" },
    voided: { label: "Voided", cls: "bg-orange-100 text-orange-700" },
    refunded: { label: "Refunded", cls: "bg-red-100 text-red-700" },
  }
  const c = cfg[status]
  return (
    <span className={`text-xs font-semibold rounded-full px-2.5 py-0.5 ${c.cls}`}>{c.label}</span>
  )
}

function PaymentBadge({ method }: { method: PaymentMethod }) {
  const cfg: Record<PaymentMethod, string> = {
    Cash: "bg-green-100 text-green-700",
    Card: "bg-blue-100 text-blue-700",
    "Digital Transfer": "bg-purple-100 text-purple-700",
    Insurance: "bg-[#DBEFF3] text-[#49B0C1]",
  }
  return (
    <span className={`text-xs font-semibold rounded-full px-2 py-0.5 whitespace-nowrap ${cfg[method]}`}>{method}</span>
  )
}

function DownloadIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  )
}

function PrintIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a1 1 0 001 1h8a1 1 0 001-1v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a1 1 0 00-1-1H6a1 1 0 00-1 1zm2 0h6v3H7V4zm-1 9v-1h8v1H6zm6-4a1 1 0 110-2 1 1 0 010 2z" clipRule="evenodd" />
    </svg>
  )
}
