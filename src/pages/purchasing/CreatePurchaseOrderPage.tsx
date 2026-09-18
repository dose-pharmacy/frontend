import { useState, useEffect, useRef } from "react"
import { useParams, useNavigate, useSearchParams } from "react-router"
import PageHeader from "../../components/ui/PageHeader"
import Modal from "../../components/ui/Modal"
import Button from "../../components/ui/Button"
import {
  MOCK_SUPPLIERS, MOCK_REQUIREMENTS, INITIAL_POS,
  StatusBadge, Toast, fmtDate,
} from "./PurchaseOrdersPage"
import type { PurchaseOrder, POItem, POStatus } from "./PurchaseOrdersPage"

// ─── Shared local data ────────────────────────────────────────────────────────

const PRODUCT_LIST = [
  { id: "pr1", name: "Paracetamol 500mg",  unitCost: 120 },
  { id: "pr2", name: "Amoxicillin 500mg",  unitCost: 85  },
  { id: "pr3", name: "Vitamin C 1000mg",   unitCost: 60  },
  { id: "pr4", name: "Ibuprofen 400mg",    unitCost: 95  },
  { id: "pr5", name: "Metformin 850mg",    unitCost: 75  },
  { id: "pr6", name: "Omeprazole 20mg",    unitCost: 55  },
  { id: "pr7", name: "Cetirizine 10mg",    unitCost: 40  },
  { id: "pr8", name: "Losartan 50mg",      unitCost: 90  },
  { id: "pr9", name: "Atorvastatin 20mg",  unitCost: 110 },
  { id: "pr10",name: "Insulin Glargine",   unitCost: 850 },
]

function fmtMoney(n: number) { return `${n.toLocaleString("en-ET")} ETB` }

function itemTotal(item: POItem) { return item.quantity * item.unitCost }
function orderTotal(items: POItem[]) { return items.reduce((s, i) => s + itemTotal(i), 0) }

let nextItemId = 100
let nextPORef = 6

// ─── Status timeline ──────────────────────────────────────────────────────────

const STATUS_FLOW: POStatus[] = ["REGISTERED", "AWAITING_DELIVERY", "RECEIVED", "CLOSED"]

