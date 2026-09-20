import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router"
import PageHeader from "../../components/ui/PageHeader"
import Modal from "../../components/ui/Modal"
import Button from "../../components/ui/Button"
import { listSuppliers, type SupplierDto } from "../../features/purchasing/suppliersApi"
import { listPurchaseOrders, type PurchaseOrderDto } from "../../features/purchasing/purchaseOrdersApi"
import {
  createSupplierInvoice,
  type CreateSupplierInvoiceInput,
  SupplierInvoicesApiError,
} from "../../features/purchasing/supplierInvoicesApi"

function fmtDate(d: string | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
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
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0])
  const [dueDate, setDueDate] = useState("")
  const [invoiceAmount, setInvoiceAmount] = useState("")
  const [paymentTerms, setPaymentTerms] = useState("")

  // Reference data
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderDto[]>([])

  // UI state
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  useEffect(() => {
    listSuppliers({ limit: 100, isActive: true })
      .then((r) => setSuppliers(r.data))
      .catch(() => {})
    listPurchaseOrders({ limit: 100, status: "RECEIVED" })
      .then((r) => setPurchaseOrders(r.data))
      .catch(() => {})
  }, [])

  // Filter POs by selected supplier
  const filteredPOs = purchaseOrders.filter(
    (po) => !supplierId || po.supplierId === supplierId
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
      setError(e instanceof SupplierInvoicesApiError ? e.message : "Failed to create supplier invoice.")
    } finally {
      setSaving(false)
    }
  }

  const SC = "w-full rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm focus:border-[#49B0C1] focus:outline-none bg-white"

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

        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl border border-[#DBEFF3] p-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[#666666] mb-1">Supplier *</label>
                <select value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setPurchaseOrderId("") }} className={SC}>
                  <option value="">Select supplier...</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#666666] mb-1">Purchase Order</label>
                <select value={purchaseOrderId} onChange={(e) => setPurchaseOrderId(e.target.value)} className={SC} disabled={!supplierId || filteredPOs.length === 0}>
                  <option value="">No PO linked</option>
                  {filteredPOs.map((po) => <option key={po.id} value={po.id}>{po.poNumber}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#666666] mb-1">Invoice Number *</label>
                <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="INV-001" className={SC} />
              </div>
              <div>
                <label className="block text-sm text-[#666666] mb-1">Invoice Date</label>
                <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className={SC} />
              </div>
              <div>
                <label className="block text-sm text-[#666666] mb-1">Due Date</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={SC} />
              </div>
              <div>
                <label className="block text-sm text-[#666666] mb-1">Invoice Amount (ETB) *</label>
                <input type="number" min={0.01} step="0.01" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} placeholder="0.00" className={SC} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-[#666666] mb-1">Payment Terms</label>
                <input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="e.g., Net 30" className={SC} />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6 pt-4 border-t border-[#DBEFF3]">
              <Button variant="secondary" onClick={() => navigate("/purchasing/invoices")}>Cancel</Button>
              <Button onClick={handleSubmit} loading={saving} disabled={!supplierId || !invoiceNumber || !invoiceAmount}>
                {saving ? "Creating…" : "Create Invoice"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}