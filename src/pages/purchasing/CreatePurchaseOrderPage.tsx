import { useState, useEffect, useRef } from "react"
import { useParams, useNavigate, useSearchParams } from "react-router"
import PageHeader from "../../components/ui/PageHeader"
import Modal from "../../components/ui/Modal"
import Button from "../../components/ui/Button"
import {
  StatusBadge, Toast, fmtDate,
} from "./PurchaseOrdersPage"
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
  type CreatePurchaseOrderFromRequirementInput,
  type UpdatePurchaseOrderItemInput,
} from "../../features/purchasing/purchaseOrdersApi"
import { listSuppliers, getSupplierById, type SupplierDto } from "../../features/purchasing/suppliersApi"
import { listProducts, type ProductDto } from "../../features/inventory/productsApi"
import { listRequirements, type RequirementLineDto } from "../../features/purchasing/requirementsApi"
import type { POItem, POStatus } from "./PurchaseOrdersPage"
import SearchableSelect, { type SearchableOption } from "../../components/ui/SearchableSelect"
import { useSearchableResource } from "../../hooks/useSearchableResource"
import { searchProducts, searchSuppliers } from "../../features/inventory/searchSelectors"
import { useProductUnits } from "../../features/inventory/useProductUnits"
import { toBaseQuantity, formatFactor } from "../../features/inventory/unitOptions"

// ─── Shared local data ────────────────────────────────────────────────────────

/** A requirement line option for linking PO items back to requirements. */
interface ReqLineOption {
  lineId: string
  label: string
}

function fmtMoney(n: number) { return `${n.toLocaleString("en-ET")} ETB` }

function itemTotal(item: POItem) { return item.quantity * item.unitCost }
function orderTotal(items: POItem[]) { return items.reduce((s, i) => s + itemTotal(i), 0) }

// ─── Custom DatePicker (branded popup calendar) ───────────────────────────────

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]
const WEEKDAYS = ["Mo","Tu","We","Th","Fr","Sa","Su"]

function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function fromISO(s: string): Date | null {
  if (!s) return null
  const d = new Date(s + "T00:00:00")
  return Number.isNaN(d.getTime()) ? null : d
}

function fmtDisplay(s: string): string {
  const d = fromISO(s)
  if (!d) return ""
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

/** Build a 6x7 grid (Monday-first) for the given month. */
function buildGrid(viewDate: Date): Date[] {
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const first = new Date(year, month, 1)
  // Monday = 0 ... Sunday = 6
  const startOffset = (first.getDay() + 6) % 7
  const gridStart = new Date(year, month, 1 - startOffset)
  const cells: Date[] = []
  for (let i = 0; i < 42; i++) {
    cells.push(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i))
  }
  return cells
}

