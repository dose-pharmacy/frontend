// ── Requirement Line Detail ──────────────────────────────────────────────────
// Product-oriented detail for ONE purchase requirement line. Reorganised from
// the old requirement-header screen so the product's purchasing status and its
// linked purchase-order allocations are the focus.
//
//   GET /purchase/requirement-lines/{lineId}
//
// Reuses the original green header/back conventions, status badges, cards and
// the existing Edit / Close / Add Product / Order Remaining modals.

import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { StatusBadge, type POStatus } from "./PurchaseOrdersPage"
import {
  ConfirmModal,
  EditLineModal,
  EditRequirementModal,
  AddProductModal,
  ErrorBanner,
  OrderPreviewModal,
  StatusPill,
  reasonLabel,
  type EditLineTarget,
} from "./requirementShared"
import { SkeletonBar, SkeletonStatus } from "../../components/ui/Skeleton"
import { fmtDate, fmtDateTime, fmtMoney, unitCell } from "../../utils/format"
import {
  closeRequirement,
  updateRequirement,
  updateRequirementLine,
  addRequirementLine,
  getOrderPreview,
  RequirementsApiError,
  type OrderPreviewDto,
} from "../../features/purchasing/requirementsApi"
import {
  getRequirementLine,
  isLineOrderable,
  isRequestCancelled,
  type RequirementLineRow,
} from "../../features/purchasing/requirementLinesApi"

function errMessage(e: unknown): string {
  return e instanceof RequirementsApiError
    ? e.message
    : "Something went wrong. Please try again."
}

