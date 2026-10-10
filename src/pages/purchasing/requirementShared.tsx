// ── Shared Purchase Requirement UI ───────────────────────────────────────────
// Small atoms, status badges and the requirement-level modals used by BOTH the
// product-oriented list page and the requirement-line detail screen. Extracted
// from the original PurchaseRequirementsPage so the visual language (colours,
// radii, spacing, modal chrome) stays identical.

import { useEffect, useState } from "react"
import Modal from "../../components/ui/Modal"
import Button from "../../components/ui/Button"
import DatePicker from "../../components/ui/DatePicker"
import SearchableSelect from "../../components/ui/SearchableSelect"
import { IconPencil, IconTrash } from "../../components/ui/icons"
import {
  getOrderPreview,
  type OrderPreviewDto,
  type UpdateRequirementLineInput,
} from "../../features/purchasing/requirementsApi"
import type { SearchableOption } from "../../components/ui/SearchableSelect"
import { useSearchableResource } from "../../hooks/useSearchableResource"
import { searchProducts } from "../../features/inventory/searchSelectors"
import { useProductUnits } from "../../features/inventory/useProductUnits"
import {
  toBaseQuantity,
  formatFactor,
} from "../../features/inventory/unitOptions"
import type { CreateRequirementLineInput } from "../../features/purchasing/requirementsApi"

// ─── Form atoms ──────────────────────────────────────────────────────────────

export const SC =
  "w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm focus:border-[#B6C8AF] focus:outline-none bg-white"

export function Fw({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="text-sm font-medium text-[#333333] block mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}

// ─── Reason helpers ──────────────────────────────────────────────────────────

export type LineReason = "Low Stock" | "Reorder Alert" | "Manual" | ""

export function reasonLabel(code: string | null | undefined): LineReason {
  switch (code) {
    case "LOW_STOCK":
      return "Low Stock"
    case "REORDER_ALERT":
      return "Reorder Alert"
    case "MANUAL":
      return "Manual"
    default:
      return ""
  }
}

export function reasonCode(reason: LineReason): string | null {
  switch (reason) {
    case "Low Stock":
      return "LOW_STOCK"
    case "Reorder Alert":
      return "REORDER_ALERT"
    case "Manual":
      return "MANUAL"
    default:
      return null
  }
}

// ─── Status badges ───────────────────────────────────────────────────────────
// Same palette the original page used for requirement/line statuses.

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-[#E6ECE2] text-[#7A9076] border border-[#C6D4BF]",
  PARTIALLY_FULFILLED: "bg-blue-100 text-blue-700",
  FULFILLED: "bg-green-100 text-green-700",
  CLOSED: "bg-gray-100 text-gray-500",
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: "OPEN",
  PARTIALLY_FULFILLED: "PARTIALLY FULFILLED",
  FULFILLED: "FULFILLED",
  CLOSED: "CLOSED",
}

/** Line/requirement status badge. Unknown values degrade to a neutral label
 *  (never an invented status) so the table cannot crash. */
export function StatusPill({ status }: { status: string }) {
  const key = (status || "").toUpperCase()
  const cls = STATUS_STYLES[key] ?? "bg-gray-100 text-gray-600"
  const label = STATUS_LABELS[key] ?? (key ? key.replace(/_/g, " ") : "—")
  return (
    <span
      className={`text-xs font-bold rounded-full px-2.5 py-0.5 whitespace-nowrap ${cls}`}
    >
      {label}
    </span>
  )
}

// ─── Toast ───────────────────────────────────────────────────────────────────

export function Toast({
  message,
  onDone,
}: {
  message: string
  onDone: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-[#333333] px-5 py-3.5 text-sm text-white shadow-xl animate-in fade-in slide-in-from-bottom-4">
      <svg
        className="h-4 w-4 shrink-0 text-[#7A9076]"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
          clipRule="evenodd"
        />
      </svg>
      {message}
    </div>
  )
}

// ─── Inline error banner ─────────────────────────────────────────────────────

export function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string
  onDismiss?: () => void
}) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3">
      <span>{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-red-500 hover:text-red-700 text-xs font-semibold shrink-0"
        >
          Dismiss
        </button>
      )}
    </div>
  )
}

