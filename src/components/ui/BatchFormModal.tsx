import { useEffect, useState } from "react"
import { createBatch, type BatchDto } from "../../features/inventory/batchesApi"
import { listUnits, type UnitDto } from "../../features/inventory/unitsApi"
import { searchProducts } from "../../features/inventory/searchSelectors"
import { useSearchableResource } from "../../hooks/useSearchableResource"
import SearchableSelect from "./SearchableSelect"
import type { SearchableOption } from "./SearchableSelect"
import Input from "./Input"
import DatePicker from "./DatePicker"
import FormError from "./FormError"
import Modal from "./Modal"
import Button from "./Button"

// ─────────────────────────────────────────────────────────────
// Add Batch form types
// ─────────────────────────────────────────────────────────────
interface AddBatchForm {
  productId: string
  unitId: string
  batchNumber: string
  receivedDate: string
  expiryDate: string
  purchaseCost: string
  supplierReference: string
}

function emptyBatchForm(): AddBatchForm {
  const today = new Date().toISOString().slice(0, 10)
  return {
    productId: "",
    unitId: "",
    batchNumber: "",
    receivedDate: today,
    expiryDate: "",
    purchaseCost: "",
    supplierReference: "",
  }
}

function addBatchErrors(f: AddBatchForm) {
  const e: Partial<Record<keyof AddBatchForm, string>> = {}
  if (!f.productId) e.productId = "Product is required."
  if (!f.unitId) e.unitId = "Unit is required."
  if (!f.batchNumber.trim()) e.batchNumber = "Batch number is required."
  if (!f.receivedDate) e.receivedDate = "Received date is required."
  if (!f.expiryDate) e.expiryDate = "Expiry date is required."
  else if (f.expiryDate < f.receivedDate)
    e.expiryDate = "Expiry must be after received date."
  if (f.purchaseCost.trim() === "") e.purchaseCost = "Purchase cost is required."
  else if (Number.isNaN(Number(f.purchaseCost)) || Number(f.purchaseCost) < 0)
    e.purchaseCost = "Purchase cost must be a non-negative number."
  return e
}

// ─────────────────────────────────────────────────────────────
// Reusable Add Batch modal.
// Used by Inventory > Batches & Expiry and the Add Stock form.
// ─────────────────────────────────────────────────────────────
interface BatchFormModalProps {
  open: boolean
  onClose: () => void
  /** Pre-select (and lock) the product when adding a batch from a
   *  product-scoped form like the Add Stock modal. */
  initialProductId?: string
  initialProductName?: string
  /** Called after a successful create with the saved batch. */
  onSaved?: (batch: BatchDto) => void | Promise<void>
}

