import { useState, useEffect, useRef } from "react"
import { useParams, useNavigate, useSearchParams } from "react-router"
import { ChevronLeft, ChevronRight } from "lucide-react"
import PageHeader from "../../components/ui/PageHeader"
import Modal from "../../components/ui/Modal"
import Button from "../../components/ui/Button"
import StatusChip from "../../components/ui/StatusChip"
import { StatusBadge, Toast, fmtDate } from "./PurchaseOrdersPage"
import {
  getPurchaseOrder,
  createPurchaseOrder,
  createPurchaseOrderFromRequirement,
  updatePurchaseOrder,
  markPurchaseOrderAwaitingDelivery,
  cancelPurchaseOrder,
  closePurchaseOrder,
  PurchaseOrdersApiError,
  type POItemDto,
  type PurchaseOrderDto,
  type CreatePurchaseOrderItemInput,
  type CreatePurchaseOrderFromRequirementInput,
} from "../../features/purchasing/purchaseOrdersApi"
import {
  listSuppliers,
  type SupplierDto,
} from "../../features/purchasing/suppliersApi"
import {
  listProducts,
  type ProductDto,
} from "../../features/inventory/productsApi"
import {
  listRequirements,
  type RequirementLineDto,
} from "../../features/purchasing/requirementsApi"
import type { POItem, POStatus } from "./PurchaseOrdersPage"

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

