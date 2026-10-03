// ── Finance Reports · filters, query building and label helpers ──────────────
// Kept free of React so the rules below can be reasoned about (and unit-checked)
// independently of rendering.
//
// Rules encoded here, so no section can quietly break them:
//   • A financial figure is never computed in the browser. `netSales`,
//     `netSalesAfterReturns`, `grossProfit`, `grossMargin`, `supplierOutstanding`
//     and every other derived money value are read straight off the response.
//   • `grossMargin` is a PERCENTAGE as sent (`20` means 20%), so it is displayed
//     through a pass-through formatter. Multiplying it by 100 would render a 20%
//     margin as "2000.0%".
//   • A zero is real data and renders as a zero. Only an ABSENT value renders
//     as "—", so a quiet day never looks like a failed request.
//   • Unset filters are OMITTED from the query, never sent blank.
//   • Date LABELS come from `period.fromDate` / `period.toDate`, which are
//     calendar days — never from the `from`/`to` UTC instants.

import type { FinanceGranularity, FinanceReport, FinanceReportSection } from "../../features/finance/financeReportingApi";
import { isFinanceGranularity } from "../../features/finance/financeReportingApi";
import { fmtCalendarDay } from "../../utils/format";
import { utcDayEnd, utcDayStart } from "./financeView";

// ─── Filter model ────────────────────────────────────────────────────────────

/**
 * The form state behind the filter toolbar.
 *
 * This is the DRAFT. It is deliberately separate from the applied query so that
 * typing in a date field or paging through the location list does not fire a
 * request on every keystroke — the request is built only from `applied`.
 */
export interface FinanceReportFilters {
  /** `YYYY-MM-DD`, or "" for "let the backend default". */
  from: string;
  /** `YYYY-MM-DD`, or "" for "let the backend default". */
  to: string;
  /** "" means All Locations — never the string "all", never a made-up id. */
  locationId: string;
  /** "" means All Product Groups. */
  productGroupId: string;
  granularity: FinanceGranularity;
}

/** `MONTH` is the endpoint's documented default. */
export const DEFAULT_REPORT_FILTERS: FinanceReportFilters = {
  from: "",
  to: "",
  locationId: "",
  productGroupId: "",
  granularity: "MONTH",
};

/** UI labels map onto the wire enum; only the enum is ever sent. */
export const GRANULARITY_OPTIONS: { value: FinanceGranularity; label: string }[] = [
  { value: "DAY", label: "Day" },
  { value: "MONTH", label: "Month" },
  { value: "YEAR", label: "Year" },
];

/**
 * Checks the filters BEFORE any request goes out, so an obviously invalid range
 * never reaches the API. Granularity is checked against the legal enum rather
 * than trusted, because a hand-edited URL or a stale stored value must not be
 * able to put an unsupported value in the query.
 */
export function validateReportFilters(filters: FinanceReportFilters): string | null {
  if (!isFinanceGranularity(filters.granularity)) {
    return "Granularity must be Day, Month or Year.";
  }
  if (filters.from && !/^\d{4}-\d{2}-\d{2}$/.test(filters.from)) {
    return "The From date is not a valid date.";
  }
  if (filters.to && !/^\d{4}-\d{2}-\d{2}$/.test(filters.to)) {
    return "The To date is not a valid date.";
  }
  if (filters.from && filters.to && filters.from > filters.to) {
    return "The From date must not be after the To date.";
  }
  return null;
}

/**
 * Turns the applied filters into request parameters.
 *
 * `from`/`to` are expanded to the INCLUSIVE UTC start/end of the chosen days, so
 * selecting 2026-10-03 keeps that whole day. Empty filters are OMITTED rather
 * than sent blank: `locationId` is declared `format: uuid`, so a blank or the
 * literal "all" fails validation with a 422. Blank date bounds let the backend
 * apply its own documented defaults (last 30 days → today).
 */
export function buildReportQuery(filters: FinanceReportFilters) {
  return {
    from: filters.from ? utcDayStart(filters.from) : undefined,
    to: filters.to ? utcDayEnd(filters.to) : undefined,
    locationId: filters.locationId || undefined,
    productGroupId: filters.productGroupId || undefined,
    granularity: filters.granularity,
  };
}

