import { useEffect, useState } from "react"
import PageHeader from "../../components/ui/PageHeader"
import DashboardSubNav from "../dashboard/DashboardSubNav"
import SearchInput from "../../components/ui/SearchInput"
import Select from "../../components/ui/Select"
import Pagination from "../../components/ui/Pagination"
import EmptyState from "../../components/ui/EmptyState"
import Modal from "../../components/ui/Modal"
import Button from "../../components/ui/Button"
import Input from "../../components/ui/Input"
import FormError from "../../components/ui/FormError"
import NarcoticBadge from "../../components/ui/NarcoticBadge"
import DatePicker from "../../components/ui/DatePicker"
import {
  listSales,
  getSale,
  cancelSale,
  recordSalePayment,
  SalesApiError,
  type SaleDto,
  type SaleItemDto,
  type SaleStatus,
  type RecordSalePaymentMethod,
} from "../../features/sales/salesApi"

// ─── Types (UI view of a sale) ───────────────────────────────────────────────

type PaymentMethod = "Cash" | "Card" | "Digital Transfer" | "Mobile Transfer" | "Credit" | "Check" | "Insurance"
type SaleStatusUi = "completed" | "voided" | "refunded"

interface SaleItem {
  product: string
  brand: string
  batch: string
  unit: string
  qty: number
  unitPrice: number
  isNarcotic?: boolean
}

interface SalePayment {
  method: PaymentMethod
  amount: number
  reference?: string
  date?: string
}

interface Sale {
  id: string
  invoice: string
  date: string
  time: string
  location: string
  cashier: string
  items: SaleItem[]
  payments: SalePayment[]
  subtotal: number
  discount: number
  total: number
  paidAmount: number
  changeAmount: number
  outstanding: number
  status: SaleStatusUi
}

// ─── DTO → UI adaptation ─────────────────────────────────────────────────────

