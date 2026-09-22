import { useState, useEffect, useMemo } from "react"
import { useNavigate, useSearchParams } from "react-router"
import PageHeader from "../../components/ui/PageHeader"
import Button from "../../components/ui/Button"
import { getSupplierById } from "../../features/purchasing/suppliersApi"
import { listPurchaseOrders, getPurchaseOrder, type PurchaseOrderDto, type POItemDto } from "../../features/purchasing/purchaseOrdersApi"
import { searchSuppliers } from "../../features/inventory/searchSelectors"
import { useSearchableResource } from "../../hooks/useSearchableResource"
import SearchableSelect from "../../components/ui/SearchableSelect"
import type { SearchableOption } from "../../components/ui/SearchableSelect"
import {
  createSupplierInvoice,
  type CreateSupplierInvoiceInput,
  SupplierInvoicesApiError,
} from "../../features/purchasing/supplierInvoicesApi"

function fmtDate(d: string | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function fmtMoney(n: number) {
  return `${n.toLocaleString("en-ET", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`
}

const PO_STATUS_BADGE: Record<string, string> = {
  REGISTERED: "bg-blue-100 text-blue-700",
  AWAITING_DELIVERY: "bg-yellow-100 text-yellow-700",
  RECEIVED: "bg-green-100 text-green-700",
  CLOSED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-100 text-red-700",
}

/** One invoicable PO line — how much of its received goods to bill. */
interface InvoiceLine {
  purchaseOrderItemId: string
  productName: string
  quantityOrdered: number
  quantityReceived: number
  unitCost: number
  unitName: string
  quantity: string
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
  const [paymentTerms, setPaymentTerms] = useState("")

  // Non-PO invoices bill goods directly
  const [goodsAmount, setGoodsAmount] = useState("")
  // Financial split (applies to both modes)
  const [taxAmount, setTaxAmount] = useState("")
  const [chargesAmount, setChargesAmount] = useState("")
  const [discountAmount, setDiscountAmount] = useState("")

  // PO-linked item allocation
  const [lines, setLines] = useState<InvoiceLine[]>([])

  // Reference data
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderDto[]>([])
  const [selectedPO, setSelectedPO] = useState<PurchaseOrderDto | null>(null)
  const [poLoading, setPoLoading] = useState(false)

  // UI state
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const supplierSearch = useSearchableResource(searchSuppliers, true)
  const [prefillSupplierOption, setPrefillSupplierOption] = useState<SearchableOption | null>(null)
  useEffect(() => {
    if (!prefillSupplierId) return
    let cancelled = false
    getSupplierById(prefillSupplierId)
      .then((s) => {
        if (cancelled) return
        setPrefillSupplierOption({
          value: s.id,
          label: s.name,
          sub: s.contactPerson ? `${s.contactPerson}${s.email ? ` · ${s.email}` : ""}` : (s.email ?? undefined),
        })
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [prefillSupplierId])

  const selectedSupplierOption = supplierSearch.options.find((o) => o.value === supplierId) ?? null
  const supplierOptions: SearchableOption[] = [
    ...(prefillSupplierOption && prefillSupplierOption.value === supplierId ? [prefillSupplierOption] : []),
    ...(selectedSupplierOption ? [selectedSupplierOption] : []),
    ...supplierSearch.options.filter((o) => o.value !== supplierId),
  ].filter((o, i, arr) => arr.findIndex((x) => x.value === o.value) === i)

  // When supplier changes, reload received POs filtered by that supplier
  useEffect(() => {
    if (!supplierId) {
      setPurchaseOrders([])
      setPurchaseOrderId("")
      setSelectedPO(null)
      setLines([])
      return
    }
    const controller = new AbortController()
    listPurchaseOrders({ limit: 100, supplierId, status: "RECEIVED" })
      .then((r) => { if (!controller.signal.aborted) setPurchaseOrders(r.data) })
      .catch(() => {})
    return () => controller.abort()
  }, [supplierId])

  // Load selected PO detail and seed the allocation lines (default = all received goods).
  useEffect(() => {
    if (!purchaseOrderId) {
      setSelectedPO(null)
      setLines([])
      return
    }
    setPoLoading(true)
    getPurchaseOrder(purchaseOrderId)
      .then((po) => {
        setSelectedPO(po)
        setLines(
          (po.items ?? []).map((it: POItemDto) => ({
            purchaseOrderItemId: it.id,
            productName: it.product?.name ?? "Product",
            quantityOrdered: it.quantityOrdered ?? 0,
            quantityReceived: it.quantityReceived ?? 0,
            unitCost: it.unitCost ?? 0,
            unitName: it.unit?.name ?? "",
            quantity: String(it.quantityReceived ?? 0),
          })),
        )
      })
      .catch(() => setSelectedPO(null))
      .finally(() => setPoLoading(false))
  }, [purchaseOrderId])

  // Goods amount is DERIVED from the item allocation for PO-linked invoices
  // (the backend validates it matches), otherwise entered directly.
  const derivedGoods = useMemo(
    () => lines.reduce((sum, l) => sum + (parseFloat(l.quantity) || 0) * l.unitCost, 0),
    [lines],
  )
  const explicitGoods = parseFloat(goodsAmount) || 0
  const tax = parseFloat(taxAmount) || 0
  const charges = parseFloat(chargesAmount) || 0
  const discount = parseFloat(discountAmount) || 0
  const totalAmount = Math.max(0, (purchaseOrderId ? derivedGoods : explicitGoods) + tax + charges - discount)

  const invoiceableLines = lines.filter((l) => (parseFloat(l.quantity) || 0) > 0)

  function setLineQty(itemId: string, qty: string) {
    setLines((prev) => prev.map((l) => (l.purchaseOrderItemId === itemId ? { ...l, quantity: qty } : l)))
  }

  function handlePOChange(id: string) {
    setPurchaseOrderId(id)
    setGoodsAmount("")
  }

  const filteredPOs = purchaseOrders

  async function handleSubmit() {
    if (!supplierId || !invoiceNumber) {
      setError("Supplier and Invoice Number are required.")
      return
    }
    if (purchaseOrderId) {
      if (invoiceableLines.length === 0) {
        setError("Select at least one item and enter the quantity of received goods to invoice.")
        return
      }
    } else {
      if (!(explicitGoods > 0)) {
        setError("Goods Amount is required for invoices without a linked purchase order.")
        return
      }
    }
    setError("")
    setSaving(true)
    try {
      const input: CreateSupplierInvoiceInput = {
        supplierId,
        ...(purchaseOrderId ? { purchaseOrderId } : {}),
        invoiceNumber,
        invoiceDate: invoiceDate || undefined,
        dueDate: dueDate || undefined,
        ...(purchaseOrderId
          ? { items: invoiceableLines.map((l) => ({ purchaseOrderItemId: l.purchaseOrderItemId, quantity: parseFloat(l.quantity) })) }
          : { goodsAmount: explicitGoods }),
        ...(tax > 0 ? { taxAmount: tax } : {}),
        ...(charges > 0 ? { additionalChargesAmount: charges } : {}),
        ...(discount > 0 ? { discountAmount: discount } : {}),
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

        <div className="max-w-4xl mx-auto grid lg:grid-cols-5 gap-5 items-start">
          {/* Invoice form */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl border border-[#DBEFF3] p-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[#666666] mb-1">Supplier *</label>
                  <SearchableSelect
                    value={supplierId || null}
                    onChange={(v) => { setSupplierId(v); setPurchaseOrderId("") }}
                    options={supplierOptions}
                    onSearch={supplierSearch.setTerm}
                    loading={supplierSearch.loading}
                    error={supplierSearch.error}
                    onRetry={supplierSearch.retry}
                    placeholder="Select supplier..."
                    searchPlaceholder="Search suppliers..."
                    emptyMessage="No suppliers found"
                    noResultsMessage="No suppliers matching your search"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#666666] mb-1">Purchase Order</label>
                  <select value={purchaseOrderId} onChange={(e) => handlePOChange(e.target.value)} className={SC} disabled={!supplierId || filteredPOs.length === 0}>
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
                  <label className="block text-sm text-[#666666] mb-1">Payment Terms</label>
                  <input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="e.g., Net 30" className={SC} />
                </div>
              </div>

              {/* Items to invoice (PO-linked) */}
              {purchaseOrderId && (
                <div className="mt-5">
                  <p className="text-sm font-semibold text-[#333333] mb-1">Items to Invoice</p>
                  <p className="text-xs text-[#999] mb-3">
                    Choose how much of each received item to bill. The quantity can't exceed the goods received but not yet invoiced on this order.
                  </p>
                  {lines.length > 0 ? (
                    <div className="overflow-x-auto -mx-5 px-5">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-[#666666] border-b border-[#DBEFF3]">
                            <th className="py-2 pr-2">Product</th>
                            <th className="py-2 px-2 text-right">Ordered</th>
                            <th className="py-2 px-2 text-right">Received</th>
                            <th className="py-2 px-2 text-right">Unit Cost</th>
                            <th className="py-2 pl-2 text-right">To Invoice</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lines.map((l) => (
                            <tr key={l.purchaseOrderItemId} className="border-b border-[#DBEFF3]/60">
                              <td className="py-2 pr-2 font-medium text-[#333333]">{l.productName}</td>
                              <td className="py-2 px-2 text-right text-[#666666]">{l.quantityOrdered} {l.unitName}</td>
                              <td className="py-2 px-2 text-right text-[#666666]">{l.quantityReceived} {l.unitName}</td>
                              <td className="py-2 px-2 text-right text-[#666666]">{fmtMoney(l.unitCost)}</td>
                              <td className="py-2 pl-2 text-right w-24">
                                <div className="flex items-end justify-end gap-1">
                                  <input
                                    type="number"
                                    min={0}
                                    max={l.quantityReceived}
                                    step={0.01}
                                    value={l.quantity}
                                    onChange={(e) => setLineQty(l.purchaseOrderItemId, e.target.value)}
                                    className="w-20 rounded-lg border border-[#ABDBE3] px-2 py-1 text-right text-sm focus:border-[#49B0C1] focus:outline-none"
                                  />
                                  {l.unitName && <span className="text-xs text-[#999] pb-1 whitespace-nowrap">{l.unitName}</span>}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-[#999]">No items on this purchase order.</p>
                  )}
                </div>
              )}

              {/* Financial split */}
              <div className="mt-5 grid sm:grid-cols-2 gap-4 border-t border-[#DBEFF3] pt-4">
                {purchaseOrderId ? (
                  <div>
                    <label className="block text-sm text-[#666666] mb-1">Goods Amount</label>
                    <input value={derivedGoods ? derivedGoods.toFixed(2) : ""} readOnly className={`${SC} bg-[#DBEFF3]/30 text-[#333333]`} />
                    <p className="text-[11px] text-[#999] mt-1">Derived from the item quantities above.</p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm text-[#666666] mb-1">Goods Amount (ETB) *</label>
                    <input type="number" min={0} step="0.01" value={goodsAmount} onChange={(e) => setGoodsAmount(e.target.value)} className={SC} />
                  </div>
                )}
                <div>
                  <label className="block text-sm text-[#666666] mb-1">VAT / Tax</label>
                  <input type="number" min={0} step="0.01" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} placeholder="0.00" className={SC} />
                </div>
                <div>
                  <label className="block text-sm text-[#666666] mb-1">Additional Charges</label>
                  <input type="number" min={0} step="0.01" value={chargesAmount} onChange={(e) => setChargesAmount(e.target.value)} placeholder="0.00" className={SC} />
                </div>
                <div>
                  <label className="block text-sm text-[#666666] mb-1">Discount</label>
                  <input type="number" min={0} step="0.01" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} placeholder="0.00" className={SC} />
                </div>
                <div className="sm:col-span-2">
                  <div className="rounded-lg bg-[#DBEFF3]/50 px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-[#666666]">Total Amount</span>
                    <span className="text-lg font-bold text-[#333333]">{fmtMoney(totalAmount)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6 pt-4 border-t border-[#DBEFF3]">
                <Button variant="secondary" onClick={() => navigate("/purchasing/invoices")}>Cancel</Button>
                <Button onClick={handleSubmit} loading={saving} disabled={!supplierId || !invoiceNumber}>
                  {saving ? "Creating…" : "Create Invoice"}
                </Button>
              </div>
            </div>
          </div>

          {/* PO context panel */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
              <div className="px-4 py-3 bg-[#DBEFF3]/50 border-b border-[#DBEFF3]">
                <p className="text-xs font-bold text-[#666666] uppercase tracking-wide">Linked Purchase Order</p>
              </div>
              {purchaseOrderId && selectedPO ? (
                <div className="p-4 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-[#333333]">{selectedPO.poNumber}</p>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${PO_STATUS_BADGE[selectedPO.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {selectedPO.status}
                    </span>
                  </div>
                  {selectedPO.receivingSummary && (
                    <div className="rounded-lg border border-[#DBEFF3] divide-y divide-[#DBEFF3]/70">
                      {([
                        ["Ordered", selectedPO.receivingSummary.orderedQuantity],
                        ["Received", selectedPO.receivingSummary.receivedQuantity],
                        ["Shortage", selectedPO.receivingSummary.shortQuantity],
                        ["Remaining", selectedPO.receivingSummary.remainingQuantity],
                      ] as [string, number][]).map(([label, val]) => (
                        <div key={label} className="flex justify-between px-3 py-1.5 text-sm">
                          <span className="text-[#666666]">{label}</span>
                          <span className="font-semibold text-[#333333]">{val}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedPO.goodsSummary && (
                    <div className="rounded-lg border border-[#DBEFF3] divide-y divide-[#DBEFF3]/70">
                      {([
                        ["Received Goods", selectedPO.goodsSummary.receivedGoodsValue],
                        ["Goods Invoiced", selectedPO.goodsSummary.goodsInvoicedAmount],
                        ["Still to Invoice", selectedPO.goodsSummary.remainingGoodsToInvoice],
                      ] as [string, number][]).map(([label, val]) => (
                        <div key={label} className="flex justify-between px-3 py-1.5 text-sm">
                          <span className="text-[#666666]">{label}</span>
                          <span className="font-semibold text-[#333333]">{fmtMoney(val)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="border-t border-[#DBEFF3] pt-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#666666]">Ordered</span>
                      <span className="font-semibold text-[#333333]">{fmtDate(selectedPO.orderDate)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-[#666666]">Expected Delivery</span>
                      <span className="font-semibold text-[#333333]">{fmtDate(selectedPO.expectedDeliveryDate)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  {poLoading ? (
                    <p className="text-sm text-[#666666]">Loading purchase order...</p>
                  ) : (
                    <p className="text-sm text-[#999]">Select a purchase order to invoice its received goods.</p>
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