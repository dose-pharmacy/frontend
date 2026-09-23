import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router"
import PageHeader from "../../components/ui/PageHeader"
import Modal from "../../components/ui/Modal"
import Button from "../../components/ui/Button"
import StatusChip, { type StatusTone } from "../../components/ui/StatusChip"
import {
  getSupplierInvoice,
  recordInvoicePayment,
  deleteSupplierInvoice,
  updateSupplierInvoice,
  invoiceOutstanding,
  invoicePaid,
  type SupplierInvoiceDto,
  type InvoicePaymentDto,
  type SupplierInvoiceStatus,
  SupplierInvoicesApiError,
} from "../../features/purchasing/supplierInvoicesApi"
import {
  getPurchaseOrder,
  type PurchaseOrderDto,
} from "../../features/purchasing/purchaseOrdersApi"
import {
  listGoodsReceipts,
  type GoodsReceiptDto,
} from "../../features/purchasing/goodsReceiptsApi"

function fmtDate(d: string | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function fmtMoney(n: number) {
  return `${n.toLocaleString("en-ET", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`
}

const STATUS_BADGE: Record<SupplierInvoiceStatus, StatusTone> = {
  OPEN: "amber",
  PARTIALLY_PAID: "orange",
  PAID: "green",
}

const PO_STATUS_BADGE: Record<string, StatusTone> = {
  REGISTERED: "blue",
  AWAITING_DELIVERY: "amber",
  RECEIVED: "green",
  CLOSED: "gray",
  CANCELLED: "red",
}

export default function SupplierInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [invoice, setInvoice] = useState<SupplierInvoiceDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrderDto | null>(
    null,
  )
  const [poLoading, setPoLoading] = useState(false)
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceiptDto[]>([])

  const [payModalOpen, setPayModalOpen] = useState(false)
  const [payAmount, setPayAmount] = useState("")
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0])
  const [payNotes, setPayNotes] = useState("")
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState("")

  const [editOpen, setEditOpen] = useState(false)
  const [editDueDate, setEditDueDate] = useState("")
  const [editTerms, setEditTerms] = useState("")
  const [editing, setEditing] = useState(false)
  const [editError, setEditError] = useState("")

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  const [successMsg, setSuccessMsg] = useState("")

  const loadInvoice = useCallback(() => {
    if (!id) return
    setLoading(true)
    setError("")
    getSupplierInvoice(id)
      .then((inv) => setInvoice(inv))
      .catch(() => setError("Failed to load supplier invoice."))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    loadInvoice()
  }, [loadInvoice])

  // Load linked PO context + goods receipts
  useEffect(() => {
    if (!invoice?.purchaseOrderId) {
      setPurchaseOrder(null)
      setGoodsReceipts([])
      setPoLoading(false)
      return
    }
    setPoLoading(true)
    getPurchaseOrder(invoice.purchaseOrderId)
      .then((po) => setPurchaseOrder(po))
      .catch(() => setPurchaseOrder(null))
    listGoodsReceipts({ limit: 50, purchaseOrderId: invoice.purchaseOrderId })
      .then((r) => setGoodsReceipts(r.data))
      .catch(() => setGoodsReceipts([]))
      .finally(() => setPoLoading(false))
  }, [invoice?.purchaseOrderId])

  async function handleRecordPayment() {
    if (!invoice) return
    const amount = parseFloat(payAmount)
    if (isNaN(amount) || amount <= 0) {
      setPayError("Enter a valid payment amount.")
      return
    }
    if (amount > invoiceOutstanding(invoice)) {
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
      await getSupplierInvoice(id!)
        .then((updated) => setInvoice(updated))
        .catch(() => {})
    } catch (e) {
      setPayError(
        e instanceof SupplierInvoicesApiError
          ? e.message
          : "Failed to record payment.",
      )
    } finally {
      setPaying(false)
    }
  }

  async function handleEdit() {
    if (!invoice) return
    setEditing(true)
    setEditError("")
    try {
      const updated = await updateSupplierInvoice(invoice.id, {
        dueDate: editDueDate || null,
        paymentTerms: editTerms || null,
      })
      setInvoice(updated)
      setEditOpen(false)
      setSuccessMsg("Invoice updated successfully.")
    } catch (e) {
      setEditError(
        e instanceof SupplierInvoicesApiError
          ? e.message
          : "Failed to update invoice.",
      )
    } finally {
      setEditing(false)
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
      setDeleteError(
        e instanceof SupplierInvoicesApiError
          ? e.message
          : "Failed to delete invoice.",
      )
    } finally {
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  function openPayModal() {
    if (!invoice) return
    setPayAmount(invoiceOutstanding(invoice).toString())
    setPayDate(new Date().toISOString().split("T")[0])
    setPayNotes("")
    setPayError("")
    setPayModalOpen(true)
  }

  if (loading) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <PageHeader title="Supplier Invoice" subtitle="Loading..." />
        <div className="flex-1 flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-4 border-[#E6ECE2] border-t-[#B6C8AF] animate-spin" />
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
            <Button onClick={() => navigate("/purchasing/invoices")}>
              Back to Invoices
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const canPay = invoice.status !== "PAID"
  const canDelete =
    invoice.status !== "PAID" && (invoice.payments?.length ?? 0) === 0
  const canEdit = invoice.status !== "PAID"

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb="Purchasing / Invoices"
        title="Supplier Invoice"
        subtitle={invoice.invoiceNumber}
        actions={
          <div className="flex items-center gap-3">
            <StatusChip
              label={invoice.status}
              tone={STATUS_BADGE[invoice.status] ?? "gray"}
            />
            {canEdit && (
              <Button
                variant="secondary"
                onClick={() => {
                  setEditDueDate(invoice.dueDate ?? "")
                  setEditTerms(invoice.paymentTerms ?? "")
                  setEditError("")
                  setEditOpen(true)
                }}
              >
                Edit
              </Button>
            )}
            {canPay && <Button onClick={openPayModal}>Record Payment</Button>}
            {canDelete && (
              <Button
                variant="secondary"
                onClick={() => setDeleteOpen(true)}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
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

        <div className="grid lg:grid-cols-5 gap-5 items-start">
          {/* Financial summary */}
          <div className="lg:col-span-3 flex flex-col gap-5">
            <div className="bg-white rounded-xl border border-[#E6ECE2] p-5">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-[#666666]">Supplier</p>
                  <p className="font-semibold text-[#333333]">
                    {invoice.supplier?.name ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#666666]">Purchase Order</p>
                  <p className="font-semibold text-[#333333]">
                    {invoice.purchaseOrder?.poNumber ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#666666]">Invoice Date</p>
                  <p className="font-semibold text-[#333333]">
                    {fmtDate(invoice.invoiceDate)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#666666]">Due Date</p>
                  <p className="font-semibold text-[#333333]">
                    {fmtDate(invoice.dueDate)}
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-[#E6ECE2] grid sm:grid-cols-3 gap-4">
                <div className="bg-[#E6ECE2]/30 rounded-xl p-3">
                  <p className="text-[11px] text-[#666666] font-semibold uppercase tracking-wide">
                    Invoice Amount
                  </p>
                  <p className="text-lg font-bold text-[#333333] mt-0.5">
                    {fmtMoney(invoice.invoiceAmount)}
                  </p>
                </div>
                <div className="bg-green-50 rounded-xl p-3">
                  <p className="text-[11px] text-green-700 font-semibold uppercase tracking-wide">
                    Paid
                  </p>
                  <p className="text-lg font-bold text-green-700 mt-0.5">
                    {fmtMoney(invoicePaid(invoice))}
                  </p>
                </div>
                <div className="bg-red-50 rounded-xl p-3">
                  <p className="text-[11px] text-red-600 font-semibold uppercase tracking-wide">
                    Outstanding
                  </p>
                  <p className="text-lg font-bold text-red-600 mt-0.5">
                    {fmtMoney(invoiceOutstanding(invoice))}
                  </p>
                </div>
              </div>

              {/* Financial breakdown */}
              <div className="mt-4 rounded-lg border border-[#E6ECE2] divide-y divide-[#E6ECE2]/70">
                {([
                  ["Goods Amount", invoice.goodsAmount],
                  ["VAT / Tax", invoice.taxAmount],
                  ["Additional Charges", invoice.additionalChargesAmount],
                  ["Discount", -invoice.discountAmount],
                  ["Total Amount", invoice.totalAmount ?? invoice.invoiceAmount],
                ] as [string, number][]).map(([label, val]) => (
                  <div key={label} className={`flex justify-between px-3 py-1.5 text-sm ${label === "Total Amount" ? "bg-[#E6ECE2]/40 font-bold" : ""}`}>
                    <span className={label === "Total Amount" ? "text-[#333333]" : "text-[#666666]"}>{label}</span>
                    <span className="font-semibold text-[#333333]">{val < 0 ? `−${fmtMoney(Math.abs(val))}` : fmtMoney(val)}</span>
                  </div>
                ))}
              </div>

              {/* Invoiced items (PO-linked allocations) */}
              {invoice.items && invoice.items.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-bold text-[#666666] uppercase tracking-wide mb-2">Invoiced Items</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#E6ECE2] text-left">
                          {["Product", "Qty", "Unit Cost", "Amount"].map((h) => (
                            <th key={h} className="px-4 py-2.5 font-semibold text-[#333333]">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {invoice.items.map((it, i) => (
                          <tr key={it.id} className={i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/20"}>
                            <td className="px-4 py-2.5 text-[#333333]">{it.purchaseOrderItem?.product?.name ?? "Product"}</td>
                            <td className="px-4 py-2.5 text-[#333333]">{it.quantity}</td>
                            <td className="px-4 py-2.5 text-[#666666]">{fmtMoney(it.unitCost)}</td>
                            <td className="px-4 py-2.5 font-semibold text-[#333333]">{fmtMoney(it.goodsAmount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {(invoice.paymentTerms || invoice.createdBy) && (
                <p className="text-xs text-[#999] mt-3">
                  {invoice.paymentTerms ? `Terms: ${invoice.paymentTerms}` : ""}
                  {invoice.paymentTerms && invoice.createdBy ? " · " : ""}
                  {invoice.createdBy
                    ? `Recorded by ${invoice.createdBy.name}`
                    : ""}
                </p>
              )}
            </div>

            {/* Payments history */}
            <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden">
              <div className="px-5 py-3 border-b border-[#E6ECE2] flex items-center justify-between">
                <p className="text-xs font-bold text-[#666666] uppercase tracking-wide">
                  Payment History
                </p>
                {canPay && (
                  <Button onClick={openPayModal}>Record Payment</Button>
                )}
              </div>
              <div className="p-5">
                {invoice.payments && invoice.payments.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#E6ECE2] text-left">
                          {["Date", "Amount", "Recorded By", "Notes"].map(
                            (h) => (
                              <th
                                key={h}
                                className="px-4 py-2.5 font-semibold text-[#333333]"
                              >
                                {h}
                              </th>
                            ),
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {invoice.payments.map(
                          (payment: InvoicePaymentDto, i: number) => (
                            <tr
                              key={payment.id}
                              className={
                                i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/20"
                              }
                            >
                              <td className="px-4 py-2.5 text-[#333333]">
                                {fmtDate(payment.paymentDate)}
                              </td>
                              <td className="px-4 py-2.5 font-semibold text-[#333333]">
                                {fmtMoney(payment.amount)}
                              </td>
                              <td className="px-4 py-2.5 text-[#666666]">
                                {payment.recordedBy?.name ??
                                  payment.createdBy?.name ??
                                  "—"}
                              </td>
                              <td className="px-4 py-2.5 text-[#666666]">
                                {payment.notes ?? "—"}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-[#999] text-center py-8">
                    No payments recorded yet.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* PO context panel */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden">
              <div className="px-4 py-3 bg-[#E6ECE2]/50 border-b border-[#E6ECE2]">
                <p className="text-xs font-bold text-[#666666] uppercase tracking-wide">
                  Linked Purchase Order
                </p>
              </div>
              {purchaseOrder ? (
                <div className="p-4 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-[#333333]">
                      {purchaseOrder.poNumber}
                    </p>
                    <StatusChip
                      label={purchaseOrder.status}
                      tone={PO_STATUS_BADGE[purchaseOrder.status] ?? "gray"}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-[#666666] mb-1.5">Items</p>
                    {purchaseOrder.items && purchaseOrder.items.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {purchaseOrder.items.map((it) => (
                          <div
                            key={it.id}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-[#333333]">
                              {it.product?.name ?? "Product"}
                            </span>
                            <span className="text-[#666666] whitespace-nowrap">
                              {it.quantityOrdered} × {fmtMoney(it.unitCost)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-[#999]">No items available.</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-[#666666] mb-1.5">
                      Goods Receipts
                    </p>
                    {goodsReceipts.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {goodsReceipts.map((gr) => (
                          <span
                            key={gr.id}
                            className="inline-flex items-center rounded-full border border-[#C6D4BF] bg-[#E6ECE2]/40 px-2.5 py-0.5 text-xs font-semibold text-[#333333]"
                          >
                            {gr.receiptNumber}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-[#999]">No goods receipts.</p>
                    )}
                  </div>
                  <div className="border-t border-[#E6ECE2] pt-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#666666]">PO Total</span>
                      <span className="font-semibold text-[#333333]">
                        {fmtMoney(
                          (purchaseOrder.items ?? []).reduce(
                            (s, it) =>
                              s +
                              (it.quantityOrdered ?? 0) * (it.unitCost ?? 0),
                            0,
                          ),
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  {poLoading ? (
                    <p className="text-sm text-[#666666]">
                      Loading purchase order...
                    </p>
                  ) : (
                    <p className="text-sm text-[#999]">
                      No purchase order linked to this invoice.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Record Payment Modal */}
      <Modal
        open={payModalOpen}
        title="Record Payment"
        onClose={() => {
          setPayModalOpen(false)
          setPayAmount("")
          setPayError("")
        }}
        size="sm"
      >
        <div className="flex flex-col gap-4">
          {payError && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {payError}
            </p>
          )}
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-xs text-green-800">
              Invoice Total:{" "}
              <span className="font-semibold">
                {fmtMoney(invoice.invoiceAmount)}
              </span>
            </p>
            <p className="text-xs text-green-800">
              Paid:{" "}
              <span className="font-semibold">
                {fmtMoney(invoicePaid(invoice))}
              </span>
            </p>
            <p className="text-xs text-green-800">
              Outstanding:{" "}
              <span className="font-semibold">
                {fmtMoney(invoiceOutstanding(invoice))}
              </span>
            </p>
          </div>
          <div>
            <label className="block text-sm text-[#666666] mb-1">
              Payment Amount *
            </label>
            <input
              type="number"
              min={0.01}
              step="0.01"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className="w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm focus:border-[#B6C8AF] focus:outline-none"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm text-[#666666] mb-1">
              Payment Date
            </label>
            <input
              type="date"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
              className="w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm focus:border-[#B6C8AF] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-[#666666] mb-1">
              Notes (optional)
            </label>
            <textarea
              rows={2}
              value={payNotes}
              onChange={(e) => setPayNotes(e.target.value)}
              className="w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm resize-none focus:border-[#B6C8AF] focus:outline-none"
              placeholder="Optional notes..."
            />
          </div>
          <div className="flex gap-3 justify-end border-t border-[#E6ECE2] pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setPayModalOpen(false)
                setPayAmount("")
                setPayError("")
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleRecordPayment} loading={paying}>
              Record Payment
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal (PATCH dueDate / paymentTerms) */}
      <Modal
        open={editOpen}
        title="Edit Invoice"
        onClose={() => {
          setEditOpen(false)
          setEditError("")
        }}
        size="sm"
      >
        <div className="flex flex-col gap-4">
          {editError && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {editError}
            </p>
          )}
          <div>
            <label className="block text-sm text-[#666666] mb-1">
              Due Date
            </label>
            <input
              type="date"
              value={editDueDate}
              onChange={(e) => setEditDueDate(e.target.value)}
              className="w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm focus:border-[#B6C8AF] focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm text-[#666666] mb-1">
              Payment Terms
            </label>
            <input
              value={editTerms}
              onChange={(e) => setEditTerms(e.target.value)}
              placeholder="e.g., Net 30"
              className="w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm focus:border-[#B6C8AF] focus:outline-none"
            />
          </div>
          <div className="flex gap-3 justify-end border-t border-[#E6ECE2] pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setEditOpen(false)
                setEditError("")
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleEdit} loading={editing}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        open={deleteOpen}
        title="Delete Supplier Invoice?"
        onClose={() => {
          setDeleteOpen(false)
          setDeleteError("")
        }}
        size="sm"
      >
        <p className="text-sm text-[#666666]">
          Delete {invoice.invoiceNumber}?
        </p>
        <p className="mt-2 text-xs text-[#999]">
          This action cannot be undone. Invoices with payments cannot be
          deleted.
        </p>
        {deleteError && (
          <p className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {deleteError}
          </p>
        )}
        <div className="flex gap-3 justify-end mt-6">
          <Button
            variant="secondary"
            onClick={() => {
              setDeleteOpen(false)
              setDeleteError("")
            }}
          >
            Cancel
          </Button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 bg-red-600 hover:bg-red-700 text-white`}
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </Modal>
    </div>
  )
}