export default function RequirementLineDetailScreen({
  lineId,
  onBack,
  onChanged,
  onToast,
}: {
  lineId: string
  onBack: () => void
  onChanged: () => void
  onToast: (msg: string) => void
}) {
  const navigate = useNavigate()

  const [line, setLine] = useState<RequirementLineRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [apiError, setApiError] = useState("")
  const [busy, setBusy] = useState(false)
  const [reloadTick, setReloadTick] = useState(0)

  const [editReqOpen, setEditReqOpen] = useState(false)
  const [editLineOpen, setEditLineOpen] = useState(false)
  const [addProductOpen, setAddProductOpen] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const [orderPreview, setOrderPreview] = useState<{
    line: RequirementLineRow
    preview: OrderPreviewDto
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    setLoading(true)
    setLoadError("")
    getRequirementLine(lineId, { signal: controller.signal })
      .then((row) => {
        if (!cancelled) setLine(row)
      })
      .catch((e) => {
        if (cancelled || isRequestCancelled(e)) return
        setLoadError(errMessage(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [lineId, reloadTick])

  function refresh() {
    setReloadTick((t) => t + 1)
  }

  async function runAction(action: () => Promise<unknown>, toastMsg: string) {
    setApiError("")
    setBusy(true)
    try {
      await action()
      onToast(toastMsg)
      refresh()
      onChanged()
    } catch (e) {
      setApiError(errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  function handleSaveLine(patch: Parameters<typeof updateRequirementLine>[1]) {
    if (!line) return
    setEditLineOpen(false)
    void runAction(
      () => updateRequirementLine(line.id, patch),
      "Requirement item updated.",
    )
  }

  async function handleOrderRemaining() {
    if (!line) return
    setApiError("")
    setBusy(true)
    try {
      const preview = await getOrderPreview(line.id)
      setOrderPreview({ line, preview })
    } catch (e) {
      setApiError(errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  function navigateToCreatePO(
    quantity: number,
    unitCost: number,
    expectedDeliveryDate: string,
    notes: string,
  ) {
    if (!line) return
    const params = new URLSearchParams()
    params.set("requirementLineId", line.id)
    params.set("quantity", quantity.toString())
    params.set("unitCost", unitCost.toString())
    if (expectedDeliveryDate)
      params.set("expectedDeliveryDate", expectedDeliveryDate)
    if (notes) params.set("notes", notes)
    params.set("requirementReference", line.requirementReference)
    params.set("productName", line.productName)
    params.set("productSku", line.productSku)
    if (line.unitName) params.set("unitName", line.unitName)
    navigate(`/purchasing/orders/new?${params.toString()}`)
  }

  // ── Loading / error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div
          className="px-6 pt-5 pb-4"
          style={{
            background: "linear-gradient(135deg, #4F6B4A 0%, #3B4F35 100%)",
          }}
        >
          <SkeletonBar className="h-3 w-24 mb-3 bg-white/30" />
          <SkeletonBar className="h-6 w-64 bg-white/30" />
        </div>
        <SkeletonStatus>Loading requirement line</SkeletonStatus>
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          <div className="bg-white rounded-xl border border-[#E6ECE2] p-5">
            <SkeletonBar className="h-3 w-40 mb-4" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 9 }, (_, i) => (
                <div key={i}>
                  <SkeletonBar className="h-2.5 w-20 mb-2" />
                  <SkeletonBar className="h-3.5 w-28" />
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-[#E6ECE2] p-5">
            <SkeletonBar className="h-3 w-44 mb-4" />
            <SkeletonBar className="h-16 w-full rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  if (loadError || !line) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <div
          className="px-6 pt-5 pb-4"
          style={{
            background: "linear-gradient(135deg, #4F6B4A 0%, #3B4F35 100%)",
          }}
        >
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors"
          >
            ← Requirements
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6">
          <p className="text-sm font-semibold text-red-600 text-center max-w-md">
            {loadError || "This requirement line could not be loaded."}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onBack}
              className="rounded-xl border border-[#C6D4BF] bg-white px-3.5 py-2 text-sm font-medium text-[#333333] hover:bg-[#E6ECE2] transition-colors"
            >
              Back to Requirements
            </button>
            <button
              onClick={refresh}
              className="rounded-xl bg-[#B6C8AF] text-[#333333] px-3.5 py-2 text-sm font-semibold hover:bg-[#E5ECE2] transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  const isClosed =
    line.lineStatus.toUpperCase() === "CLOSED" ||
    line.requirementStatus.toUpperCase() === "CLOSED"
  const orderable = isLineOrderable(line)
  // Existing rule: line quantities are editable while the line is still open or
  // partially fulfilled. Flags/PO-linked lines are not editable here.
  const lineStatusUpper = line.lineStatus.toUpperCase()
  const editable =
    lineStatusUpper === "OPEN" || lineStatusUpper === "PARTIALLY_FULFILLED"

  const editLineTarget: EditLineTarget = {
    id: line.id,
    productId: line.productId,
    productName: line.productName,
    unitId: line.unitId,
    requiredQuantity: line.requiredQuantity,
    reason: reasonLabel(line.reasonCode),
    notes: line.notes,
  }

  const infoFields: [string, string][] = [
    ["Requirement Reference", line.requirementReference || "—"],
    ["Unit", unitCell(line.unitName || line.unitSymbol)],
    ["Required Quantity", String(line.requiredQuantity)],
    ["Ordered Quantity", String(line.orderedQuantity)],
    ["Quantity Delivered", String(line.quantityDelivered)],
    ["Remaining to Order", String(line.remainingToOrder)],
    ["Remaining to Receive", String(line.remainingToReceive)],
    ["Required By", fmtDate(line.requiredBy)],
    ["Created By", line.createdByName],
    ["Created Date", fmtDateTime(line.createdAt)],
    ["Last Updated", fmtDateTime(line.updatedAt)],
  ]

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header — existing green gradient + back convention */}
      <div
        className="px-6 pt-5 pb-4"
        style={{
          background: "linear-gradient(135deg, #4F6B4A 0%, #3B4F35 100%)",
        }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors mb-3"
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
          Requirements
        </button>
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <p className="text-xs text-white/60 font-medium mb-0.5 tracking-wide">
              Requirement Line
            </p>
            <h1 className="text-xl font-bold text-white">{line.productName}</h1>
            {line.productSku && (
              <p className="text-xs text-white/70 font-mono mt-0.5">
                {line.productSku}
              </p>
            )}
          </div>
          <StatusPill status={line.lineStatus} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        {apiError && (
          <ErrorBanner message={apiError} onDismiss={() => setApiError("")} />
        )}

        {/* Requirement information */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden flex-shrink-0">
          <div className="px-5 py-3 border-b border-[#E6ECE2] flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs font-bold text-[#666666] uppercase tracking-wide">
              Requirement Information
            </p>
            {!isClosed && (
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={() => setEditReqOpen(true)}
                  className="text-xs font-semibold text-[#7A9076] hover:underline"
                >
                  Edit Requirement
                </button>
                {editable && (
                  <button
                    onClick={() => setEditLineOpen(true)}
                    className="text-xs font-semibold text-[#7A9076] hover:underline"
                  >
                    Edit This Line
                  </button>
                )}
                <button
                  onClick={() => setAddProductOpen(true)}
                  className="text-xs font-semibold text-[#7A9076] hover:underline"
                >
                  + Add Product
                </button>
                <button
                  onClick={() => setCloseOpen(true)}
                  className="text-xs font-semibold text-orange-500 hover:underline"
                >
                  Close Requirement
                </button>
              </div>
            )}
          </div>

          <div className="px-5 py-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div>
                <p className="text-xs text-[#999] mb-0.5">
                  Requirement Reference
                </p>
                <p className="text-sm font-semibold text-[#7A9076]">
                  {line.requirementReference || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#999] mb-0.5">Requirement Status</p>
                <StatusPill status={line.requirementStatus} />
              </div>
              <div>
                <p className="text-xs text-[#999] mb-0.5">Line Status</p>
                <StatusPill status={line.lineStatus} />
              </div>
              {infoFields.map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-[#999] mb-0.5">{label}</p>
                  <p className="text-sm font-semibold text-[#333333]">
                    {value}
                  </p>
                </div>
              ))}
              <div className="sm:col-span-2 lg:col-span-3">
                <p className="text-xs text-[#999] mb-0.5">Reason</p>
                <p className="text-sm font-semibold text-[#333333]">
                  {reasonLabel(line.reasonCode) || "—"}
                </p>
              </div>
              {line.notes && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <p className="text-xs text-[#999] mb-0.5">Notes</p>
                  <p className="text-sm text-[#333333] whitespace-pre-wrap">
                    {line.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {isClosed && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 text-sm font-medium text-gray-500">
            This requirement is <strong>CLOSED</strong> and cannot be modified.
          </div>
        )}

        {/* Order Remaining action */}
        {!isClosed && (
          <div className="bg-white rounded-xl border border-[#E6ECE2] px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-[#333333]">
                Order Remaining
              </p>
              <p className="text-xs text-[#666666] mt-0.5">
                {orderable
                  ? `${line.remainingToOrder} remaining to order · ${line.remainingToReceive} awaiting receipt`
                  : "Nothing left to order on this line."}
              </p>
            </div>
            <button
              onClick={handleOrderRemaining}
              disabled={!orderable || busy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#B6C8AF] text-[#333333] px-3.5 py-2 text-sm font-semibold hover:bg-[#E6ECE2] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Order Remaining
            </button>
          </div>
        )}

        {/* Purchase order history */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden flex-shrink-0">
          <div className="px-5 py-3 border-b border-[#E6ECE2]">
            <p className="text-xs font-bold text-[#666666] uppercase tracking-wide">
              Purchase Order History
            </p>
          </div>
          {line.purchaseOrders.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-[#999]">
              No purchase orders have been created for this requirement yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="bg-[#E6ECE2]/50 text-left">
                    <th className="px-4 py-3 font-semibold text-[#333333]">
                      PO Number
                    </th>
                    <th className="px-4 py-3 font-semibold text-[#333333]">
                      Supplier
                    </th>
                    <th className="px-4 py-3 font-semibold text-[#333333]">
                      Status
                    </th>
                    <th className="px-4 py-3 font-semibold text-[#333333] text-right">
                      Allocated
                    </th>
                    <th className="px-4 py-3 font-semibold text-[#333333] text-right">
                      Ordered
                    </th>
                    <th className="px-4 py-3 font-semibold text-[#333333] text-right">
                      Received
                    </th>
                    <th className="px-4 py-3 font-semibold text-[#333333] text-right">
                      Outstanding
                    </th>
                    <th className="px-4 py-3 font-semibold text-[#333333] text-right">
                      Unit Cost
                    </th>
                    <th className="px-4 py-3 font-semibold text-[#333333]">
                      Order Date
                    </th>
                    <th className="px-4 py-3 font-semibold text-[#333333]">
                      Expected Delivery
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {line.purchaseOrders.map((po, idx) => (
                    <tr
                      key={`${po.id}-${idx}`}
                      className={idx % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/20"}
                    >
                      <td className="px-4 py-3">
                        {po.purchaseOrderId ? (
                          <button
                            onClick={() =>
                              navigate(
                                `/purchasing/orders/${po.purchaseOrderId}`,
                              )
                            }
                            className="font-semibold text-[#7A9076] hover:underline"
                          >
                            {po.purchaseOrderNumber || "—"}
                          </button>
                        ) : (
                          <span className="font-semibold text-[#333333]">
                            {po.purchaseOrderNumber || "—"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#333333]">
                        {po.supplierName}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={po.status as POStatus} />
                      </td>
                      <td className="px-4 py-3 text-right text-[#666666]">
                        {po.quantityAllocated}
                      </td>
                      <td className="px-4 py-3 text-right text-[#333333]">
                        {po.quantityOrdered}
                      </td>
                      <td className="px-4 py-3 text-right text-[#333333]">
                        {po.quantityReceived}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[#7A9076]">
                        {po.outstandingQuantity}
                      </td>
                      <td className="px-4 py-3 text-right text-[#333333]">
                        {fmtMoney(po.unitCost)}
                      </td>
                      <td className="px-4 py-3 text-[#666666] whitespace-nowrap">
                        {fmtDate(po.orderDate)}
                      </td>
                      <td className="px-4 py-3 text-[#666666] whitespace-nowrap">
                        {fmtDate(po.expectedDeliveryDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <EditRequirementModal
        open={editReqOpen}
        requiredBy={line.requiredBy ? line.requiredBy.slice(0, 10) : ""}
        notes={line.notes}
        onClose={() => setEditReqOpen(false)}
        onSave={(updates) => {
          setEditReqOpen(false)
          if (!line.requirementId) {
            setApiError("This line is missing its parent requirement id.")
            return
          }
          void runAction(
            () =>
              updateRequirement(line.requirementId, {
                ...(updates.requiredBy
                  ? { requiredBy: updates.requiredBy }
                  : {}),
                notes: updates.notes,
              }),
            "Requirement updated successfully.",
          )
        }}
      />
      <EditLineModal
        open={editLineOpen}
        line={editLineTarget}
        onClose={() => setEditLineOpen(false)}
        onSave={handleSaveLine}
      />
      <AddProductModal
        open={addProductOpen}
        existingProductIds={[line.productId]}
        onClose={() => setAddProductOpen(false)}
        onAdd={(input) => {
          setAddProductOpen(false)
          if (!line.requirementId) {
            setApiError("This line is missing its parent requirement id.")
            return
          }
          void runAction(
            () => addRequirementLine(line.requirementId, input),
            "Product added to requirement.",
          )
        }}
      />
      <ConfirmModal
        open={closeOpen}
        title="Close Requirement?"
        message={`Are you sure you want to close ${line.requirementReference || "this requirement"}?`}
        detail="Closed requirements cannot be modified. All lines will be marked CLOSED."
        confirmLabel="Close Requirement"
        confirmClass="bg-orange-600 hover:bg-orange-700 text-white"
        onClose={() => setCloseOpen(false)}
        onConfirm={() => {
          setCloseOpen(false)
          if (!line.requirementId) return
          void runAction(
            () => closeRequirement(line.requirementId),
            "Requirement closed successfully.",
          )
        }}
        loading={busy}
      />
      <OrderPreviewModal
        open={!!orderPreview}
        line={
          orderPreview
            ? {
                id: orderPreview.line.id,
                productName: orderPreview.line.productName,
                productSku: orderPreview.line.productSku,
                unitName: orderPreview.line.unitName,
                remainingToOrder: orderPreview.line.remainingToOrder,
              }
            : null
        }
        preview={orderPreview?.preview ?? null}
        onClose={() => setOrderPreview(null)}
        onCreatePO={(quantity, unitCost, expectedDeliveryDate, notes) => {
          setOrderPreview(null)
          navigateToCreatePO(quantity, unitCost, expectedDeliveryDate, notes)
        }}
      />
    </div>
  )
}
