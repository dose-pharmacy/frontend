import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router"
import PageHeader from "../../components/ui/PageHeader"
import Modal from "../../components/ui/Modal"
import Button from "../../components/ui/Button"
import {
  getSupplierInvoice,
  recordInvoicePayment,
  deleteSupplierInvoice,
  type SupplierInvoiceDto,
  type InvoicePaymentDto,
  type SupplierInvoiceStatus,
  SupplierInvoicesApiError,
} from "../../features/purchasing/supplierInvoicesApi"

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

export default function SupplierInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [invoice, setInvoice] = useState<SupplierInvoiceDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [payModalOpen, setPayModalOpen] = useState(false)
  const [payAmount, setPayAmount] = useState("")
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0])
  const [payNotes, setPayNotes] = useState("")
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState("")

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  const [successMsg, setSuccessMsg] = useState("")

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError("")
    getSupplierInvoice(id)
      .then((inv) => setInvoice(inv))
      .catch(() => setError("Failed to load supplier invoice."))
      .finally(() => setLoading(false))
  }, [id])

  async function handleRecordPayment() {
    if (!invoice) return
    const amount = parseFloat(payAmount)
    if (isNaN(amount) || amount <= 0) {
      setPayError("Enter a valid payment amount.")
      return
    }
    if (amount > (invoice.balanceDue ?? invoice.invoiceAmount)) {
      setPayError("Payment amount cannot exceed outstanding balance.")
      return
    }
    setPayError("")
    setPaying(true)
    try {
      await recordInvoicePayment(invoice.id, {
        amount,
        paymentDate: payDate || undefined,
        notes: payNotes || undefined,
      })
      setPayModalOpen(false)
      setSuccessMsg("Payment recorded successfully.")
      // Refresh invoice
      const updated = await getSupplierInvoice(id!)
      setInvoice(updated)
    } catch (e) {
      setPayError(e instanceof SupplierInvoicesApiError ? e.message : "Failed to record payment.")
    } finally {
      setPaying(false)
    }
  }

  async function handleDelete() {
    if (!invoice) return
    setDeleting(true)
    setDeleteError("")
    try {
      await deleteSupplierInvoice(invoice.id)
      setSuccessMsg("Invoice deleted successfully.")
      setTimeout(() => navigate("/purchasing/invoices"), 1500)
    } catch (e) {
      setDeleteError(e instanceof SupplierInvoicesApiError ? e.message : "Failed to delete invoice.")
    } finally {
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <PageHeader title="Supplier Invoice" subtitle="Loading..." />
        <div className="flex-1 flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-4 border-[#DBEFF3] border-t-[#49B0C1] animate-spin" />
        </div>
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <PageHeader title="Supplier Invoice" subtitle="Not found" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-500 mb-3">{error || "Invoice not found."}</p>
            <Button onClick={() => navigate("/purchasing/invoices")}>Back to Invoices</Button>
          </div>
        </div>
      </div>
    )
  }

  const canPay = invoice.status !== "PAID"
  const canDelete = invoice.status !== "PAID" && (invoice.payments?.length ?? 0) === 0

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb="Purchasing / Invoices"
        title="Supplier Invoice"
        subtitle={invoice.invoiceNumber}
        actions={
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${STATUS_BADGE[invoice.status] ?? "bg-gray-100 text-gray-600"}`}>
              {invoice.status}
            </span>
            {canPay && (
              <Button onClick={() => { setPayAmount((invoice.balanceDue ?? invoice.invoiceAmount).toString()); setPayModalOpen(true) }}>
                Record Payment
              </Button>
            )}
            {canDelete && (
              <Button variant="secondary" onClick={() => setDeleteOpen(true)} className="text-red-600 border-red-200 hover:bg-red-50">
                Delete
              </Button>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {successMsg && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm border border-green-200">
            {successMsg}
          </div>
        )}

        {/* Header info */}
        <div className="bg-white rounded-xl border border-[#DBEFF3] p-5 mb-5">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-[#666666]">Supplier</p>
              <p className="font-semibold text-[#333333]">{invoice.supplier?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-[#666666]">Purchase Order</p>
              <p className="font-semibold text-[#333333]">{invoice.purchaseOrderId ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-[#666666]">Invoice Date</p>
              <p className="font-semibold text-[#333333]">{fmtDate(invoice.invoiceDate)}</p>
            </div>
            <div>
              <p className="text-xs text-[#666666]">Due Date</p>
              <p className="font-semibold text-[#333333]">{fmtDate(invoice.dueDate)}</p>
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <p className="text-xs text-[#666666]">Payment Terms</p>
              <p className="font-semibold text-[#333333]">{invoice.paymentTerms ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-[#666666]">Invoice Amount</p>
              <p className="text-lg font-bold text-[#333333]">{fmtMoney(invoice.invoiceAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-[#666666]">Paid Amount</p>
              <p className="text-lg font-bold text-green-600">{fmtMoney(invoice.paidAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-[#666666]">Outstanding Balance</p>
              <p className="text-lg font-bold text-red-600">{fmtMoney(invoice.balanceDue ?? invoice.invoiceAmount)}</p>
            </div>
          </div>
        </div>

        {/* Payments history */}
        <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#DBEFF3] flex items-center justify-between">
            <p className="text-xs font-bold text-[#666666] uppercase tracking-wide">Payment History</p>
            {canPay && (
              <Button onClick={() => { setPayAmount((invoice.balanceDue ?? invoice.invoiceAmount).toString()); setPayModalOpen(true) }}>
                Record Payment
              </Button>
            )}
          </div>
          <div className="p-5">
            {invoice.payments && invoice.payments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#DBEFF3] text-left">
                      {["#", "Date", "Amount", "Recorded By", "Notes"].map((h) => (
                        <th key={h} className="px-4 py-2.5 font-semibold text-[#333333]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.payments.map((payment, i) => (
                      <tr key={payment.id} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"}>
                        <td className="px-4 py-2.5 text-[#666666]">{i + 1}</td>
                        <td className="px-4 py-2.5 text-[#333333]">{fmtDate(payment.paymentDate)}</td>
                        <td className="px-4 py-2.5 font-semibold text-[#333333]">{fmtMoney(payment.amount)}</td>
                        <td className="px-4 py-2.5 text-[#666666]">{payment.createdBy?.name ?? "—"}</td>
                        <td className="px-4 py-2.5 text-[#666666]">{payment.notes ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-[#999] text-center py-8">No payments recorded yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Record Payment Modal */}
      <Modal open={payModalOpen} title="Record Payment" onClose={() => { setPayModalOpen(false); setPayAmount(""); setPayError("") }} size="sm">
        <div className="flex flex-col gap-4">
          {payError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{payError}</p>}
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-xs text-green-800">Invoice Total: <span className="font-semibold">{fmtMoney(invoice.invoiceAmount)}</span></p>
            <p className="text-xs text-green-800">Paid: <span className="font-semibold">{fmtMoney(invoice.paidAmount)}</span></p>
            <p className="text-xs text-green-800">Outstanding: <span className="font-semibold">{fmtMoney(invoice.balanceDue ?? invoice.invoiceAmount)}</span></p>
          </div>
          <div>
            <label className="block text-sm text-[#666666] mb-1">Payment Amount *</label>
            <input type="number" min={0.01} step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="w-full rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm focus:border-[#49B0C1] focus:outline-none" placeholder="0.00" />
          </div>
          <div>
            <label className="block text-sm text-[#666666] mb-1">Payment Date</label>
            <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="w-full rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm focus:border-[#49B0C1] focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm text-[#666666] mb-1">Notes (optional)</label>
            <textarea rows={2} value={payNotes} onChange={(e) => setPayNotes(e.target.value)} className="w-full rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm resize-none focus:border-[#49B0C1] focus:outline-none" placeholder="Optional notes..." />
          </div>
          <div className="flex gap-3 justify-end border-t border-[#DBEFF3] pt-4">
            <Button variant="secondary" onClick={() => { setPayModalOpen(false); setPayAmount(""); setPayError("") }}>Cancel</Button>
            <Button onClick={handleRecordPayment} loading={paying}>Record Payment</Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal open={deleteOpen} title="Delete Supplier Invoice?" onClose={() => { setDeleteOpen(false); setDeleteError("") }} size="sm">
        <p className="text-sm text-[#666666]">Delete {invoice.invoiceNumber}?</p>
        <p className="mt-2 text-xs text-[#999]">This action cannot be undone. Invoices with payments cannot be deleted.</p>
        {deleteError && <p className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{deleteError}</p>}
        <div className="flex gap-3 justify-end mt-6">
          <Button variant="secondary" onClick={() => { setDeleteOpen(false); setDeleteError("") }}>Cancel</Button>
          <button onClick={handleDelete} disabled={deleting} className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 bg-red-600 hover:bg-red-700 text-white`}>
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </Modal>
    </div>
  )
}