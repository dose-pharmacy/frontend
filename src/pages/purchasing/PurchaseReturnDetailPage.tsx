import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router"
import PageHeader from "../../components/ui/PageHeader"
import Button from "../../components/ui/Button"
import ConfirmationDialog from "../../components/ui/ConfirmationDialog"
import {
  deletePurchaseReturn,
  getPurchaseReturn,
  type PurchaseReturnDto,
  type PurchaseReturnReason,
} from "../../features/purchasing/purchaseReturnsApi"

function fmtDate(d: string | null | undefined) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function fmtMoney(n: number | null | undefined) {
  return `${Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`
}

const REASON_LABELS: Record<PurchaseReturnReason, string> = {
  EXPIRED: "Expired",
  DAMAGED: "Damaged",
  INCORRECT_DELIVERY: "Incorrect Delivery",
}

const REASON_BADGE: Record<PurchaseReturnReason, string> = {
  EXPIRED: "bg-red-100 text-red-700",
  DAMAGED: "bg-orange-100 text-orange-700",
  INCORRECT_DELIVERY: "bg-blue-100 text-blue-700",
}

export default function PurchaseReturnDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [returnRecord, setReturnRecord] = useState<PurchaseReturnDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState("")

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError("")
    getPurchaseReturn(id)
      .then((ret) => setReturnRecord(ret))
      .catch(() => setError("Failed to load purchase return."))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <PageHeader title="Purchase Return" subtitle="Loading..." />
        <div className="flex-1 flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-4 border-[#DBEFF3] border-t-[#49B0C1] animate-spin" />
        </div>
      </div>
    )
  }

  if (error || !returnRecord) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <PageHeader title="Purchase Return" subtitle="Not found" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-500 mb-3">{error || "Purchase return not found."}</p>
            <Button onClick={() => navigate("/purchasing/returns")}>Back to Returns</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb="Purchasing / Returns"
        title="Purchase Return"
        subtitle={returnRecord.returnNumber}
        actions={
          <Button variant="secondary" onClick={() => navigate("/purchasing/returns")}>Back to Returns</Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Header info */}
        <div className="bg-white rounded-xl border border-[#DBEFF3] p-5 mb-5">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-[#666666]">Supplier</p>
              <p className="font-semibold text-[#333333]">{returnRecord.supplier?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-[#666666]">Product</p>
              <p className="font-semibold text-[#333333]">{returnRecord.product?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-[#666666]">Batch</p>
              <p className="font-semibold text-[#333333] font-mono text-xs">
                {returnRecord.batch ? `${returnRecord.batch.batchNumber} · Exp: ${fmtDate(returnRecord.batch.expiryDate)}` : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#666666]">Location</p>
              <p className="font-semibold text-[#333333]">{returnRecord.location?.name ?? "—"}</p>
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <p className="text-xs text-[#666666]">Return Reason</p>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${REASON_BADGE[returnRecord.reason] ?? "bg-gray-100 text-gray-600"}`}>
                {REASON_LABELS[returnRecord.reason] ?? returnRecord.reason}
              </span>
            </div>
            <div>
              <p className="text-xs text-[#666666]">Quantity</p>
              <p className="text-lg font-bold text-[#333333]">{returnRecord.quantity}</p>
            </div>
            <div>
              <p className="text-xs text-[#666666]">Unit Cost</p>
              <p className="text-lg font-bold text-[#333333]">{fmtMoney(returnRecord.unitCost)}</p>
            </div>
            <div>
              <p className="text-xs text-[#666666]">Debit Note Amount</p>
              <p className="text-lg font-bold text-red-600">{fmtMoney(returnRecord.debitNoteAmount)}</p>
            </div>
            <div>
              <p className="text-xs text-[#666666]">Returned Date</p>
              <p className="font-semibold text-[#333333]">{fmtDate(returnRecord.returnedDate)}</p>
            </div>
            <div>
              <p className="text-xs text-[#666666]">Recorded By</p>
              <p className="font-semibold text-[#333333]">{returnRecord.recordedBy?.name ?? "—"}</p>
            </div>
            {returnRecord.notes && (
              <div className="col-span-2 sm:col-span-4">
                <p className="text-xs text-[#666666]">Notes</p>
                <p className="font-medium text-[#333333]">{returnRecord.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Immutability note */}
        <div className="bg-white rounded-xl border border-[#DBEFF3] p-5">
          <p className="text-xs font-bold text-[#666666] uppercase tracking-wide mb-3">Actions</p>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="text-xs text-[#666666] max-w-2xl">
              Purchase returns are permanent — the RETURN_TO_SUPPLIER stock reduction was applied when
              the return was recorded and is preserved for the stock-ledger audit trail. Deleting the
              record does <strong>not</strong> restore stock; a reversal requires an administrator.
            </span>
            {deleteError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{deleteError}</p>
            )}
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => navigate("/purchasing/returns")}>Back to Returns</Button>
              <button
                disabled={deleting}
                onClick={() => { setDeleteOpen(true); setDeleteError("") }}
                className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-150 border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Delete Return
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmationDialog
        open={deleteOpen}
        title="Delete Purchase Return?"
        message={`Delete return ${returnRecord.returnNumber}? Deletion does NOT restore stock — the stock movement already recorded in the ledger stays in place and the record would only be removed from this view. The system blocks deletion because it would break the stock-ledger audit trail.`}
        confirmLabel={deleting ? "Deleting…" : "Delete Return"}
        danger
        loading={deleting}
        onConfirm={() => {
          if (!id) return
          setDeleting(true)
          setDeleteError("")
          deletePurchaseReturn(id)
            .then(() => navigate("/purchasing/returns"))
            .catch((e: unknown) =>
              setDeleteError(e instanceof Error ? e.message : "The return could not be deleted."),
            )
            .finally(() => {
              setDeleting(false)
              setDeleteOpen(false)
            })
        }}
        onCancel={() => { setDeleteOpen(false); setDeleteError("") }}
      />
    </div>
  )
}