function DatePicker({
  value,
  onChange,
  disabled,
  placeholder = "Select a date...",
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = fromISO(value)
  const [viewDate, setViewDate] = useState<Date>(selected ?? new Date())
  const wrapRef = useRef<HTMLDivElement>(null)

  // Keep the popup month in sync when the value changes externally.
  useEffect(() => {
    const d = fromISO(value)
    if (d) setViewDate(d)
  }, [value])

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDoc)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const today = new Date()
  const todayISO = toISO(today)
  const selectedISO = selected ? toISO(selected) : ""
  const viewYear = viewDate.getFullYear()
  const viewMonth = viewDate.getMonth()
  const grid = buildGrid(viewDate)

  function prevMonth() {
    setViewDate(new Date(viewYear, viewMonth - 1, 1))
  }
  function nextMonth() {
    setViewDate(new Date(viewYear, viewMonth + 1, 1))
  }
  function pick(d: Date) {
    onChange(toISO(d))
    setOpen(false)
  }

  return (
    <div ref={wrapRef} className="relative">
      {/* Trigger — matches the other inputs */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="w-full rounded-xl border border-[#C6D4BF] bg-white px-3.5 py-2.5 text-sm text-left text-[#4A4A4A] focus:border-[#B6C8AF] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between gap-2 transition-colors hover:border-[#B6C8AF]"
      >
        <span className={value ? "text-[#4A4A4A]" : "text-[#9A9A9A]"}>
          {value ? fmtDisplay(value) : placeholder}
        </span>
        <svg
          className="h-4 w-4 text-[#7A9076] shrink-0"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Popup calendar */}
      {open && (
        <div className="absolute z-50 mt-2 rounded-xl border border-[#E6ECE2] bg-white shadow-lg p-3 w-[19rem]">
          {/* Header: prev / month-year / next */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={prevMonth}
              aria-label="Previous month"
              className="h-8 w-8 rounded-lg text-[#7A9076] hover:bg-[#E6ECE2] inline-flex items-center justify-center transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
              </svg>
            </button>

            <div className="text-sm font-bold text-[#4A4A4A]">
              {MONTHS[viewMonth]} {viewYear}
            </div>

            <button
              type="button"
              onClick={nextMonth}
              aria-label="Next month"
              className="h-8 w-8 rounded-lg text-[#7A9076] hover:bg-[#E6ECE2] inline-flex items-center justify-center transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Weekday header */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="h-8 flex items-center justify-center text-[0.7rem] uppercase tracking-wide text-[#8A8A8A] font-semibold"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7">
            {grid.map((d, i) => {
              const iso = toISO(d)
              const inMonth = d.getMonth() === viewMonth
              const isSelected = iso === selectedISO
              const isToday = iso === todayISO

              let cls =
                "h-9 w-9 mx-auto rounded-lg text-sm inline-flex items-center justify-center transition-colors "

              if (isSelected) {
                cls += "bg-[#B6C8AF] text-[#333333] font-bold hover:bg-[#A5B89E]"
              } else if (!inMonth) {
                cls += "text-[#C8C8C8] hover:bg-[#F3F5F0]"
              } else if (isToday) {
                cls += "text-[#4A4A4A] ring-1 ring-inset ring-[#B6C8AF] hover:bg-[#E6ECE2]"
              } else {
                cls += "text-[#4A4A4A] hover:bg-[#E6ECE2]"
              }

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pick(d)}
                  className={cls}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>

          {/* Quick actions */}
          <div className="mt-3 pt-3 border-t border-[#E6ECE2] flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                onChange("")
                setOpen(false)
              }}
              className="text-xs font-semibold text-[#7A7A7A] hover:text-[#4A4A4A] transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => pick(today)}
              className="text-xs font-semibold text-[#7A9076] hover:text-[#5F7359] transition-colors"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

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
                  ? "border-[#B6C8AF] bg-[#B6C8AF] text-[#333333]"
                  : active
                  ? "border-[#B6C8AF] bg-[#B6C8AF] text-[#333333]"
                  : "border-[#C6D4BF] bg-white text-[#C6D4BF]"
              }`}>
                {done ? (
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                  </svg>
                ) : idx + 1}
              </div>
              <p className={`mt-1 text-[10px] font-medium text-center leading-tight ${active ? "text-[#7A9076]" : done ? "text-[#7A9076]" : "text-[#C6D4BF]"} ${step === "CANCELLED" ? "text-red-500" : ""}`}>
                {labels[step]}
              </p>
            </div>
            {idx < steps.length - 1 && (
              <div className={`h-0.5 w-8 -mt-4 mx-1 flex-shrink-0 ${idx < currentIdx ? "bg-[#B6C8AF]" : "bg-[#E6ECE2]"}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Add Product Modal ────────────────────────────────────────────────────────

function AddProductModal({ open, reqLines, existingProductIds, onClose, onAdd }: {
  open: boolean
  reqLines: ReqLineOption[]
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

  const unitProducts = useProductUnits(product || null)
  const baseUnit = unitProducts.baseUnit
  const unitOptions = unitProducts.options
  const [unitFilter, setUnitFilter] = useState("")

  const selectedProductOption: SearchableOption[] =
    product && !productSearch.options.some((o) => o.value === product) && unitProducts.product
      ? [{ value: unitProducts.product.id, label: unitProducts.product.name, sub: unitProducts.product.sku }]
      : []
  const productOptions = [...selectedProductOption, ...productSearch.options]

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
    if (open) { setProduct(""); setUnitId(""); setQuantity(""); setUnitCost(""); setReqLineId(""); setError("") }
  }, [open])

  function handleAdd() {
    if (!product) { setError("Please select a product."); return }
    if (existingProductIds.includes(product)) { setError("This product is already in the order."); return }
    if (!qty || qty <= 0) { setError("Quantity must be greater than zero."); return }
    if (!unitId) { setError("Please select a unit."); return }
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
    setProduct(""); setUnitId(""); setQuantity(""); setUnitCost(""); setReqLineId("")
  }

  return (
    <Modal open={open} title="Add Product to Purchase Order" onClose={onClose} size="sm">
      <div className="flex flex-col gap-4">
        {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <div>
          <label className="text-sm font-medium text-[#333333] block mb-1.5">Product</label>
          <SearchableSelect
            value={product}
            onChange={(v) => { setProduct(v); setUnitId("") }}
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
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-[#333333] block mb-1.5">Quantity Ordered</label>
            <input type="number" min={1} step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={SC} placeholder="0" />
          </div>
          <div>
            <label className="text-sm font-medium text-[#333333] block mb-1.5">Unit</label>
            <SearchableSelect
              value={unitId || null}
              onChange={(v) => setUnitId(v)}
              options={visibleUnitOptions}
              onSearch={(t) => setUnitFilter(t)}
              loading={unitProducts.loading}
              error={unitProducts.error}
              onRetry={unitProducts.refresh}
              allowClear
              placeholder={unitProducts.loading ? "Loading units..." : (product ? "Select a unit..." : "Select a product first")}
              emptyMessage={product ? "No units configured for this product" : "Select a product first"}
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-[#333333] block mb-1.5">Unit Cost (ETB)</label>
          <input type="number" min={0} step={0.01} value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className={SC} placeholder="0.00" />
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
          <select value={reqLineId} onChange={(e) => setReqLineId(e.target.value)} className={SC}>
            <option value="">No requirement</option>
            {reqLines.map((r) => <option key={r.lineId} value={r.lineId}>{r.label}</option>)}
          </select>
        </div>
        {product && quantity && unitCost && (
          <div className="rounded-lg bg-[#E6ECE2]/50 px-4 py-2.5 flex items-center justify-between text-sm">
            <span className="text-[#666666]">Line Total</span>
            <span className="font-bold text-[#333333]">{fmtMoney(qty * (parseFloat(unitCost) || 0))}</span>
          </div>
        )}
        <div className="flex gap-3 justify-end border-t border-[#E6ECE2] pt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
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
  target: { productName: string; remaining: number } | null
  quantity: string
  reason: string
  error: string
  setQuantity: (v: string) => void
  setReason: (v: string) => void
  onClose: () => void
  onConfirm: () => void
}) {
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

function ConfirmModal({ open, title, message, detail, error, confirmLabel, confirmClass, cancelLabel = "Cancel", onClose, onConfirm }: {
  open: boolean; title: string; message: string; detail?: string; error?: string
  confirmLabel: string; confirmClass: string; cancelLabel?: string
  onClose: () => void; onConfirm: () => void
}) {
  const [loading, setLoading] = useState(false)
  async function go() { setLoading(true); await onConfirm(); setLoading(false) }
  return (
    <Modal open={open} title={title} onClose={onClose} size="sm">
      <p className="text-sm text-[#666666]">{message}</p>
      {detail && <p className="mt-2 text-xs text-[#999]">{detail}</p>}
      {error && <p className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex gap-3 justify-end mt-6">
        <Button variant="secondary" onClick={onClose}>{cancelLabel}</Button>
        <button onClick={go} disabled={loading} className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${confirmClass}`}>
          {loading ? "Processing..." : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

// ─── Shared input class ───────────────────────────────────────────────────────

const SC = "w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm text-[#4A4A4A] placeholder:text-[#9A9A9A] focus:border-[#B6C8AF] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/20 bg-white"
const ROC = "w-full rounded-xl border border-[#E6ECE2] bg-[#E6ECE2]/40 px-3.5 py-2.5 text-sm text-[#666666]"

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

  // Reorder → Create PO prefill: the reorder row carries the product id and
  // its base unit, which the requirement prefill above doesn't have.
  const reorderProductId = searchParams.get("productId")
  const prefilledUnitId = searchParams.get("unitId")
  const prefilledUnitName = searchParams.get("unitName")

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
  const [suppId, setSuppId]         = useState("")
  const [orderDate, setOrderDate]   = useState(new Date().toISOString().slice(0, 10))
  const [delivDate, setDelivDate]   = useState(prefilledDelivDate ?? "")
  const [notes, setNotes]           = useState(prefilledNotes ?? "")
  const [items, setItems]           = useState<POItem[]>([])
  const [saving, setSaving]         = useState(false)
  const [saveError, setSaveError]   = useState("")
  const [addProductOpen, setAddProductOpen] = useState(false)

  // Status action modals
  const [markDeliveryOpen, setMarkDeliveryOpen] = useState(false)
  const [closeOpen, setCloseOpen]               = useState(false)
  const [cancelOpen, setCancelOpen]             = useState(false)
  const [actionError, setActionError]           = useState("")

  // Item edit + shortage state
  const [editingItem, setEditingItem] = useState<POItem | null>(null)
  const [shortageTarget, setShortageTarget] = useState<{ itemId: string; productName: string; remaining: number } | null>(null)
  const [shortageQty, setShortageQty] = useState("")
  const [shortageReason, setShortageReason] = useState("")

  // Load suppliers + products + open requirement lines once.
  const supplierSearch = useSearchableResource(searchSuppliers, isNew || editMode)
  useEffect(() => {
    let active = true
    listSuppliers({ limit: 100, isActive: true })
      .then((res) => { if (active) setSuppliers(res.data) })
      .catch(() => { /* supplier select simply stays empty */ })
    listProducts({ limit:   100, isActive: true })
      .then((res) => { if (active) setProducts(res.data) })
      .catch(() => { /* product select simply stays empty */ })
    listRequirements({ status: "OPEN", limit: 50 })
      .then((res) => {
        if (!active) return
        const options: ReqLineOption[] = []
        for (const req of res.data) {
          for (const line of req.lines ?? []) {
            if (line.status === "CLOSED") continue
            const productPart = line.product?.name ?? line.productId
            options.push({ lineId: line.id, label: `${req.reference} — ${productPart}` })
          }
        }
        setReqLines(options)
      })
      .catch(() => { /* requirement-line select simply stays empty */ })
    return () => { active = false }
  }, [])

  // Handle from-requirement prefill: add the requirement line as an item
  useEffect(() => {
    if (isFromRequirement && requirementLineId && prefilledQuantity && prefilledUnitCost && items.length === 0) {
      const product = products.find((p) => p.name === productName)
      const productId = product?.id ?? ""
      setItems([{
        id: `draft-${requirementLineId}`,
        productId,
        product: productName ?? "",
        requirementLineId,
        quantity: parseFloat(prefilledQuantity),
        unitCost: parseFloat(prefilledUnitCost),
      }])
      if (prefilledDelivDate) setDelivDate(prefilledDelivDate)
      if (prefilledNotes) setNotes(prefilledNotes)
    }
  }, [isFromRequirement, requirementLineId, prefilledQuantity, prefilledUnitCost, prefilledDelivDate, prefilledNotes, productName, products, items.length])

  // Handle reorder prefill: open with the selected reorder product already
  // added as a line item (no requirement link). The suggested reorder
  // quantity comes through `quantity`; the user still reviews and edits
  // everything before explicitly creating the purchase order.
  useEffect(() => {
    if (!isNew || !reorderProductId || items.length > 0) return
    const qty = Number(prefilledQuantity)
    if (!Number.isFinite(qty) || qty <= 0) return
    setItems([{
      id: `draft-reorder-${reorderProductId}`,
      productId: reorderProductId,
      product: productName ?? "",
      unitId: prefilledUnitId || null,
      unitLabel: prefilledUnitName ?? "",
      requirementLineId: null,
      quantity: qty,
      unitCost: parseFloat(prefilledUnitCost ?? "0") || 0,
    }])
  }, [isNew, reorderProductId, prefilledQuantity, prefilledUnitCost, productName, prefilledUnitId, prefilledUnitName, items.length])

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
        setDelivDate(dto.expectedDeliveryDate ? dto.expectedDeliveryDate.slice(0, 10) : "")
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
        setPageError(err instanceof PurchaseOrdersApiError ? err.message : "Failed to load this purchase order.")
      })
      .finally(() => { if (active) setLoadingPO(false) })
    return () => { active = false }
  }, [id, isNew])

  const status: POStatus = (poState?.status as POStatus) ?? "REGISTERED"
  const supplier = suppliers.find((s) => s.id === suppId) ?? null
  // Detail fallback: when the suppliers list hasn't loaded, show the embedded supplier info.
  const supplierView = supplier ?? (poState?.supplier
    ? { id: poState.supplier.id, name: poState.supplier.name, contactPerson: poState.supplier.contactPerson ?? "", phone: poState.supplier.phone ?? "", email: poState.supplier.email ?? "", paymentTerms: poState.supplier.paymentTerms ?? "" }
    : null)

  const supplierSearchOptions: SearchableOption[] = [
    ...suppliers.map((s) => ({ value: s.id, label: s.name, sub: s.contactPerson ?? (s.email ?? undefined) })),
    ...supplierSearch.options.filter((o) => !suppliers.some((s) => s.id === o.value)),
  ]
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
      ...(it.requirementLineId ? { requirementLineId: it.requirementLineId } : {}),
      ...(it.unitId ? { unitId: it.unitId } : {}),
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
      setSaveError(err instanceof PurchaseOrdersApiError ? err.message : "Failed to create the purchase order. Please try again.")
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
      setSaveError(err instanceof PurchaseOrdersApiError ? err.message : "Failed to update the purchase order. Please try again.")
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
    const dtoItem = poState?.items?.find((it) => it.id === item.id)
    return Math.max(
      0,
      (dtoItem?.quantityOrdered ?? item.quantity) - (dtoItem?.quantityReceived ?? 0) - (dtoItem?.quantityShort ?? 0),
    )
  }

  /** Confirmed status transition against the real endpoint. */
  async function handleStatusAction(action: "markDelivery" | "close" | "cancel") {
    if (!poState) return
    setActionError("")
    try {
      if (action === "cancel") await cancelPurchaseOrder(poState.id)
      else if (action === "markDelivery") await markPurchaseOrderAwaitingDelivery(poState.id)
      else if (action === "close") await closePurchaseOrder(poState.id)
      setPOState({ ...poState, status: action === "markDelivery" ? "AWAITING_DELIVERY" : action === "close" ? "CLOSED" : "CANCELLED" })
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
      setActionError(err instanceof PurchaseOrdersApiError ? err.message : "The action failed. Please try again.")
    }
  }

  const reference = poState?.poNumber ?? (isNew ? "New Purchase Order" : "")

  if (loadingPO) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <PageHeader breadcrumb="Purchasing / Orders" title="Purchase Order" subtitle="Loading..." />
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
        <PageHeader breadcrumb="Purchasing / Orders" title="Purchase Order" subtitle="Something went wrong." />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 max-w-md text-center">{pageError}</p>
          <Button onClick={() => navigate("/purchasing/orders")}>← Back to Orders</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb={`Purchasing / Orders${isNew ? " / New" : " / " + reference}`}
        title={isNew ? "Create Purchase Order" : reference}
        subtitle={isNew ? "Create a new purchase order to send to a supplier." : "Purchase Order"}
        actions={
          <div className="flex items-center gap-2">
            {!isNew && poState && <StatusBadge status={status} />}
            {!isNew && editMode && (
              <button onClick={() => setEditMode(false)} className="inline-flex items-center gap-1.5 rounded-xl border border-[#C6D4BF] bg-white px-3.5 py-2 text-sm font-medium text-[#333333] hover:bg-[#E6ECE2] transition-colors">
                Cancel Edit
              </button>
            )}
            {!isNew && !editMode && status === "REGISTERED" && (
              <button onClick={() => setEditMode(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-[#C6D4BF] bg-white px-3.5 py-2 text-sm font-medium text-[#333333] hover:bg-[#E6ECE2] transition-colors">
                Edit Order
              </button>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Detail view — back nav */}
        {!isNew && (
          <button onClick={() => navigate("/purchasing/orders")} className="flex items-center gap-1.5 text-sm text-[#666666] hover:text-[#7A9076] transition-colors mb-5">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
            </svg>
            Purchase Orders
          </button>
        )}

        {(saveError || (!isNew && editMode && !poState)) && (
          <div className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {saveError || "This purchase order could not be loaded — editing is unavailable."}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-5">
          {/* ── LEFT COLUMN ── */}
          <div className="lg:col-span-2 flex flex-col gap-5">

            {/* Status timeline (detail only) */}
            {!isNew && poState && (
              <div className="bg-white rounded-xl border border-[#E6ECE2] p-5">
                <p className="text-xs font-bold text-[#666666] uppercase tracking-wide mb-4">Order Status</p>
                <StatusTimeline current={status} cancelled={status === "CANCELLED"} />
              </div>
            )}

            {/* Order information */}
            <div className="bg-white rounded-xl border border-[#E6ECE2] p-5">
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
                    Purchase Requirement <span className="text-[#999] text-xs font-normal">(optional, set per item)</span>
                  </label>
                  <div className={ROC}>
                    {items.some((it) => it.requirementLineId)
                      ? `${items.filter((it) => it.requirementLineId).length} of ${items.length} item${items.length !== 1 ? "s" : ""} linked`
                      : "—"}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-[#333333] block mb-1.5">Order Date</label>
                  {isReadOnly ? (
                    <div className={ROC}>{fmtDate(poState?.orderDate ?? orderDate)}</div>
                  ) : (
                    <DatePicker
                      value={orderDate}
                      onChange={setOrderDate}
                      placeholder="Select order date..."
                    />
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium text-[#333333] block mb-1.5">Expected Delivery Date</label>
                  {isReadOnly ? (
                    <div className={ROC}>{fmtDate(delivDate) || "—"}</div>
                  ) : (
                    <DatePicker
                      value={delivDate}
                      onChange={setDelivDate}
                      placeholder="Select delivery date..."
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
                <SearchableSelect
                  value={suppId || null}
                  onChange={(v) => setSuppId(v)}
                  options={supplierSearchOptions}
                  onSearch={supplierSearch.setTerm}
                  loading={supplierSearch.loading}
                  error={supplierSearch.error}
                  onRetry={supplierSearch.retry}
                  placeholder="Search and select a supplier..."
                  searchPlaceholder="Search by name, contact or email..."
                  emptyMessage="No suppliers available"
                  noResultsMessage="No suppliers matching your search"
                />
              )}
              {supplierView && (
                <div className="mt-4 rounded-xl bg-[#E6ECE2]/50 p-4 grid sm:grid-cols-2 gap-3">
                  {[
                    ["Contact Person", supplierView.contactPerson],
                    ["Phone",          supplierView.phone],
                    ["Email",          supplierView.email],
                    ["Payment Terms",  supplierView.paymentTerms],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-xs text-[#999]">{label}</p>
                      <p className="text-sm font-semibold text-[#333333]">{value || "—"}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Order items */}
            <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden flex-shrink-0">
              <div className="px-5 py-3 border-b border-[#E6ECE2] flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-[#666666] uppercase tracking-wide">Order Items</p>
                  <p className="text-xs text-[#999] mt-0.5">Products included in this purchase order.</p>
                </div>
                {isNew && (
                  <button onClick={() => setAddProductOpen(true)} className="text-xs font-semibold text-[#7A9076] hover:underline">+ Add Product</button>
                )}
              </div>
              {items.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-[#999]">No products added yet.</p>
                  {isNew && (
                    <button onClick={() => setAddProductOpen(true)} className="mt-3 text-xs font-semibold text-[#7A9076] hover:underline">+ Add Product</button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#E6ECE2]/50 text-left">
                        <th className="px-4 py-3 font-semibold text-[#333333]">Product</th>
                        <th className="px-4 py-3 font-semibold text-[#333333] hidden sm:table-cell">Requirement</th>
                        <th className="px-4 py-3 font-semibold text-[#333333] text-right">Quantity</th>
                        <th className="px-4 py-3 font-semibold text-[#333333] text-right">Unit Cost</th>
                        <th className="px-4 py-3 font-semibold text-[#333333] text-right">Line Total</th>
                        {!isReadOnly && <th className="px-4 py-3" />}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, i) => {
                        const product = products.find((p) => p.id === item.productId)
                        const reqLine = reqLines.find((r) => r.lineId === item.requirementLineId)
                        return (
                          <tr key={item.id} className={i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/15"}>
                            <td className="px-4 py-3 font-medium text-[#333333]">{product?.name ?? item.product ?? "—"}</td>
                            <td className="px-4 py-3 text-[#666666] font-mono text-xs hidden sm:table-cell">
                              {reqLine?.label ?? (item.requirementLineId ? item.requirementLineId.slice(0, 8) : <span className="text-[#999]">—</span>)}
                            </td>
                            <td className="px-4 py-3 text-right text-[#333333]">
                              {item.quantity}
                              {item.unitLabel && <span className="ml-1 text-xs text-[#999]">{item.unitLabel}</span>}
                              {!isNew && !editMode && itemRemaining(item) > 0 && (status === "REGISTERED" || status === "AWAITING_DELIVERY") && (
                                <div className="mt-0.5">
                                  <button onClick={() => openShortage(item)} className="text-[11px] font-semibold text-yellow-700 hover:underline">
                                    Accept Shortage
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right text-[#666666]">{fmtMoney(item.unitCost)}</td>
                            <td className="px-4 py-3 text-right font-bold text-[#333333]">{fmtMoney(itemTotal(item))}</td>
                            {!isReadOnly && (
                              <td className="px-4 py-3">
                                {isNew ? (
                                  <button onClick={() => setItems((prev) => prev.filter((x) => x.id !== item.id))} className="text-xs text-red-400 hover:text-red-600 font-medium">Remove</button>
                                ) : (
                                  <div className="flex items-center gap-3 justify-end">
                                    <button onClick={() => { setActionError(""); setEditingItem(item) }} className="text-xs text-[#7A9076] hover:underline font-medium">Edit</button>
                                    <button onClick={() => handleRemoveItem(item)} className="text-xs text-red-400 hover:text-red-600 font-medium">Remove</button>
                                  </div>
                                )}
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
              <label className="text-xs font-bold text-[#666666] uppercase tracking-wide block mb-3">Notes / Special Instructions</label>
              {isReadOnly ? (
                <p className="text-sm text-[#666666]">{notes || "—"}</p>
              ) : (
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm resize-none focus:border-[#B6C8AF] focus:outline-none" placeholder="Add delivery instructions, purchasing notes, or other relevant information..." />
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
              <div className="bg-white rounded-xl border border-[#E6ECE2] p-5">
                <p className="text-xs font-bold text-[#666666] uppercase tracking-wide mb-3">Source</p>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-[#E6ECE2] flex items-center justify-center shrink-0">
                    <svg className="h-4 w-4 text-[#7A9076]" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                      <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11 4a1 1 0 10-2 0v4a1 1 0 102 0V7zm-3 1a1 1 0 10-2 0v3a1 1 0 102 0V8zM8 9a1 1 0 00-2 0v2a1 1 0 102 0V9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-[#999]">Purchase Requirement</p>
                    {items.some((it) => it.requirementLineId)
                      ? <p className="text-sm font-semibold text-[#7A9076]">Linked requirement items</p>
                      : <p className="text-sm text-[#666666]">Manual Purchase Order</p>
                    }
                  </div>
                </div>
              </div>
            )}

            {/* Requirement Allocation Display (detail only) */}
            {!isNew && items.some((it) => it.requirementLineId) && (
              <div className="bg-white rounded-xl border border-[#E6ECE2] p-5">
                <p className="text-xs font-bold text-[#666666] uppercase tracking-wide mb-3">Requirement Allocations</p>
                <div className="space-y-3">
                  {items.filter((it) => it.requirementLineId).map((item) => {
                    const reqLine = reqLines.find((r) => r.lineId === item.requirementLineId)
                    const product = products.find((p) => p.id === item.productId)
                    return (
                      <div key={item.id} className="rounded-lg border border-[#E6ECE2] p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-semibold text-[#333333]">{product?.name ?? item.product ?? "—"}</span>
                          <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                            {reqLine?.label ?? item.requirementLineId?.slice(0, 8)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-[#999]">Allocated Qty</p>
                            <p className="font-semibold text-[#333333]">
                              {item.quantity}
                              {item.unitLabel && <span className="ml-1 text-xs font-normal text-[#999]">{item.unitLabel}</span>}
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
                <div className="flex justify-between border-t border-[#E6ECE2] pt-3">
                  <span className="font-semibold text-[#333333]">Total Amount</span>
                  <span className="text-xl font-bold text-[#7A9076]">{fmtMoney(total)}</span>
                </div>
              </div>

              {/* Supplier payment terms */}
              {supplierView && (
                <div className="mt-4 rounded-lg bg-[#E6ECE2]/50 px-4 py-3">
                  <p className="text-xs text-[#999]">Supplier Payment Terms</p>
                  <p className="text-sm font-semibold text-[#333333] mt-0.5">{supplierView.paymentTerms || "—"}</p>
                  <p className="text-xs text-[#999] mt-1">Payment is managed through Supplier Payables.</p>
                </div>
              )}

              {/* Receiving summary (detail only) */}
              {!isNew && poState?.receivingSummary && (
                <div className="mt-4">
                  <p className="text-xs font-bold text-[#666666] uppercase tracking-wide mb-2">Receiving</p>
                  <div className="rounded-lg border border-[#E6ECE2] divide-y divide-[#E6ECE2]/70">
                    {([
                      ["Ordered", poState.receivingSummary.orderedQuantity],
                      ["Received", poState.receivingSummary.receivedQuantity],
                      ["Shortage", poState.receivingSummary.shortQuantity],
                      ["Remaining", poState.receivingSummary.remainingQuantity],
                    ] as [string, number][]).map(([label, val]) => (
                      <div key={label} className="flex justify-between px-3 py-1.5 text-sm">
                        <span className="text-[#666666]">{label}</span>
                        <span className="font-semibold text-[#333333]">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Goods value summary (detail only) */}
              {!isNew && poState?.goodsSummary && (
                <div className="mt-4">
                  <p className="text-xs font-bold text-[#666666] uppercase tracking-wide mb-2">Goods Value</p>
                  <div className="rounded-lg border border-[#E6ECE2] divide-y divide-[#E6ECE2]/70">
                    {([
                      ["Ordered Goods", poState.goodsSummary.orderedGoodsValue],
                      ["Received Goods", poState.goodsSummary.receivedGoodsValue],
                      ["Goods Invoiced", poState.goodsSummary.goodsInvoicedAmount],
                      ["Still to Invoice", poState.goodsSummary.remainingGoodsToInvoice],
                    ] as [string, number][]).map(([label, val]) => (
                      <div key={label} className="flex justify-between px-3 py-1.5 text-sm">
                        <span className="text-[#666666]">{label}</span>
                        <span className="font-semibold text-[#333333]">{fmtMoney(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payment summary (detail only) */}
              {!isNew && poState?.paymentSummary && (
                <div className="mt-4">
                  <p className="text-xs font-bold text-[#666666] uppercase tracking-wide mb-2">Payment</p>
                  <div className="rounded-lg border border-[#E6ECE2] divide-y divide-[#E6ECE2]/70">
                    {([
                      ["Status", poState.paymentSummary.status === "NOT_INVOICED" ? "Not Invoiced" : poState.paymentSummary.status === "PARTIALLY_PAID" ? "Partially Paid" : poState.paymentSummary.status === "UNPAID" ? "Unpaid" : poState.paymentSummary.status === "PAID" ? "Paid" : poState.paymentSummary.status],
                      ["Invoices", String(poState.paymentSummary.invoiceCount)],
                      ["Invoiced", poState.paymentSummary.invoicedAmount],
                      ["Paid", poState.paymentSummary.paidAmount],
                      ["Outstanding", poState.paymentSummary.outstandingAmount],
                    ] as [string, string | number][]).map(([label, val]) => (
                      <div key={label} className="flex justify-between px-3 py-1.5 text-sm">
                        <span className="text-[#666666]">{label}</span>
                        <span className={`font-semibold ${val === 0 && label === "Outstanding" ? "text-green-600" : "text-[#333333]"}`}>{typeof val === "number" ? fmtMoney(val) : val}</span>
                      </div>
                    ))}
                  </div>
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
                        <button onClick={() => { setActionError(""); setMarkDeliveryOpen(true) }} className="w-full rounded-xl bg-[#B6C8AF] px-4 py-2.5 text-sm font-semibold text-[#333333] hover:bg-[#A5B89E] transition-colors">
                          Mark as Awaiting Delivery
                        </button>
                        <button onClick={() => setEditMode(true)} className="w-full rounded-xl border border-[#C6D4BF] bg-white px-4 py-2.5 text-sm font-semibold text-[#333333] hover:bg-[#E6ECE2] transition-colors">
                          Edit Order
                        </button>
                        <button onClick={() => { setActionError(""); setCancelOpen(true) }} className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors">
                          Cancel Order
                        </button>
                      </>
                    )}
                    {status === "AWAITING_DELIVERY" && (
                      <button onClick={() => { setActionError(""); setCancelOpen(true) }} className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors">
                        Cancel Order
                      </button>
                    )}
                    {status === "RECEIVED" && (
                      <button onClick={() => { setActionError(""); setCloseOpen(true) }} className="w-full rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 transition-colors">
                        Close Purchase Order
                      </button>
                    )}
                    <button onClick={() => navigate("/purchasing/orders")} className="w-full rounded-xl border border-[#C6D4BF] bg-white px-4 py-2.5 text-sm text-[#666666] hover:bg-[#E6ECE2] transition-colors">
                      ← Back to Orders
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Supplier payables link (detail) */}
            {!isNew && (status === "CLOSED" || status === "RECEIVED") && (
              <div className="bg-white rounded-xl border border-[#E6ECE2] p-5">
                <p className="text-xs font-bold text-[#666666] uppercase tracking-wide mb-3">Supplier Payables</p>
                <p className="text-xs text-[#999] mb-3">Invoice and payment details are managed in Supplier Payables.</p>
                <button onClick={() => navigate("/purchasing/payables")} className="w-full rounded-xl border border-[#C6D4BF] px-4 py-2.5 text-sm font-semibold text-[#7A9076] hover:bg-[#E6ECE2] transition-colors">
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
        reqLines={reqLines}
        existingProductIds={items.map((i) => i.productId)}
        onClose={() => setAddProductOpen(false)}
        onAdd={(item) => { setItems((prev) => [...prev, item]); setAddProductOpen(false) }}
      />

      <EditItemModal
        item={editingItem}
        error={actionError}
        onClose={() => { setEditingItem(null); setActionError("") }}
        onSave={(patch, onDone) => { if (editingItem) void handleSaveItem(editingItem.id, patch, onDone) }}
      />

      <AcceptShortageModal
        target={shortageTarget}
        quantity={shortageQty}
        reason={shortageReason}
        error={actionError}
        setQuantity={setShortageQty}
        setReason={setShortageReason}
        onClose={() => { setShortageTarget(null); setActionError("") }}
        onConfirm={() => void handleAcceptShortage()}
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