function StatusTimeline({ current, cancelled }: { current: POStatus; cancelled?: boolean }) {
  const steps = cancelled
    ? ["REGISTERED", "CANCELLED"]
    : STATUS_FLOW

  const currentIdx = steps.indexOf(current)

  return (
    <div className="flex items-center gap-0 overflow-x-auto">
      {steps.map((step, idx) => {
        const done = idx < currentIdx
        const active = idx === currentIdx
        const labels: Record<string, string> = {
          REGISTERED: "Registered", AWAITING_DELIVERY: "Awaiting Delivery",
          RECEIVED: "Received", CLOSED: "Closed", CANCELLED: "Cancelled",
        }
        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center min-w-[80px]">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                step === "CANCELLED"
                  ? "border-red-300 bg-red-50 text-red-500"
                  : done
                  ? "border-[#49B0C1] bg-[#49B0C1] text-white"
                  : active
                  ? "border-[#49B0C1] bg-white text-[#49B0C1]"
                  : "border-[#ABDBE3] bg-white text-[#ABDBE3]"
              }`}>
                {done ? (
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                  </svg>
                ) : idx + 1}
              </div>
              <p className={`mt-1 text-[10px] font-medium text-center leading-tight ${active ? "text-[#49B0C1]" : done ? "text-[#49B0C1]" : "text-[#ABDBE3]"} ${step === "CANCELLED" ? "text-red-500" : ""}`}>
                {labels[step]}
              </p>
            </div>
            {idx < steps.length - 1 && (
              <div className={`h-0.5 w-8 -mt-4 mx-1 flex-shrink-0 ${idx < currentIdx ? "bg-[#49B0C1]" : "bg-[#DBEFF3]"}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Add Product Modal ────────────────────────────────────────────────────────

function AddProductModal({ open, existingProducts, requirementRef, onClose, onAdd }: {
  open: boolean
  existingProducts: string[]
  requirementRef: string
  onClose: () => void
  onAdd: (item: POItem) => void
}) {
  const [product, setProduct] = useState("")
  const [quantity, setQuantity] = useState("")
  const [unitCost, setUnitCost] = useState("")
  const [reqRef, setReqRef] = useState(requirementRef)
  const [error, setError] = useState("")

  const selectedProduct = PRODUCT_LIST.find((p) => p.id === product)

  useEffect(() => {
    if (selectedProduct) setUnitCost(selectedProduct.unitCost.toString())
  }, [product])

  useEffect(() => { setReqRef(requirementRef) }, [requirementRef])

  function handleAdd() {
    if (!product) { setError("Please select a product."); return }
    if (!quantity || parseInt(quantity) <= 0) { setError("Quantity must be greater than zero."); return }
    if (existingProducts.includes(selectedProduct?.name ?? "")) { setError("This product is already in the order."); return }
    setError("")
    onAdd({
      id: `item-${++nextItemId}`,
      product: selectedProduct!.name,
      requirementRef: reqRef,
      quantity: parseInt(quantity),
      unitCost: parseFloat(unitCost) || 0,
    })
    setProduct(""); setQuantity(""); setUnitCost(""); setReqRef(requirementRef)
  }

  const SC = "w-full rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm focus:border-[#49B0C1] focus:outline-none bg-white"

  return (
    <Modal open={open} title="Add Product to Purchase Order" onClose={onClose} size="sm">
      <div className="flex flex-col gap-4">
        {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <div>
          <label className="text-sm font-medium text-[#333333] block mb-1.5">Product</label>
          <select value={product} onChange={(e) => setProduct(e.target.value)} className={SC}>
            <option value="">Select product...</option>
            {PRODUCT_LIST.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-[#333333] block mb-1.5">Quantity Ordered</label>
            <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} className={SC} placeholder="0" />
          </div>
          <div>
            <label className="text-sm font-medium text-[#333333] block mb-1.5">Unit Cost (ETB)</label>
            <input type="number" min={0} step={0.01} value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className={SC} placeholder="0.00" />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-[#333333] block mb-1.5">Requirement Line <span className="text-[#999] text-xs font-normal">(optional)</span></label>
          <select value={reqRef} onChange={(e) => setReqRef(e.target.value)} className={SC}>
            <option value="">No requirement</option>
            {MOCK_REQUIREMENTS.map((r) => <option key={r.id} value={r.reference}>{r.label}</option>)}
          </select>
        </div>
        {product && quantity && unitCost && (
          <div className="rounded-lg bg-[#DBEFF3]/50 px-4 py-2.5 flex items-center justify-between text-sm">
            <span className="text-[#666666]">Line Total</span>
            <span className="font-bold text-[#333333]">{fmtMoney(parseInt(quantity || "0") * parseFloat(unitCost || "0"))}</span>
          </div>
        )}
        <div className="flex gap-3 justify-end border-t border-[#DBEFF3] pt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAdd}>Add Product</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

function ConfirmModal({ open, title, message, detail, confirmLabel, confirmClass, cancelLabel = "Cancel", onClose, onConfirm }: {
  open: boolean; title: string; message: string; detail?: string
  confirmLabel: string; confirmClass: string; cancelLabel?: string
  onClose: () => void; onConfirm: () => void
}) {
  const [loading, setLoading] = useState(false)
  async function go() { setLoading(true); await new Promise((r) => setTimeout(r, 600)); onConfirm(); setLoading(false) }
  return (
    <Modal open={open} title={title} onClose={onClose} size="sm">
      <p className="text-sm text-[#666666]">{message}</p>
      {detail && <p className="mt-2 text-xs text-[#999]">{detail}</p>}
      <div className="flex gap-3 justify-end mt-6">
        <Button variant="secondary" onClick={onClose}>{cancelLabel}</Button>
        <button onClick={go} disabled={loading} className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${confirmClass}`}>
          {loading ? "Processing..." : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CreatePurchaseOrderPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const isNew = !id || id === "new"
  const wantsEdit = searchParams.get("edit") === "1"

  const existingPO = isNew ? null : INITIAL_POS.find((p) => p.id === id) ?? null
  const [poState, setPOState] = useState<PurchaseOrder | null>(existingPO)
  const [editMode, setEditMode] = useState(isNew || wantsEdit)
  const [toast, setToast] = useState("")

  // Form state
  const [reqRef, setReqRef]         = useState(existingPO?.requirementRef ?? "")
  const [suppId, setSuppId]         = useState(existingPO?.supplierId ?? "")
  const [orderDate, setOrderDate]   = useState(existingPO?.orderDate ?? new Date().toISOString().slice(0, 10))
  const [delivDate, setDelivDate]   = useState(existingPO?.expectedDeliveryDate ?? "")
  const [notes, setNotes]           = useState(existingPO?.notes ?? "")
  const [items, setItems]           = useState<POItem[]>(existingPO?.items ?? [])
  const [saving, setSaving]         = useState(false)
  const [addProductOpen, setAddProductOpen] = useState(false)

  // Status action modals
  const [markDeliveryOpen, setMarkDeliveryOpen] = useState(false)
  const [closeOpen, setCloseOpen]               = useState(false)
  const [cancelOpen, setCancelOpen]             = useState(false)

  const status: POStatus = poState?.status ?? "REGISTERED"
  const supplier = MOCK_SUPPLIERS.find((s) => s.id === suppId)
  const total = orderTotal(items)
  const isReadOnly = !editMode || status === "CLOSED" || status === "CANCELLED"

  function updateStatus(next: POStatus) {
    if (poState) {
      const updated = { ...poState, status: next }
      setPOState(updated)
      // Also update INITIAL_POS for list page consistency
      const idx = INITIAL_POS.findIndex((p) => p.id === poState.id)
      if (idx !== -1) INITIAL_POS[idx] = updated
    }
  }

  async function handleCreate() {
    if (!suppId || items.length === 0) return
    setSaving(true)
    await new Promise((r) => setTimeout(r, 900))
    setSaving(false)
    const ref = `PO-2026-00${nextPORef++}`
    const newPO: PurchaseOrder = {
      id: `po-new-${Date.now()}`, reference: ref,
      supplierId: suppId, supplierName: supplier?.name ?? "",
      orderDate, expectedDeliveryDate: delivDate,
      status: "REGISTERED", items, notes, requirementRef: reqRef,
    }
    INITIAL_POS.unshift(newPO)
    setToast("Purchase order created successfully.")
    setTimeout(() => navigate("/purchasing/orders"), 1200)
  }

  async function handleUpdate() {
    if (!poState || !suppId || items.length === 0) return
    setSaving(true)
    await new Promise((r) => setTimeout(r, 900))
    const updated = { ...poState, supplierId: suppId, supplierName: supplier?.name ?? "", expectedDeliveryDate: delivDate, notes, items, requirementRef: reqRef }
    setPOState(updated)
    const idx = INITIAL_POS.findIndex((p) => p.id === poState.id)
    if (idx !== -1) INITIAL_POS[idx] = updated
    setSaving(false)
    setEditMode(false)
    setToast("Purchase order updated successfully.")
  }

  const SC = "w-full rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm focus:border-[#49B0C1] focus:outline-none bg-white"
  const ROC = "w-full rounded-xl border border-[#DBEFF3] bg-[#DBEFF3]/40 px-3.5 py-2.5 text-sm text-[#666666]"

  const reference = poState?.reference ?? `PO-2026-00${nextPORef}`

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb={`Purchasing / Orders${isNew ? " / New" : " / " + reference}`}
        title={isNew ? "Create Purchase Order" : reference}
        subtitle={isNew ? "Create a new purchase order to send to a supplier." : "Purchase Order"}
        actions={
          <div className="flex items-center gap-2">
            {!isNew && poState && <StatusBadge status={poState.status} />}
            {!isNew && editMode && (
              <button onClick={() => setEditMode(false)} className="inline-flex items-center gap-1.5 rounded-xl border border-white/30 bg-white/10 px-3.5 py-2 text-sm font-medium text-white hover:bg-white/20 transition-colors">
                Cancel Edit
              </button>
            )}
            {!isNew && !editMode && status === "REGISTERED" && (
              <button onClick={() => setEditMode(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-white/30 bg-white/10 px-3.5 py-2 text-sm font-medium text-white hover:bg-white/20 transition-colors">
                Edit Order
              </button>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Detail view — back nav */}
        {!isNew && (
          <button onClick={() => navigate("/purchasing/orders")} className="flex items-center gap-1.5 text-sm text-[#666666] hover:text-[#49B0C1] transition-colors mb-5">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
            </svg>
            Purchase Orders
          </button>
        )}

        <div className="grid lg:grid-cols-3 gap-5">
          {/* ── LEFT COLUMN ── */}
          <div className="lg:col-span-2 flex flex-col gap-5">

            {/* Status timeline (detail only) */}
            {!isNew && poState && (
              <div className="bg-white rounded-xl border border-[#DBEFF3] p-5">
                <p className="text-xs font-bold text-[#666666] uppercase tracking-wide mb-4">Order Status</p>
                <StatusTimeline current={poState.status} cancelled={poState.status === "CANCELLED"} />
              </div>
            )}

            {/* Order information */}
            <div className="bg-white rounded-xl border border-[#DBEFF3] p-5">
              <p className="text-xs font-bold text-[#666666] uppercase tracking-wide mb-4">Order Information</p>
              <div className="grid sm:grid-cols-2 gap-4">
                {!isNew && (
                  <div>
                    <label className="text-sm font-medium text-[#333333] block mb-1.5">PO Number</label>
                    <input readOnly value={reference} className={ROC} />
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-[#333333] block mb-1.5">
                    Purchase Requirement <span className="text-[#999] text-xs font-normal">(optional)</span>
                  </label>
                  {isReadOnly ? (
                    <div className={ROC}>{reqRef || "—"}</div>
                  ) : (
                    <select value={reqRef} onChange={(e) => setReqRef(e.target.value)} className={SC}>
                      <option value="">No requirement</option>
                      {MOCK_REQUIREMENTS.map((r) => <option key={r.id} value={r.reference}>{r.label}</option>)}
                    </select>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-[#333333] block mb-1.5">Order Date</label>
                  {isReadOnly ? (
                    <div className={ROC}>{fmtDate(orderDate)}</div>
                  ) : (
                    <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className={SC} />
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-[#333333] block mb-1.5">Expected Delivery Date</label>
                  {isReadOnly ? (
                    <div className={ROC}>{fmtDate(delivDate) || "—"}</div>
                  ) : (
                    <input type="date" value={delivDate} onChange={(e) => setDelivDate(e.target.value)} className={SC} />
                  )}
                </div>
              </div>
            </div>

            {/* Supplier selection */}
            <div className="bg-white rounded-xl border border-[#DBEFF3] p-5">
              <p className="text-xs font-bold text-[#666666] uppercase tracking-wide mb-4">
                Supplier <span className="text-red-400">*</span>
              </p>
              {isReadOnly ? (
                <div className={ROC}>{supplier?.name ?? "—"}</div>
              ) : (
                <select value={suppId} onChange={(e) => setSuppId(e.target.value)} className={SC}>
                  <option value="">Select supplier...</option>
                  {MOCK_SUPPLIERS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
              {supplier && (
                <div className="mt-4 rounded-xl bg-[#DBEFF3]/50 p-4 grid sm:grid-cols-2 gap-3">
                  {[
                    ["Contact Person", supplier.contact],
                    ["Phone",          supplier.phone],
                    ["Email",          supplier.email],
                    ["Payment Terms",  supplier.paymentTerms],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-xs text-[#999]">{label}</p>
                      <p className="text-sm font-semibold text-[#333333]">{value}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Order items */}
            <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
              <div className="px-5 py-3 border-b border-[#DBEFF3] flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#666666] uppercase tracking-wide">Order Items</p>
                  <p className="text-xs text-[#999] mt-0.5">Products included in this purchase order.</p>
                </div>
                {!isReadOnly && (
                  <button onClick={() => setAddProductOpen(true)} className="text-xs font-semibold text-[#49B0C1] hover:underline">+ Add Product</button>
                )}
              </div>
              {items.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-[#999]">No products added yet.</p>
                  {!isReadOnly && (
                    <button onClick={() => setAddProductOpen(true)} className="mt-3 text-xs font-semibold text-[#49B0C1] hover:underline">+ Add Product</button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#DBEFF3]/50 text-left">
                        <th className="px-4 py-3 font-semibold text-[#333333]">Product</th>
                        <th className="px-4 py-3 font-semibold text-[#333333] hidden sm:table-cell">Requirement</th>
                        <th className="px-4 py-3 font-semibold text-[#333333] text-right">Quantity</th>
                        <th className="px-4 py-3 font-semibold text-[#333333] text-right">Unit Cost</th>
                        <th className="px-4 py-3 font-semibold text-[#333333] text-right">Line Total</th>
                        {!isReadOnly && <th className="px-4 py-3" />}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, i) => (
                        <tr key={item.id} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/15"}>
                          <td className="px-4 py-3 font-medium text-[#333333]">{item.product}</td>
                          <td className="px-4 py-3 text-[#666666] font-mono text-xs hidden sm:table-cell">
                            {item.requirementRef || <span className="text-[#999]">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right text-[#333333]">{item.quantity}</td>
                          <td className="px-4 py-3 text-right text-[#666666]">{fmtMoney(item.unitCost)}</td>
                          <td className="px-4 py-3 text-right font-bold text-[#333333]">{fmtMoney(itemTotal(item))}</td>
                          {!isReadOnly && (
                            <td className="px-4 py-3">
                              <button onClick={() => setItems((prev) => prev.filter((x) => x.id !== item.id))} className="text-xs text-red-400 hover:text-red-600 font-medium">Remove</button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="bg-white rounded-xl border border-[#DBEFF3] p-5">
              <label className="text-xs font-bold text-[#666666] uppercase tracking-wide block mb-3">Notes / Special Instructions</label>
              {isReadOnly ? (
                <p className="text-sm text-[#666666]">{notes || "—"}</p>
              ) : (
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-xl border border-[#ABDBE3] px-3.5 py-2.5 text-sm resize-none focus:border-[#49B0C1] focus:outline-none" placeholder="Add delivery instructions, purchasing notes, or other relevant information..." />
              )}
            </div>

            {/* Delivery info panel for AWAITING_DELIVERY */}
            {!isNew && status === "AWAITING_DELIVERY" && (
              <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-5">
                <div className="flex items-start gap-3">
                  <svg className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <p className="font-semibold text-yellow-800 text-sm">Delivery is pending</p>
                    <p className="text-sm text-yellow-700 mt-1">When the supplier delivers the goods, complete receiving and reconciliation from Purchasing → Deliveries.</p>
                    <button onClick={() => navigate("/purchasing/deliveries/new")} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-yellow-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-yellow-800 transition-colors">
                      Go to Deliveries / Receive Goods →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Source relationship (detail only) */}
            {!isNew && (
              <div className="bg-white rounded-xl border border-[#DBEFF3] p-5">
                <p className="text-xs font-bold text-[#666666] uppercase tracking-wide mb-3">Source</p>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-[#DBEFF3] flex items-center justify-center shrink-0">
                    <svg className="h-4 w-4 text-[#49B0C1]" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                      <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V7zm-3 1a1 1 0 10-2 0v3a1 1 0 102 0V8zM8 9a1 1 0 00-2 0v2a1 1 0 102 0V9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-[#999]">Purchase Requirement</p>
                    {poState?.requirementRef
                      ? <p className="text-sm font-semibold text-[#49B0C1]">{poState.requirementRef}</p>
                      : <p className="text-sm text-[#666666]">Manual Purchase Order</p>
                    }
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="flex flex-col gap-5">
            {/* Order summary */}
            <div className="bg-white rounded-xl border border-[#DBEFF3] p-5 sticky top-0">
              <p className="text-xs font-bold text-[#666666] uppercase tracking-wide mb-4">Order Summary</p>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#666666]">Items</span>
                  <span className="text-[#333333]">{items.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#666666]">Subtotal</span>
                  <span className="text-[#333333]">{fmtMoney(total)}</span>
                </div>
                <div className="flex justify-between border-t border-[#DBEFF3] pt-3">
                  <span className="font-semibold text-[#333333]">Total Amount</span>
                  <span className="text-xl font-bold text-[#49B0C1]">{fmtMoney(total)}</span>
                </div>
              </div>

              {/* Supplier payment terms */}
              {supplier && (
                <div className="mt-4 rounded-lg bg-[#DBEFF3]/50 px-4 py-3">
                  <p className="text-xs text-[#999]">Supplier Payment Terms</p>
                  <p className="text-sm font-semibold text-[#333333] mt-0.5">{supplier.paymentTerms}</p>
                  <p className="text-xs text-[#999] mt-1">Payment is managed through Supplier Payables.</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="mt-5 flex flex-col gap-2">
                {isNew && (
                  <>
                    <Button onClick={handleCreate} loading={saving} disabled={!suppId || items.length === 0} className="w-full">
                      {saving ? "Creating..." : "Create Purchase Order"}
                    </Button>
                    <Button variant="secondary" onClick={() => navigate("/purchasing/orders")} className="w-full">Cancel</Button>
                  </>
                )}
                {!isNew && editMode && (
                  <>
                    <Button onClick={handleUpdate} loading={saving} disabled={!suppId || items.length === 0} className="w-full">
                      {saving ? "Updating..." : "Save Changes"}
                    </Button>
                    <Button variant="secondary" onClick={() => setEditMode(false)} className="w-full">Cancel Edit</Button>
                  </>
                )}
                {!isNew && !editMode && (
                  <>
                    {status === "REGISTERED" && (
                      <>
                        <button onClick={() => setMarkDeliveryOpen(true)} className="w-full rounded-xl bg-[#49B0C1] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#3a9aaa] transition-colors">
                          Mark as Awaiting Delivery
                        </button>
                        <button onClick={() => setEditMode(true)} className="w-full rounded-xl border border-[#ABDBE3] bg-white px-4 py-2.5 text-sm font-semibold text-[#333333] hover:bg-[#DBEFF3] transition-colors">
                          Edit Order
                        </button>
                        <button onClick={() => setCancelOpen(true)} className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors">
                          Cancel Order
                        </button>
                      </>
                    )}
                    {status === "AWAITING_DELIVERY" && (
                      <button onClick={() => setCancelOpen(true)} className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors">
                        Cancel Order
                      </button>
                    )}
                    {status === "RECEIVED" && (
                      <button onClick={() => setCloseOpen(true)} className="w-full rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition-colors">
                        Close Purchase Order
                      </button>
                    )}
                    <button onClick={() => navigate("/purchasing/orders")} className="w-full rounded-xl border border-[#ABDBE3] bg-white px-4 py-2.5 text-sm text-[#666666] hover:bg-[#DBEFF3] transition-colors">
                      ← Back to Orders
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Supplier payables link (detail) */}
            {!isNew && (status === "CLOSED" || status === "RECEIVED") && (
              <div className="bg-white rounded-xl border border-[#DBEFF3] p-5">
                <p className="text-xs font-bold text-[#666666] uppercase tracking-wide mb-3">Supplier Payables</p>
                <p className="text-xs text-[#999] mb-3">Invoice and payment details are managed in Supplier Payables.</p>
                <button onClick={() => navigate("/purchasing/payables")} className="w-full rounded-xl border border-[#ABDBE3] px-4 py-2.5 text-sm font-semibold text-[#49B0C1] hover:bg-[#DBEFF3] transition-colors">
                  View Supplier Payables →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddProductModal
        open={addProductOpen}
        existingProducts={items.map((i) => i.product)}
        requirementRef={reqRef}
        onClose={() => setAddProductOpen(false)}
        onAdd={(item) => { setItems((prev) => [...prev, item]); setAddProductOpen(false) }}
      />

      <ConfirmModal
        open={markDeliveryOpen}
        title="Mark as Awaiting Delivery?"
        message={`Send ${reference} to the supplier and mark it as awaiting delivery?`}
        confirmLabel="Mark Awaiting Delivery"
        confirmClass="bg-yellow-600 hover:bg-yellow-700 text-white"
        onClose={() => setMarkDeliveryOpen(false)}
        onConfirm={() => { updateStatus("AWAITING_DELIVERY"); setMarkDeliveryOpen(false); setToast("Purchase order marked as awaiting delivery.") }}
      />
      <ConfirmModal
        open={closeOpen}
        title="Close Purchase Order?"
        message="This purchase order has been received. Closing it will mark the purchasing cycle as complete."
        confirmLabel="Close Purchase Order"
        confirmClass="bg-green-600 hover:bg-green-700 text-white"
        onClose={() => setCloseOpen(false)}
        onConfirm={() => { updateStatus("CLOSED"); setCloseOpen(false); setToast("Purchase order closed.") }}
      />
      <ConfirmModal
        open={cancelOpen}
        title="Cancel Purchase Order?"
        message={`Are you sure you want to cancel ${reference}? This action will mark the order as cancelled.`}
        confirmLabel="Cancel Purchase Order"
        confirmClass="bg-red-600 hover:bg-red-700 text-white"
        cancelLabel="Keep Order"
        onClose={() => setCancelOpen(false)}
        onConfirm={() => { updateStatus("CANCELLED"); setCancelOpen(false); setToast("Purchase order cancelled.") }}
      />

      {toast && <Toast message={toast} onDone={() => setToast("")} />}
    </div>
  )
}