// ─── Effective range ─────────────────────────────────────────────────────────

/**
 * The range the BACKEND actually used, from `period.fromDate` → `period.toDate`.
 *
 * This is deliberately NOT reconstructed from the request, and NOT read from
 * `trends.from`/`trends.to`. Two reasons:
 *
 *  1. When the date fields are untouched nothing is sent and the backend applies
 *     its own default window — only the response knows what that was.
 *  2. `trends.from`/`trends.to` are UTC *instants*. Passing the inclusive
 *     end-of-day `2026-10-03T23:59:59.999Z` through a local-time formatter on a
 *     UTC+3 browser yields "04 Oct", reporting a day that was never queried.
 *     `fromDate`/`toDate` are already calendar days, so no conversion applies.
 *
 * Falls back to the `from`/`to` instants only if the calendar-day fields are
 * absent, and does so in UTC so the fallback cannot reintroduce the shift.
 */
export function effectiveRange(data: FinanceReport): { from: string; to: string; label: string } {
  const p = data.period;
  const fromDay = p?.fromDate;
  const toDay = p?.toDate;
  if (fromDay && toDay) {
    return { from: fromDay, to: toDay, label: `${fmtCalendarDay(fromDay)} – ${fmtCalendarDay(toDay)}` };
  }
  const from = p?.from;
  const to = p?.to;
  return {
    from: from ?? "",
    to: to ?? "",
    label: from && to ? `${fmtCalendarDay(from)} – ${fmtCalendarDay(to)}` : "—",
  };
}

// ─── Bucket labels ───────────────────────────────────────────────────────────

/** Human wording for a bucket width, for prose like "12 monthly buckets". */
export const GRANULARITY_WORD: Record<FinanceGranularity, string> = {
  DAY: "daily",
  MONTH: "monthly",
  YEAR: "yearly",
};

/**
 * X-axis label for a trend bucket.
 *
 * The backend returns the bucket already cut at the requested granularity
 * (`YYYY-MM-DD` / `YYYY-MM` / `YYYY`) and documents those as UTC boundaries, so
 * this is a pure string reshape — the value is never passed through
 * `new Date(dateISOString)`, which would reinterpret it in local time and can
 * shift a bucket into the neighbouring day.
 *
 * `granularity` comes from the RESPONSE, so a bucket is always labelled for the
 * width the backend actually used rather than the one that was requested.
 */
export function bucketLabel(period: string, granularity: FinanceGranularity): string {
  const parts = period.split("-");
  if (granularity === "YEAR") return parts[0] ?? period;
  if (parts.length < 2 || parts[0] === undefined) return period;
  const year = parts[0];
  const month = parts[1];
  if (granularity === "MONTH") {
    const name = new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toLocaleDateString("en-GB", {
      month: "short",
      timeZone: "UTC",
    });
    return `${name} ${year}`;
  }
  const day = parts[2];
  if (day === undefined) return period;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

/**
 * A human label for a raw expiry-bucket key.
 *
 * The API types `expiryBuckets[].key` as a free-form string with no enum, so this
 * maps the keys the backend actually sends and falls back to the raw key for
 * anything new rather than hiding a bucket the server chose to report.
 */
const EXPIRY_LABELS: Record<string, string> = {
  EXPIRED: "Expired",
  DAYS_0_30: "0–30 days",
  DAYS_31_90: "31–90 days",
  DAYS_91_180: "91–180 days",
  DAYS_180_PLUS: "180+ days",
};

export function expiryBucketLabel(key: string): string {
  return EXPIRY_LABELS[key?.toUpperCase()] ?? key ?? "";
}

// ─── Scope ───────────────────────────────────────────────────────────────────

/**
 * The scope basis for a report section, for the badge in its header.
 *
 * `COMPANY` means the figure ignores the location/product-group filter.
 */
export function scopeBasisOf(
  data: FinanceReport,
  section: FinanceReportSection,
): "REPORT_SCOPE" | "COMPANY" | undefined {
  return data.scopeNotes?.[section]?.basis;
}