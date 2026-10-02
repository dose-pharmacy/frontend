import { useState, useEffect, useMemo } from "react"
import { useNavigate, useSearchParams } from "react-router"
import PageHeader from "../../components/ui/PageHeader"
import Button from "../../components/ui/Button"
import DatePicker from "../../components/ui/DatePicker"
import { getSupplierById, type SupplierDto } from "../../features/purchasing/suppliersApi"
import AddSupplier from "./AddSupplier"
import { listPurchaseOrders, getPurchaseOrder, PurchaseOrdersApiError, type PurchaseOrderDto } from "../../features/purchasing/purchaseOrdersApi"
import PurchaseOrderSelect, { PoStatusBadge, invoiceableItems } from "../../components/purchasing/PurchaseOrderSelect"
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

/** Trim float noise so a max of 100 never renders as "100.0000001". */
function fmtQty(n: number): string {
  const v = Number.isFinite(n) ? n : 0
  return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(4)))
}

/** The backend accepts exactly these two values (see SupplierInvoiceCreateInput). */
type InvoicePaymentTerms = "CREDIT" | "NO_CREDIT" | ""

const PAYMENT_TERMS_OPTIONS: { value: InvoicePaymentTerms; label: string }[] = [
  { value: "CREDIT", label: "CREDIT — payment due later" },
  { value: "NO_CREDIT", label: "NO_CREDIT — paid on delivery" },
]

/** One invoiceable PO line — how much of its remaining billable goods to bill. */
interface InvoiceLine {
  purchaseOrderItemId: string
  productName: string
  sku: string
  quantityOrdered: number
  quantityReceived: number
  /** Already billed on earlier invoices of this PO. */
  quantityInvoiced: number
  /** quantityReceived − quantityInvoiced — the hard cap for "To Invoice". */
  quantityRemainingToInvoice: number
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
  const [paymentTerms, setPaymentTerms] = useState<InvoicePaymentTerms>("")

  // Non-PO invoices bill goods directly
  const [goodsAmount, setGoodsAmount] = useState("")
  // Financial split (applies to both modes)
  const [taxAmount, setTaxAmount] = useState("")
  const [chargesAmount, setChargesAmount] = useState("")
  const [discountAmount, setDiscountAmount] = useState("")

  // PO-linked item allocation
  const [lines, setLines] = useState<InvoiceLine[]>([])

  // Reference data — only INVOICEABLE purchase orders (received-but-not-invoiced).
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderDto[]>([])
  const [selectedPO, setSelectedPO] = useState<PurchaseOrderDto | null>(null)
  const [poLoading, setPoLoading] = useState(false)
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState<string | null>(null)
  const [ordersReload, setOrdersReload] = useState(0)
  const [poItemsError, setPoItemsError] = useState("")

