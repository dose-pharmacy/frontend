// ── Presentation-only helpers for the dashboard redesign ────────────────────
// Everything here is display formatting. No API data is changed, no business
// calculations are performed, no new statistics are introduced.

/** Splits "4,815.00 ETB" into amount + currency so the currency can be styled smaller. */
export function splitMoney(value: string): { amount: string; currency: string } {
  const index = value.lastIndexOf(" ")
  if (index === -1) return { amount: value, currency: "" }
  return { amount: value.slice(0, index), currency: value.slice(index + 1) }
}

/** Current stock as a fraction of the reorder point (0–1), for the visual stock bar. */
export function stockRatio(
  availableStock: number,
  reorderPoint: number,
): number {
  if (!reorderPoint || reorderPoint <= 0) return 0
  return Math.max(0, Math.min(1, availableStock / reorderPoint))
}

export type StockStatus = {
  label: "Critical" | "Low"
  tone: "red" | "amber"
  color: string
}

/** Presentation label for how far below the reorder point a product sits. */
export function stockStatus(ratio: number): StockStatus {
  if (ratio <= 0.1) return { label: "Critical", tone: "red", color: "#B0574A" }
  return { label: "Low", tone: "amber", color: "#D0A23C" }
}

/** "GOODS_RECEIVED" → "Goods received" (label only, the type itself is unchanged). */
export function activityTypeLabel(type: string): string {
  const text = type.replace(/_/g, " ").toLowerCase()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Batch id with the nearest expiry date — used only to emphasise it in the timeline. */
export function nearestExpiryBatchId(
  items: { batchId: string; expiryDate: string }[],
): string | null {
  let nearest: string | null = null
  let nearestTime = Infinity
  for (const item of items) {
    const time = new Date(item.expiryDate).getTime()
    if (!isNaN(time) && time < nearestTime) {
      nearestTime = time
      nearest = item.batchId
    }
  }
  return nearest
}
