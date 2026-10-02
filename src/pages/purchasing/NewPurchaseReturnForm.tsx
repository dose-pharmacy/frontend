import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Button from "../../components/ui/Button"
import ConfirmationDialog from "../../components/ui/ConfirmationDialog"
import SearchableSelect from "../../components/ui/SearchableSelect"
import type { SearchableOption } from "../../components/ui/SearchableSelect"
import { IconX } from "../../components/ui/icons"
import { searchLocations, searchSuppliers } from "../../features/inventory/searchSelectors"
import { useSearchableResource } from "../../hooks/useSearchableResource"
import {
  createPurchaseReturn,
  getPurchaseOrderItemReturnable,
  newPurchaseReturnIdempotencyKey,
  PurchaseReturnsApiError,
  readPurchaseOrderItemReturnable,
  type PurchaseOrderItemReturnable,
  type PurchaseReturnDto,
  type PurchaseReturnReason,
} from "../../features/purchasing/purchaseReturnsApi"
import { listPurchaseOrders } from "../../features/purchasing/purchaseOrdersApi"
import type { POItemDto, PurchaseOrderDto } from "../../features/purchasing/purchaseOrdersApi"
import {
  getSupplierProductBatches,
  type SupplierProductBatchDto,
} from "../../features/purchasing/suppliersApi"

const REASON_LABELS: Record<PurchaseReturnReason, string> = {
  EXPIRED: "Expired",
  DAMAGED: "Damaged",
  INCORRECT_DELIVERY: "Incorrect Delivery",
}

const REASON_OPTIONS: PurchaseReturnReason[] = [
  "EXPIRED",
  "DAMAGED",
  "INCORRECT_DELIVERY",
]

/** Purchase orders / batches fetched per supplier in one go. */
const LOOKUP_PAGE_SIZE = 100

const inputClass =
  "w-full rounded-lg border border-[#C6D4BF] bg-white px-3 py-2 text-sm focus:border-[#B6C8AF] focus:outline-none disabled:bg-[#E6ECE2]/40 disabled:text-[#999]"

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "—"
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function fmtMoney(value: number | null | undefined): string {
  return `${Number(value ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ETB`
}