  // UI state
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const supplierSearch = useSearchableResource(searchSuppliers, true)
  const [prefillSupplierOption, setPrefillSupplierOption] = useState<SearchableOption | null>(null)
  const [addedSupplierOption, setAddedSupplierOption] = useState<SearchableOption | null>(null)
  const [showAddSupplier, setShowAddSupplier] = useState(false)
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
    ...(addedSupplierOption && addedSupplierOption.value === supplierId ? [addedSupplierOption] : []),
    ...(selectedSupplierOption ? [selectedSupplierOption] : []),
    ...supplierSearch.options.filter((o) => o.value !== supplierId),
  ].filter((o, i, arr) => arr.findIndex((x) => x.value === o.value) === i)

  // Callback from the Add Supplier popup — select the newly created supplier.
  function handleSupplierCreated(created: SupplierDto) {
    setAddedSupplierOption({
      value: created.id,
      label: created.name,
      sub: created.contactPerson ? `${created.contactPerson}${created.email ? ` · ${created.email}` : ""}` : (created.email ?? undefined),
    })
    selectSupplier(created.id)
    setShowAddSupplier(false)
    supplierSearch.refresh()
  }

  /**
   * Changing supplier must drop everything derived from the previous supplier's
   * purchase orders BEFORE the new list loads, so no stale PO, items, invoice
   * quantity or goods amount is ever visible under the new supplier name.
   */
  function selectSupplier(id: string) {
    setSupplierId(id)
    setPurchaseOrderId("")
    setSelectedPO(null)
    setLines([])
    setGoodsAmount("")
    setPoItemsError("")
    setOrdersError(null)
    setError("")
  }

  // Invoiceable POs for the selected supplier.
  //
  // `invoiceable=true` is the backend's own rule: at least one item with
  // quantityReceived > quantityInvoiced. PO STATUS DOES NOT GATE ELIGIBILITY —
  // a PARTIALLY_RECEIVED or AWAITING_DELIVERY order appears whenever it holds
  // received-but-not-yet-invoiced goods, and a fully invoiced order is excluded.
  // The frontend therefore filters nothing itself; `receivable=true` is the
  // receiving workflow and must NOT be used here.
  useEffect(() => {
    setPurchaseOrders([])
    setOrdersError(null)
    if (!supplierId) return
    let cancelled = false
    setOrdersLoading(true)
    listPurchaseOrders({ supplierId, invoiceable: true, limit: 100 })
      .then((r) => { if (!cancelled) setPurchaseOrders(r.data) })
      .catch(() => {
        if (cancelled) return
        setPurchaseOrders([])
        setOrdersError("No invoiceable purchase orders found for this supplier.")
      })
      .finally(() => { if (!cancelled) setOrdersLoading(false) })
    return () => { cancelled = true }
  }, [supplierId, ordersReload])

  // Load the selected PO's INVOICEABLE items and seed the allocation lines.
  // Source of truth for "Items to Invoice" — never the hover preview.
  useEffect(() => {
    if (!purchaseOrderId) {
      setSelectedPO(null)
      setLines([])
      setPoItemsError("")
      return
    }
    let cancelled = false
    setPoLoading(true)
    setPoItemsError("")
    getPurchaseOrder(purchaseOrderId, { invoiceableItems: true })
      .then((po) => {
        if (cancelled) return
        setSelectedPO(po)
        // `invoiceableItems=true` already restricts the response; filter again so
        // a fully invoiced line can never appear with an un-billable max of 0.
        setLines(
          invoiceableItems(po).map((it) => ({
            purchaseOrderItemId: it.id,
            productName: it.product?.name ?? "Product",
            sku: it.product?.sku ?? "",
            quantityOrdered: it.quantityOrdered ?? 0,
            quantityReceived: it.quantityReceived ?? 0,
            quantityInvoiced: it.quantityInvoiced ?? 0,
            quantityRemainingToInvoice: it.quantityRemainingToInvoice ?? 0,
            unitCost: it.unitCost ?? 0,
            unitName: it.unit?.name || it.unit?.symbol || "",
            // Default to billing the full outstanding quantity.
            quantity: fmtQty(it.quantityRemainingToInvoice ?? 0),
          })),
        )
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setSelectedPO(null)
        setLines([])
        setPoItemsError(
          e instanceof PurchaseOrdersApiError
            ? e.message
            : "Could not load this purchase order.",
        )
      })
      .finally(() => { if (!cancelled) setPoLoading(false) })
    return () => { cancelled = true }
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

  /** Lines the pharmacist has pushed past the backend's remaining-to-invoice cap. */
  const overLimitLines = lines.filter(
    (l) => (parseFloat(l.quantity) || 0) - l.quantityRemainingToInvoice > 1e-6,
  )

  /**
   * The cap is `quantityRemainingToInvoice` (received − already invoiced), NOT
   * `quantityReceived`. Clamping here keeps the input honest; the backend
   * revalidates inside the invoice transaction and wins on any conflict.
   */
  function setLineQty(itemId: string, qty: string) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.purchaseOrderItemId !== itemId) return l
        if (qty.trim() === "") return { ...l, quantity: "" }
        const n = Number(qty)
        if (!Number.isFinite(n)) return l
        const capped = Math.min(Math.max(n, 0), l.quantityRemainingToInvoice)
        return { ...l, quantity: fmtQty(capped) }
      }),
    )
  }

  function handlePOChange(id: string) {
    setPurchaseOrderId(id)
    setGoodsAmount("")
    setError("")
    setPoItemsError("")
  }

  const hasInvoiceablePOs = purchaseOrders.length > 0

  async function handleSubmit() {
    if (!supplierId || !invoiceNumber) {
      setError("Supplier and Invoice Number are required.")
      return
    }
    if (paymentTerms === "CREDIT" && !dueDate) {
      setError("A Due Date is required when the payment terms are CREDIT.")
      return
    }
    if (purchaseOrderId) {
      if (overLimitLines.length > 0) {
        setError(
          `The quantity for ${overLimitLines[0].productName} exceeds the goods still awaiting invoicing on this order. Review the quantities and try again.`,
        )
        return
      }
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

  const SC = "w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm focus:border-[#B6C8AF] focus:outline-none bg-white"

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
                  <label className="block text-sm text-[#666666] mb-1">Supplier *</label>
                  <SearchableSelect
                    value={supplierId || null}
                    onChange={selectSupplier}
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
                  <button
                    type="button"
                    onClick={() => setShowAddSupplier(true)}
                    className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-[#7A9076] hover:underline transition-colors"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                      <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                    </svg>
                    Add New Supplier
                  </button>
                </div>
                <div>
                  <label className="block text-sm text-[#666666] mb-1" htmlFor="purchase-order">Purchase Order</label>
                  <PurchaseOrderSelect
                    id="purchase-order"
                    value={purchaseOrderId || null}
                    onChange={handlePOChange}
                    options={purchaseOrders}
                    loading={ordersLoading}
                    error={ordersError}
                    onRetry={() => setOrdersReload((t) => t + 1)}
                    disabled={!supplierId}
                    placeholder={
                      supplierId
                        ? "Select purchase order..."
                        : "Select a supplier first..."
                    }
                    emptyMessage="No invoiceable purchase orders"
                    footerHint={
                      <>
                        {supplierId && !ordersLoading && !ordersError && !hasInvoiceablePOs && (
                          <p className="text-xs text-[#666666]">
                            <span className="font-semibold text-[#333333]">
                              No invoiceable purchase orders.
                            </span>{" "}
                            This supplier has no received goods awaiting invoicing.
                          </p>
                        )}
                        {purchaseOrderId && (
                          <button
                            type="button"
                            onClick={() => handlePOChange("")}
                            className="self-start text-xs font-semibold text-[#7A9076] hover:underline"
                          >
                            Unlink purchase order (bill goods directly)
                          </button>
                        )}
                      </>
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#666666] mb-1">Invoice Number *</label>
                  <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="INV-001" className={SC} />
                </div>
                <div>
                  <label className="block text-sm text-[#666666] mb-1">Invoice Date</label>
                  <DatePicker
                    value={invoiceDate}
                    onChange={setInvoiceDate}
                    placeholder="Select invoice date..."
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#666666] mb-1">Due Date</label>
                  <DatePicker
                    value={dueDate}
                    onChange={setDueDate}
                    placeholder="Select due date..."
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#666666] mb-1" htmlFor="payment-terms">Payment Terms</label>
                  <select
                    id="payment-terms"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value as InvoicePaymentTerms)}
                    className={SC}
                  >
                    <option value="">— Select payment terms —</option>
                    {PAYMENT_TERMS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-[#999] mt-1">
                    The backend accepts only these two terms.
                    {paymentTerms === "CREDIT" && !dueDate && (
                      <span className="text-red-500"> A Due Date is required for CREDIT terms.</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Items to invoice (PO-linked) */}
              {purchaseOrderId && (
                <div className="mt-5">
                  <p className="text-sm font-semibold text-[#333333] mb-1">Items to Invoice</p>
                  <p className="text-xs text-[#999] mb-3">
                    Choose how much of each received item to bill. The quantity can't exceed the goods received but not yet invoiced on this order.
                  </p>

                  {poLoading ? (
                    <p className="text-sm text-[#666666]">Loading invoiceable items...</p>
                  ) : poItemsError ? (
                    <div className="flex items-center gap-2 text-sm text-red-600">
                      <span>{poItemsError}</span>
                      <button
                        type="button"
                        onClick={() => handlePOChange("")}
                        className="font-semibold underline underline-offset-2 hover:text-red-700"
                      >
                        Choose another order
                      </button>
                    </div>
                  ) : lines.length > 0 ? (
                    <div className="overflow-x-auto -mx-5 px-5">
                      <table className="w-full text-sm min-w-[720px]">
                        <thead>
                          <tr className="text-left text-xs text-[#666666] border-b border-[#E6ECE2]">
                            <th className="py-2 pr-2">Product</th>
                            <th className="py-2 px-2 text-right">Ordered</th>
                            <th className="py-2 px-2 text-right">Received</th>
                            <th className="py-2 px-2 text-right">Invoiced</th>
                            <th className="py-2 px-2 text-right">
                              Max To Invoice
                            </th>
                            <th className="py-2 px-2 text-right">Unit Cost</th>
                            <th className="py-2 pl-2 text-right">To Invoice</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lines.map((l) => {
                            const entered = parseFloat(l.quantity) || 0
                            const overLimit =
                              entered - l.quantityRemainingToInvoice > 1e-6
                            return (
                              <tr key={l.purchaseOrderItemId} className="border-b border-[#E6ECE2]/60">
                                <td className="py-2 pr-2 font-medium text-[#333333]">
                                  {l.productName}
                                  {l.sku && (
                                    <span className="block text-[10px] font-normal text-[#999]">{l.sku}</span>
                                  )}
                                </td>
                                <td className="py-2 px-2 text-right text-[#666666] whitespace-nowrap">{fmtQty(l.quantityOrdered)} {l.unitName}</td>
                                <td className="py-2 px-2 text-right text-[#666666] whitespace-nowrap">{fmtQty(l.quantityReceived)} {l.unitName}</td>
                                <td className="py-2 px-2 text-right text-[#999] whitespace-nowrap">{fmtQty(l.quantityInvoiced)}</td>
                                <td className="py-2 px-2 text-right font-semibold text-[#7A9076] whitespace-nowrap">
                                  {fmtQty(l.quantityRemainingToInvoice)} {l.unitName}
                                </td>
                                <td className="py-2 px-2 text-right text-[#666666]">{fmtMoney(l.unitCost)}</td>
                                <td className="py-2 pl-2 text-right w-28">
                                  <div className="flex items-end justify-end gap-1">
                                    <input
                                      type="number"
                                      min={0}
                                      max={l.quantityRemainingToInvoice}
                                      step={0.01}
                                      value={l.quantity}
                                      onChange={(e) => setLineQty(l.purchaseOrderItemId, e.target.value)}
                                      aria-label={`To invoice for ${l.productName}`}
                                      className={`w-20 rounded-lg border px-2 py-1 text-right text-sm focus:outline-none ${
                                        overLimit
                                          ? "border-red-400 bg-red-50"
                                          : "border-[#C6D4BF] focus:border-[#B6C8AF]"
                                      }`}
                                    />
                                    {l.unitName && <span className="text-xs text-[#999] pb-1 whitespace-nowrap">{l.unitName}</span>}
                                  </div>
                                  {overLimit && (
                                    <p className="text-[10px] text-red-600 text-right mt-0.5">
                                      Max {fmtQty(l.quantityRemainingToInvoice)} {l.unitName}
                                    </p>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      <p className="text-[11px] text-[#999] mt-2">
                        &ldquo;Max To Invoice&rdquo; is the goods received on this
                        order minus anything already billed on earlier invoices.
                        Each purchase order is invoiced separately.
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-[#999]">
                      This purchase order has no received goods awaiting invoicing.
                    </p>
                  )}
                </div>
              )}

              {/* Financial split */}
              <div className="mt-5 grid sm:grid-cols-2 gap-4 border-t border-[#E6ECE2] pt-4">
                {purchaseOrderId ? (
                  <div>
                    <label className="block text-sm text-[#666666] mb-1">Goods Amount</label>
                    <input value={derivedGoods ? derivedGoods.toFixed(2) : ""} readOnly className={`${SC} bg-[#E6ECE2]/30 text-[#333333]`} />
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
                  <div className="rounded-lg bg-[#E6ECE2]/50 px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-[#666666]">Total Amount</span>
                    <span className="text-lg font-bold text-[#333333]">{fmtMoney(totalAmount)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6 pt-4 border-t border-[#E6ECE2]">
                <Button variant="secondary" onClick={() => navigate("/purchasing/invoices")}>Cancel</Button>
                <Button onClick={handleSubmit} loading={saving} disabled={!supplierId || !invoiceNumber}>
                  {saving ? "Creating…" : "Create Invoice"}
                </Button>
              </div>
            </div>
          </div>

          {/* PO context panel */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden flex-shrink-0">
              <div className="px-4 py-3 bg-[#E6ECE2]/50 border-b border-[#E6ECE2]">
                <p className="text-xs font-bold text-[#666666] uppercase tracking-wide">Linked Purchase Order</p>
              </div>
              {purchaseOrderId && selectedPO ? (
                <div className="p-4 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-[#333333]">{selectedPO.poNumber}</p>
                    <PoStatusBadge status={selectedPO.status} />
                  </div>
                  {selectedPO.receivingSummary && (
                    <div className="rounded-lg border border-[#E6ECE2] divide-y divide-[#E6ECE2]/70">
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
                    <div className="rounded-lg border border-[#E6ECE2] divide-y divide-[#E6ECE2]/70">
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
                  <div className="border-t border-[#E6ECE2] pt-3">
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
                    <p className="text-sm text-[#666666]">Loading invoiceable items...</p>
                  ) : (
                    <p className="text-sm text-[#999]">
                      {supplierId
                        ? "Select a purchase order to invoice its received goods. Only orders with received-but-not-yet-invoiced goods are listed."
                        : "Select a supplier to see the purchase orders that have goods awaiting invoicing."}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AddSupplier
        open={showAddSupplier}
        onClose={() => setShowAddSupplier(false)}
        onCreated={handleSupplierCreated}
      />
    </div>
  )
}