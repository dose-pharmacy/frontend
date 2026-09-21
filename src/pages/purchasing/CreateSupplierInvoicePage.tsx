import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router"
import PageHeader from "../../components/ui/PageHeader"
import Button from "../../components/ui/Button"
import StatusChip, { type StatusTone } from "../../components/ui/StatusChip"
import {
  listSuppliers,
  type SupplierDto,
} from "../../features/purchasing/suppliersApi"
import {
  listPurchaseOrders,
  getPurchaseOrder,
  type PurchaseOrderDto,
} from "../../features/purchasing/purchaseOrdersApi"
import {
  listGoodsReceipts,
  type GoodsReceiptDto,
} from "../../features/purchasing/goodsReceiptsApi"
import {
  createSupplierInvoice,
  type CreateSupplierInvoiceInput,
  SupplierInvoicesApiError,
} from "../../features/purchasing/supplierInvoicesApi"

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

const PO_STATUS_BADGE: Record<string, StatusTone> = {
  REGISTERED: "blue",
  AWAITING_DELIVERY: "amber",
  RECEIVED: "green",
  CLOSED: "gray",
  CANCELLED: "red",
}

export default function CreateSupplierInvoicePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  // Prefill from query params (e.g., from PO detail)
  const prefillSupplierId = searchParams.get("supplierId") || ""
  const prefillPOId = searchParams.get("purchaseOrderId") || ""

  // Form state
  const [supplierId, setSupplierId] = useState(prefillSupplierId)
  const [purchaseOrderId, setPurchaseOrderId] = useState(prefillPOId)
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().split("T")[0],
  )
  const [dueDate, setDueDate] = useState("")
  const [invoiceAmount, setInvoiceAmount] = useState("")
  const [paymentTerms, setPaymentTerms] = useState("")

  // Reference data
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderDto[]>([])
  const [selectedPO, setSelectedPO] = useState<PurchaseOrderDto | null>(null)
  const [poLoading, setPoLoading] = useState(false)
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceiptDto[]>([])

  // UI state
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  useEffect(() => {
    listSuppliers({ limit: 100, isActive: true })
      .then((r) => setSuppliers(r.data))
      .catch(() => {})
  }, [])

  // When supplier changes, reload POs filtered by that supplier
  useEffect(() => {
    if (!supplierId) {
      setPurchaseOrders([])
      return
    }
    const controller = new AbortController()
    listPurchaseOrders({ limit: 100, supplierId, status: "RECEIVED" })
      .then((r) => {
        if (!controller.signal.aborted) setPurchaseOrders(r.data)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [supplierId])

  // Load selected PO detail + goods receipts for context
  useEffect(() => {
    if (!purchaseOrderId) {
      setSelectedPO(null)
      setGoodsReceipts([])
      return
    }
    setPoLoading(true)
    getPurchaseOrder(purchaseOrderId)
      .then((po) => setSelectedPO(po))
      .catch(() => setSelectedPO(null))
    listGoodsReceipts({ limit: 50, purchaseOrderId })
      .then((r) => setGoodsReceipts(r.data))
      .catch(() => setGoodsReceipts([]))
      .finally(() => setPoLoading(false))
  }, [purchaseOrderId])

  // Suggest the invoice amount from the selected PO items when unchanged
  const poTotal =
    selectedPO?.items?.reduce(
      (sum, it) => sum + (it.quantityOrdered ?? 0) * (it.unitCost ?? 0),
      0,
    ) ?? 0
  const amountManuallyEdited =
    invoiceAmount !== "" &&
    invoiceAmount !== (poTotal > 0 ? poTotal.toString() : "")

  function handlePOChange(id: string) {
    setPurchaseOrderId(id)
    if (id) {
      const po = purchaseOrders.find((p) => p.id === id)
      if (po) {
        const total = (po.items ?? []).reduce(
          (sum, it) => sum + (it.quantityOrdered ?? 0) * (it.unitCost ?? 0),
          0,
        )
        if (total > 0) setInvoiceAmount(total.toString())
      }
    }
  }

  // Filter POs by selected supplier
  const filteredPOs = purchaseOrders.filter(
    (po) => !supplierId || po.supplierId === supplierId,
  )

  async function handleSubmit() {
    if (!supplierId || !invoiceNumber || !invoiceAmount) {
      setError("Supplier, Invoice Number, and Amount are required.")
      return
    }
    const amount = parseFloat(invoiceAmount)
    if (isNaN(amount) || amount <= 0) {
      setError("Invoice amount must be a positive number.")
      return
    }
    setError("")
    setSaving(true)
    try {
      const input: CreateSupplierInvoiceInput = {
        supplierId,
        purchaseOrderId: purchaseOrderId || undefined,
        invoiceNumber,
        invoiceDate: invoiceDate || undefined,
        dueDate: dueDate || undefined,
        invoiceAmount: amount,
        paymentTerms: paymentTerms || undefined,
      }
      await createSupplierInvoice(input)
      setSuccess("Supplier invoice created successfully.")
      setTimeout(() => navigate("/purchasing/invoices"), 1500)
    } catch (e) {
      setError(
        e instanceof SupplierInvoicesApiError
          ? e.message
          : "Failed to create supplier invoice.",
      )
    } finally {
      setSaving(false)
    }
  }

  const SC =
    "w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm focus:border-[#B6C8AF] focus:outline-none bg-white"

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb="Purchasing / Invoices / New"
        title="Create Supplier Invoice"
        subtitle="Record a new invoice from a supplier."
      />

      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="mx-4 sm:mx-6 mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
            {error}
          </div>
        )}
        {success && (
          <div className="mx-4 sm:mx-6 mb-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm border border-green-200">
            {success}
          </div>
        )}

        <div className="max-w-4xl mx-auto grid lg:grid-cols-5 gap-5 items-start">
          {/* Invoice form */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl border border-[#E6ECE2] p-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[#666666] mb-1">
                    Supplier *
                  </label>
                  <select
                    value={supplierId}
                    onChange={(e) => {
                      setSupplierId(e.target.value)
                      setPurchaseOrderId("")
                    }}
                    className={SC}
                  >
                    <option value="">Select supplier...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-[#666666] mb-1">
                    Purchase Order
                  </label>
                  <select
                    value={purchaseOrderId}
                    onChange={(e) => handlePOChange(e.target.value)}
                    className={SC}
                    disabled={!supplierId || filteredPOs.length === 0}
                  >
                    <option value="">No PO linked</option>
                    {filteredPOs.map((po) => (
                      <option key={po.id} value={po.id}>
                        {po.poNumber}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-[#666666] mb-1">
                    Invoice Number *
                  </label>
                  <input
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="INV-001"
                    className={SC}
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#666666] mb-1">
                    Invoice Date
                  </label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className={SC}
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#666666] mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className={SC}
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#666666] mb-1">
                    Invoice Amount (ETB) *
                  </label>
                  <input
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={invoiceAmount}
                    onChange={(e) => setInvoiceAmount(e.target.value)}
                    placeholder={poTotal > 0 ? poTotal.toString() : "0.00"}
                    className={SC}
                  />
                  {poTotal > 0 && !amountManuallyEdited && (
                    <p className="text-[11px] text-[#7A9076] mt-1">
                      Suggested from PO total: {fmtMoney(poTotal)}
                    </p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm text-[#666666] mb-1">
                    Payment Terms
                  </label>
                  <input
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    placeholder="e.g., Net 30"
                    className={SC}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6 pt-4 border-t border-[#E6ECE2]">
                <Button
                  variant="secondary"
                  onClick={() => navigate("/purchasing/invoices")}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  loading={saving}
                  disabled={!supplierId || !invoiceNumber || !invoiceAmount}
                >
                  {saving ? "Creating…" : "Create Invoice"}
                </Button>
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
              {purchaseOrderId && selectedPO ? (
                <div className="p-4 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-[#333333]">
                      {selectedPO.poNumber}
                    </p>
                    <StatusChip
                      label={selectedPO.status}
                      tone={PO_STATUS_BADGE[selectedPO.status] ?? "gray"}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-[#666666] mb-1.5">Items</p>
                    {selectedPO.items && selectedPO.items.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {selectedPO.items.map((it) => (
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
                      <p className="text-sm text-[#999]">
                        No goods receipts yet.
                      </p>
                    )}
                  </div>
                  <div className="border-t border-[#E6ECE2] pt-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#666666]">PO Total</span>
                      <span className="font-semibold text-[#333333]">
                        {fmtMoney(poTotal)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-[#666666]">Expected</span>
                      <span className="font-semibold text-[#333333]">
                        {fmtDate(selectedPO.orderDate)}
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
                      Select a purchase order to see its items, goods receipts,
                      and total.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
