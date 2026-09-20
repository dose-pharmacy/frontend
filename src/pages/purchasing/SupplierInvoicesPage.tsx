import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router"
import PageHeader from "../../components/ui/PageHeader"
import SearchInput from "../../components/ui/SearchInput"
import Button from "../../components/ui/Button"
import Modal from "../../components/ui/Modal"
import { listSupplierInvoices, deleteSupplierInvoice, recordInvoicePayment, type SupplierInvoiceDto, type SupplierInvoiceStatus, SupplierInvoicesApiError } from "../../features/purchasing/supplierInvoicesApi"
import { listSuppliers, type SupplierDto } from "../../features/purchasing/suppliersApi"

function fmtDate(d: string | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function fmtMoney(n: number) {
  return `${n.toLocaleString("en-ET", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`
}

const STATUS_BADGE: Record<SupplierInvoiceStatus, string> = {
  OPEN: "bg-yellow-100 text-yellow-700",
  PARTIALLY_PAID: "bg-orange-100 text-orange-700",
  PAID: "bg-green-100 text-green-700",
}

export default function SupplierInvoicesPage() {
  const navigate = useNavigate()
  const [invoices, setInvoices] = useState<SupplierInvoiceDto[]>([])
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<SupplierInvoiceStatus | "">("")
  const [supplierFilter, setSupplierFilter] = useState<string>("")
  const [toast, setToast] = useState("")

  const PAGE_SIZE = 20

  const loadInvoices = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listSupplierInvoices({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        status: statusFilter || undefined,
        supplierId: supplierFilter || undefined,
      })
      setInvoices(res.data)
      setTotalPages(res.meta.totalPages)
      setTotalCount(res.meta.total)
    } catch (e) {
      setError(e instanceof SupplierInvoicesApiError ? e.message : "Failed to load invoices.")
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter, supplierFilter])

  useEffect(() => {
    loadInvoices()
  }, [loadInvoices])

  useEffect(() => {
    listSuppliers({ limit: 100, isActive: true })
      .then((r) => setSuppliers(r.data))
      .catch(() => {})
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(""), 3000)
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this invoice? This cannot be undone.")) return
    try {
      await deleteSupplierInvoice(id)
      showToast("Invoice deleted successfully.")
      loadInvoices()
    } catch (e) {
      showToast(e instanceof SupplierInvoicesApiError ? e.message : "Delete failed")
    }
  }

  const [payModalOpen, setPayModalOpen] = useState(false)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [payAmount, setPayAmount] = useState("")
  const [payNotes, setPayNotes] = useState("")
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState("")

  const openPayModal = (id: string, balance: number) => {
    setPayingId(id)
    setPayAmount(balance.toString())
    setPayNotes("")
    setPayError("")
    setPayModalOpen(true)
  }

  async function handleRecordPayment() {
    if (!payingId) return
    const amountNum = parseFloat(payAmount)
    if (isNaN(amountNum) || amountNum <= 0) {
      setPayError("Enter a valid amount")
      return
    }
    setPayError("")
    setPaying(true)
    try {
      await recordInvoicePayment(payingId, { amount: amountNum, notes: payNotes || undefined })
      setPayModalOpen(false)
      setPayingId(null)
      setPayAmount("")
      setPayNotes("")
      showToast("Payment recorded successfully.")
      loadInvoices()
    } catch (e) {
      setPayError(e instanceof SupplierInvoicesApiError ? e.message : "Payment failed")
    } finally {
      setPaying(false)
    }
  }

  const summary = {
    total: totalCount,
    open: invoices.filter((i) => i.status === "OPEN").length,
    partiallyPaid: invoices.filter((i) => i.status === "PARTIALLY_PAID").length,
    paid: invoices.filter((i) => i.status === "PAID").length,
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb="Purchasing / Invoices"
        title="Supplier Invoices"
        subtitle="View and manage supplier invoices and payments."
        actions={
          <Button onClick={() => navigate("/purchasing/invoices/new")}>
            + Create Invoice
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {([
            ["Total Invoices", summary.total, "text-[#333333]"],
            ["Open", summary.open, "text-yellow-600"],
            ["Partially Paid", summary.partiallyPaid, "text-orange-600"],
            ["Paid", summary.paid, "text-green-600"],
          ] as [string, number, string][]).map(([label, value, accent]) => (
            <div key={label} className="bg-white rounded-xl border border-[#DBEFF3] p-4">
              <p className="text-xs text-[#666666]">{label}</p>
              <p className={`text-2xl font-bold mt-0.5 ${accent}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-[#DBEFF3] p-4 flex flex-col gap-3">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1) }} placeholder="Search invoices..." />
          <div className="flex flex-wrap gap-3 items-center">
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as SupplierInvoiceStatus | ""); setPage(1) }} className="flex-1 min-w-[160px] rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm focus:border-[#49B0C1] focus:outline-none">
              <option value="">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="PAID">Paid</option>
            </select>
            <select value={supplierFilter} onChange={(e) => { setSupplierFilter(e.target.value); setPage(1) }} className="flex-1 min-w-[160px] rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm focus:border-[#49B0C1] focus:outline-none">
              <option value="">All Suppliers</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {(search || statusFilter || supplierFilter) && (
              <button onClick={() => { setSearch(""); setStatusFilter(""); setSupplierFilter(""); setPage(1) }} className="text-xs font-semibold text-[#49B0C1] hover:underline">Reset</button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="h-8 w-8 rounded-full border-4 border-[#DBEFF3] border-t-[#49B0C1] animate-spin" />
              <p className="text-sm text-[#666666]">Loading invoices...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 px-6">
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 max-w-md text-center">{error}</p>
              <Button onClick={loadInvoices}>Retry</Button>
            </div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="h-14 w-14 rounded-2xl bg-[#DBEFF3] flex items-center justify-center">
                <svg className="h-7 w-7 text-[#49B0C1]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="font-semibold text-[#333333]">No supplier invoices found</p>
                <p className="text-sm text-[#666666] mt-1">
                  {(search || statusFilter || supplierFilter)
                    ? "No invoices match your filters."
                    : "Invoices will appear here once they are created."}
                </p>
              </div>
              {(search || statusFilter || supplierFilter) ? (
                <button onClick={() => { setSearch(""); setStatusFilter(""); setSupplierFilter(""); setPage(1) }} className="text-sm font-semibold text-[#49B0C1] hover:underline">Clear Filters</button>
              ) : (
                <Button onClick={() => navigate("/purchasing/invoices/new")}>+ Create Invoice</Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#DBEFF3] text-left">
                      {["Invoice #", "Supplier", "PO", "Date", "Due", "Amount", "Outstanding", "Status", "Actions"].map((h) => (
                        <th key={h} className="px-4 py-3 font-semibold text-[#333333]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv, i) => (
                      <tr key={inv.id} className={`hover:bg-[#DBEFF3]/30 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/15"}`}>
                        <td className="px-4 py-3">
                          <button onClick={() => navigate(`/purchasing/invoices/${inv.id}`)} className="font-semibold text-[#49B0C1] hover:underline">{inv.invoiceNumber}</button>
                        </td>
                        <td className="px-4 py-3 text-[#333333]">{inv.supplier?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-[#666666]">{inv.purchaseOrderId ?? "—"}</td>
                        <td className="px-4 py-3 text-[#666666] whitespace-nowrap">{fmtDate(inv.invoiceDate)}</td>
                        <td className="px-4 py-3 text-[#666666] whitespace-nowrap">{fmtDate(inv.dueDate)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-[#333333]">{fmtMoney(inv.invoiceAmount)}</td>
                        <td className="px-4 py-3 text-right text-red-600 font-semibold">{fmtMoney(inv.balanceDue ?? inv.invoiceAmount)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_BADGE[inv.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => navigate(`/purchasing/invoices/${inv.id}`)} className="text-xs font-semibold text-[#49B0C1] hover:underline whitespace-nowrap">View →</button>
                            {inv.status !== "PAID" && (
                              <button onClick={() => openPayModal(inv.id, inv.balanceDue ?? inv.invoiceAmount)} className="text-xs font-semibold text-[#49B0C1] hover:underline whitespace-nowrap">Pay</button>
                            )}
                            {(inv.status !== "PAID" && (inv.payments?.length ?? 0) === 0) && (
                              <button onClick={() => handleDelete(inv.id)} className="text-xs text-red-500 hover:underline whitespace-nowrap">Delete</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 border-t border-[#DBEFF3] flex items-center justify-between">
                <p className="text-xs text-[#666666]">
                  Showing {Math.min((page - 1) * PAGE_SIZE + 1, totalCount)}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount} invoices
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

      {/* Record Payment Modal */}
      <Modal open={payModalOpen} title="Record Payment" onClose={() => { setPayModalOpen(false); setPayingId(null); setPayAmount(""); setPayNotes(""); setPayError("") }} size="sm">
        {payError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{payError}</p>}
        <div>
          <label className="block text-sm text-[#666666] mb-1">Payment Amount</label>
          <input type="number" min={0.01} step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="w-full rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm focus:border-[#49B0C1] focus:outline-none" />
        </div>
        <div>
          <label className="block text-sm text-[#666666] mb-1">Notes (optional)</label>
          <textarea rows={2} value={payNotes} onChange={(e) => setPayNotes(e.target.value)} className="w-full rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm resize-none focus:border-[#49B0C1] focus:outline-none" />
        </div>
        <div className="flex gap-3 justify-end mt-6">
          <Button variant="secondary" onClick={() => { setPayModalOpen(false); setPayingId(null); setPayAmount(""); setPayNotes(""); setPayError("") }}>Cancel</Button>
          <Button onClick={handleRecordPayment} loading={paying}>Record Payment</Button>
        </div>
      </Modal>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-[#333333] px-5 py-3.5 text-sm text-white shadow-xl">
          <svg className="h-4 w-4 shrink-0 text-[#49B0C1]" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
          </svg>
          {toast}
        </div>
      )}
    </div>
  )
}