function describeError(error: unknown, fallback: string): string {
  if (error instanceof PurchaseReturnsApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}

/** A PO item plus the identity fields the POST needs, kept together. */
interface SelectedItem {
  purchaseOrderItemId: string
  productId: string
  productName: string
  productSku: string
  unitId: string | null
  unitLabel: string
  unitCost: number
  quantityReceived: number
}

function toSelectedItem(item: POItemDto): SelectedItem {
  const unitLabel = item.unit ? [item.unit.name, item.unit.symbol].filter(Boolean).join(" ") : ""
  return {
    purchaseOrderItemId: item.id,
    productId: item.productId,
    productName: item.product?.name ?? "—",
    productSku: item.product?.sku ?? "",
    unitId: item.unitId ?? item.unit?.id ?? null,
    unitLabel,
    unitCost: item.unitCost,
    quantityReceived: item.quantityReceived ?? 0,
  }
}

function itemOption(item: SelectedItem): SearchableOption {
  return {
    value: item.purchaseOrderItemId,
    label: item.productName,
    sub: [item.productSku, `Received: ${item.quantityReceived}`, item.unitLabel]
      .filter(Boolean)
      .join(" · "),
  }
}

function availableAt(batch: SupplierProductBatchDto, locationId: string): number {
  if (!locationId) {
    return batch.locations.reduce((sum, l) => sum + l.availableQuantity, 0)
  }
  return batch.locations.find((l) => l.locationId === locationId)?.availableQuantity ?? 0
}

interface Props {
  onCancel: () => void
  onCreated: (record: PurchaseReturnDto) => void
}

export default function NewPurchaseReturnForm({ onCancel, onCreated }: Props) {
  // ── Selection cascade ──────────────────────────────────────────────────────
  const [supplierId, setSupplierId] = useState("")
  const [purchaseOrderId, setPurchaseOrderId] = useState("")
  const [itemId, setItemId] = useState("")
  const [batchId, setBatchId] = useState("")
  const [locationId, setLocationId] = useState("")
  const [reason, setReason] = useState<PurchaseReturnReason>("EXPIRED")
  const [quantityInput, setQuantityInput] = useState("")
  const [notes, setNotes] = useState("")

  // One key per logical submission. Reused on every retry of the same submit
  // and only regenerated after a return has actually been recorded.
  const [idempotencyKey, setIdempotencyKey] = useState(newPurchaseReturnIdempotencyKey)

  // ── Purchase orders for the selected supplier ──────────────────────────────
  const [orders, setOrders] = useState<PurchaseOrderDto[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState("")
  const ordersSeq = useRef(0)

  // ── Returnable quantity for the selected PO item ───────────────────────────
  const [returnable, setReturnable] = useState<PurchaseOrderItemReturnable | null>(null)
  const [returnableLoading, setReturnableLoading] = useState(false)
  const [returnableError, setReturnableError] = useState("")
  const returnableSeq = useRef(0)

  // ── Supplier-owned batches for the selected product ────────────────────────
  const [batches, setBatches] = useState<SupplierProductBatchDto[]>([])
  const [batchesLoading, setBatchesLoading] = useState(false)
  const [batchesError, setBatchesError] = useState("")
  const batchesSeq = useRef(0)

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)

  const supplierSearch = useSearchableResource(searchSuppliers)
  const locationSearch = useSearchableResource(searchLocations)

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === purchaseOrderId) ?? null,
    [orders, purchaseOrderId],
  )

  // Only items with received goods can be returned at all. This uses published
  // per-item quantities rather than any invented server-side filter, and it is
  // a coarse pre-filter only — the `returnable` endpoint remains the authority.
  const returnableItems = useMemo<SelectedItem[]>(() => {
    const items = selectedOrder?.items ?? []
    return items
      .filter((item) => (item.quantityReceived ?? 0) > 0)
      .map(toSelectedItem)
      .sort((a, b) => a.productName.localeCompare(b.productName))
  }, [selectedOrder])

  const selectedItem = useMemo(
    () => returnableItems.find((i) => i.purchaseOrderItemId === itemId) ?? null,
    [returnableItems, itemId],
  )

  const selectedBatch = useMemo(
    () => batches.find((b) => b.id === batchId) ?? null,
    [batches, batchId],
  )

  // ── Derived money / quantity ───────────────────────────────────────────────
  // Unit cost prefers the returnable endpoint's own figure and falls back to the
  // purchase-order item's published `unitCost`. Both are backend values; the
  // field is never typed by the user.
  const unitCostSource: "returnable endpoint" | "purchase-order item" | null = returnable?.unitCost
    ? "returnable endpoint"
    : selectedItem
      ? "purchase-order item"
      : null
  const unitCost = returnable?.unitCost ?? selectedItem?.unitCost ?? null
  const maxQuantity = returnable?.quantityReturnable ?? null
  const parsedQuantity = Number(quantityInput)
  const quantity = Number.isFinite(parsedQuantity) && quantityInput.trim() !== "" ? parsedQuantity : 0
  // Indicative only. The backend derives the return value itself and this value
  // is deliberately NOT sent — see `createPurchaseReturn`.
  const indicativeDebitNote = unitCost != null ? quantity * unitCost : null

  // ── Loads ──────────────────────────────────────────────────────────────────

  const loadOrders = useCallback(async (targetSupplierId: string) => {
    if (!targetSupplierId) {
      setOrders([])
      return
    }
    const seq = ++ordersSeq.current
    setOrdersLoading(true)
    setOrdersError("")
    try {
      // `includeItems` (not `receivable` / `invoiceable`, which belong to the
      // receiving and supplier-invoicing workflows respectively) so each PO
      // carries its items, their received quantities and their unit costs.
      const result = await listPurchaseOrders({
        supplierId: targetSupplierId,
        includeItems: true,
        page: 1,
        limit: LOOKUP_PAGE_SIZE,
      })
      if (seq !== ordersSeq.current) return
      setOrders(result.data)
    } catch (e) {
      if (seq !== ordersSeq.current) return
      setOrders([])
      setOrdersError(describeError(e, "Failed to load purchase orders."))
    } finally {
      if (seq === ordersSeq.current) setOrdersLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!supplierId) {
      ordersSeq.current++
      setOrders([])
      setOrdersError("")
      return
    }
    void loadOrders(supplierId)
  }, [supplierId, loadOrders])

  const loadReturnable = useCallback(
    async (targetSupplierId: string, targetItemId: string) => {
      const seq = ++returnableSeq.current
      setReturnableLoading(true)
      setReturnableError("")
      setReturnable(null)
      try {
        const raw = await getPurchaseOrderItemReturnable(targetItemId, targetSupplierId)
        if (seq !== returnableSeq.current) return
        setReturnable(readPurchaseOrderItemReturnable(raw))
      } catch (e) {
        if (seq !== returnableSeq.current) return
        setReturnableError(
          describeError(e, "Failed to load the returnable quantity for this purchase-order item."),
        )
      } finally {
        if (seq === returnableSeq.current) setReturnableLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (!supplierId || !selectedItem) {
      returnableSeq.current++
      setReturnable(null)
      setReturnableError("")
      setReturnableLoading(false)
      return
    }
    void loadReturnable(supplierId, selectedItem.purchaseOrderItemId)
  }, [supplierId, selectedItem, loadReturnable])

  const loadBatches = useCallback(
    async (targetSupplierId: string, targetProductId: string) => {
      if (!targetSupplierId || !targetProductId) {
        setBatches([])
        return
      }
      const seq = ++batchesSeq.current
      setBatchesLoading(true)
      setBatchesError("")
      try {
        // `excludeExpired` is deliberately NOT set: expired stock is a normal
        // reason to return goods, so those batches must stay selectable.
        const result = await getSupplierProductBatches(targetSupplierId, targetProductId, {
          inStock: true,
        })
        if (seq !== batchesSeq.current) return
        setBatches(result.data)
      } catch (e) {
        if (seq !== batchesSeq.current) return
        setBatches([])
        setBatchesError(describeError(e, "Failed to load batches for this product."))
      } finally {
        if (seq === batchesSeq.current) setBatchesLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (!supplierId || !selectedItem) {
      batchesSeq.current++
      setBatches([])
      setBatchesError("")
      return
    }
    void loadBatches(supplierId, selectedItem.productId)
  }, [supplierId, selectedItem, loadBatches])

  // ── Selection handlers (each resets everything downstream) ────────────────

  function handleSupplierChange(value: string) {
    setSupplierId(value)
    setPurchaseOrderId("")
    setItemId("")
    setBatchId("")
  }

  function handleOrderChange(value: string) {
    setPurchaseOrderId(value)
    setItemId("")
    setBatchId("")
  }

  function handleItemChange(value: string) {
    setItemId(value)
    setBatchId("")
  }

  function handleLocationChange(value: string) {
    setLocationId(value)
    // The batch may not exist at the newly chosen location.
    if (selectedBatch && availableAt(selectedBatch, value) <= 0) setBatchId("")
  }

  // ── Options ────────────────────────────────────────────────────────────────

  const supplierOptions: SearchableOption[] = (() => {
    const current = supplierSearch.options.find((o) => o.value === supplierId)
    return current ? [current, ...supplierSearch.options.filter((o) => o.value !== supplierId)] : supplierSearch.options
  })()

  const locationOptions: SearchableOption[] = (() => {
    const current = locationSearch.options.find((o) => o.value === locationId)
    return current ? [current, ...locationSearch.options.filter((o) => o.value !== locationId)] : locationSearch.options
  })()

  const supplierName =
    supplierSearch.options.find((o) => o.value === supplierId)?.label ?? null
  const locationName =
    locationSearch.options.find((o) => o.value === locationId)?.label ?? null

  const orderOptions: SearchableOption[] = useMemo(
    () =>
      orders.map((po) => ({
        value: po.id,
        label: po.poNumber || po.id.slice(0, 8),
        sub: [
          po.status,
          `Expected: ${fmtDate(po.expectedDeliveryDate)}`,
          `${(po.items ?? []).filter((i) => (i.quantityReceived ?? 0) > 0).length} received item(s)`,
        ]
          .filter(Boolean)
          .join(" · "),
      })),
    [orders],
  )

  const itemOptions: SearchableOption[] = useMemo(() => returnableItems.map(itemOption), [returnableItems])

  const selectableBatches = useMemo(
    () => (locationId ? batches.filter((b) => availableAt(b, locationId) > 0) : batches),
    [batches, locationId],
  )

  const batchOptions: SearchableOption[] = useMemo(
    () =>
      selectableBatches.map((b) => {
        const stock = availableAt(b, locationId)
        return {
          value: b.id,
          label: b.batchNumber,
          sub: `Exp: ${fmtDate(b.expiryDate)}`,
          hint: locationName ? `Available at ${locationName}: ${stock}` : `Available: ${stock}`,
        }
      }),
    [selectableBatches, locationId, locationName],
  )

  // ── Validation ─────────────────────────────────────────────────────────────

  const quantityExceedsMax = maxQuantity != null && quantity > maxQuantity
  const canSubmit =
    !!supplierId &&
    !!selectedItem &&
    !!batchId &&
    !!locationId &&
    !!reason &&
    quantity > 0 &&
    !quantityExceedsMax &&
    !returnableLoading &&
    !returnableError &&
    !ordersLoading &&
    !batchesLoading

  function validate(): string {
    if (!supplierId) return "Select a supplier."
    if (!selectedItem) return "Select a purchase order and a purchase-order item."
    if (!batchId) return "Select the batch whose stock is being returned."
    if (!locationId) return "Select the location the stock is being returned from."
    if (quantity <= 0) return "Enter a quantity greater than zero."
    if (maxQuantity != null && quantity > maxQuantity) {
      return `Quantity exceeds the maximum returnable of ${maxQuantity}.`
    }
    if (returnableError) return returnableError
    return ""
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function submit() {
    const problem = validate()
    if (problem) {
      setSubmitError(problem)
      setConfirmOpen(false)
      return
    }
    if (!selectedItem) return

    setSubmitError("")
    setSubmitting(true)
    try {
      // ONE request. Stock decrement, the RETURN_TO_SUPPLIER movement, applying
      // the return value against outstanding payables and the audit write are
      // all the backend's atomic transaction — never replicated here.
      const created = await createPurchaseReturn({
        supplierId,
        productId: selectedItem.productId,
        purchaseOrderItemId: selectedItem.purchaseOrderItemId,
        batchId,
        locationId,
        reason,
        quantity,
        unitId: selectedItem.unitId,
        unitCost,
        notes: notes.trim() || null,
        // Same key for every retry of this logical submission.
        idempotencyKey,
      })
      setConfirmOpen(false)
      // Fresh key for the NEXT return, never for a retry of this one.
      setIdempotencyKey(newPurchaseReturnIdempotencyKey())
      onCreated(created)
    } catch (e) {
      setSubmitError(describeError(e, "The purchase return could not be recorded."))
      setConfirmOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const disabledHint = (text: string) =>
    text ? <p className="mt-1 text-xs text-[#999999]">{text}</p> : null

  return (
    <div className="bg-white rounded-xl border border-[#E6ECE2] p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-[#333333]">New Purchase Return</h2>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="text-sm text-gray-400 hover:text-gray-600 inline-flex items-center gap-1 disabled:opacity-60"
        >
          <IconX className="h-4 w-4" />
          Cancel
        </button>
      </div>

      {submitError && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
          {submitError}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Supplier */}
        <div>
          <label className="block text-sm text-[#666666] mb-1">Supplier *</label>
          <SearchableSelect
            value={supplierId || null}
            onChange={handleSupplierChange}
            options={supplierOptions}
            onSearch={supplierSearch.setTerm}
            loading={supplierSearch.loading}
            error={supplierSearch.error}
            onRetry={supplierSearch.retry}
            disabled={submitting}
            placeholder="— Select Supplier —"
            searchPlaceholder="Search suppliers..."
            emptyMessage="No suppliers found"
            noResultsMessage="No suppliers matching your search"
          />
        </div>

        {/* Purchase Order */}
        <div>
          <label className="block text-sm text-[#666666] mb-1">Purchase Order *</label>
          <SearchableSelect
            value={purchaseOrderId || null}
            onChange={handleOrderChange}
            options={orderOptions}
            disabled={!supplierId || ordersLoading || submitting}
            placeholder={
              !supplierId
                ? "— Select a supplier first —"
                : ordersLoading
                  ? "Loading purchase orders…"
                  : orderOptions.length === 0
                    ? "— No purchase orders for this supplier —"
                    : "— Select Purchase Order —"
            }
            emptyMessage="No purchase orders for this supplier"
            noResultsMessage="No matching purchase order"
            footerHint="Only orders with received goods can be returned against."
          />
          {ordersError && <p className="mt-1 text-xs text-red-600">{ordersError}</p>}
          {supplierId &&
            !ordersLoading &&
            !ordersError &&
            orderOptions.length === 0 &&
            disabledHint("This supplier has no purchase orders with received goods.")}
        </div>

        {/* Purchase Order Item / Product */}
        <div className="sm:col-span-2">
          <label className="block text-sm text-[#666666] mb-1">Product / PO Item *</label>
          <SearchableSelect
            value={itemId || null}
            onChange={handleItemChange}
            options={itemOptions}
            disabled={!purchaseOrderId || submitting}
            placeholder={
              !purchaseOrderId
                ? "— Select a purchase order first —"
                : itemOptions.length === 0
                  ? "— No received items on this order —"
                  : "— Select Product / PO Item —"
            }
            emptyMessage="No received items on this purchase order"
            noResultsMessage="No matching item"
            footerHint="A return is recorded against a specific purchase-order line, not just a product."
          />
          {selectedItem && (
            <p className="mt-1 text-xs text-[#666666]">
              Received on this order: <strong>{selectedItem.quantityReceived}</strong> · Unit cost:{" "}
              <strong>{fmtMoney(selectedItem.unitCost)}</strong>
              {selectedItem.unitLabel ? ` per ${selectedItem.unitLabel}` : ""}
            </p>
          )}
        </div>

        {/* Returnable quantity — read-only, straight from the backend endpoint */}
        <div className="sm:col-span-2">
          <label className="block text-sm text-[#666666] mb-1">
            Returnable Quantity
            <span className="text-xs font-normal"> (from the backend)</span>
          </label>
          {!selectedItem ? (
            <p className="rounded-lg bg-[#E6ECE2]/40 border border-[#E6ECE2] px-3 py-2 text-sm text-[#999999]">
              Select a purchase-order item to load its returnable quantity.
            </p>
          ) : returnableLoading ? (
            <p className="rounded-lg bg-[#E6ECE2]/40 border border-[#E6ECE2] px-3 py-2 text-sm text-[#666666]">
              Loading returnable quantity…
            </p>
          ) : returnableError ? (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2">
              <p className="text-sm text-red-700">{returnableError}</p>
            </div>
          ) : returnable?.quantityReturnable != null ? (
            <div className="rounded-lg bg-[#E6ECE2]/50 border border-[#E6ECE2] px-3 py-2">
              <p className="text-sm text-[#333333]">
                <strong>{returnable.quantityReturnable}</strong> base unit
                {returnable.quantityReturnable === 1 ? "" : "s"} still returnable for this
                purchase-order item.
              </p>
              {returnable.quantityReturnable <= 0 && (
                <p className="mt-1 text-sm text-red-600">
                  No quantity remains available for return for this purchase-order item.
                </p>
              )}
              <details className="mt-2">
                <summary className="text-xs text-[#666666] cursor-pointer">
                  Backend response
                </summary>
                <pre className="mt-1 overflow-x-auto rounded bg-white border border-[#E6ECE2] p-2 text-[11px] text-[#333333]">
                  {JSON.stringify(returnable.raw, null, 2)}
                </pre>
              </details>
            </div>
          ) : (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
              <p className="text-sm text-amber-800">
                The backend returned no recognisable returnable-quantity field for this
                purchase-order item, so no maximum is shown here. The backend still validates the
                quantity on submit — it stays the authority.
              </p>
              <details className="mt-2">
                <summary className="text-xs text-amber-800 cursor-pointer">
                  Raw backend response
                </summary>
                <pre className="mt-1 overflow-x-auto rounded bg-white border border-amber-200 p-2 text-[11px] text-[#333333]">
                  {JSON.stringify(returnable?.raw ?? null, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-sm text-[#666666] mb-1">Quantity to Return * (base units)</label>
          <input
            type="number"
            min={1}
            step={1}
            value={quantityInput}
            onChange={(e) => setQuantityInput(e.target.value)}
            disabled={!selectedItem || submitting}
            placeholder="0"
            className={inputClass}
          />
          {maxQuantity != null && (
            <p className="mt-1 text-xs text-[#666666]">
              Maximum returnable: <strong>{maxQuantity}</strong>
            </p>
          )}
          {quantityExceedsMax && (
            <p className="mt-1 text-xs text-red-600">
              Quantity exceeds the maximum returnable of {maxQuantity}.
            </p>
          )}
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm text-[#666666] mb-1">Return Reason *</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as PurchaseReturnReason)}
            disabled={submitting}
            className={inputClass}
          >
            {REASON_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {REASON_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        {/* Batch */}
        <div>
          <label className="block text-sm text-[#666666] mb-1">Batch *</label>
          <SearchableSelect
            value={batchId || null}
            onChange={setBatchId}
            options={batchOptions}
            loading={batchesLoading}
            error={batchesError}
            onRetry={() => selectedItem && void loadBatches(supplierId, selectedItem.productId)}
            disabled={!selectedItem || batchesLoading || submitting}
            placeholder={
              !selectedItem
                ? "— Select a purchase-order item first —"
                : batchesLoading
                  ? "Loading batches…"
                  : selectableBatches.length === 0
                    ? "— No batches in stock for this product —"
                    : "— Select batch —"
            }
            searchPlaceholder="Search batches..."
            emptyMessage="No batches in stock for this product"
            noResultsMessage="No matching batch"
            footerHint={
              locationId && selectableBatches.length < batches.length
                ? "Batches without stock at the selected location are hidden."
                : "The return must identify the batch whose stock leaves the pharmacy."
            }
          />
          {selectedBatch && (
            <p className="mt-1 text-xs text-[#666666]">
              Available: <strong>{availableAt(selectedBatch, locationId)}</strong>
              {locationName ? ` at ${locationName}` : " across all locations"} · Exp:{" "}
              {fmtDate(selectedBatch.expiryDate)}
            </p>
          )}
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm text-[#666666] mb-1">Location *</label>
          <SearchableSelect
            value={locationId || null}
            onChange={handleLocationChange}
            options={locationOptions}
            onSearch={locationSearch.setTerm}
            loading={locationSearch.loading}
            error={locationSearch.error}
            onRetry={locationSearch.retry}
            disabled={submitting}
            placeholder="— Select Location —"
            searchPlaceholder="Search locations..."
            emptyMessage="No locations found"
            noResultsMessage="No locations matching your search"
          />
          {selectedBatch && !locationId && selectedBatch.locations.length > 0 && (
            <p className="mt-1 text-xs text-[#666666]">
              Stock for this batch sits at:{" "}
              {selectedBatch.locations
                .filter((l) => l.availableQuantity > 0)
                .map((l) => `${l.locationName} (${l.availableQuantity})`)
                .join(", ")}
            </p>
          )}
        </div>

        {/* Unit cost — read-only, backend-sourced */}
        <div>
          <label className="block text-sm text-[#666666] mb-1">
            Unit Cost
            <span className="text-xs font-normal"> (from the backend)</span>
          </label>
          <div className="rounded-lg bg-[#E6ECE2]/40 border border-[#E6ECE2] px-3 py-2 text-sm text-[#333333]">
            {unitCost != null ? fmtMoney(unitCost) : "—"}
          </div>
          {unitCostSource && (
            <p className="mt-1 text-xs text-[#666666]">Source: {unitCostSource}. Not editable.</p>
          )}
        </div>

        {/* Debit note — indicative only */}
        <div>
          <label className="block text-sm text-[#666666] mb-1">
            Debit Note Amount
            <span className="text-xs font-normal"> (indicative)</span>
          </label>
          <div className="rounded-lg bg-[#E6ECE2]/40 border border-[#E6ECE2] px-3 py-2 text-sm text-[#333333]">
            {indicativeDebitNote != null ? fmtMoney(indicativeDebitNote) : "—"}
          </div>
          <p className="mt-1 text-xs text-[#666666]">
            Quantity × unit cost, for reference only. The backend derives the return value and
            applies it against outstanding payables, so no amount is sent from here.
          </p>
        </div>

        {/* Notes */}
        <div className="sm:col-span-2">
          <label className="block text-sm text-[#666666] mb-1">Notes</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={submitting}
            placeholder="Optional notes..."
            className={`${inputClass} resize-none`}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-[#E6ECE2]">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            const problem = validate()
            if (problem) {
              setSubmitError(problem)
              return
            }
            setSubmitError("")
            setConfirmOpen(true)
          }}
          disabled={!canSubmit || submitting}
        >
          {submitting ? "Recording…" : "Record Return"}
        </Button>
        {!canSubmit && !submitting && (
          <span className="text-xs text-[#666666]">
            {!supplierId
              ? "Select a supplier to begin."
              : !selectedItem
                ? "Select a purchase order and a purchase-order item."
                : !batchId
                  ? "Select the batch being returned."
                  : !locationId
                    ? "Select the location."
                    : quantity <= 0
                      ? "Enter a quantity greater than zero."
                      : ""}
          </span>
        )}
      </div>

      <ConfirmationDialog
        open={confirmOpen}
        title="Record Purchase Return?"
        message={`Return ${quantity} of ${selectedItem?.productName ?? "the product"} from batch ${
          selectedBatch?.batchNumber ?? "—"
        } at ${locationName ?? "the selected location"} to ${
          supplierName ?? "the supplier"
        } (${REASON_LABELS[reason]}). This permanently reduces stock through a RETURN_TO_SUPPLIER movement and the backend applies the return value against outstanding payables — all in one atomic transaction.`}
        confirmLabel={submitting ? "Recording…" : "Record Return"}
        danger
        loading={submitting}
        onConfirm={() => void submit()}
        onCancel={() => {
          if (submitting) return
          setConfirmOpen(false)
          setSubmitError("")
        }}
      />
    </div>
  )
}