function AddProductModal({
  open,
  products,
  reqLines,
  existingProductIds,
  onClose,
  onAdd,
}: {
  open: boolean
  products: ProductDto[]
  reqLines: ReqLineOption[]
  existingProductIds: string[]
  onClose: () => void
  onAdd: (item: POItem) => void
}) {
  const [product, setProduct] = useState("")
  const [quantity, setQuantity] = useState("")
  const [unitCost, setUnitCost] = useState("")
  const [reqLineId, setReqLineId] = useState("")
  const [error, setError] = useState("")

  const selectedProduct = products.find((p) => p.id === product)

  useEffect(() => {
    if (open) {
      setProduct("")
      setQuantity("")
      setUnitCost("")
      setReqLineId("")
      setError("")
    }
  }, [open])

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
      product: selectedProduct?.name ?? "",
      requirementLineId: reqLineId || null,
      quantity: parseInt(quantity),
      unitCost: parseFloat(unitCost) || 0,
    })
    setProduct("")
    setQuantity("")
    setUnitCost("")
    setReqLineId("")
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
            Requirement Line{" "}
            <span className="text-[#999] text-xs font-normal">(optional)</span>
          </label>
          <select
            value={reqLineId}
            onChange={(e) => setReqLineId(e.target.value)}
            className={SC}
          >
            <option value="">No requirement</option>
            {reqLines.map((r) => (
              <option key={r.lineId} value={r.lineId}>
                {r.label}
              </option>
            ))}
          </select>
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
  const requirementReference = searchParams.get("requirementReference")
  const productName = searchParams.get("productName")
  const productSku = searchParams.get("productSku")

  // Track if we're in from-requirement mode
  const isFromRequirement = isNew && !!requirementLineId

  // Real data
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([])
  const [products, setProducts] = useState<ProductDto[]>([])
  const [reqLines, setReqLines] = useState<ReqLineOption[]>([])

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

  // Status action modals
  const [markDeliveryOpen, setMarkDeliveryOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [actionError, setActionError] = useState("")

  // Load suppliers + products + open requirement lines once.
  useEffect(() => {
    let active = true
    listSuppliers({ limit: 100, isActive: true })
      .then((res) => {
        if (active) setSuppliers(res.data)
      })
      .catch(() => {
        /* supplier select simply stays empty */
      })
    listProducts({ limit: 100, isActive: true })
      .then((res) => {
        if (active) setProducts(res.data)
      })
      .catch(() => {
        /* product select simply stays empty */
      })
    listRequirements({ status: "OPEN", limit: 50 })
      .then((res) => {
        if (!active) return
        const options: ReqLineOption[] = []
        for (const req of res.data) {
          for (const line of req.lines ?? []) {
            if (line.status === "CLOSED") continue
            const productPart = line.product?.name ?? line.productId
            options.push({
              lineId: line.id,
              label: `${req.reference} — ${productPart}`,
            })
          }
        }
        setReqLines(options)
      })
      .catch(() => {
        /* requirement-line select simply stays empty */
      })
    return () => {
      active = false
    }
  }, [])

  // Handle from-requirement prefill: add the requirement line as an item
  useEffect(() => {
    if (
      isFromRequirement &&
      requirementLineId &&
      prefilledQuantity &&
      prefilledUnitCost &&
      items.length === 0
    ) {
      const product = products.find((p) => p.name === productName)
      const productId = product?.id ?? ""
      setItems([
        {
          id: `draft-${requirementLineId}`,
          productId,
          product: productName ?? "",
          requirementLineId,
          quantity: parseFloat(prefilledQuantity),
          unitCost: parseFloat(prefilledUnitCost),
        },
      ])
      if (prefilledDelivDate) setDelivDate(prefilledDelivDate)
      if (prefilledNotes) setNotes(prefilledNotes)
    }
  }, [
    isFromRequirement,
    requirementLineId,
    prefilledQuantity,
    prefilledUnitCost,
    prefilledDelivDate,
    prefilledNotes,
    productName,
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
            product: "",
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
      const updated = await updatePurchaseOrder(poState.id, {
        supplierId: suppId,
        expectedDeliveryDate: delivDate || null,
        notes: notes || null,
        items: itemsToDto(),
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
              {items.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-[#999]">No products added yet.</p>
                  {!isReadOnly && (
                    <button
                      onClick={() => setAddProductOpen(true)}
                      className="mt-3 text-xs font-semibold text-[#7A9076] hover:underline"
                    >
                      + Add Product
                    </button>
                  )}
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
                        {!isReadOnly && <th className="px-4 py-3" />}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, i) => {
                        const product = products.find(
                          (p) => p.id === item.productId,
                        )
                        const reqLine = reqLines.find(
                          (r) => r.lineId === item.requirementLineId,
                        )
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
                              {reqLine?.label ??
                                (item.requirementLineId ? (
                                  item.requirementLineId.slice(0, 8)
                                ) : (
                                  <span className="text-[#999]">—</span>
                                ))}
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
                            {!isReadOnly && (
                              <td className="px-4 py-3">
                                <button
                                  onClick={() =>
                                    setItems((prev) =>
                                      prev.filter((x) => x.id !== item.id),
                                    )
                                  }
                                  className="text-xs text-red-400 hover:text-red-600 font-medium"
                                >
                                  Remove
                                </button>
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

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
                      const reqLine = reqLines.find(
                        (r) => r.lineId === item.requirementLineId,
                      )
                      const product = products.find(
                        (p) => p.id === item.productId,
                      )
                      return (
                        <div
                          key={item.id}
                          className="rounded-lg border border-[#E6ECE2] p-4"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-semibold text-[#333333]">
                              {product?.name ?? item.product ?? "—"}
                            </span>
                            <StatusChip
                              label={
                                reqLine?.label ??
                                item.requirementLineId?.slice(0, 8) ??
                                "—"
                              }
                              tone="blue"
                            />
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                              <p className="text-[#999]">Allocated Qty</p>
                              <p className="font-semibold text-[#333333]">
                                {item.quantity}
                              </p>
                            </div>
                            <div>
                              <p className="text-[#999]">Unit Cost</p>
                              <p className="font-semibold text-[#333333]">
                                {fmtMoney(item.unitCost)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[#999]">Line Total</p>
                              <p className="font-semibold text-[#333333]">
                                {fmtMoney(itemTotal(item))}
                              </p>
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
        reqLines={reqLines}
        existingProductIds={items.map((i) => i.productId)}
        onClose={() => setAddProductOpen(false)}
        onAdd={(item) => {
          setItems((prev) => [...prev, item])
          setAddProductOpen(false)
        }}
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
