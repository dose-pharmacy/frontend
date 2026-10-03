// ── Finance · derived chart data ─────────────────────────────────────────────
// Pure transforms from an API response into chart-ready series. Every function
// here is memoised at the call site with `useMemo` so a filter chip toggling or
// a tooltip opening does not re-derive the whole page's data.
//
// THE RULE THAT MATTERS MOST IN THIS FILE
// The backend deliberately emits EVERY trend bucket in the window, including
// empty ones as zeroes. That is correct data, not missing data. So "is there
// anything to draw?" is a question about VALUES, not about bucket COUNT — the
// previous implementation asked `points.length === 0`, which is why a window of
// all-zero buckets rendered as a blank white rectangle: two buckets, two
// zero-height bars, two dotless lines pinned to a collapsed [0,0] axis, and no
// empty state because `points.length` was 2.

import { useMemo } from "react";
import type {
  FinanceInventoryBucket,
  FinanceReport,
  FinanceTrendPoint,
  PaymentMethodTotal,
  SalesLocationBreakdown,
  SalesProductGroupBreakdown,
} from "../../features/finance/financeReportingApi";
import { bucketLabel, expiryBucketLabel } from "./financeReportsView";

/**
 * Numeric guard for values read off a response or a tooltip payload.
 *
 * Returns `null` for anything that is not a usable number, and `null` is NOT
 * zero — the distinction the whole module depends on, since a missing figure
 * must render as "—" while a real zero must render as 0.00.
 *
 * The explicit type checks are load-bearing: JavaScript's `Number()` coerces
 * `null` to 0, `""` to 0 and `[]` to 0, so a naive `Number(value)` would
 * silently turn every absent value into a healthy-looking zero and make a
 * missing series look like a quiet one.
 */
export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** One trend point, with its display label attached. Values are untouched. */
export interface TrendDatum extends FinanceTrendPoint {
  label: string;
}

// ─── Trends ──────────────────────────────────────────────────────────────────

export function useTrendData(report: FinanceReport | null) {
  return useMemo(() => {
    const trends = report?.trends;
    const granularity = trends?.granularity ?? "MONTH";
    const points: TrendDatum[] = (trends?.points ?? []).map((p) => ({
      ...p,
      label: bucketLabel(p.period, granularity),
    }));
    return { trends, granularity, points };
  }, [report]);
}

/** The money series plotted on the trends chart. Backend values, verbatim. */
const TREND_MONEY_KEYS = [
  "grossSales",
  "netSales",
  "netSalesAfterReturns",
  "grossProfit",
  "customerCollections",
  "supplierPayments",
  "supplierReturns",
] as const;

/**
 * Whether ANY bucket carries a non-zero money value.
 *
 * Distinguishes "the server sent no buckets" (a genuine empty state) from "the
 * server sent buckets and they are all zero" (real, plottable data that happens
 * to be flat). Only the former warrants an empty state; the latter must still
 * render its axes and its zero line.
 *
 * An ABSENT field counts as zero here, deliberately: a bucket where nothing was
 * reported has nothing to draw, which is the same visual situation as a bucket
 * of zeroes. (`null !== 0` is true, so this must be an explicit zero-coalesce —
 * testing `toFiniteNumber(x) !== 0` would report a completely empty bucket as
 * active and skip the "all buckets are zero" note.)
 */
export function trendsHaveActivity(points: TrendDatum[]): boolean {
  return points.some((p) => TREND_MONEY_KEYS.some((k) => (toFiniteNumber(p[k]) ?? 0) !== 0));
}

/**
 * Largest plotted value, floored at 1.
 *
 * A zero-height domain makes recharts collapse the Y axis, which is what left
 * the flat line hugging the baseline and looking like nothing at all. Flooring
 * the domain gives the zeros somewhere to be seen.
 */
export function trendAxisMax(points: TrendDatum[]): number {
  let max = 0;
  for (const p of points) {
    for (const k of TREND_MONEY_KEYS) {
      const v = toFiniteNumber(p[k]);
      if (v !== null && v > max) max = v;
    }
  }
  return max > 0 ? max * 1.15 : 1;
}

/**
 * Whether a line chart is the right mark.
 *
 * A line encodes a trend BETWEEN points, so with one bucket there is no trend to
 * draw — and with dots disabled the single value is invisible. Below three
 * buckets the caller switches to bars, where every value is drawn as a length.
 */
