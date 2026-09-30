import { useState, useEffect, useMemo } from "react"
import { useParams, useNavigate, useSearchParams } from "react-router"
import { ChevronLeft, ChevronRight } from "lucide-react"
import PageHeader from "../../components/ui/PageHeader"
import Modal from "../../components/ui/Modal"
import Button from "../../components/ui/Button"
import { StatusBadge, PaymentBadge, Toast, fmtDate } from "./PurchaseOrdersPage"
import {
  getPurchaseOrder,
  createPurchaseOrder,
  createPurchaseOrderFromRequirement,
  updatePurchaseOrder,
  updatePurchaseOrderItem,
  deletePurchaseOrderItem,
  acceptPurchaseOrderShortage,
  markPurchaseOrderAwaitingDelivery,
  cancelPurchaseOrder,
  closePurchaseOrder,
  PurchaseOrdersApiError,
  type POItemDto,
  type PurchaseOrderDto,
  type CreatePurchaseOrderItemInput,
  type UpdatePurchaseOrderItemInput,
} from "../../features/purchasing/purchaseOrdersApi"
import { listSuppliers, type SupplierDto } from "../../features/purchasing/suppliersApi"
import { listProducts, type ProductDto } from "../../features/inventory/productsApi"
import { listRequirementLinesByProduct } from "../../features/purchasing/requirementsApi"
import type { POItem, POStatus } from "./PurchaseOrdersPage"
import { useSearchableResource } from "../../hooks/useSearchableResource"
import { searchProducts } from "../../features/inventory/searchSelectors"
import { useProductUnits } from "../../features/inventory/useProductUnits"
import { toBaseQuantity, formatFactor } from "../../features/inventory/unitOptions"
import OrderItemReceivingDetails, {
  type ReceivingDetailsRow,
} from "./OrderItemReceivingDetails"

// ─── Shared local data ────────────────────────────────────────────────────────

/** A requirement line option for linking PO items back to requirements. */
interface ReqLineOption {
  lineId: string
  label: string
}

function fmtMoney(n: number) {
  return `${n.toLocaleString("en-ET")} ETB`
}

function itemTotal(item: POItem) {
  return item.quantity * item.unitCost
}
function orderTotal(items: POItem[]) {
  return items.reduce((s, i) => s + itemTotal(i), 0)
}

// ─── Status timeline ──────────────────────────────────────────────────────────

const STATUS_FLOW: POStatus[] = [
  "REGISTERED",
  "AWAITING_DELIVERY",
  "RECEIVED",
  "CLOSED",
]

// ─── Receiving progress ───────────────────────────────────────────────────────

