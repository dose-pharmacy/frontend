import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router"
import Button from "../../components/ui/Button"
import PageHeader from "../../components/ui/PageHeader"
import { getBatch } from "../../features/inventory/batchesApi"
import {
  getPurchaseReturn,
  PurchaseReturnsApiError,
  type PurchaseReturnDto,
  type PurchaseReturnReason,
} from "../../features/purchasing/purchaseReturnsApi"
import { useReturnLabels } from "./purchaseReturnLabels"

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

function fmtDate(value: string | null | undefined): string {
  if (!value) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "—"
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function fmtDateTime(value: string | null | undefined): string {
  if (!value) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "—"
  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function fmtMoney(value: number | null | undefined): string {
  return `${Number(value ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ETB`
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-[#666666]">{label}</p>
      <div className="font-semibold text-[#333333]">{children}</div>
    </div>
  )
}

export default function PurchaseReturnDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [record, setRecord] = useState<PurchaseReturnDto | null>(null)
  const [batchNumber, setBatchNumber] = useState<string | null>(null)
  const [batchExpiry, setBatchExpiry] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setError("")
    getPurchaseReturn(id)
      .then((result) => {
        if (cancelled) return
        setRecord(result)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setRecord(null)
        const message =
          e instanceof PurchaseReturnsApiError
            ? e.status === 404
              ? "Purchase return not found."
              : e.message
            : e instanceof Error && e.message
              ? e.message
              : "Failed to load the purchase return."
        setError(message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  // The return record carries only `batchId`, so the batch number comes from the
  // existing batch endpoint rather than a field the return does not publish.
  useEffect(() => {
    const batchId = record?.batchId
    if (!batchId) {
      setBatchNumber(null)
      setBatchExpiry(null)
      return
    }
    let cancelled = false
    getBatch(batchId)
      .then((batch) => {
        if (cancelled) return
        setBatchNumber(batch.batchNumber)
        setBatchExpiry(batch.expiryDate)
      })
      .catch(() => {
        if (cancelled) return
        setBatchNumber(null)
        setBatchExpiry(null)
      })
    return () => {
      cancelled = true
    }
  }, [record?.batchId])

  const labelSources = useMemo(
    () =>
      record
        ? [
            {
              supplierId: record.supplierId,
              productId: record.productId,
              locationId: record.locationId,
            },
          ]
        : [],
    [record],
  )
  const labels = useReturnLabels(labelSources)

  if (loading) {
    return (
      <div className="flex-1 flex flex-col min-h-0">
        <PageHeader title="Purchase Return" subtitle="Loading..." />
        <div className="flex-1 flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-4 border-[#E6ECE2] border-t-[#B6C8AF] animate-spin" />
        </div>
      </div>
    )
  }

  if (error || !record) {
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
        subtitle={record.returnNumber}
        actions={
          <Button variant="secondary" onClick={() => navigate("/purchasing/returns")}>
            Back to Returns
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-white rounded-xl border border-[#E6ECE2] p-5 mb-5">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="Purchase Order">
              {record.purchaseOrderItem?.purchaseOrder.poNumber ?? "—"}
            </Field>

            <Field label="Supplier">
              {labels.ready ? labels.supplierName(record.supplierId) : "…"}
            </Field>

            <Field label="Product">
              {labels.ready ? labels.productName(record.productId) : "…"}
            </Field>

            <Field label="Batch">
              {record.batchId ? (
                <span className="font-mono text-xs">
                  {batchNumber ?? "…"}
                  {batchExpiry ? ` · Exp: ${fmtDate(batchExpiry)}` : ""}
                </span>
              ) : (
                "—"
              )}
            </Field>

            <Field label="Location">
              {labels.ready ? labels.locationName(record.locationId) : "…"}
            </Field>

            <Field label="Return Reason">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  REASON_BADGE[record.reason] ?? "bg-gray-100 text-gray-600"
                }`}
              >
                {REASON_LABELS[record.reason] ?? record.reason}
              </span>
            </Field>

            <Field label="Quantity">
              <span className="text-lg font-bold">{record.quantity}</span>
              <span className="ml-1 text-xs font-normal text-[#666666]">base units</span>
            </Field>

            <Field label="Unit Cost">
              <span className="text-lg font-bold">{fmtMoney(record.unitCost)}</span>
            </Field>

            <Field label="Debit Note Amount">
              <span className="text-lg font-bold text-red-600">
                {fmtMoney(record.debitNoteAmount)}
              </span>
            </Field>

            <Field label="Applied to Payable">
              <span className="text-lg font-bold text-[#4F6B4A]">
                {fmtMoney(record.appliedToPayable)}
              </span>
            </Field>

            <Field label="Returned">
              <span className="font-semibold">{fmtDate(record.createdAt)}</span>
              <span className="block text-xs font-normal text-[#666666]">
                {fmtDateTime(record.createdAt)}
              </span>
            </Field>

            <Field label="Purchase Order Item">
              <span className="font-mono text-xs text-[#666666]">
                {record.purchaseOrderItemId ?? "—"}
              </span>
            </Field>

            {record.purchaseOrderItem && (
              <Field label="Received on that item">
                <span className="font-semibold">
                  {record.purchaseOrderItem.quantityReceived}
                </span>
              </Field>
            )}

            {record.notes && (
              <div className="col-span-2 sm:col-span-4">
                <p className="text-xs text-[#666666]">Notes</p>
                <p className="font-medium text-[#333333] whitespace-pre-wrap">{record.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* No delete/reversal affordance on purpose. Verified against the
            deployed backend:

              • The only DELETE route in the Swagger contract,
                `DELETE /purchasing/purchase-order-items/{purchaseOrderItemId}/returnable`,
                is NOT registered — a live probe returns 404 at the routing layer
                while the sibling GET on the same path returns 401. Its Swagger
                declaration is also self-inconsistent (path template
                `{purchaseOrderItemId}`, declared parameter `id`).

              • A router probe does show an UNDOCUMENTED
                `DELETE /purchasing/purchase-returns/{id}` (control:
                `DELETE /purchasing/purchase-orders/{id}`, which is GET/PATCH
                only, correctly 404s).

            The undocumented route's effect on the RETURN_TO_SUPPLIER stock
            movement and the payable application is unverified, and no test
            credentials are available to verify it. Wiring an irreversible
            stock-and-money action on an unverified contract is the one thing
            §27/§31 rule out, so the button stays removed. Backend team: please
            document the route and state whether it reverses the stock ledger. */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] p-5">
          <p className="text-xs font-bold text-[#666666] uppercase tracking-wide mb-3">
            Record status
          </p>
          <p className="text-xs text-[#666666] max-w-3xl">
            Recording a purchase return is a single atomic backend transaction: it creates the
            return, reduces stock through a RETURN_TO_SUPPLIER movement, applies the return value
            against the purchase order's outstanding invoices, and writes the audit entry.
          </p>
          <p className="text-xs text-[#666666] max-w-3xl mt-2">
            No delete or reversal action is offered on this page. The delete route in the backend's
            published contract is not registered on the server, and an undocumented alternative
            has not been verified as safe for the stock ledger or the payable balance.
          </p>
        </div>
      </div>
    </div>
  )
}