export default function BatchFormModal({
  open,
  onClose,
  initialProductId,
  initialProductName,
  onSaved,
}: BatchFormModalProps) {
  // ── Add Batch modal state ──
  const [addForm, setAddForm] = useState<AddBatchForm>(emptyBatchForm())
  const [addErrors, setAddErrors] = useState<
    Partial<Record<keyof AddBatchForm, string>>
  >({})
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [units, setUnits] = useState<UnitDto[]>([])

  // ── Load the master unit list once (shared Units API) for the Unit field ──
  useEffect(() => {
    let cancelled = false
    listUnits({ limit: 100 })
      .catch(() => ({ data: [] as UnitDto[] }))
      .then((u) => {
        if (cancelled) return
        setUnits(u.data)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const addProductSearch = useSearchableResource(searchProducts, open)
  // When a product is pre-selected (Add Stock flow), keep it visible even
  // before the server-side search results arrive.
  const lockedProductOption =
    initialProductId && initialProductName
      ? { value: initialProductId, label: initialProductName }
      : null
  const selectedAddProduct =
    lockedProductOption ??
    addProductSearch.options.find((o) => o.value === addForm.productId) ??
    null
  const addProductOptions: SearchableOption[] = selectedAddProduct
    ? [
        selectedAddProduct,
        ...addProductSearch.options.filter(
          (o) => o.value !== addForm.productId,
        ),
      ]
    : addProductSearch.options

  // Reset the form whenever the modal opens, pre-filling a locked product.
  useEffect(() => {
    if (!open) return
    setAddForm(
      initialProductId
        ? { ...emptyBatchForm(), productId: initialProductId }
        : emptyBatchForm(),
    )
    setAddErrors({})
    setAddError(null)
    setAdding(false)
    // `initialProductId` is snapshotted at open time on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function close() {
    if (adding) return
    onClose()
  }

  async function handleCreate() {
    const e = addBatchErrors(addForm)
    if (Object.keys(e).length) {
      setAddErrors(e)
      return
    }
    setAdding(true)
    setAddError(null)
    try {
      const saved = await createBatch({
        productId: addForm.productId,
        unitId: addForm.unitId,
        batchNumber: addForm.batchNumber.trim(),
        receivedDate: addForm.receivedDate,
        expiryDate: addForm.expiryDate,
        purchaseCost: Number(addForm.purchaseCost),
        supplierReference: addForm.supplierReference.trim(),
      })

      await onSaved?.(saved)
      onClose()
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to create batch.")
    } finally {
      setAdding(false)
    }
  }

  return (
    <Modal open={open} title="Add Batch" onClose={close} size="xl">
      <div className="flex flex-col gap-4">
        <FormError message={addError} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#333333]">Product</label>
            <SearchableSelect
              value={addForm.productId || null}
              onChange={(v) => {
                setAddForm((f) => ({ ...f, productId: v }))
                setAddErrors((er) => ({ ...er, productId: undefined }))
              }}
              options={addProductOptions}
              onSearch={addProductSearch.setTerm}
              loading={addProductSearch.loading}
              error={addProductSearch.error}
              onRetry={addProductSearch.retry}
              disabled={!!initialProductId}
              placeholder="Search and select a product..."
              searchPlaceholder="Search by name or SKU..."
              emptyMessage="No products found"
              noResultsMessage="No products matching your search"
            />
            {addErrors.productId && (
              <p className="text-xs text-red-500">{addErrors.productId}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#333333]">
              Unit <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              value={addForm.unitId || null}
              onChange={(v) => {
                setAddForm((f) => ({ ...f, unitId: v }))
                setAddErrors((er) => ({ ...er, unitId: undefined }))
              }}
              options={units.map((u) => ({ value: u.id, label: u.name }))}
              placeholder="Select a unit..."
              searchPlaceholder="Search units..."
              emptyMessage="No units available"
              noResultsMessage="No matching units"
            />
            {addErrors.unitId && (
              <p className="text-xs text-red-500">{addErrors.unitId}</p>
            )}
          </div>

          <Input
            label="Batch Number"
            value={addForm.batchNumber}
            onChange={(e) => {
              setAddForm((f) => ({ ...f, batchNumber: e.target.value }))
              setAddErrors((er) => ({ ...er, batchNumber: undefined }))
            }}
            error={addErrors.batchNumber}
            placeholder="e.g. PCM001"
          />

          <Input
            label="Purchase Cost"
            type="number"
            min={0}
            step="0.01"
            value={addForm.purchaseCost}
            onChange={(e) => {
              setAddForm((f) => ({ ...f, purchaseCost: e.target.value }))
              setAddErrors((er) => ({ ...er, purchaseCost: undefined }))
            }}
            error={addErrors.purchaseCost}
            placeholder="e.g. 110"
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#333333]">
              Received Date
            </label>
            <DatePicker
              value={addForm.receivedDate}
              onChange={(v) => {
                setAddForm((f) => ({ ...f, receivedDate: v }))
                setAddErrors((er) => ({ ...er, receivedDate: undefined }))
              }}
              placeholder="Select received date..."
            />
            {addErrors.receivedDate && (
              <p className="text-xs text-red-500">{addErrors.receivedDate}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#333333]">
              Expiry Date
            </label>
            <DatePicker
              value={addForm.expiryDate}
              onChange={(v) => {
                setAddForm((f) => ({ ...f, expiryDate: v }))
                setAddErrors((er) => ({ ...er, expiryDate: undefined }))
              }}
              placeholder="Select expiry date..."
            />
            {addErrors.expiryDate && (
              <p className="text-xs text-red-500">{addErrors.expiryDate}</p>
            )}
          </div>

          <div className="md:col-span-2">
            <Input
              label="Supplier Reference"
              value={addForm.supplierReference}
              onChange={(e) =>
                setAddForm((f) => ({ ...f, supplierReference: e.target.value }))
              }
              placeholder="e.g. ABC Pharma invoice 1042"
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="secondary" onClick={close} disabled={adding}>
            Cancel
          </Button>
          <Button onClick={() => void handleCreate()} loading={adding}>
            Create Batch
          </Button>
        </div>
      </div>
    </Modal>
  )
}