function ReceivingProgress({
  ordered,
  received,
  remaining,
}: {
  ordered: number
  received: number
  remaining: number
}) {
  const pct =
    ordered > 0 ? Math.min(100, Math.round((received / ordered) * 100)) : 0
  return (
    <div className="px-5 py-4 border-b border-[#E6ECE2] bg-[#E6ECE2]/30">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6 text-sm">
          {[
            ["Ordered", ordered],
            ["Received", received],
            ["Remaining", remaining],
          ].map(([label, value]) => (
            <div key={label as string}>
              <p className="text-xs text-[#666666]">{label}</p>
              <p className="text-lg font-bold text-[#333333]">
                {value as number}
              </p>
            </div>
          ))}
        </div>
        <div className="flex-1 min-w-[200px] max-w-[280px]">
          <div className="flex justify-between text-xs text-[#666666] mb-1">
            <span className="font-medium text-[#333333]">
              {received} / {ordered} received
            </span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-[#C6D4BF]/50 overflow-hidden">
            <div
              className="h-2 rounded-full bg-[#7A9076] transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Goods receipt status badge ───────────────────────────────────────────────

const RECEIPT_STATUS_CFG: Record<string, { label: string; cls: string }> = {
  RESOLVED: { label: "Resolved", cls: "bg-green-100 text-green-700" },
  RECEIVED: { label: "Received", cls: "bg-green-100 text-green-700" },
  PENDING: { label: "Pending", cls: "bg-yellow-100 text-yellow-700" },
  DRAFT: { label: "Draft", cls: "bg-gray-100 text-gray-500" },
  CANCELLED: { label: "Cancelled", cls: "bg-red-100 text-red-600" },
}

function receiptStatusCfg(status: string) {
  return (
    RECEIPT_STATUS_CFG[status] ?? {
      label: status ? status.charAt(0) + status.slice(1).toLowerCase() : status,
      cls: "bg-gray-100 text-gray-500",
    }
  )
}

function StatusTimeline({
  current,
  cancelled,
}: {
  current: POStatus
  cancelled?: boolean
}) {
  const steps = cancelled ? ["REGISTERED", "CANCELLED"] : STATUS_FLOW

  const currentIdx = steps.indexOf(current)

  return (
    <div className="flex items-center gap-0 overflow-x-auto">
      {steps.map((step, idx) => {
        const done = idx < currentIdx
        const active = idx === currentIdx
        const labels: Record<string, string> = {
          REGISTERED: "Registered",
          AWAITING_DELIVERY: "Awaiting Delivery",
          RECEIVED: "Received",
          CLOSED: "Closed",
          CANCELLED: "Cancelled",
        }
        return (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center min-w-[80px]">
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                  step === "CANCELLED"
                    ? "border-red-300 bg-red-50 text-red-500"
                    : done
                      ? "border-[#B6C8AF] bg-[#B6C8AF] text-[#333333]"
                      : active
                        ? "border-[#B6C8AF] bg-white text-[#7A9076]"
                        : "border-[#C6D4BF] bg-white text-[#C6D4BF]"
                }`}
              >
                {done ? (
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  idx + 1
                )}
              </div>
              <p
                className={`mt-1 text-[10px] font-medium text-center leading-tight ${
                  active
                    ? "text-[#7A9076]"
                    : done
                      ? "text-[#7A9076]"
                      : "text-[#C6D4BF]"
                } ${step === "CANCELLED" ? "text-red-500" : ""}`}
              >
                {labels[step]}
              </p>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`h-0.5 w-8 -mt-4 mx-1 flex-shrink-0 ${
                  idx < currentIdx ? "bg-[#B6C8AF]" : "bg-[#E6ECE2]"
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Add Product Modal ────────────────────────────────────────────────────────

function AddProductModal({ open, products, existingProductIds, onClose, onAdd }: {
  open: boolean
  products: ProductDto[]
  existingProductIds: string[]
  onClose: () => void
  onAdd: (item: POItem) => void
}) {
  const productSearch = useSearchableResource(searchProducts, open)
  const [product, setProduct] = useState("")
  const [unitId, setUnitId] = useState("")
  const [quantity, setQuantity] = useState("")
  const [unitCost, setUnitCost] = useState("")
  const [reqLineId, setReqLineId] = useState("")
  const [error, setError] = useState("")

  // Requirement-line options for the currently selected product. Fetched on
  // demand from GET /requirements/lines?productId= — never loaded for all
  // products up front.
  const [reqLineOptions, setReqLineOptions] = useState<ReqLineOption[]>([])
  const [reqLinesLoading, setReqLinesLoading] = useState(false)
  const [reqLinesError, setReqLinesError] = useState(false)
  const [reqLinesNoMatch, setReqLinesNoMatch] = useState(false)

  const unitProducts = useProductUnits(product || null)
  const baseUnit = unitProducts.baseUnit
  const unitOptions = unitProducts.options
  const [unitFilter, setUnitFilter] = useState("")

  const visibleUnitOptions = unitOptions.filter(
    (o) => !unitFilter || o.label.toLowerCase().includes(unitFilter.toLowerCase()),
  )

  const selectedProductName =
    productSearch.options.find((o) => o.value === product)?.label ??
    unitProducts.product?.name ??
    ""

  const qty = parseFloat(quantity) || 0
  const productUnit = unitProducts.units.find((u) => u.unitId === unitId)
  const baseQty = toBaseQuantity(qty, productUnit)
  const showPreview = !!product && !!unitId && qty > 0 && baseQty !== null && !!baseUnit

  useEffect(() => {
    if (open) {
      setProduct("")
      setUnitId("")
      setQuantity("")
      setUnitCost("")
      setReqLineId("")
      setUnitFilter("")
      setError("")
    }
  }, [open])

  // Fetch the requirement lines for the selected product. Before a product is
  // chosen nothing is fetched and the field stays disabled. When the product
  // changes, any previously selected requirement is cleared (it can only
  // belong to the previous product).
  useEffect(() => {
    if (!open) return
    setReqLineId("")
    if (!product) {
      setReqLineOptions([])
      setReqLinesLoading(false)
      setReqLinesError(false)
      setReqLinesNoMatch(false)
      return
    }
    let active = true
    setReqLineOptions([])
    setReqLinesLoading(true)
    setReqLinesError(false)
    setReqLinesNoMatch(false)
    listRequirementLinesByProduct(product)
      .then((lines) => {
        if (!active) return
        const options: ReqLineOption[] = lines.map((l) => ({
          lineId: l.id,
          label: `${l.requirementReference || l.requirementId.slice(0, 8).toUpperCase()} — ${l.product?.name ?? ""}`,
        }))
        setReqLineOptions(options)
        setReqLinesNoMatch(options.length === 0)
      })
      .catch(() => {
        if (!active) return
        setReqLinesError(true)
      })
      .finally(() => { if (active) setReqLinesLoading(false) })
    return () => { active = false }
  }, [open, product])

  function handleAdd() {
    if (!product) {
      setError("Please select a product.")
      return
    }
    if (!quantity || parseInt(quantity) <= 0) {
      setError("Quantity must be greater than zero.")
      return
    }
    if (existingProductIds.includes(product)) {
      setError("This product is already in the order.")
      return
    }
    setError("")
    onAdd({
      id: `draft-${product}`,
      productId: product,
      product: selectedProductName,
      unitId,
      unitLabel: productUnit?.unit?.name ?? "",
      requirementLineId: reqLineId || null,
      quantity: qty,
      unitCost: parseFloat(unitCost) || 0,
    })
    setProduct("")
    setUnitId("")
    setQuantity("")
    setUnitCost("")
    setReqLineId("")
    setUnitFilter("")
  }

  const SC =
    "w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm focus:border-[#B6C8AF] focus:outline-none bg-white"

  return (
    <Modal
      open={open}
      title="Add Product to Purchase Order"
      onClose={onClose}
      size="sm"
    >
      <div className="flex flex-col gap-4">
        {error && (
          <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div>
          <label className="text-sm font-medium text-[#333333] block mb-1.5">
            Product
          </label>
          <select
            value={product}
            onChange={(e) => setProduct(e.target.value)}
            className={SC}
          >
            <option value="">Select product...</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-[#333333] block mb-1.5">
              Quantity Ordered
            </label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className={SC}
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-[#333333] block mb-1.5">
              Unit Cost (ETB)
            </label>
            <input
              type="number"
              min={0}
              step={0.01}
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              className={SC}
              placeholder="0.00"
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-[#333333] block mb-1.5">
            Unit
          </label>
          <select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            className={SC}
            disabled={!product || unitOptions.length === 0}
          >
            <option value="">Select unit...</option>
            {visibleUnitOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {showPreview && (
          <div className="rounded-lg bg-[#E6ECE2]/50 px-4 py-2.5 text-sm">
            {qty} {productUnit?.unit?.name ?? ""} ={" "}
            <span className="font-semibold text-[#7A9076]">{baseQty} {baseUnit?.name ?? ""}</span>
            <span className="text-[#999] text-xs ml-2">(conversion {formatFactor(productUnit?.conversionFactor ?? 1)}×)</span>
          </div>
        )}
        <div>
          <label className="text-sm font-medium text-[#333333] block mb-1.5">Requirement Line <span className="text-[#999] text-xs font-normal">(optional)</span></label>
          <select
            value={reqLineId}
            onChange={(e) => setReqLineId(e.target.value)}
            disabled={!product || reqLinesLoading}
            className={`${SC} ${!product || reqLinesLoading ? "bg-[#F5F4EE] text-[#999] cursor-not-allowed" : ""}`}
          >
            {reqLinesLoading ? (
              <option value="">Loading requirements...</option>
            ) : reqLineOptions.length > 0 ? (
              <>
                <option value="" disabled>
                  Select a requirement...
                </option>
                {reqLineOptions.map((r) => (
                  <option key={r.lineId} value={r.lineId}>{r.label}</option>
                ))}
              </>
            ) : (
              <option value="">No requirement</option>
            )}
          </select>
          {reqLinesNoMatch && (
            <p className="text-xs text-[#999] mt-1.5">
              No open purchase requirements found for this product.
            </p>
          )}
          {reqLinesError && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-1.5">
              Unable to load purchase requirements.
            </p>
          )}
        </div>
        {product && quantity && unitCost && (
          <div className="rounded-lg bg-[#E6ECE2]/50 px-4 py-2.5 flex items-center justify-between text-sm">
            <span className="text-[#666666]">Line Total</span>
            <span className="font-bold text-[#333333]">
              {fmtMoney(
                parseInt(quantity || "0") * parseFloat(unitCost || "0"),
              )}
            </span>
          </div>
        )}
        <div className="flex gap-3 justify-end border-t border-[#E6ECE2] pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAdd}>Add Product</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Edit Item Modal ──────────────────────────────────────────────────────────

function EditItemModal({ item, error, onClose, onSave }: {
  item: POItem | null
  error: string
  onClose: () => void
  onSave: (patch: UpdatePurchaseOrderItemInput, onDone: () => void) => void
}) {
  const [quantity, setQuantity] = useState("")
  const [unitCost, setUnitCost] = useState("")
  const [fieldError, setFieldError] = useState("")

  useEffect(() => {
    if (item) {
      setQuantity(String(item.quantity ?? ""))
      setUnitCost(String(item.unitCost ?? ""))
      setFieldError("")
    }
  }, [item])

  function handleSave() {
    const q = parseFloat(quantity)
    const c = parseFloat(unitCost)
    if (!q || q <= 0) { setFieldError("Quantity must be greater than zero."); return }
    if (!c || c <= 0) { setFieldError("Unit cost must be greater than zero."); return }
    setFieldError("")
    onSave(
      { quantityOrdered: q, unitCost: c },
      () => { setQuantity(""); setUnitCost("") },
    )
  }

  const SC = "w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm focus:border-[#B6C8AF] focus:outline-none bg-white"

  return (
    <Modal open={!!item} title="Edit Order Item" onClose={onClose} size="sm">
      <div className="flex flex-col gap-4">
        {(fieldError || error) && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{fieldError || error}</p>}
        <div>
          <label className="text-sm font-medium text-[#333333] block mb-1.5">Quantity Ordered</label>
          <input type="number" min={1} step={0.01} value={quantity} onChange={(e) => setQuantity(e.target.value)} className={SC} />
        </div>
        <div>
          <label className="text-sm font-medium text-[#333333] block mb-1.5">Unit Cost (ETB)</label>
          <input type="number" min={0} step={0.01} value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className={SC} />
        </div>
        {quantity && unitCost && (
          <div className="rounded-lg bg-[#E6ECE2]/50 px-4 py-2.5 flex items-center justify-between text-sm">
            <span className="text-[#666666]">Line Total</span>
            <span className="font-bold text-[#333333]">{fmtMoney(parseFloat(quantity || "0") * parseFloat(unitCost || "0"))}</span>
          </div>
        )}
        <div className="flex gap-3 justify-end border-t border-[#E6ECE2] pt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Item</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Accept Shortage Modal ────────────────────────────────────────────────────

function AcceptShortageModal({ target, quantity, reason, error, setQuantity, setReason, onClose, onConfirm }: {
  target: { itemId?: string; productName: string; remaining: number } | null
  quantity: string
  reason: string
  error: string
  setQuantity: (v: string) => void
  setReason: (v: string) => void
  onClose: () => void
  onConfirm: () => void
}) {
  const SC = "w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm focus:border-[#B6C8AF] focus:outline-none bg-white"
  return (
    <Modal open={!!target} title="Accept Shortage" onClose={onClose} size="sm">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-[#666666]">
          The supplier will not deliver the full ordered quantity for <span className="font-semibold text-[#333333]">{target?.productName}</span>.
          Accepting the shortage reconciles the remaining <span className="font-semibold text-[#333333]">{target?.remaining}</span> unit{target?.remaining !== 1 ? "s" : ""} against the order without receiving stock.
        </p>
        {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <div>
          <label className="text-sm font-medium text-[#333333] block mb-1.5">Shortage Quantity</label>
          <input type="number" min={1} step={0.01} value={quantity} onChange={(e) => setQuantity(e.target.value)} className={SC} placeholder={`Up to ${target?.remaining ?? 0}`} />
        </div>
        <div>
          <label className="text-sm font-medium text-[#333333] block mb-1.5">Reason <span className="text-[#999] text-xs font-normal">(optional)</span></label>
          <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm resize-none focus:border-[#B6C8AF] focus:outline-none" placeholder="e.g. Supplier short-shipped this line" />
        </div>
        <div className="flex gap-3 justify-end border-t border-[#E6ECE2] pt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={onConfirm}>Accept Shortage</Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

function ConfirmModal({
  open,
  title,
  message,
  detail,
  error,
  confirmLabel,
  confirmClass,
  cancelLabel = "Cancel",
  onClose,
  onConfirm,
}: {
  open: boolean
  title: string
  message: string
  detail?: string
  error?: string
  confirmLabel: string
  confirmClass: string
  cancelLabel?: string
  onClose: () => void
  onConfirm: () => void
}) {
  const [loading, setLoading] = useState(false)
  async function go() {
    setLoading(true)
    await onConfirm()
    setLoading(false)
  }
  return (
    <Modal open={open} title={title} onClose={onClose} size="sm">
      <p className="text-sm text-[#666666]">{message}</p>
      {detail && <p className="mt-2 text-xs text-[#999]">{detail}</p>}
      {error && (
        <p className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      <div className="flex gap-3 justify-end mt-6">
        <Button variant="secondary" onClick={onClose}>
          {cancelLabel}
        </Button>
        <button
          onClick={go}
          disabled={loading}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${confirmClass}`}
        >
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

  // Check if we're creating from a requirement (Order Remaining flow)
  const requirementLineId = searchParams.get("requirementLineId")
  const prefilledQuantity = searchParams.get("quantity")
  const prefilledUnitCost = searchParams.get("unitCost")
  const prefilledDelivDate = searchParams.get("expectedDeliveryDate")
  const prefilledNotes = searchParams.get("notes")
  const productName = searchParams.get("productName")

  // Track if we're in from-requirement mode
  const isFromRequirement = isNew && !!requirementLineId

  // Multi-line prefill from a requirement (the "Order" action on the Purchase
  // Requirements list). Each requested line is carried as repeated query params
  // (requirementLineId, quantity, unitCost, productName, ...), zipped by index.
  const prefillLines = useMemo(() => {
    const ids = searchParams.getAll("requirementLineId")
    const quantities = searchParams.getAll("quantity")
    const costs = searchParams.getAll("unitCost")
    const names = searchParams.getAll("productName")
    const units = searchParams.getAll("unitName")
    return ids
      .map((id, i) => ({
        requirementLineId: id,
        quantity: quantities[i] ?? "",
        unitCost: costs[i] ?? "",
        productName: names[i] ?? "",
        unitName: units[i] ?? "",
      }))
      .filter((l) => l.requirementLineId && l.quantity && l.unitCost !== "")
  }, [searchParams])

  // Real data
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([])
  const [products, setProducts] = useState<ProductDto[]>([])

  // Detail state
  const [poState, setPOState] = useState<PurchaseOrderDto | null>(null)
  const [loadingPO, setLoadingPO] = useState(!isNew)
  const [pageError, setPageError] = useState("")

  const [editMode, setEditMode] = useState(isNew || wantsEdit)
  const [toast, setToast] = useState("")

  // Form state
  const [suppId, setSuppId] = useState("")
  const [orderDate, setOrderDate] = useState(
    new Date().toISOString().slice(0, 10),
  )
  const [delivDate, setDelivDate] = useState(prefilledDelivDate ?? "")
  const [notes, setNotes] = useState(prefilledNotes ?? "")
  const [items, setItems] = useState<POItem[]>([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [addProductOpen, setAddProductOpen] = useState(false)
  const [editItem, setEditItem] = useState<POItem | null>(null)
  const [shortageTarget, setShortageTarget] = useState<{ itemId: string; productName: string; remaining: number } | null>(null)
  const [shortageQty, setShortageQty] = useState("")
  const [shortageReason, setShortageReason] = useState("")

  // Status action modals
  const [markDeliveryOpen, setMarkDeliveryOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [actionError, setActionError] = useState("")

  // Load suppliers + products once. Requirement lines are NOT loaded up front:
  // the Add Product modal fetches them per selected product via
  // GET /requirements/lines?productId=.
  useEffect(() => {
    let active = true
    listSuppliers({ limit: 100, isActive: true })
      .then((res) => { if (active) setSuppliers(res.data) })
      .catch(() => { /* supplier select simply stays empty */ })
    listProducts({ limit:   100, isActive: true })
      .then((res) => { if (active) setProducts(res.data) })
      .catch(() => { /* product select simply stays empty */ })
    return () => { active = false }
  }, [])

  // Handle from-requirement prefill: add the requirement line(s) as items
  useEffect(() => {
    if (!isFromRequirement || items.length > 0) return
    if (prefillLines.length === 0) return
    setItems(
      prefillLines.map((pl) => {
        const product = products.find((p) => p.name === pl.productName)
        return {
          id: `draft-${pl.requirementLineId}`,
          productId: product?.id ?? "",
          product: pl.productName ?? "",
          unitId: null,
          unitLabel: pl.unitName ?? "",
          requirementLineId: pl.requirementLineId,
          quantity: parseFloat(pl.quantity),
          unitCost: parseFloat(pl.unitCost),
        }
      }),
    )
    if (prefilledDelivDate) setDelivDate(prefilledDelivDate)
    if (prefilledNotes) setNotes(prefilledNotes)
  }, [
    isFromRequirement,
    prefillLines,
    prefilledDelivDate,
    prefilledNotes,
    products,
    items.length,
  ])

  // Load the PO from the real endpoint when editing/viewing.
  useEffect(() => {
    if (isNew) return
    let active = true
    setLoadingPO(true)
    setPageError("")
    getPurchaseOrder(id!)
      .then((dto) => {
        if (!active) return
        setPOState(dto)
        setSuppId(dto.supplierId)
        setDelivDate(
          dto.expectedDeliveryDate ? dto.expectedDeliveryDate.slice(0, 10) : "",
        )
        setNotes(dto.notes ?? "")
        setItems(
          (dto.items ?? []).map((it: POItemDto) => ({
            id: it.id,
            productId: it.productId,
            product: it.product?.name ?? "",
            unitId: it.unitId ?? null,
            unitLabel: it.unit?.name ?? "",
            requirementLineId: it.requirementLineId ?? null,
            quantity: it.quantityOrdered ?? 0,
            unitCost: it.unitCost ?? 0,
          })),
        )
      })
      .catch((err) => {
        if (!active) return
        setPageError(
          err instanceof PurchaseOrdersApiError
            ? err.message
            : "Failed to load this purchase order.",
        )
      })
      .finally(() => {
        if (active) setLoadingPO(false)
      })
    return () => {
      active = false
    }
  }, [id, isNew])

  const status: POStatus = poState?.status as POStatus ?? "REGISTERED"
  const supplier = suppliers.find((s) => s.id === suppId) ?? null
  // Detail fallback: when the suppliers list hasn't loaded, show the embedded supplier info.
  const supplierView =
    supplier ??
    (poState?.supplier
      ? {
          id: poState.supplier.id,
          name: poState.supplier.name,
          contactPerson: poState.supplier.contactPerson ?? "",
          phone: poState.supplier.phone ?? "",
          email: poState.supplier.email ?? "",
          paymentTerms: poState.supplier.paymentTerms ?? "",
        }
      : null)
  const total = orderTotal(items)
  const isReadOnly = !editMode || status === "CLOSED" || status === "CANCELLED"

  /**
   * Build the create/update items payload. `requirementLineId` is omitted
   * when empty — the backend's validator rejects explicit nulls with 422 —
   * and client-side draft ids are stripped so they never reach the API.
   */
  function itemsToDto(): CreatePurchaseOrderItemInput[] {
    return items.map((it) => ({
      productId: it.productId,
      quantityOrdered: it.quantity,
      unitCost: it.unitCost,
      ...(it.requirementLineId
        ? { requirementLineId: it.requirementLineId }
        : {}),
    }))
  }

  async function handleCreate() {
    if (!suppId || items.length === 0) return
    setSaving(true)
    setSaveError("")
    try {
      if (isFromRequirement) {
        // Use from-requirement endpoint for requirement-linked items
        const requirementItems = items
          .filter((it) => it.requirementLineId)
          .map((it) => ({
            requirementLineId: it.requirementLineId!,
            quantityOrdered: it.quantity,
            unitCost: it.unitCost,
          }))
        if (requirementItems.length > 0) {
          await createPurchaseOrderFromRequirement({
            supplierId: suppId,
            expectedDeliveryDate: delivDate || null,
            notes: notes || null,
            items: requirementItems,
          })
        } else {
          // Fallback to regular create if no requirement-linked items
          await createPurchaseOrder({
            supplierId: suppId,
            expectedDeliveryDate: delivDate || null,
            notes: notes || null,
            items: itemsToDto(),
          })
        }
      } else {
        await createPurchaseOrder({
          supplierId: suppId,
          expectedDeliveryDate: delivDate || null,
          notes: notes || null,
          items: itemsToDto(),
        })
      }
      setToast("Purchase order created successfully.")
      setTimeout(() => navigate("/purchasing/orders"), 1200)
    } catch (err) {
      setSaveError(
        err instanceof PurchaseOrdersApiError
          ? err.message
          : "Failed to create the purchase order. Please try again.",
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate() {
    if (!poState || !suppId || items.length === 0) return
    setSaving(true)
    setSaveError("")
    try {
      // The backend only accepts expectedDeliveryDate + notes on the header.
      // Item edits flow through PATCH/DELETE /purchase-orders/items/{itemId}.
      const updated = await updatePurchaseOrder(poState.id, {
        expectedDeliveryDate: delivDate || null,
        notes: notes || null,
      })
      setPOState(updated)
      setEditMode(false)
      setToast("Purchase order updated successfully.")
    } catch (err) {
      setSaveError(
        err instanceof PurchaseOrdersApiError
          ? err.message
          : "Failed to update the purchase order. Please try again.",
      )
    } finally {
      setSaving(false)
    }
  }

  /** Re-fetch the PO detail (used after item mutations so quantities/summaries stay fresh). */
  function refreshPO() {
    if (!poState) return
    getPurchaseOrder(poState.id)
      .then((dto) => {
        setPOState(dto)
        setItems(
          (dto.items ?? []).map((it: POItemDto) => ({
            id: it.id,
            productId: it.productId,
            product: it.product?.name ?? "",
            unitId: it.unitId ?? null,
            unitLabel: it.unit?.name ?? "",
            requirementLineId: it.requirementLineId ?? null,
            quantity: it.quantityOrdered ?? 0,
            unitCost: it.unitCost ?? 0,
          })),
        )
      })
      .catch(() => { /* keep current state — the toast from the action still informs the user */ })
  }

  /** Persisted item removal — only allowed by the backend on REGISTERED orders. */
  async function handleRemoveItem(item: POItem) {
    if (!poState) return
    setActionError("")
    try {
      await deletePurchaseOrderItem(item.id)
      setToast("Item removed from the purchase order.")
      refreshPO()
    } catch (err) {
      setActionError(err instanceof PurchaseOrdersApiError ? err.message : "Failed to remove the item. Please try again.")
    }
  }

  async function handleSaveItem(itemId: string, patch: UpdatePurchaseOrderItemInput, onDone: () => void) {
    setActionError("")
    try {
      await updatePurchaseOrderItem(itemId, patch)
      setToast("Item updated successfully.")
      refreshPO()
      onDone()
    } catch (err) {
      setActionError(err instanceof PurchaseOrdersApiError ? err.message : "Failed to update the item. Please try again.")
    }
  }

  /** Open the shortage modal with the item's unreceived remainder. */
  function openShortage(item: POItem) {
    const dtoItem = poState?.items?.find((it) => it.id === item.id)
    const remaining = Math.max(
      0,
      (dtoItem?.quantityOrdered ?? item.quantity) - (dtoItem?.quantityReceived ?? 0) - (dtoItem?.quantityShort ?? 0),
    )
    setShortageTarget({ itemId: item.id, productName: item.product, remaining })
    setShortageQty(String(remaining || ""))
    setShortageReason("")
    setActionError("")
  }

  async function handleAcceptShortage() {
    if (!shortageTarget) return
    setActionError("")
    try {
      await acceptPurchaseOrderShortage(shortageTarget.itemId, {
        quantityShort: parseFloat(shortageQty) || undefined,
        ...(shortageReason.trim() ? { shortReason: shortageReason.trim() } : {}),
      })
      setShortageTarget(null)
      setShortageQty("")
      setShortageReason("")
      setToast("Shortage accepted — the item is reconciled against the order.")
      refreshPO()
    } catch (err) {
      setActionError(err instanceof PurchaseOrdersApiError ? err.message : "Failed to accept the shortage. Please try again.")
    }
  }

  /** Remaining quantity of a detail item (for the shortage / progress rendering). */
  function itemRemaining(item: POItem): number {
    return itemNumbers(item).remaining
  }

  /** Ordered / received / remaining numbers for a detail item (from the DTO). */
  function itemNumbers(item: POItem): {
    ordered: number
    received: number
    remaining: number
  } {
    const dtoItem = poState?.items?.find((it) => it.id === item.id)
    const ordered = dtoItem?.quantityOrdered ?? item.quantity
    const received = dtoItem?.quantityReceived ?? 0
    const short = dtoItem?.quantityShort ?? 0
    return { ordered, received, remaining: Math.max(0, ordered - received - short) }
  }

  /** Confirmed status transition against the real endpoint. */
  async function handleStatusAction(
    action: "markDelivery" | "close" | "cancel",
  ) {
    if (!poState) return
    setActionError("")
    try {
      if (action === "cancel") await cancelPurchaseOrder(poState.id)
      else if (action === "markDelivery")
        await markPurchaseOrderAwaitingDelivery(poState.id)
      else if (action === "close") await closePurchaseOrder(poState.id)
      setPOState({
        ...poState,
        status:
          action === "markDelivery"
            ? "AWAITING_DELIVERY"
            : action === "close"
              ? "CLOSED"
              : "CANCELLED",
      })
      setMarkDeliveryOpen(false)
      setCloseOpen(false)
      setCancelOpen(false)
      setToast(
        action === "markDelivery"
          ? "Purchase order marked as awaiting delivery."
          : action === "close"
            ? "Purchase order closed."
            : "Purchase order cancelled.",
      )
    } catch (err) {
      setActionError(
        err instanceof PurchaseOrdersApiError
          ? err.message
          : "The action failed. Please try again.",
      )
    }
  }

  const SC =
    "w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm focus:border-[#B6C8AF] focus:outline-none bg-white"
  const ROC =
    "w-full rounded-xl border border-[#E6ECE2] bg-[#E6ECE2]/40 px-3.5 py-2.5 text-sm text-[#666666]"

  const reference = poState?.poNumber ?? (isNew ? "New Purchase Order" : "")

  const goodsSummary = poState?.goodsSummary ?? null
  const paymentSummary = poState?.paymentSummary ?? null
  const receivingSummary = poState?.receivingSummary ?? null
  const goodsReceipts = poState?.goodsReceipts ?? []

  /** Per-product rows for the "Receiving Details" boxes under the Order Items
   *  table. Only meaningful once the real PO response is loaded. */
  const receivingDetails = useMemo<ReceivingDetailsRow[]>(() => {
    return items.map((item) => {
      const product = products.find((p) => p.id === item.productId)
      const dtoItem = poState?.items?.find((it) => it.id === item.id)
      const ordered = dtoItem?.quantityOrdered ?? item.quantity
      const received = dtoItem?.quantityReceived ?? 0
      const short = dtoItem?.quantityShort ?? 0
      return {
        id: item.id,
        name: product?.name ?? item.product ?? dtoItem?.product?.name ?? "—",
        sku: dtoItem?.product?.sku ?? product?.sku ?? null,
        unitLabel: item.unitLabel || dtoItem?.unit?.name || "—",
        ordered,
        received,
        remaining: Math.max(0, ordered - received - short),
        unitCost: item.unitCost,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, poState, products])

  if (loadingPO) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <PageHeader
          breadcrumb="Purchasing / Orders"
          title="Purchase Order"
          subtitle="Loading..."
        />
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <div className="h-8 w-8 rounded-full border-4 border-[#E6ECE2] border-t-[#B6C8AF] animate-spin" />
          <p className="text-sm text-[#666666]">Loading purchase order...</p>
        </div>
      </div>
    )
  }

  if (!isNew && pageError) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <PageHeader
          breadcrumb="Purchasing / Orders"
          title="Purchase Order"
          subtitle="Something went wrong."
        />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 max-w-md text-center">
            {pageError}
          </p>
          <Button onClick={() => navigate("/purchasing/orders")}>
            <ChevronLeft className="h-4 w-4" /> Back to Orders
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb={`Purchasing / Orders${
          isNew ? " / New" : " / " + reference
        }`}
        title={isNew ? "Create Purchase Order" : reference}
        subtitle={
          isNew
            ? "Create a new purchase order to send to a supplier."
            : "Purchase Order"
        }
        actions={
          <div className="flex items-center gap-2">
            {!isNew && poState && <StatusBadge status={status} />}
            {!isNew && editMode && (
              <button
                onClick={() => setEditMode(false)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#C6D4BF] bg-white px-3.5 py-2 text-sm font-semibold text-[#7A9076] hover:bg-[#E6ECE2] transition-colors"
              >
                Cancel Edit
              </button>
            )}
            {!isNew && !editMode && status === "REGISTERED" && (
              <button
                onClick={() => setEditMode(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#C6D4BF] bg-white px-3.5 py-2 text-sm font-semibold text-[#7A9076] hover:bg-[#E6ECE2] transition-colors"
              >
                Edit Order
              </button>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Detail view — back nav */}
        {!isNew && (
          <button
            onClick={() => navigate("/purchasing/orders")}
            className="flex items-center gap-1.5 text-sm text-[#666666] hover:text-[#7A9076] transition-colors mb-5"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
                clipRule="evenodd"
              />
            </svg>
            Purchase Orders
          </button>
        )}

        {(saveError || (!isNew && editMode && !poState)) && (
          <div className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {saveError ||
              "This purchase order could not be loaded — editing is unavailable."}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-5">
          {/* ── LEFT COLUMN ── */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            {/* Status timeline (detail only) */}
            {!isNew && poState && (
              <div className="bg-white rounded-xl border border-[#E6ECE2] p-5">
                <p className="text-xs font-bold text-[#666666] uppercase tracking-wide mb-4">
                  Order Status
                </p>
                <StatusTimeline
                  current={status}
                  cancelled={status === "CANCELLED"}
                />
              </div>
            )}

            {/* Order information */}
            <div className="bg-white rounded-xl border border-[#E6ECE2] p-5">
              <p className="text-xs font-bold text-[#666666] uppercase tracking-wide mb-4">
                Order Information
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                {!isNew && (
                  <div>
                    <label className="text-sm font-medium text-[#333333] block mb-1.5">
                      PO Number
                    </label>
                    <input readOnly value={reference} className={ROC} />
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-[#333333] block mb-1.5">
                    Purchase Requirement{" "}
                    <span className="text-[#999] text-xs font-normal">
                      (optional, set per item)
                    </span>
                  </label>
                  <div className={ROC}>
                    {items.some((it) => it.requirementLineId)
                      ? `${items.filter((it) => it.requirementLineId).length} of ${items.length} item${
                          items.length !== 1 ? "s" : ""
                        } linked`
                      : "—"}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-[#333333] block mb-1.5">
                    Order Date
                  </label>
                  {isReadOnly ? (
                    <div className={ROC}>
                      {fmtDate(poState?.orderDate ?? orderDate)}
                    </div>
                  ) : (
                    <input
                      type="date"
                      value={orderDate}
                      onChange={(e) => setOrderDate(e.target.value)}
                      className={SC}
                    />
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-[#333333] block mb-1.5">
                    Expected Delivery Date
                  </label>
                  {isReadOnly ? (
                    <div className={ROC}>{fmtDate(delivDate) || "—"}</div>
                  ) : (
                    <input
                      type="date"
                      value={delivDate}
                      onChange={(e) => setDelivDate(e.target.value)}
                      className={SC}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Supplier selection */}
            <div className="bg-white rounded-xl border border-[#E6ECE2] p-5">
              <p className="text-xs font-bold text-[#666666] uppercase tracking-wide mb-4">
                Supplier <span className="text-red-400">*</span>
              </p>
              {isReadOnly ? (
                <div className={ROC}>{supplierView?.name ?? "—"}</div>
              ) : (
                <select
                  value={suppId}
                  onChange={(e) => setSuppId(e.target.value)}
                  className={SC}
                >
                  <option value="">Select supplier...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
              {supplierView && (
                <div className="mt-4 rounded-xl bg-[#E6ECE2]/50 p-4 grid sm:grid-cols-2 gap-3">
                  {[
                    ["Contact Person", supplierView.contactPerson],
                    ["Phone", supplierView.phone],
                    ["Email", supplierView.email],
                    ["Payment Terms", supplierView.paymentTerms],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-xs text-[#999]">{label}</p>
                      <p className="text-sm font-semibold text-[#333333]">
                        {value || "—"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Order items */}
            <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden">
              <div className="px-5 py-3 border-b border-[#E6ECE2] flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#666666] uppercase tracking-wide">
                    Order Items
                  </p>
                  <p className="text-xs text-[#999] mt-0.5">
                    Products included in this purchase order.
                  </p>
                </div>
                {!isReadOnly && (
                  <button
                    onClick={() => setAddProductOpen(true)}
                    className="text-xs font-semibold text-[#7A9076] hover:underline"
                  >
                    + Add Product
                  </button>
                )}
              </div>
              {/* Receiving progress (read-only detail) */}
              {isReadOnly && receivingSummary && (
                <ReceivingProgress
                  ordered={receivingSummary.orderedQuantity ?? 0}
                  received={receivingSummary.receivedQuantity ?? 0}
                  remaining={
                    receivingSummary.remainingQuantity ??
                    Math.max(
                      0,
                      (receivingSummary.orderedQuantity ?? 0) -
                        (receivingSummary.receivedQuantity ?? 0) -
                        (receivingSummary.shortQuantity ?? 0),
                    )
                  }
                />
              )}

              {isReadOnly ? (
                items.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-sm text-[#999]">No products added yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[880px]">
                      <thead>
                        <tr className="bg-[#E6ECE2]/50 text-left">
                          <th className="px-4 py-3 font-semibold text-[#333333]">
                            Product
                          </th>
                          <th className="px-4 py-3 font-semibold text-[#333333]">
                            Unit
                          </th>
                          <th className="px-4 py-3 font-semibold text-[#333333] text-right">
                            Ordered
                          </th>
                          <th className="px-4 py-3 font-semibold text-[#333333] text-right">
                            Received
                          </th>
                          <th className="px-4 py-3 font-semibold text-[#333333] text-right">
                            Remaining
                          </th>
                          <th className="px-4 py-3 font-semibold text-[#333333] text-right">
                            Unit Cost
                          </th>
                          <th className="px-4 py-3 font-semibold text-[#333333] text-right">
                            Ordered Value
                          </th>
                          <th className="px-4 py-3 font-semibold text-[#333333] text-right">
                            Received Value
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, i) => {
                          const product = products.find((p) => p.id === item.productId)
                          const { ordered, received, remaining } = itemNumbers(item)
                          const pct =
                            ordered > 0
                              ? Math.min(100, Math.round((received / ordered) * 100))
                              : 0
                          const unitLabel =
                            item.unitLabel ||
                            poState?.items?.find((it) => it.id === item.id)?.unit
                              ?.name ||
                            "—"
                          const dtoItem = poState?.items?.find(
                            (it) => it.id === item.id,
                          )
                          return (
                            <tr
                              key={item.id}
                              className={
                                i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/15"
                              }
                            >
                              <td className="px-4 py-3">
                                <div className="font-medium text-[#333333]">
                                  {product?.name ?? item.product ?? "—"}
                                </div>
                                {dtoItem?.product?.sku && (
                                  <div className="text-xs text-[#999] font-mono mt-0.5">
                                    {dtoItem.product.sku}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-[#666666]">
                                {unitLabel}
                              </td>
                              <td className="px-4 py-3 text-right text-[#333333]">
                                {ordered}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-[#7A9076]">
                                {received}
                                {received > 0 && received < ordered && (
                                  <span className="ml-1 text-[10px] font-medium text-[#999]">
                                    ({pct}%)
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="text-[#333333]">{remaining}</div>
                                <div className="mt-1 h-1 w-20 rounded-full bg-[#E6ECE2] overflow-hidden ml-auto">
                                  <div
                                    className="h-1 rounded-full bg-[#7A9076]"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right text-[#666666]">
                                {fmtMoney(item.unitCost)}
                              </td>
                              <td className="px-4 py-3 text-right text-[#333333]">
                                {fmtMoney(ordered * item.unitCost)}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-[#333333]">
                                {fmtMoney(received * item.unitCost)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-[#E6ECE2] bg-[#E6ECE2]/30">
                          <td
                            colSpan={6}
                            className="px-4 py-3 text-right text-xs font-semibold text-[#666666] uppercase tracking-wide"
                          >
                            Order Total
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-[#333333]">
                            {fmtMoney(
                              items.reduce(
                                (s, it) => s + itemNumbers(it).ordered * it.unitCost,
                                0,
                              ),
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-[#333333]">
                            {fmtMoney(
                              items.reduce(
                                (s, it) => s + itemNumbers(it).received * it.unitCost,
                                0,
                              ),
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )
              ) : (
                <>
                  {items.length === 0 ? (
                    <div className="py-12 text-center">
                      <p className="text-sm text-[#999]">No products added yet.</p>
                      <button
                        onClick={() => setAddProductOpen(true)}
                        className="mt-3 text-xs font-semibold text-[#7A9076] hover:underline"
                      >
                        + Add Product
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-[#E6ECE2]/50 text-left">
                            <th className="px-4 py-3 font-semibold text-[#333333]">
                              Product
                            </th>
                            <th className="px-4 py-3 font-semibold text-[#333333] hidden sm:table-cell">
                              Requirement
                            </th>
                            <th className="px-4 py-3 font-semibold text-[#333333] text-right">
                              Quantity
                            </th>
                            <th className="px-4 py-3 font-semibold text-[#333333] text-right">
                              Unit Cost
                            </th>
                            <th className="px-4 py-3 font-semibold text-[#333333] text-right">
                              Line Total
                            </th>
                            <th className="px-4 py-3" />
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, i) => {
                            const product = products.find((p) => p.id === item.productId)
                            return (
                              <tr
                                key={item.id}
                                className={
                                  i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/15"
                                }
                              >
                                <td className="px-4 py-3 font-medium text-[#333333]">
                                  {product?.name ?? item.product ?? "—"}
                                </td>
                                <td className="px-4 py-3 text-[#666666] font-mono text-xs hidden sm:table-cell">
                                  {item.requirementLineId ? (
                                    item.requirementLineId.slice(0, 8)
                                  ) : (
                                    <span className="text-[#999]">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right text-[#333333]">
                                  {item.quantity}
                                </td>
                                <td className="px-4 py-3 text-right text-[#666666]">
                                  {fmtMoney(item.unitCost)}
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-[#333333]">
                                  {fmtMoney(itemTotal(item))}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-end gap-3">
                                    {poState && !item.id.startsWith("draft-") && (
                                      <button
                                        onClick={() => setEditItem(item)}
                                        className="text-xs text-[#7A9076] hover:underline font-medium"
                                      >
                                        Edit
                                      </button>
                                    )}
                                    {poState && status === "AWAITING_DELIVERY" && itemRemaining(item) > 0 && (
                                      <button
                                        onClick={() => openShortage(item)}
                                        className="text-xs text-amber-600 hover:underline font-medium"
                                      >
                                        Shortage
                                      </button>
                                    )}
                                    <button
                                      onClick={() => {
                                        if (poState && !item.id.startsWith("draft-")) {
                                          void handleRemoveItem(item)
                                        } else {
                                          setItems((prev) => prev.filter((x) => x.id !== item.id))
                                        }
                                      }}
                                      className="text-xs text-red-400 hover:text-red-600 font-medium"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {/* Per-product receiving/value boxes (create + view + edit) */}
              {receivingDetails.length > 0 && (
                <OrderItemReceivingDetails items={receivingDetails} />
              )}
            </div>

            {/* Goods receipts (detail only) */}
            {!isNew && goodsReceipts.length > 0 && (
              <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden">
                <div className="px-5 py-3 border-b border-[#E6ECE2]">
                  <p className="text-xs font-bold text-[#666666] uppercase tracking-wide">
                    Goods Receipts
                  </p>
                  <p className="text-xs text-[#999] mt-0.5">
                    Receipts registered against this purchase order.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#E6ECE2]/50 text-left">
                        <th className="px-4 py-3 font-semibold text-[#333333]">
                          Receipt
                        </th>
                        <th className="px-4 py-3 font-semibold text-[#333333]">
                          Status
                        </th>
                        <th className="px-4 py-3 font-semibold text-[#333333]">
                          Received Date
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {goodsReceipts.map((gr, i) => {
                        const cfg = receiptStatusCfg(gr.status ?? "")
                        return (
                          <tr
                            key={gr.id ?? gr.receiptNumber}
                            className={
                              i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/15"
                            }
                          >
                            <td className="px-4 py-3 font-mono text-xs text-[#333333]">
                              {gr.receiptNumber}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`text-xs font-bold rounded-full px-2.5 py-0.5 ${cfg.cls}`}
                              >
                                {cfg.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-[#666666]">
                              {fmtDate(gr.receivedDate)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="bg-white rounded-xl border border-[#E6ECE2] p-5">
              <label className="text-xs font-bold text-[#666666] uppercase tracking-wide block mb-3">
                Notes / Special Instructions
              </label>
              {isReadOnly ? (
                <p className="text-sm text-[#666666]">{notes || "—"}</p>
              ) : (
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm resize-none focus:border-[#B6C8AF] focus:outline-none"
                  placeholder="Add delivery instructions, purchasing notes, or other relevant information..."
                />
              )}
            </div>

            {/* Delivery info panel for AWAITING_DELIVERY */}
            {!isNew && status === "AWAITING_DELIVERY" && (
              <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-5">
                <div className="flex items-start gap-3">
                  <svg
                    className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div className="flex-1">
                    <p className="font-semibold text-yellow-800 text-sm">
                      Delivery is pending
                    </p>
                    <p className="text-sm text-yellow-700 mt-1">
                      When the supplier delivers the goods, complete receiving
                      and reconciliation from Purchasing to Deliveries.
                    </p>
                    <button
                      onClick={() => navigate("/purchasing/deliveries/new")}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-yellow-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-yellow-800 transition-colors"
                    >
                      Go to Deliveries / Receive Goods{" "}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Source relationship (detail only) */}
            {!isNew && (
              <div className="bg-white rounded-xl border border-[#E6ECE2] p-5">
                <p className="text-xs font-bold text-[#666666] uppercase tracking-wide mb-3">
                  Source
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-[#E6ECE2] flex items-center justify-center shrink-0">
                    <svg
                      className="h-4 w-4 text-[#7A9076]"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden
                    >
                      <path
                        fillRule="evenodd"
                        d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V7zm-3 1a1 1 0 10-2 0v3a1 1 0 102 0V8zM8 9a1 1 0 00-2 0v2a1 1 0 102 0V9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-[#999]">Purchase Requirement</p>
                    {items.some((it) => it.requirementLineId) ? (
                      <p className="text-sm font-semibold text-[#7A9076]">
                        Linked requirement items
                      </p>
                    ) : (
                      <p className="text-sm text-[#666666]">
                        Manual Purchase Order
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Requirement Allocation Display (detail only) */}
            {!isNew && items.some((it) => it.requirementLineId) && (
              <div className="bg-white rounded-xl border border-[#E6ECE2] p-5">
                <p className="text-xs font-bold text-[#666666] uppercase tracking-wide mb-3">
                  Requirement Allocations
                </p>
                <div className="space-y-3">
                  {items
                    .filter((it) => it.requirementLineId)
                    .map((item) => {
                      const product = products.find((p) => p.id === item.productId)
                      return (
                        <div key={item.id} className="rounded-lg border border-[#E6ECE2] p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-semibold text-[#333333]">
                              {product?.name ?? item.product ?? "—"}
                            </span>
                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                              {item.requirementLineId?.slice(0, 8)}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                              <p className="text-[#999]">Allocated Qty</p>
                              <p className="font-semibold text-[#333333]">
                                {item.quantity}
                                {item.unitLabel && (
                                  <span className="ml-1 text-xs font-normal text-[#999]">{item.unitLabel}</span>
                                )}
                              </p>
                            </div>
                            <div>
                              <p className="text-[#999]">Unit Cost</p>
                              <p className="font-semibold text-[#333333]">{fmtMoney(item.unitCost)}</p>
                            </div>
                            <div>
                              <p className="text-[#999]">Line Total</p>
                              <p className="font-semibold text-[#333333]">{fmtMoney(itemTotal(item))}</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="flex flex-col gap-5">
            {/* Order summary */}
            <div className="bg-white rounded-xl border border-[#E6ECE2] p-5 sticky top-0">
              <p className="text-xs font-bold text-[#666666] uppercase tracking-wide mb-4">
                Order Summary
              </p>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#666666]">Items</span>
                  <span className="text-[#333333]">{items.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#666666]">Subtotal</span>
                  <span className="text-[#333333]">{fmtMoney(total)}</span>
                </div>
                <div className="flex justify-between border-t border-[#E6ECE2] pt-3">
                  <span className="font-semibold text-[#333333]">
                    Total Amount
                  </span>
                  <span className="text-xl font-bold text-[#7A9076]">
                    {fmtMoney(total)}
                  </span>
                </div>
              </div>

              {/* Supplier payment terms */}
              {supplierView && (
                <div className="mt-4 rounded-lg bg-[#E6ECE2]/50 px-4 py-3">
                  <p className="text-xs text-[#999]">Supplier Payment Terms</p>
                  <p className="text-sm font-semibold text-[#333333] mt-0.5">
                    {supplierView.paymentTerms || "—"}
                  </p>
                  <p className="text-xs text-[#999] mt-1">
                    Payment is managed through Supplier Payables.
                  </p>
                </div>
              )}

              {/* Action buttons */}
              <div className="mt-5 flex flex-col gap-2">
                {isNew && (
                  <>
                    <Button
                      onClick={handleCreate}
                      loading={saving}
                      disabled={!suppId || items.length === 0}
                      className="w-full"
                    >
                      {saving ? "Creating..." : "Create Purchase Order"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => navigate("/purchasing/orders")}
                      className="w-full"
                    >
                      Cancel
                    </Button>
                  </>
                )}
                {!isNew && editMode && (
                  <>
                    <Button
                      onClick={handleUpdate}
                      loading={saving}
                      disabled={!suppId || items.length === 0}
                      className="w-full"
                    >
                      {saving ? "Updating..." : "Save Changes"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setEditMode(false)}
                      className="w-full"
                    >
                      Cancel Edit
                    </Button>
                  </>
                )}
                {!isNew && !editMode && (
                  <>
                    {status === "REGISTERED" && (
                      <>
                        <button
                          onClick={() => {
                            setActionError("")
                            setMarkDeliveryOpen(true)
                          }}
                          className="w-full rounded-xl bg-[#B6C8AF] px-4 py-2.5 text-sm font-semibold text-[#333333] hover:bg-[#7A9076] transition-colors"
                        >
                          Mark as Awaiting Delivery
                        </button>
                        <button
                          onClick={() => setEditMode(true)}
                          className="w-full rounded-xl border border-[#C6D4BF] bg-white px-4 py-2.5 text-sm font-semibold text-[#333333] hover:bg-[#E6ECE2] transition-colors"
                        >
                          Edit Order
                        </button>
                        <button
                          onClick={() => {
                            setActionError("")
                            setCancelOpen(true)
                          }}
                          className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors"
                        >
                          Cancel Order
                        </button>
                      </>
                    )}
                    {status === "AWAITING_DELIVERY" && (
                      <button
                        onClick={() => {
                          setActionError("")
                          setCancelOpen(true)
                        }}
                        className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors"
                      >
                        Cancel Order
                      </button>
                    )}
                    {status === "RECEIVED" && (
                      <button
                        onClick={() => {
                          setActionError("")
                          setCloseOpen(true)
                        }}
                        className="w-full rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
                      >
                        Close Purchase Order
                      </button>
                    )}
                    <button
                      onClick={() => navigate("/purchasing/orders")}
                      className="w-full inline-flex items-center justify-center gap-1 rounded-xl border border-[#C6D4BF] bg-white px-4 py-2.5 text-sm text-[#666666] hover:bg-[#E6ECE2] transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" /> Back to Orders
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Goods summary (detail only) */}
            {!isNew && goodsSummary && (
              <div className="bg-white rounded-xl border border-[#E6ECE2] p-5">
                <p className="text-xs font-bold text-[#666666] uppercase tracking-wide mb-4">
                  Goods Summary
                </p>
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#666666]">Ordered Goods Value</span>
                    <span className="text-[#333333] font-medium">
                      {fmtMoney(goodsSummary.orderedGoodsValue ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#666666]">Received Goods Value</span>
                    <span className="text-[#333333] font-medium">
                      {fmtMoney(goodsSummary.receivedGoodsValue ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#666666]">Remaining to Receive</span>
                    <span className="text-[#333333] font-medium">
                      {fmtMoney(
                        Math.max(
                          0,
                          (goodsSummary.orderedGoodsValue ?? 0) -
                            (goodsSummary.receivedGoodsValue ?? 0),
                        ),
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-[#E6ECE2] pt-2.5">
                    <span className="text-[#666666]">Invoiced Amount</span>
                    <span className="text-[#333333] font-medium">
                      {fmtMoney(goodsSummary.goodsInvoicedAmount ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#666666]">Remaining to Invoice</span>
                    <span className="text-[#333333] font-medium">
                      {fmtMoney(goodsSummary.remainingGoodsToInvoice ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Payment summary (detail only) */}
            {!isNew && paymentSummary && (
              <div className="bg-white rounded-xl border border-[#E6ECE2] p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-bold text-[#666666] uppercase tracking-wide">
                    Payment Summary
                  </p>
                  <PaymentBadge status={paymentSummary.status} />
                </div>
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[#666666]">Invoice Count</span>
                    <span className="text-[#333333] font-medium">
                      {paymentSummary.invoiceCount ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#666666]">Invoiced Amount</span>
                    <span className="text-[#333333] font-medium">
                      {fmtMoney(paymentSummary.invoicedAmount ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#666666]">Paid Amount</span>
                    <span className="text-[#333333] font-medium">
                      {fmtMoney(paymentSummary.paidAmount ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-[#E6ECE2] pt-2.5">
                    <span className="text-[#666666]">Outstanding Amount</span>
                    <span
                      className={
                        (paymentSummary.outstandingAmount ?? 0) > 0
                          ? "font-bold text-[#333333]"
                          : "font-medium text-[#333333]"
                      }
                    >
                      {fmtMoney(paymentSummary.outstandingAmount ?? 0)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Supplier payables link (detail) */}
            {!isNew && (status === "CLOSED" || status === "RECEIVED") && (
              <div className="bg-white rounded-xl border border-[#E6ECE2] p-5">
                <p className="text-xs font-bold text-[#666666] uppercase tracking-wide mb-3">
                  Supplier Payables
                </p>
                <p className="text-xs text-[#999] mb-3">
                  Invoice and payment details are managed in Supplier Payables.
                </p>
                <button
                  onClick={() => navigate("/purchasing/payables")}
                  className="w-full rounded-xl border border-[#C6D4BF] px-4 py-2.5 text-sm font-semibold text-[#7A9076] hover:bg-[#E6ECE2] transition-colors"
                >
                  View Supplier Payables <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddProductModal
        open={addProductOpen}
        products={products}
        existingProductIds={items.map((i) => i.productId)}
        onClose={() => setAddProductOpen(false)}
        onAdd={(item) => {
          setItems((prev) => [...prev, item])
          setAddProductOpen(false)
        }}
      />

      <EditItemModal
        item={editItem}
        error={actionError}
        onClose={() => setEditItem(null)}
        onSave={(patch, onDone) => handleSaveItem(editItem?.id ?? "", patch, () => {
          onDone()
          setEditItem(null)
        })}
      />

      <AcceptShortageModal
        target={shortageTarget}
        quantity={shortageQty}
        reason={shortageReason}
        error={actionError}
        setQuantity={setShortageQty}
        setReason={setShortageReason}
        onClose={() => setShortageTarget(null)}
        onConfirm={handleAcceptShortage}
      />

      <ConfirmModal
        open={markDeliveryOpen}
        title="Mark as Awaiting Delivery?"
        message={`Send ${reference} to the supplier and mark it as awaiting delivery?`}
        confirmLabel="Mark Awaiting Delivery"
        confirmClass="bg-yellow-600 hover:bg-yellow-700 text-white"
        error={actionError}
        onClose={() => setMarkDeliveryOpen(false)}
        onConfirm={() => handleStatusAction("markDelivery")}
      />
      <ConfirmModal
        open={closeOpen}
        title="Close Purchase Order?"
        message="This purchase order has been received. Closing it will mark the purchasing cycle as complete."
        confirmLabel="Close Purchase Order"
        confirmClass="bg-green-600 hover:bg-green-700 text-white"
        error={actionError}
        onClose={() => setCloseOpen(false)}
        onConfirm={() => handleStatusAction("close")}
      />
      <ConfirmModal
        open={cancelOpen}
        title="Cancel Purchase Order?"
        message={`Are you sure you want to cancel ${reference}? This action will mark the order as cancelled.`}
        confirmLabel="Cancel Purchase Order"
        confirmClass="bg-red-600 hover:bg-red-700 text-white"
        cancelLabel="Keep Order"
        error={actionError}
        onClose={() => setCancelOpen(false)}
        onConfirm={() => handleStatusAction("cancel")}
      />

      {toast && <Toast message={toast} onDone={() => setToast("")} />}
    </div>
  )
}

