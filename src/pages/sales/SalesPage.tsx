import { useEffect, useMemo, useState } from "react"
import PageHeader from "../../components/ui/PageHeader"
import SearchInput from "../../components/ui/SearchInput"
import Select from "../../components/ui/Select"
import Pagination from "../../components/ui/Pagination"
import EmptyState from "../../components/ui/EmptyState"
import Modal from "../../components/ui/Modal"
import Button from "../../components/ui/Button"
import Input from "../../components/ui/Input"
import FormError from "../../components/ui/FormError"
import {
  listSales,
  getSale,
  cancelSale,
  SalesApiError,
  type SaleDto,
  type SaleItemDto,
  type SaleStatus,
} from "../../features/sales/salesApi"

// ─── Types (UI view of a sale) ───────────────────────────────────────────────

type PaymentMethod = "Cash" | "Card" | "Digital Transfer" | "Insurance"
type SaleStatusUi = "completed" | "voided" | "refunded"

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
  status: SaleStatusUi
}

// ─── DTO → UI adaptation ─────────────────────────────────────────────────────

const METHOD_TO_UI: Record<string, PaymentMethod> = {
  CASH: "Cash",
  CARD: "Card",
  DIGITAL_TRANSFER: "Digital Transfer",
  INSURANCE: "Insurance",
}

function methodLabel(method: string): PaymentMethod {
  return METHOD_TO_UI[method] ?? "Cash"
}

function toUiStatus(status: SaleStatus): SaleStatusUi {
  if (status === "COMPLETED") return "completed"
  if (status === "CANCELLED" || status === "DRAFT") return "voided"
  return "refunded"
}

function fmtDateTime(iso: string) {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
  }
}

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function adaptSale(dto: SaleDto, detail?: SaleDto | null): Sale {
  // List rows can arrive with empty items/payments — enrich them from the
  // freshly fetched detail so modal contents and table counts stay right.
  const itemsSource = dto.items.length > 0 ? dto.items : detail?.items ?? []
  const paymentsSource = dto.payments.length > 0 ? dto.payments : detail?.payments ?? []
  const items: SaleItem[] = itemsSource.map((it) => ({
    product: it.product?.name ?? it.productId,
    brand: it.product?.brand ?? "—",
    batch: it.batchAllocations[0]?.batch.batchNumber ?? "—",
    unit: it.unit?.name ?? "—",
    qty: it.quantity,
    unitPrice: it.actualUnitPrice,
    discount: it.discountAmount,
  }))
  const payments: SalePayment[] = paymentsSource.map((p) => ({
    method: methodLabel(p.method),
    amount: p.amount,
  }))
  // The API reports amounts exclusive of tax; tax isn't part of the sale schema.
  const tax = 0
  const { date, time } = fmtDateTime(dto.completedAt ?? dto.createdAt)
  return {
    id: dto.id,
    invoice: dto.saleNumber,
    date,
    time,
    cashier: dto.cashier?.name ?? "—",
    items,
    payments,
    subtotal: dto.subtotal,
    discount: dto.totalDiscount,
    tax,
    total: dto.totalAmount,
    status: toUiStatus(dto.status),
  }
}

const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "Card", "Digital Transfer", "Insurance"]

