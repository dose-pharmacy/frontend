// ── Expiry rules ───────────────────────────────────────────────────────────────
// The expiry arithmetic the Narcotics module shares.
//
// `daysUntilExpiry` is the application's existing inventory rule. Its canonical
// home is `features/inventory/inventoryService.ts` — but that module imports the
// whole mock layer (`./inventoryMock`) for its other exports, so a controlled-
// medicines compliance page must not import it. The identical calculation lives
// here instead, and the windows below are the ones already in use across the
// Inventory module:
//
//   • BatchManagementPage  → flags anything inside 30 days
//   • BatchesExpiryPage    → lists a 0–90 day "expiring soon" window
//   • ExpiryDashboardPage  → summarises 180 / 365 day windows
//
// No Narcotics-specific threshold was introduced; these are the app's rules,
// unchanged. See the module comment in `narcoticsView.tsx`.

/** Days until `dateStr`; negative once the date has passed. */
export function daysUntilExpiry(dateStr: string): number {
  const expiry = new Date(dateStr);
  if (Number.isNaN(expiry.getTime())) return Number.NaN;
  return Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

/** Upper bound, in days, for each named expiry window. */
export const EXPIRY_WINDOWS = {
  CRITICAL: 30,
  EXPIRING_SOON: 90,
  WARNING: 365,
} as const;