// ─── Confirm modal ───────────────────────────────────────────────────────────

export function ConfirmModal({
  open,
  title,
  message,
  detail,
  confirmLabel,
  confirmClass,
  onClose,
  onConfirm,
  loading,
}: {
  open: boolean
  title: string
  message: string
  detail?: string
  confirmLabel: string
  confirmClass: string
  onClose: () => void
  onConfirm: () => void
  loading?: boolean
}) {
  return (
    <Modal open={open} title={title} onClose={onClose} size="sm">
      <p className="text-sm text-[#666666]">{message}</p>
      {detail && <p className="mt-2 text-xs text-[#999]">{detail}</p>}
      <div className="flex gap-3 justify-end mt-6">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${confirmClass}`}
        >
          {loading ? "..." : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

// ─── Edit Requirement Modal (parent header) ──────────────────────────────────

export function EditRequirementModal({
  open,
  requiredBy,
  notes,
  onClose,
  onSave,
  /** Calendar day, "YYYY-MM-DD", or "" when unset. */
}: {
  open: boolean
  requiredBy: string
  notes: string
  onClose: () => void
  onSave: (updates: { requiredBy: string; notes: string | null }) => void
}) {
  const [localRequiredBy, setLocalRequiredBy] = useState(requiredBy)
  const [localNotes, setLocalNotes] = useState(notes)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setLocalRequiredBy(requiredBy)
      setLocalNotes(notes)
    }
  }, [open, requiredBy, notes])

  async function handleSave() {
    setLoading(true)
    try {
      onSave({
        requiredBy: localRequiredBy
          ? new Date(`${localRequiredBy}T00:00:00Z`).toISOString()
          : "",
        notes: localNotes || null,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} title="Edit Requirement" onClose={onClose} size="sm">
      <div className="flex flex-col gap-4">
        <Fw label="Required By">
          <DatePicker
            value={localRequiredBy}
            onChange={setLocalRequiredBy}
            placeholder="Select required-by date..."
          />
        </Fw>
        <Fw label="Notes">
          <textarea
            rows={3}
            value={localNotes}
            onChange={(e) => setLocalNotes(e.target.value)}
            className={`${SC} resize-none`}
            placeholder="Add notes..."
          />
        </Fw>
        <div className="flex gap-3 justify-end border-t border-[#E6ECE2] pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={loading}>
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Add Product Modal (to the parent requirement) ───────────────────────────

export function AddProductModal({
  open,
  existingProductIds,
  onClose,
  onAdd,
}: {
  open: boolean
  existingProductIds: string[]
  onClose: () => void
  onAdd: (input: CreateRequirementLineInput) => void
}) {
  const productSearch = useSearchableResource(searchProducts, open)
  const [productId, setProductId] = useState("")
  const [unitId, setUnitId] = useState("")
  const [quantity, setQuantity] = useState("")
  const [reason, setReason] = useState<LineReason>("Low Stock")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [unitSearchTerm, setUnitSearchTerm] = useState("")

  const unitProducts = useProductUnits(productId || null)
  const baseUnit = unitProducts.baseUnit

  const selectedProductOption: SearchableOption[] =
    productId &&
    !productSearch.options.some((o) => o.value === productId) &&
    unitProducts.product
      ? [
          {
            value: unitProducts.product.id,
            label: unitProducts.product.name,
            sub: unitProducts.product.sku,
          },
        ]
      : []
  const productOptions = [...selectedProductOption, ...productSearch.options]

  const unitOptions = unitProducts.options.filter(
    (o) =>
      !unitSearchTerm ||
      o.label.toLowerCase().includes(unitSearchTerm.toLowerCase()),
  )

  const qty = parseFloat(quantity) || 0
  const productUnit = unitProducts.units.find((u) => u.unitId === unitId)
  const baseQty = toBaseQuantity(qty, productUnit)
  const showPreview =
    !!productId && !!unitId && qty > 0 && baseQty !== null && !!baseUnit

  function resetForm() {
    setProductId("")
    setUnitId("")
    setQuantity("")
    setReason("Low Stock")
    setNotes("")
    setError("")
  }

  async function handleAdd() {
    if (!productId) {
      setError("Please select a product.")
      return
    }
    if (existingProductIds.includes(productId)) {
      setError("This product is already in the requirement.")
      return
    }
    if (!qty || qty <= 0) {
      setError("Quantity must be greater than zero.")
      return
    }
    if (!unitId) {
      setError("Please select a unit.")
      return
    }
    setError("")
    setLoading(true)
    try {
      onAdd({
        productId,
        unitId,
        quantityNeeded: qty,
        reasonCode: reasonCode(reason),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      })
      resetForm()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Add Product to Requirement"
      onClose={onClose}
      size="sm"
    >
      <div className="flex flex-col gap-4">
        {error && (
          <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <Fw label="Product">
          <SearchableSelect
            value={productId}
            onChange={(v) => {
              setProductId(v)
              setUnitId("")
            }}
            options={productOptions}
            onSearch={productSearch.setTerm}
            loading={productSearch.loading}
            error={productSearch.error}
            onRetry={productSearch.retry}
            placeholder="Search and select a product..."
            searchPlaceholder="Search by name or SKU..."
            emptyMessage="No products to choose from"
            noResultsMessage="No products matching your search"
          />
        </Fw>
        <Fw label="Unit">
          <SearchableSelect
            value={unitId || null}
            onChange={(v) => setUnitId(v)}
            options={unitOptions}
            onSearch={setUnitSearchTerm}
            loading={unitProducts.loading}
            error={unitProducts.error}
            onRetry={unitProducts.refresh}
            allowClear
            placeholder={
              unitProducts.loading
                ? "Loading units..."
                : productId
                  ? "Select a unit..."
                  : "Select a product first"
            }
            emptyMessage={
              productId
                ? "No units configured for this product"
                : "Select a product first"
            }
          />
        </Fw>
        <Fw label="Quantity Needed">
          <input
            type="number"
            min={1}
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={SC}
            placeholder={`0${baseUnit ? ` ${baseUnit.name ?? ""}` : ""}`}
          />
        </Fw>
        {showPreview && (
          <div className="rounded-xl bg-[#E6ECE2]/50 px-4 py-3 text-sm text-[#333333]">
            {qty} {productUnit?.unit?.name ?? ""} ={" "}
            <span className="font-semibold text-[#7A9076]">
              {baseQty} {baseUnit?.name ?? ""}
            </span>
            <span className="text-[#999] text-xs ml-2">
              (conversion {formatFactor(productUnit?.conversionFactor ?? 1)}×)
            </span>
          </div>
        )}
        <Fw label="Reason">
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as LineReason)}
            className={SC}
          >
            <option value="">No reason</option>
            <option>Low Stock</option>
            <option>Reorder Alert</option>
            <option>Manual</option>
          </select>
        </Fw>
        <Fw label="Notes (optional)">
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${SC} resize-none`}
            placeholder="Optional notes..."
          />
        </Fw>
        <div className="flex gap-3 justify-end border-t border-[#E6ECE2] pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAdd} loading={loading}>
            Add Product
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Edit Line Modal ─────────────────────────────────────────────────────────

export interface EditLineTarget {
  id: string
  productId: string
  productName: string
  unitId: string | null
  /** Quantity the requirement asks for, in the line's unit. */
  requiredQuantity: number
  reason: LineReason
  notes: string
}

export function EditLineModal({
  open,
  line,
  onClose,
  onSave,
}: {
  open: boolean
  line: EditLineTarget | null
  onClose: () => void
  onSave: (patch: UpdateRequirementLineInput) => void
}) {
  const [quantity, setQuantity] = useState(
    line?.requiredQuantity.toString() ?? "",
  )
  const [unitId, setUnitId] = useState(line?.unitId ?? "")
  const [reason, setReason] = useState<LineReason>(line?.reason ?? "Low Stock")
  const [notes, setNotes] = useState(line?.notes ?? "")
  const [loading, setLoading] = useState(false)
  const [unitSearchTerm, setUnitSearchTerm] = useState("")
  const [error, setError] = useState("")

  const unitProducts = useProductUnits(line?.productId ?? null)
  const baseUnit = unitProducts.baseUnit
  const unitOptions = unitProducts.options.filter(
    (o) =>
      !unitSearchTerm ||
      o.label.toLowerCase().includes(unitSearchTerm.toLowerCase()),
  )

  const qty = parseFloat(quantity) || 0
  const productUnit = unitProducts.units.find((u) => u.unitId === unitId)
  const baseQty = toBaseQuantity(qty, productUnit)
  const showPreview = !!unitId && qty > 0 && baseQty !== null && !!baseUnit

  useEffect(() => {
    if (line) {
      setQuantity(line.requiredQuantity.toString())
      setUnitId(line.unitId ?? "")
      setReason(line.reason)
      setNotes(line.notes)
      setError("")
    }
  }, [line])

  async function handleSave() {
    if (!line) return
    if (!qty || qty <= 0) {
      setError("Quantity must be greater than zero.")
      return
    }
    setError("")
    setLoading(true)
    try {
      onSave({
        quantityNeeded: qty,
        unitId: unitId || null,
        reasonCode: reasonCode(reason),
        ...(notes.trim() ? { notes: notes.trim() } : { notes: null }),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Edit Requirement Item"
      onClose={onClose}
      size="sm"
    >
      <div className="flex flex-col gap-4">
        {error && (
          <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        {line?.productName && (
          <div className="rounded-xl bg-[#E6ECE2]/50 px-4 py-3">
            <p className="text-xs text-[#999]">Product</p>
            <p className="text-sm font-bold text-[#333333]">
              {line.productName}
            </p>
          </div>
        )}
        <Fw label="Unit">
          <SearchableSelect
            value={unitId || null}
            onChange={(v) => setUnitId(v)}
            options={unitOptions}
            onSearch={setUnitSearchTerm}
            loading={unitProducts.loading}
            error={unitProducts.error}
            onRetry={unitProducts.refresh}
            allowClear
            placeholder="Select a unit..."
            emptyMessage={
              unitProducts.loading
                ? "Loading units..."
                : "No units configured for this product"
            }
          />
        </Fw>
        <Fw label="Quantity Needed">
          <input
            type="number"
            min={1}
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={SC}
            placeholder={`0${baseUnit ? ` ${baseUnit.name ?? ""}` : ""}`}
          />
        </Fw>
        {showPreview && (
          <div className="rounded-xl bg-[#E6ECE2]/50 px-4 py-3 text-sm text-[#333333]">
            {qty} {productUnit?.unit?.name ?? ""} ={" "}
            <span className="font-semibold text-[#7A9076]">
              {baseQty} {baseUnit?.name ?? ""}
            </span>
            <span className="text-[#999] text-xs ml-2">
              (conversion {formatFactor(productUnit?.conversionFactor ?? 1)}×)
            </span>
          </div>
        )}
        <Fw label="Reason">
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as LineReason)}
            className={SC}
          >
            <option value="">No reason</option>
            <option>Low Stock</option>
            <option>Reorder Alert</option>
            <option>Manual</option>
          </select>
        </Fw>
        <Fw label="Notes">
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${SC} resize-none`}
            placeholder="Optional notes..."
          />
        </Fw>
        <div className="flex gap-3 justify-end border-t border-[#E6ECE2] pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={loading}>
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Order Preview Modal (single line "Order Remaining") ─────────────────────

export interface OrderPreviewLine {
  id: string
  productName: string
  productSku: string
  unitName: string
  /** Used only to block ordering when there is nothing left to order. */
  remainingToOrder: number
}

/**
 * Reuses the original "Order Remaining" confirmation: it shows the backend's
 * authoritative order-preview numbers (required/ordered/remaining), collects a
 * quantity + unit cost, then hands off to the existing Create Purchase Order
 * page through `onCreatePO`.
 */
export function OrderPreviewModal({
  open,
  line,
  preview,
  onClose,
  onCreatePO,
}: {
  open: boolean
  line: OrderPreviewLine | null
  preview: OrderPreviewDto | null
  onClose: () => void
  onCreatePO: (
    quantity: number,
    unitCost: number,
    expectedDeliveryDate: string,
    notes: string,
  ) => void
}) {
  const [quantity, setQuantity] = useState("")
  const [unitCost, setUnitCost] = useState("")
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && preview) {
      setQuantity(preview.suggestedOrderQuantity.toString())
      setUnitCost("")
      setExpectedDeliveryDate("")
      setNotes("")
      setError("")
    }
  }, [open, preview])

  function handleCreate() {
    if (!line || !preview) return
    if (!quantity || parseFloat(quantity) <= 0) {
      setError("Quantity must be greater than zero.")
      return
    }
    if (parseFloat(quantity) > preview.remainingQuantity) {
      setError(
        `Cannot order more than remaining quantity (${preview.remainingQuantity}).`,
      )
      return
    }
    if (!unitCost || parseFloat(unitCost) < 0) {
      setError("Unit cost must be a valid number.")
      return
    }
    setError("")
    setLoading(true)
    onCreatePO(
      parseFloat(quantity),
      parseFloat(unitCost),
      expectedDeliveryDate,
      notes,
    )
    setLoading(false)
  }

  if (!open || !line || !preview) return null

  return (
    <Modal open={true} title="Order Remaining" onClose={onClose} size="md">
      <div className="flex flex-col gap-4">
        {error && (
          <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="rounded-xl bg-[#E6ECE2]/50 p-4">
          <p className="text-xs font-bold text-[#666666] uppercase tracking-wide mb-3">
            Requirement Line Preview
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[#999]">Product</p>
              <p className="font-semibold text-[#333333]">{line.productName}</p>
            </div>
            <div>
              <p className="text-[#999]">SKU</p>
              <p className="font-semibold text-[#333333]">
                {line.productSku || "—"}
              </p>
            </div>
            <div>
              <p className="text-[#999]">Required</p>
              <p className="font-bold text-[#333333]">
                {preview.requiredQuantity}
              </p>
            </div>
            <div>
              <p className="text-[#999]">Ordered</p>
              <p className="font-bold text-[#333333]">
                {preview.orderedQuantity}
              </p>
            </div>
            <div>
              <p className="text-[#999]">Remaining to Order</p>
              <p className="font-bold text-[#7A9076]">
                {preview.remainingQuantity}
              </p>
            </div>
            <div>
              <p className="text-[#999]">Suggested Order Qty</p>
              <p className="font-bold text-[#7A9076]">
                {preview.suggestedOrderQuantity}
              </p>
            </div>
            <div>
              <p className="text-[#999]">Active POs</p>
              <p className="font-semibold text-[#333333]">
                {preview.activeOrderCount}
              </p>
            </div>
            <div>
              <p className="text-[#999]">Line Status</p>
              <p className="font-semibold text-[#333333]">
                <StatusPill status={preview.lineStatus} />
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#E6ECE2] p-4">
          <p className="text-xs font-bold text-[#666666] uppercase tracking-wide mb-3">
            Create Purchase Order
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <Fw label="Quantity to Order">
              <input
                type="number"
                min={1}
                max={preview.remainingQuantity}
                step="0.001"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={SC}
                placeholder={preview.suggestedOrderQuantity.toString()}
              />
            </Fw>
            <Fw label="Unit Cost (ETB)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className={SC}
                placeholder="0.00"
              />
            </Fw>
            <Fw label="Expected Delivery Date">
              <DatePicker
                value={expectedDeliveryDate}
                onChange={setExpectedDeliveryDate}
                placeholder="Select expected delivery date..."
              />
            </Fw>
            <Fw label="Notes (optional)">
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={`${SC} resize-none`}
                placeholder="Optional notes..."
              />
            </Fw>
          </div>
        </div>

        <div className="flex gap-3 justify-end border-t border-[#E6ECE2] pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} loading={loading}>
            Create Purchase Order
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/** Re-export for the detail screen's "Order Remaining" fetch. */
export { getOrderPreview }
export { IconPencil, IconTrash }
