import type { PricingStatus } from "../../features/inventory/productsApi";

/**
 * Display labels for the backend's `pricingStatus` values. The mapping is
 * presentation only — the classification itself is always made by the backend.
 */
const LABELS: Record<PricingStatus, string> = {
  OK: "OK",
  BELOW_TARGET: "Below Target",
  BELOW_COST: "Below Cost",
  NO_MARGIN_CONFIG: "No Margin Config",
  NO_PURCHASE_COST: "No Purchase Cost",
};

const TONES: Record<PricingStatus, string> = {
  OK: "bg-green-50 text-green-700",
  BELOW_TARGET: "bg-yellow-50 text-yellow-700",
  BELOW_COST: "bg-red-50 text-red-700",
  // Both "cannot be evaluated" states are neutral, not failures — they mean
  // the inputs are missing, which is a data problem rather than a bad price.
  NO_MARGIN_CONFIG: "bg-gray-100 text-gray-600",
  NO_PURCHASE_COST: "bg-gray-100 text-gray-600",
};

interface Props {
  status: PricingStatus;
  /** Optional; omit for a bare badge. */
  className?: string;
}

/**
 * Compact badge for a product's pricing / target-margin warning.
 * Reused by the product detail page and the Products list.
 */
export default function PricingStatusBadge({ status, className = "" }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[status]} ${className}`}
    >
      {LABELS[status]}
    </span>
  );
}

/** Label lookup for contexts that need plain text rather than a badge. */
export function pricingStatusLabel(status: PricingStatus): string {
  return LABELS[status];
}
