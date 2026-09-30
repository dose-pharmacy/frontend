/**
 * Per-product receiving/value boxes shown below the Order Items table on an
 * existing purchase order (View and Edit modes) — one card per product:
 *
 *   Paracetamol 500mg
 *   Para-001
 *
 *   Ordered       40 Tablet
 *   Received      30 Tablet
 *   Remaining     10 Tablet
 *
 *   Unit Cost         50 ETB
 *   Ordered Value   2,000 ETB
 *   Received Value  1,500 ETB
 *
 * All values are precomputed by the caller (from the purchase-order DTO), so
 * this component is purely presentational and easy to snapshot/test.
 */

export interface ReceivingDetailsRow {
  id: string
  name: string
  sku: string | null | undefined
  unitLabel: string
  ordered: number
  received: number
  remaining: number
  unitCost: number
}

function fmtMoney(n: number) {
  return `${n.toLocaleString("en-ET")} ETB`
}

function Row({
  label,
  value,
  valueClass = "font-semibold text-[#333333]",
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="flex justify-between">
      <span className="text-[#666666]">{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  )
}

export default function OrderItemReceivingDetails({
  items,
}: {
  items: ReceivingDetailsRow[]
}) {
  return (
    <div className="border-t border-[#E6ECE2] px-5 py-4 bg-[#E6ECE2]/20">
      <p className="text-xs font-bold text-[#666666] uppercase tracking-wide mb-3">
        Receiving Details
      </p>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl bg-white border border-[#E6ECE2] p-4"
          >
            <p className="font-semibold text-[#333333]">{item.name}</p>
            {item.sku && (
              <p className="text-xs text-[#999] font-mono mt-0.5">{item.sku}</p>
            )}
            <div className="mt-3 space-y-1.5 text-sm">
              <Row label="Ordered" value={`${item.ordered} ${item.unitLabel}`} />
              <Row
                label="Received"
                value={`${item.received} ${item.unitLabel}`}
                valueClass="font-semibold text-[#7A9076]"
              />
              <Row
                label="Remaining"
                value={`${item.remaining} ${item.unitLabel}`}
              />
            </div>
            <div className="mt-3 pt-3 border-t border-[#E6ECE2] space-y-1.5 text-sm">
              <Row label="Unit Cost" value={fmtMoney(item.unitCost)} valueClass="text-[#333333]" />
              <Row
                label="Ordered Value"
                value={fmtMoney(item.ordered * item.unitCost)}
                valueClass="text-[#333333]"
              />
              <Row
                label="Received Value"
                value={fmtMoney(item.received * item.unitCost)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}