export function shouldUseBars(pointCount: number): boolean {
  return pointCount < 3;
}

/**
 * A nudge toward a granularity that suits the range. `null` when the current
 * choice is already fine.
 */
export function granularityHint(pointCount: number, granularity: string): string | null {
  if (pointCount === 0) return null;
  if (granularity === "DAY") return null;
  if (pointCount <= 2) {
    return `Only ${pointCount} ${GRANULARITY_NOUN[granularity] ?? granularity} bucket${
      pointCount === 1 ? "" : "s"
    } in this range — switch to Day for a readable trend.`;
  }
  if (pointCount <= 5 && granularity === "YEAR") {
    return `Only ${pointCount} yearly buckets in this range — switch to Month for a readable trend.`;
  }
  return null;
}

const GRANULARITY_NOUN: Record<string, string> = { DAY: "daily", MONTH: "monthly", YEAR: "yearly" };

// ─── Payment methods ─────────────────────────────────────────────────────────

export interface PaymentDatum {
  method: string;
  amount: number;
  /** Share of the returned total, 0-100. Chart geometry only — never a balance. */
  pct: number;
}

/**
 * Payment methods with their share of the returned total.
 *
 * Rendered from whatever the API returned. The percentage is derived for the
 * legend/label only; the amount shown is the backend's own figure.
 */
export function paymentData(methods: PaymentMethodTotal[] | undefined): PaymentDatum[] {
  const rows = methods ?? [];
  const total = rows.reduce((s, r) => s + (toFiniteNumber(r.amount) ?? 0), 0);
  return rows.map((r) => {
    const amount = toFiniteNumber(r.amount) ?? 0;
    return {
      method: r.method,
      amount,
      pct: total > 0 ? (amount / total) * 100 : 0,
    };
  });
}

// ─── Breakdowns ──────────────────────────────────────────────────────────────

/**
 * Top N rows by a money key, descending.
 *
 * Sorting is presentational (which rows fit on screen) and the full sorted set
 * stays reachable behind "View all", so no figure is dropped — only ordered.
 * A copy is sorted so the response array is never mutated.
 */
export function topBy<T>(rows: T[], key: (r: T) => number | undefined, n: number): T[] {
  return [...rows]
    .sort((a, b) => (toFiniteNumber(key(b)) ?? 0) - (toFiniteNumber(key(a)) ?? 0))
    .slice(0, n);
}

export function useLocationRows(data: FinanceReport | null) {
  return useMemo(() => {
    const rows: SalesLocationBreakdown[] = data?.salesPerformance?.byLocation ?? [];
    return { all: [...rows].sort((a, b) => (b.netSales ?? 0) - (a.netSales ?? 0)), top: topBy(rows, (r) => r.netSales, 8) };
  }, [data]);
}

export function useProductGroupRows(data: FinanceReport | null) {
  return useMemo(() => {
    const rows: SalesProductGroupBreakdown[] = data?.salesPerformance?.byProductGroup ?? [];
    return {
      all: [...rows].sort((a, b) => (b.lineRevenue ?? 0) - (a.lineRevenue ?? 0)),
      top: topBy(rows, (r) => r.lineRevenue, 8),
    };
  }, [data]);
}

// ─── Expiry buckets ──────────────────────────────────────────────────────────

export interface ExpiryDatum {
  key: string;
  label: string;
  value: number;
  quantity: number;
}

/**
 * Expiry buckets with friendly labels.
 *
 * Order is PRESERVED from the response: the backend chooses the bucket sequence
 * and its severity ramp, and re-sorting would put the buckets in an order the
 * server did not intend.
 */
export function useExpiryData(data: FinanceReport | null) {
  return useMemo(() => {
    const buckets: FinanceInventoryBucket[] = data?.inventoryValue?.expiryBuckets ?? [];
    return buckets.map((b) => ({
      key: b.key ?? "",
      label: expiryBucketLabel(b.key ?? ""),
      value: toFiniteNumber(b.value) ?? 0,
      quantity: toFiniteNumber(b.quantity) ?? 0,
    }));
  }, [data]);
}

/**
 * True when every "today" activity figure is a real zero (not merely absent).
 *
 * Used to show a plain-language "nothing recorded yet today" note instead of a
 * wall of 0.00 ETB cards. The cards still render either way.
 */
export function allTodayZero(values: (number | undefined)[]): boolean {
  return values.every((v) => v === 0);
}