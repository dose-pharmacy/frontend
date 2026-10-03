// ── Finance design tokens ────────────────────────────────────────────────────
// ONE definition of the Finance module's visual language, shared by the Overview
// and Reports pages so the two cannot drift apart.
//
// Tailwind note: every class string here is written out in full and literally.
// Nothing is assembled by interpolation (e.g. `bg-${tone}-50`) because Tailwind
// scans source text for complete class names and would never see a built one.
//
// Palette source is `src/index.css` `@theme` — this project overrides Tailwind's
// stock scales with desaturated sage-tinted values, so `text-green-700` here is
// #4A6342, not stock green. The app currently has NO dark mode (no `dark:`
// variants or `prefers-color-scheme` anywhere), so these are light-surface
// tokens; routing every colour through this map is what keeps a future dark
// theme a one-file change rather than an audit of both pages.

/** Semantic tone. Meaning is identical on both pages. */
export type Tone = "neutral" | "positive" | "negative" | "warning";

/**
 * Finance colour semantics, per the module's rules:
 *   green  = money in / profit
 *   red    = returns / discounts / negative
 *   amber  = outstanding / expiring
 *   blue   = volume (units, quantities)
 *   grey   = counts
 */
export const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-text-primary",
  positive: "text-green-700",
  negative: "text-red-700",
  warning: "text-yellow-700",
};

export const TONE_SURFACE: Record<Tone, string> = {
  neutral: "bg-canvas",
  positive: "bg-green-50",
  negative: "bg-red-50",
  warning: "bg-yellow-50",
};

export const TONE_BORDER: Record<Tone, string> = {
  neutral: "border-gray-200",
  positive: "border-green-200",
  negative: "border-red-200",
  warning: "border-yellow-200",
};

/**
 * The solid-fill class for each tone, for progress bars and bar segments.
 *
 * Kept as its own map rather than derived by swapping `text-` for `bg-` on a
 * text map: a string rewrite on a class name is invisible to Tailwind's scanner
 * if it ever runs at build time, and breaks silently the moment a tone's class
 * stops starting with `text-`.
 */
export const TONE_BAR: Record<Tone, string> = {
  neutral: "bg-accent",
  positive: "bg-green-600",
  negative: "bg-red-600",
  warning: "bg-yellow-600",
};

/** Chart series fills. Fixed order so a colour means the same measure everywhere. */
export const SERIES = {
  netSales: "#5C7A52",
  grossProfit: "#7A9076",
  grossSales: "#8FAC80",
  collections: "#6F8CA6",
  supplierPayments: "#AC7042",
  supplierReturns: "#B06B66",
  discounts: "#C18782",
  customerReturns: "#9A5550",
  volume: "#8AA5BC",
  neutral: "#B0B0A8",
} as const;

/**
 * Expiry-bucket severity ramp, red (worst) → amber → green (safest).
 *
 * Keyed by the backend's own bucket keys. Anything unrecognised falls back to
 * `neutral` rather than being dropped, because the API does not constrain
 * `expiryBuckets[].key` to an enum and may add buckets.
 */
export function expirySeverityColor(key: string): string {
  const k = key.toUpperCase();
  if (k.includes("EXPIRED")) return "#9A5550";
  if (k.includes("0_30") || k === "DAYS_0_30") return "#C7A06D";
  if (k.includes("31_90")) return "#B39C45";
  if (k.includes("91_180")) return "#8FAC80";
  if (k.includes("180")) return "#5C7A52";
  return "#8C8C84";
}

/** Type scale. Named so a size is never re-invented as a random px value. */
export const TEXT = {
  pageTitle: "text-xl font-bold text-text-primary",
  sectionTitle: "text-sm font-bold text-text-primary",
  cardLabel: "text-xs font-medium uppercase tracking-wide text-text-secondary",
  cardValue: "text-2xl font-bold leading-tight tabular-nums",
  heroValue: "text-3xl font-bold leading-none tabular-nums",
  hint: "text-xs text-text-secondary",
  meta: "text-xs text-text-muted",
} as const;

/** The single card shell: one radius, one border, one padding everywhere. */
export const CARD = "rounded-xl border border-gray-200 bg-white";

export const GRID = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4";