const PAGE_SIZE = 8
const SWEEP_LIMIT = 100

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [dateFilter, setDateFilter] = useState("")
  const [methodFilter, setMethodFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [cashierFilter, setCashierFilter] = useState("")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Sale | null>(null)
  const [reloadTick, setReloadTick] = useState(0)

  // GET /pos/sales — one paginated sweep, then client-side slicing. The
  // search/cashier/method/date filters have no direct API counterpart on the
  // list endpoint (search matches sale numbers server-side; the rest don't
  // exist as query params), so the loaded page of sales is filtered locally.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const first = await listSales({ page: 1, limit: SWEEP_LIMIT, search: search.trim() || undefined })
        const rows = [...first.data]
        const totalPages = Math.min(first.meta?.totalPages ?? 1, 10)
        for (let p = 2; p <= totalPages; p++) {
          const next = await listSales({ page: p, limit: SWEEP_LIMIT })
          rows.push(...next.data)
        }
        if (cancelled) return
        setSales(rows.map((dto) => adaptSale(dto)))
        setLoadError(null)
      } catch (err) {
        if (cancelled) return
        setLoadError(
          err instanceof SalesApiError
            ? err.message
            : "Failed to load sales. Please try again."
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [search, reloadTick])

  const cashiers = useMemo(
    () => [...new Set(sales.map((s) => s.cashier))].filter((c) => c !== "—"),
    [sales]
  )

  const filtered = useMemo(() => {
    let rows = sales
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(
        (s) =>
          s.invoice.toLowerCase().includes(q) ||
          s.cashier.toLowerCase().includes(q) ||
          s.items.some((i) => i.product.toLowerCase().includes(q))
      )
    }
    if (dateFilter) rows = rows.filter((s) => s.date === dateFilter)
    if (statusFilter) rows = rows.filter((s) => s.status === statusFilter)
    if (cashierFilter) rows = rows.filter((s) => s.cashier === cashierFilter)
    if (methodFilter)
      rows = rows.filter((s) =>
        s.payments.some((p) => p.method === methodFilter)
      )
    return rows
  }, [sales, search, dateFilter, statusFilter, cashierFilter, methodFilter])

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
          <SummaryCard label="Transactions" value={loading ? "—" : summary.total} />
          <SummaryCard label="Revenue" value={loading ? "—" : `${summary.revenue.toLocaleString("en-ET", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`} />
          <SummaryCard label="Voided" value={loading ? "—" : summary.voided} accent="text-orange-600" />
          <SummaryCard label="Refunded" value={loading ? "—" : summary.refunded} accent="text-red-600" />
        </div>

        {loadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {loadError}
          </div>
        )}

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
              {cashiers.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value); setPage(1) }}
              className="flex-1 min-w-[130px]"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
          {loading ? (
            <LoadingSkeleton />
          ) : filtered.length === 0 ? (
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
                            {sale.payments.length === 0
                              ? <span className="text-[#999] text-xs">—</span>
                              : sale.payments.map((p, idx) => (
                                <PaymentBadge key={`${p.method}-${idx}`} method={p.method} />
                              ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-[#666666] hidden sm:table-cell">
                          {sale.subtotal.toLocaleString()} ETB
                        </td>
                        <td className="px-4 py-3 text-right hidden xl:table-cell">
                          {sale.discount > 0 ? (
                            <span className="text-orange-600">−{sale.discount.toLocaleString()} ETB</span>
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
        <SaleDetailModal
          sale={selected}
          onClose={() => setSelected(null)}
          onVoided={() => {
            setSelected(null)
            setReloadTick((t) => t + 1)
          }}
        />
      )}
    </div>
  )
}

// ─── Sale Detail Modal ─────────────────────────────────────────────────────────

function SaleDetailModal({
  sale,
  onClose,
  onVoided,
}: {
  sale: Sale
  onClose: () => void
  onVoided: () => void
}) {
  // Always fetch the receipt detail — list rows can omit items/payments.
  const [detail, setDetail] = useState<Sale | null>(sale.items.length > 0 ? sale : null)
  const [detailLoading, setDetailLoading] = useState(sale.items.length === 0)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [voiding, setVoiding] = useState(false)
  const [voidError, setVoidError] = useState<string | null>(null)
  const [voidPromptOpen, setVoidPromptOpen] = useState(false)
  const [voidReason, setVoidReason] = useState("")

  useEffect(() => {
    let cancelled = false
    getSale(sale.id)
      .then((dto) => { if (!cancelled) setDetail(adaptSale(dto)) })
      .catch((err: unknown) => {
        if (cancelled) return
        // Fall back to the row data we already have.
        setDetail(sale)
        setDetailError(
          err instanceof SalesApiError ? err.message : "Failed to load the receipt detail."
        )
      })
      .finally(() => { if (!cancelled) setDetailLoading(false) })
    return () => { cancelled = true }
  }, [sale])

  const view = detail ?? sale

  async function handleVoid() {
    if (!voidReason.trim()) return
    setVoiding(true)
    setVoidError(null)
    try {
      await cancelSale(view.id, voidReason.trim())
      onVoided()
    } catch (err) {
      setVoidError(
        err instanceof SalesApiError
          ? err.message
          : "Failed to cancel the sale. Please try again."
      )
    } finally {
      setVoiding(false)
    }
  }

  const itemTotal = (item: SaleItem) => item.qty * item.unitPrice - item.discount

  return (
    <Modal open title={`Sale ${view.invoice}`} onClose={onClose} size="lg">
      <div className="flex flex-col gap-5">
        <FormError message={detailError ?? voidError} />

        {/* Header meta */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetaCell label="Date" value={`${view.date} ${view.time}`} />
          <MetaCell label="Cashier" value={view.cashier} />
          <MetaCell label="Status" value={<StatusBadge status={view.status} />} />
          <MetaCell label="Payment" value={
            <div className="flex flex-wrap gap-1">
              {view.payments.length === 0
                ? <span className="text-[#999] text-xs">—</span>
                : view.payments.map((p, idx) => (
                  <PaymentBadge key={`${p.method}-${idx}`} method={p.method} />
                ))}
            </div>
          } />
        </div>

        {/* Items */}
        <div>
          <p className="text-xs font-semibold text-[#666666] uppercase tracking-wide mb-2">Items</p>
          <div className="rounded-xl border border-[#DBEFF3] overflow-hidden">
            {detailLoading ? (
              <div className="p-4 space-y-2 animate-pulse">
                {[...Array(3)].map((_, i) => <div key={i} className="h-8 rounded-lg bg-[#DBEFF3]" />)}
              </div>
            ) : view.items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-[#666666]">
                No line items recorded for this sale.
              </p>
            ) : (
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
                    {view.items.map((item, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"}>
                        <td className="px-3 py-2.5 font-medium text-[#333333]">{item.product}</td>
                        <td className="px-3 py-2.5 text-[#666666]">{item.brand}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-[#666666]">{item.batch}</td>
                        <td className="px-3 py-2.5 text-[#666666]">{item.unit}</td>
                        <td className="px-3 py-2.5 text-center font-semibold text-[#333333]">{item.qty}</td>
                        <td className="px-3 py-2.5 text-right text-[#333333]">{item.unitPrice.toLocaleString()} ETB</td>
                        <td className="px-3 py-2.5 text-right">
                          {item.discount > 0 ? (
                            <span className="text-orange-600">−{item.discount.toLocaleString()} ETB</span>
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
            )}
          </div>
        </div>

        {/* Summary + Payment side by side */}
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Summary */}
          <div className="bg-[#DBEFF3]/40 rounded-xl p-4 flex flex-col gap-2">
            <p className="text-xs font-semibold text-[#666666] uppercase tracking-wide mb-1">Summary</p>
            <SummaryRow label="Subtotal" value={`${view.subtotal.toLocaleString()} ETB`} />
            <SummaryRow label="Discount" value={view.discount > 0 ? `−${view.discount.toLocaleString()} ETB` : "—"} accent={view.discount > 0} />
            <SummaryRow label="Tax" value={view.tax > 0 ? `${view.tax.toLocaleString()} ETB` : "—"} />
            <div className="border-t border-[#ABDBE3] pt-2 mt-1">
              <SummaryRow label="Total" value={`${view.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`} bold />
            </div>
          </div>

          {/* Payment breakdown */}
          <div className="bg-[#DBEFF3]/40 rounded-xl p-4 flex flex-col gap-2">
            <p className="text-xs font-semibold text-[#666666] uppercase tracking-wide mb-1">Payment</p>
            {view.payments.length === 0 ? (
              <p className="text-sm text-[#999]">No payments recorded.</p>
            ) : (
              <>
                {view.payments.map((p, idx) => (
                  <SummaryRow key={`${p.method}-${idx}`} label={p.method} value={`${p.amount.toLocaleString()} ETB`} />
                ))}
                <div className="border-t border-[#ABDBE3] pt-2 mt-1">
                  <SummaryRow
                    label="Total Paid"
                    value={`${view.payments.reduce((a, p) => a + p.amount, 0).toLocaleString()} ETB`}
                    bold
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 justify-between border-t border-[#DBEFF3] pt-4">
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => window.print()}>
              <PrintIcon /> Print Receipt
            </Button>
            {view.status === "voided" && (
              <Button
                variant="secondary"
                onClick={() => { setVoidPromptOpen(true); setVoidReason(""); setVoidError(null) }}
                loading={voiding}
              >
                Void Sale
              </Button>
            )}
            <Button variant="secondary" onClick={() => alert("Return / Refund — backend pending")}>
              Return / Refund
            </Button>
          </div>
          <Button onClick={onClose}>Close</Button>
        </div>

        {/* Void reason prompt */}
        {voidPromptOpen && (
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 flex flex-col gap-3">
            <p className="text-sm font-semibold text-[#333333]">
              Cancel sale {view.invoice}?
            </p>
            <p className="text-xs text-[#666666]">
              The backend only allows cancelling sales still in DRAFT status.
            </p>
            <Input
              label="Reason"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="e.g. Wrong items scanned"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setVoidPromptOpen(false)} disabled={voiding}>
                Keep Sale
              </Button>
              <Button onClick={() => void handleVoid()} loading={voiding} disabled={!voidReason.trim()}>
                Confirm Cancel
              </Button>
            </div>
          </div>
        )}
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

function StatusBadge({ status }: { status: SaleStatusUi }) {
  const cfg: Record<SaleStatusUi, { label: string; cls: string }> = {
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

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-3 animate-pulse">
      {[...Array(6)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-[#DBEFF3]" />)}
    </div>
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
