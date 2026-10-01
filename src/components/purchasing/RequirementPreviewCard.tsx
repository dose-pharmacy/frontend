import {
  type RequirementActionDto,
  type RequirementPreviewAction,
} from "../../features/purchasing/requirementsApi"

function fmtQty(v: number): string {
  return Number.isInteger(v)
    ? String(v)
    : v.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

interface Props {
  /** Product name as the admin entered it in the form. */
  productLabel: string
  /** Unit the requested quantity is expressed in (empty = base unit). */
  unitLabel?: string
  /** Quantity the admin is requesting for this line. */
  quantity: number
  /**
   * The backend's per-line decision from `data.actions`. `undefined` means the
   * preview returned no decision for this line — the UI says so instead of
   * guessing CREATE or UPDATE.
   */
  action?: RequirementActionDto
}

function ActionBadge({ action }: { action?: RequirementPreviewAction }) {
  if (action === "CREATE") {
    return (
      <span className="shrink-0 rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
        CREATE
      </span>
    )
  }
  if (action === "UPDATE") {
    return (
      <span className="shrink-0 rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">
        UPDATE
      </span>
    )
  }
  return (
    <span className="shrink-0 rounded-full bg-[#E6ECE2] px-3 py-1 text-xs font-bold text-[#666666]">
      {action ? String(action) : "NO DECISION"}
    </span>
  )
}

/**
 * One product line inside a "Review Purchase Requirement" screen. The CREATE /
 * UPDATE state always comes from the backend preview (`data.actions`) — the
 * frontend never decides which one it is.
 */
export default function RequirementPreviewCard({
  productLabel,
  unitLabel,
  quantity,
  action,
}: Props) {
  const existing = action?.existingRequirement
  const name =
    productLabel || existing?.product || existing?.productName || "Product"
  const unit = unitLabel || existing?.unit?.name || existing?.unit?.symbol || ""
  const existingRef = existing?.requirementReference ?? existing?.reference
  const existingQtyNeeded =
    existing?.quantityNeeded ?? existing?.requiredQuantity
  const existingQtyOrdered =
    existing?.quantityOrdered ?? existing?.orderedQuantity
  const existingRemaining =
    existing?.remainingToOrder ??
    existing?.quantityRemaining ??
    existing?.remainingQuantity

  return (
    <div
      className={`rounded-xl border p-4 ${
        action?.action === "UPDATE"
          ? "border-orange-200 bg-orange-50/60"
          : "border-[#E6ECE2] bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#333333]">{name}</p>
          <div className="mt-0.5 space-y-0.5 text-xs text-[#666666]">
            {unit && <p>Unit: {unit}</p>}
            <p>
              Requested quantity: {fmtQty(quantity)}
              {unit ? ` ${unit}` : ""}
            </p>
          </div>
        </div>
        <ActionBadge action={action?.action} />
      </div>

      {action?.action === "UPDATE" && (
        <div className="mt-3 rounded-lg border border-orange-200 bg-white p-3">
          <p className="text-sm font-semibold text-orange-800">
            Existing open requirement
          </p>
          <p className="mt-0.5 text-xs text-[#666666]">
            This product already has an open purchase requirement. The existing
            requirement will be updated instead of creating a duplicate.
          </p>
          {existing &&
          (existingRef ||
            existingQtyNeeded != null ||
            existingQtyOrdered != null ||
            existingRemaining != null ||
            existing.status) ? (
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              {existingRef && (
                <div>
                  <dt className="text-[#666666]">Requirement</dt>
                  <dd className="font-semibold text-[#333333]">
                    {existingRef}
                  </dd>
                </div>
              )}
              {existingQtyNeeded != null && (
                <div>
                  <dt className="text-[#666666]">Current quantity needed</dt>
                  <dd className="font-semibold text-[#333333]">
                    {fmtQty(existingQtyNeeded)}
                    {existing?.unit?.name ? ` ${existing.unit.name}` : ""}
                  </dd>
                </div>
              )}
              {existingQtyOrdered != null && (
                <div>
                  <dt className="text-[#666666]">Quantity ordered</dt>
                  <dd className="font-semibold text-[#333333]">
                    {fmtQty(existingQtyOrdered)}
                  </dd>
                </div>
              )}
              {existingRemaining != null && (
                <div>
                  <dt className="text-[#666666]">Remaining to order</dt>
                  <dd className="font-semibold text-[#333333]">
                    {fmtQty(existingRemaining)}
                  </dd>
                </div>
              )}
              {existing.status && (
                <div>
                  <dt className="text-[#666666]">Status</dt>
                  <dd className="font-semibold text-[#333333]">
                    {existing.status}
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="mt-1.5 text-xs text-[#666666]">
              The backend will update this existing open requirement.
            </p>
          )}
        </div>
      )}

      {action?.action === "CREATE" && (
        <div className="mt-3 rounded-lg border border-green-200 bg-green-50/60 p-3">
          <p className="text-sm font-semibold text-green-800">
            New purchase requirement
          </p>
          <p className="mt-0.5 text-xs text-[#666666]">
            This product does not have an existing open requirement. A new
            requirement will be created.
          </p>
        </div>
      )}

      {!action?.action && (
        <p className="mt-2 text-xs text-[#666666]">
          No preview decision was returned for this product — the backend could
          not determine an action.
        </p>
      )}
    </div>
  )
}
