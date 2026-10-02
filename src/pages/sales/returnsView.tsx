// ── Shared customer-return presentation helpers ─────────────────────────────
// Formatting and small building blocks shared by the return screen, the return
// register and the return detail view, so a refund, a restock state or a batch
// figure is rendered identically wherever it appears.
//
// Everything here is pure presentation over values the backend returned. Two
// rules are load-bearing:
//
//   • No refund is derived. The API publishes `refundAmount`, `netUnitPrice` and
//     `amountReturnable` because refunds come from the ORIGINAL sale, not from
//     today's product price. Nothing in this file multiplies a current price by a
//     quantity.
//   • A missing value renders as "—" rather than as 0. A return with no lines
//     published is not a return that restocked nothing.

import { fmtDate, fmtNumber } from "../../utils/format";
import type {
  RefundMethod,
  ReturnInfoBatchAllocation,
  ReturnItem,
} from "../../features/sales/returnsApi";
import { REFUND_METHOD_OPTIONS } from "../../features/sales/returnsApi";
import { paymentMethodLabel, plural } from "./saleView";

// ── Filters ──────────────────────────────────────────────────────────────────

/**
 * Refund-method filter options. The values come straight from the published
 * enum via `REFUND_METHOD_OPTIONS`, so this list cannot offer a method the
 * backend would reject. The labels are shared with the sale payment labels,
 * which already cover the identical three-value enum.
 */
export const REFUND_METHOD_FILTERS: { value: "" | RefundMethod; label: string }[] = [
  { value: "", label: "All methods" },
  ...REFUND_METHOD_OPTIONS.map((m) => ({
    value: m,
    label: paymentMethodLabel(m),
  })),
];

/**
 * The `restock` filter. The API's parameter is a STRING enum (`true` | `false`),
 * so these values are the wire literals rather than booleans.
 */
export const RESTOCK_FILTERS: { value: "" | "true" | "false"; label: string }[] = [
  { value: "", label: "All" },
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
];

// ── Domain helpers ───────────────────────────────────────────────────────────

/** "Tablet (TAB)" — the unit name with its symbol when the API supplies one. */
export function unitLabel(
  unit: { name?: string | null; symbol?: string | null } | null | undefined,
): string {
  const name = unit?.name?.trim();
  if (!name) return "—";
  const symbol = unit?.symbol?.trim();
  return symbol ? `${name} (${symbol})` : name;
}

/**
 * Whether a return restocked anything, read from the per-line `restock` flags
 * the backend published. A single return can legitimately mix both (one line
 * returned to shelf, one line discarded), which is reported as "Mixed" rather
 * than collapsed into a single yes/no. A return whose items were not published
 * is "—" — not "No".
 */
export type RestockState = "yes" | "no" | "mixed" | "unknown";

export function restockState(
  items: readonly Pick<ReturnItem, "restock">[] | null | undefined,
): RestockState {
  if (!items || items.length === 0) return "unknown";
  const restocked = items.filter((i) => i.restock === true).length;
  if (restocked === 0) return "no";
  if (restocked === items.length) return "yes";
  return "mixed";
}

const RESTOCK_TONE: Record<RestockState, string> = {
  yes: "bg-green-50 text-green-700",
  no: "bg-gray-100 text-gray-600",
  mixed: "bg-amber-50 text-amber-800",
  unknown: "bg-gray-100 text-gray-500",
};

const RESTOCK_TEXT: Record<RestockState, string> = {
  yes: "Yes",
  no: "No",
  mixed: "Mixed",
  unknown: "—",
};

/** The register's "Restocked" cell and the detail header's stock line. */
export function RestockBadge({
  items,
  className = "",
}: {
  items: readonly Pick<ReturnItem, "restock">[] | null | undefined;
  className?: string;
}) {
  const state = restockState(items);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        RESTOCK_TONE[state]
      } ${className}`}
      title={
        state === "unknown"
          ? "The API returned no item lines for this return"
          : state === "mixed"
            ? "Some returned lines were restocked and some were not"
            : undefined
      }
    >
      {RESTOCK_TEXT[state]}
    </span>
  );
}

/**
 * The "Items" column: a count of returned lines. When the API published no lines
 * the cell shows "—" with a tooltip, matching how the sales table handles a list
 * row that arrives without item detail.
 */
export function ReturnItemCount({ items }: { items: ReturnItem[] | null | undefined }) {
  const count = items?.length ?? 0;
  if (count === 0) {
    return (
      <span className="text-[#999999]" title="The API returned no item lines for this return">
        —
      </span>
    );
  }
  return <span title={plural(count, "returned line")}>{fmtNumber(count)}</span>;
}

/**
 * The batches a sale line was sold from, with how much of each is still
 * returnable. Rendered only when the API supplied allocations — no batch is ever
 * synthesised from a product's current stock.
 */
export function BatchTable({
  allocations,
}: {
  allocations: ReturnInfoBatchAllocation[] | null | undefined;
}) {
  if (!allocations || allocations.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs min-w-[440px]">
        <thead>
          <tr className="border-b border-[#E6ECE2] text-left text-[#999999]">
            <th className="px-3 py-2 font-semibold">Batch</th>
            <th className="px-3 py-2 font-semibold">Expiry</th>
            <th className="px-3 py-2 text-right font-semibold">Sold from batch</th>
            <th className="px-3 py-2 text-right font-semibold">Already returned</th>
            <th className="px-3 py-2 text-right font-semibold">Returnable</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E6ECE2]">
          {allocations.map((b) => (
            <tr key={b.batchId}>
              <td className="px-3 py-2 font-semibold text-[#333333] whitespace-nowrap">
                <span className="inline-flex items-center gap-2">
                  {b.batchNumber || "—"}
                  {b.expired && (
                    <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">
                      Expired
                    </span>
                  )}
                </span>
              </td>
              <td className="px-3 py-2 text-[#666666] whitespace-nowrap">
                {b.expiryDate ? fmtDate(b.expiryDate) : "—"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-[#666666]">
                {fmtNumber(b.baseQuantity)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-[#666666]">
                {fmtNumber(b.baseQuantityReturned)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold text-[#333333]">
                {fmtNumber(b.baseQuantityReturnable)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