const METHOD_TO_UI: Record<string, PaymentMethod> = {
  CASH: "Cash",
  CARD: "Card",
  DIGITAL_TRANSFER: "Digital Transfer",
  MOBILE_TRANSFER: "Mobile Transfer",
  INSURANCE: "Insurance",
  CREDIT: "Credit",
  CHECK: "Check",
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
  const itemsSource = dto.items.length > 0 ? dto.items : detail?.items ?? []
  const paymentsSource = dto.payments.length > 0 ? dto.payments : detail?.payments ?? []
  const items: SaleItem[] = itemsSource.map((it) => ({
    product: it.product?.name ?? it.productId,
    brand: it.product?.brand ?? "—",
    batch: it.batchAllocations[0]?.batch.batchNumber ?? "—",
    unit: it.unit?.name ?? "—",
    qty: it.quantity,
    unitPrice: it.actualUnitPrice,
    isNarcotic: it.product?.isNarcotic ?? false,
  }))
  const payments: SalePayment[] = paymentsSource.map((p) => ({
    method: methodLabel(p.method),
    amount: p.amount,
    reference: p.reference ?? undefined,
    date: p.createdAt,
  }))
  const { date, time } = fmtDateTime(dto.completedAt ?? dto.createdAt)
  return {
    id: dto.id,
    invoice: dto.saleNumber,
    date,
    time,
    location: dto.location?.name ?? "—",
    cashier: dto.cashier?.name ?? "—",
    items,
    payments,
    subtotal: dto.subtotal,
    discount: dto.totalDiscount,
    total: dto.totalAmount,
    paidAmount: dto.paidAmount,
    changeAmount: dto.changeAmount,
    outstanding: Math.max(0, dto.totalAmount - dto.paidAmount),
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
  const [statusFilter, setStatusFilter] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selected, setSelected] = useState<Sale | null>(null)
  const [payTarget, setPayTarget] = useState<Sale | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [saleView, setSaleView] = useState<"all" | "credit">("all")
  const [toast, setToast] = useState<string | null>(null)

  // Fetch sales from backend with server-side pagination and filtering
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const query: any = { page, limit: PAGE_SIZE }
        if (search.trim()) query.search = search.trim()
        if (statusFilter) query.status = statusFilter
        if (dateFilter) {
          // dateFilter is just an arbitrary string in UI right now, but assuming YYYY-MM-DD
          query.dateFrom = new Date(dateFilter).toISOString()
          const toDate = new Date(dateFilter)
          toDate.setDate(toDate.getDate() + 1)
          query.dateTo = toDate.toISOString()
        }
        
        const res = await listSales(query)
        if (cancelled) return
        setSales(res.data.map((dto) => adaptSale(dto)))
        setTotalPages(res.meta?.totalPages ?? 1)
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
  }, [search, dateFilter, statusFilter, page, reloadTick])

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1)
  }, [search, dateFilter, statusFilter])

  // Auto-dismiss the success toast.
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  /** After a payment is recorded: refresh the list and the open detail view. */
  function handleRecorded(dto: SaleDto) {
    setPayTarget(null)
    setReloadTick((t) => t + 1)
    setToast("Payment recorded successfully.")
    setSelected((prev) => {
      if (!prev || prev.id !== dto.id) return prev
      const payments = dto.payments.map((p) => ({
        method: methodLabel(p.method),
        amount: p.amount,
        reference: p.reference ?? undefined,
        date: p.createdAt,
      }))
      return {
        ...prev,
        paidAmount: dto.paidAmount,
        changeAmount: dto.changeAmount,
        outstanding: Math.max(0, dto.totalAmount - dto.paidAmount),
        payments: payments.length > 0 ? payments : prev.payments,
      }
    })
  }

  // Visible rows depend on the selected tab. Credit Sales shows completed sales
  // with an unpaid balance. That "outstanding" value is derived frontend display
  // logic (totalAmount − paidAmount), NOT a backend field.
  const visibleSales =
    saleView === "credit"
      ? sales.filter((s) => s.status === "completed" && s.outstanding > 0)
      : sales

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Success toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl px-5 py-3 shadow-xl text-white text-sm font-semibold bg-green-600">
          {toast}
        </div>
      )}

      <PageHeader
        breadcrumb="Dashboard / Sales"
        title="Sales"
        subtitle="View and manage completed sales transactions, receipts, payments, and sale details."
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => alert("Export — backend integration pending")}
              className="inline-flex items-center gap-2 rounded-xl border border-[#C6D4BF] bg-white px-3 py-2 text-sm font-medium text-[#333333] hover:bg-[#E6ECE2] transition-colors"
            >
              <DownloadIcon /> Export
            </button>
            <button
              onClick={() => alert("Print — backend integration pending")}
              className="inline-flex items-center gap-2 rounded-xl border border-[#C6D4BF] bg-white px-3 py-2 text-sm font-medium text-[#333333] hover:bg-[#E6ECE2] transition-colors"
            >
              <PrintIcon /> Print
            </button>
          </div>
        }
      />

      <DashboardSubNav />

      {/* Sales view tabs */}
      <div className="px-6 pt-4">
        <div className="flex gap-1 rounded-xl bg-[#E6ECE2] p-1 w-fit">
          <button
            onClick={() => setSaleView("all")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              saleView === "all" ? "bg-white text-[#333333] shadow-sm" : "text-[#666666] hover:text-[#333333]"
            }`}
          >
            All Sales
          </button>
          <button
            onClick={() => setSaleView("credit")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              saleView === "credit" ? "bg-white text-orange-700 shadow-sm" : "text-[#666666] hover:text-[#333333]"
            }`}
          >
            Credit Sales
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 pb-12 flex flex-col gap-6">
        {loadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {loadError}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <div className="flex-1">
              <SearchInput
                value={search}
                onChange={(v) => { setSearch(v); setPage(1) }}
                placeholder="Search invoice, product, cashier..."
              />
            </div>
            <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className="sm:w-44">
              <option value="">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="DRAFT">Draft</option>
            </Select>
            <div className="sm:w-44">
              <DatePicker
                value={dateFilter}
                onChange={(v) => { setDateFilter(v); setPage(1) }}
                placeholder="Filter by date"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden flex-shrink-0">
          {loading ? (
            <LoadingSkeleton />
          ) : visibleSales.length === 0 ? (
            <EmptyState
              title={saleView === "credit" ? "No outstanding credit sales" : "No sales found"}
              description={
                saleView === "credit"
                  ? "All completed sales are fully paid."
                  : "Adjust your search or filters."
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#E6ECE2] text-left">
                      <th className="px-4 py-3 font-semibold text-[#333333] whitespace-nowrap">Date &amp; Time</th>
                      <th className="px-4 py-3 font-semibold text-[#333333]">Invoice #</th>
                      <th className="px-4 py-3 font-semibold text-[#333333]">Items</th>
                      <th className="px-4 py-3 font-semibold text-[#333333] hidden md:table-cell">Location</th>
                      <th className="px-4 py-3 font-semibold text-[#333333] hidden md:table-cell">Cashier</th>
                      <th className="px-4 py-3 font-semibold text-[#333333] hidden lg:table-cell">Payment</th>
                      <th className="px-4 py-3 font-semibold text-[#333333] hidden xl:table-cell text-right">Discount</th>
                      <th className="px-4 py-3 font-semibold text-[#333333] text-right">Total</th>
                      <th className="px-4 py-3 font-semibold text-[#333333] text-right">Paid</th>
                      <th className="px-4 py-3 font-semibold text-[#333333] text-right">Outstanding</th>
                      <th className="px-4 py-3 font-semibold text-[#333333]">Status</th>
                      <th className="px-4 py-3 font-semibold text-[#333333]">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleSales.map((sale, i) => (
                      <tr
                        key={sale.id}
                        onClick={() => setSelected(sale)}
                        className={`cursor-pointer hover:bg-[#E6ECE2]/30 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/10"}`}
                      >
                        <td className="px-4 py-3 text-[#666666] whitespace-nowrap">
                          <span className="block text-xs text-[#999]">{sale.date}</span>
                          <span className="text-sm font-medium text-[#333333]">{sale.time}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-sm font-semibold text-[#333333]">{sale.invoice}</td>
                        <td className="px-4 py-3 text-[#666666]">
                          {sale.items.length} item{sale.items.length !== 1 ? "s" : ""}
                        </td>
                        <td className="px-4 py-3 text-[#666666] hidden md:table-cell">{sale.location}</td>
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
                        <td className="px-4 py-3 text-right hidden xl:table-cell">
                          {sale.discount > 0 ? (
                            <span className="text-orange-600">−{sale.discount.toLocaleString()} ETB</span>
                          ) : (
                            <span className="text-[#999]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-[#333333] whitespace-nowrap">
                          {sale.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {sale.paidAmount > 0 ? (
                            <span className="text-[#333333]">
                              {sale.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                            </span>
                          ) : (
                            <span className="text-[#999]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {sale.status === "completed" && sale.outstanding > 0 ? (
                            <span className="font-semibold text-orange-600">
                              {sale.outstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                            </span>
                          ) : (
                            <span className="text-[#999]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={sale.status} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {sale.status === "completed" && sale.outstanding > 0 && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setPayTarget(sale) }}
                                className="text-xs font-semibold text-orange-700 hover:underline whitespace-nowrap"
                              >
                                Record Payment
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelected(sale) }}
                              className="text-xs font-semibold text-[#7A9076] hover:underline whitespace-nowrap"
                            >
                              View
                            </button>
                          </div>
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
          onRecordPayment={() => setPayTarget(selected)}
        />
      )}

      {/* Record Payment modal (later repayment on a credit/outstanding sale) */}
      {payTarget && (
        <RecordPaymentModal
          sale={payTarget}
          onClose={() => setPayTarget(null)}
          onRecorded={handleRecorded}
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
  onRecordPayment,
}: {
  sale: Sale
  onClose: () => void
  onVoided: () => void
  onRecordPayment: () => void
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

  const itemTotal = (item: SaleItem) => item.qty * item.unitPrice

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
          <div className="rounded-xl border border-[#E6ECE2] overflow-hidden">
            {detailLoading ? (
              <div className="p-4 space-y-2 animate-pulse">
                {[...Array(3)].map((_, i) => <div key={i} className="h-8 rounded-lg bg-[#E6ECE2]" />)}
              </div>
            ) : view.items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-[#666666]">
                No line items recorded for this sale.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#E6ECE2] text-left">
                      {["Product", "Brand", "Batch", "Unit", "Qty", "Unit Price", "Line Total"].map((h) => (
                        <th key={h} className="px-3 py-2.5 font-semibold text-[#333333] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {view.items.map((item, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"}>
                        <td className="px-3 py-2.5 font-medium text-[#333333]">
                          {item.product}
                          {item.isNarcotic && <NarcoticBadge className="ml-2 align-middle" />}
                        </td>
                        <td className="px-3 py-2.5 text-[#666666]">{item.brand}</td>
                        <td className="px-3 py-2.5 font-mono text-xs text-[#666666]">{item.batch}</td>
                        <td className="px-3 py-2.5 text-[#666666]">{item.unit}</td>
                        <td className="px-3 py-2.5 text-center font-semibold text-[#333333]">{item.qty}</td>
                        <td className="px-3 py-2.5 text-right text-[#333333]">{item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-[#333333]">
                          {(item.qty * item.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
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
          <div className="bg-[#E6ECE2]/40 rounded-xl p-4 flex flex-col gap-2">
            <p className="text-xs font-semibold text-[#666666] uppercase tracking-wide mb-1">Financial Summary</p>
            <SummaryRow label="Subtotal" value={`${view.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB`} />
            {view.discount > 0 && (
              <SummaryRow label="Bill Discount" value={`−${view.discount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB`} accent />
            )}
            <div className="border-t border-[#C6D4BF] pt-2 mt-1">
              <SummaryRow label="Total" value={`${view.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`} bold />
            </div>
            <div className="border-t border-[#C6D4BF] pt-2 mt-1">
              <SummaryRow label="Paid" value={`${view.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB`} />
              {view.changeAmount > 0 && (
                <SummaryRow label="Change" value={`${view.changeAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB`} />
              )}
              {view.outstanding > 0 && (
                <SummaryRow
                  label="Outstanding"
                  value={`${view.outstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`}
                  accent
                />
              )}
              {view.status === "completed" && view.outstanding === 0 && (
                <div className="flex items-center justify-between mt-1">
                  <span className="text-sm text-[#666666]">Status</span>
                  <span className="text-sm font-semibold text-green-600">✓ Fully Paid</span>
                </div>
              )}
            </div>
          </div>

          {/* Payment history */}
          <div className="bg-[#E6ECE2]/40 rounded-xl p-4 flex flex-col gap-2">
            <p className="text-xs font-semibold text-[#666666] uppercase tracking-wide mb-1">Payment History</p>
            {view.payments.length === 0 ? (
              <p className="text-sm text-[#999]">No payments recorded.</p>
            ) : (
              <>
                {view.payments.map((p, idx) => (
                  <div key={`${p.method}-${idx}`} className="flex items-start justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-[#333333]">{p.method}</p>
                      <p className="text-xs text-[#999]">
                        {p.date
                          ? new Date(p.date).toLocaleString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                        {p.reference ? ` · ${p.reference}` : ""}
                      </p>
                    </div>
                    <span className="font-semibold text-[#333333] whitespace-nowrap">
                      {p.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                    </span>
                  </div>
                ))}
                <div className="border-t border-[#C6D4BF] pt-2 mt-1">
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
        <div className="flex flex-wrap gap-2 justify-between border-t border-[#E6ECE2] pt-4">
          <div className="flex gap-2">
            {view.status === "completed" && view.outstanding > 0 && (
              <Button onClick={onRecordPayment}>Record Payment</Button>
            )}
            <Button variant="secondary" onClick={() => window.print()}>
              <PrintIcon /> Print Receipt
            </Button>
            {view.status === "completed" && (
              <Button
                variant="secondary"
                onClick={() => { setVoidPromptOpen(true); setVoidReason(""); setVoidError(null) }}
                loading={voiding}
              >
                Cancel Sale
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
    "Mobile Transfer": "bg-purple-100 text-purple-700",
    Insurance: "bg-[#E6ECE2] text-[#7A9076]",
    Credit: "bg-orange-100 text-orange-700",
    Check: "bg-teal-100 text-teal-700",
  }
  return (
    <span className={`text-xs font-semibold rounded-full px-2 py-0.5 whitespace-nowrap ${cfg[method]}`}>{method}</span>
  )
}

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-3 animate-pulse">
      {[...Array(6)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-[#E6ECE2]" />)}
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

// ─── Record Payment (later repayment on a credit / outstanding sale) ──────────

/** Methods accepted by POST /pos/sales/{id}/payments — CARD is NOT supported. */
const RECORD_METHODS: { value: RecordSalePaymentMethod; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "MOBILE_TRANSFER", label: "Mobile Transfer" },
  { value: "CHECK", label: "Check" },
]

function RecordPaymentModal({
  sale,
  onClose,
  onRecorded,
}: {
  sale: Sale
  onClose: () => void
  onRecorded: (dto: SaleDto) => void
}) {
  // Refetch the sale on open so the outstanding balance is authoritative,
  // not a possibly-stale figure from the list row.
  const [dto, setDto] = useState<SaleDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [method, setMethod] = useState<RecordSalePaymentMethod>("CASH")
  const [amount, setAmount] = useState("")
  const [reference, setReference] = useState("")
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getSale(sale.id)
      .then((d) => { if (!cancelled) setDto(d) })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof SalesApiError ? err.message : "Failed to load the sale.")
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [sale.id])

  const total = dto ? dto.totalAmount : sale.total
  const paid = dto ? dto.paidAmount : sale.paidAmount
  const outstanding = Math.max(0, total - paid)

  const fmtMoney = (v: number) =>
    `${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`

  async function handleRecord() {
    setError(null)
    const amt = parseFloat(amount)
    if (!amount.trim() || !Number.isFinite(amt) || amt <= 0) {
      setError("Enter a valid amount greater than zero.")
      return
    }
    if (amt > outstanding) {
      setError(
        `Payment amount cannot exceed the outstanding balance of ${fmtMoney(outstanding)}.`
      )
      return
    }
    setRecording(true)
    try {
      const updated = await recordSalePayment(sale.id, {
        method,
        amount: amt,
        reference: reference.trim() || undefined,
      })
      onRecorded(updated)
    } catch (err) {
      if (err instanceof SalesApiError) {
        if (err.status === 404) {
          setError("Sale not found.")
        } else {
          setError(err.message)
          // 409 (not payable) / 422 (balance changed) → refetch the latest figures.
          if (err.status === 409 || err.status === 422) {
            setLoading(true)
            getSale(sale.id)
              .then(setDto)
              .catch(() => undefined)
              .finally(() => setLoading(false))
          }
        }
      } else {
        setError("Failed to record the payment. Please try again.")
      }
    } finally {
      setRecording(false)
    }
  }

  return (
    <Modal open title="Record Payment" onClose={onClose} size="sm">
      <div className="flex flex-col gap-4">
        <FormError message={error} />

        <p className="text-sm font-semibold text-[#333333]">Sale {sale.invoice}</p>

        {/* Balance summary — authoritative from the latest sale fetch */}
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-[#E6ECE2] bg-[#E6ECE2]/30 p-3 text-center">
          <div>
            <p className="text-xs text-[#666666]">Total</p>
            <p className="text-sm font-semibold text-[#333333]">{loading ? "…" : fmtMoney(total)}</p>
          </div>
          <div>
            <p className="text-xs text-[#666666]">Paid</p>
            <p className="text-sm font-semibold text-[#333333]">{loading ? "…" : fmtMoney(paid)}</p>
          </div>
          <div>
            <p className="text-xs text-[#666666]">Outstanding</p>
            <p className="text-sm font-bold text-orange-600">{loading ? "…" : fmtMoney(outstanding)}</p>
          </div>
        </div>

        <Select
          label="Payment Method"
          value={method}
          onChange={(e) => setMethod(e.target.value as RecordSalePaymentMethod)}
        >
          {RECORD_METHODS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </Select>

        <Input
          label="Amount"
          type="number"
          min={0}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
        />

        <Input
          label="Reference (optional)"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder={method === "CHECK" ? "e.g. CHQ-12345" : "Optional (e.g. transfer ref)"}
        />

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="secondary" onClick={onClose} disabled={recording}>
            Cancel
          </Button>
          <Button onClick={() => void handleRecord()} loading={recording}>
            {recording ? "Recording…" : "Record Payment"}
          </Button>
        </div>
      </div>
    </Modal>
  )
}