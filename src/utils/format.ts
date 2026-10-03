/**
 * The bare money number, without a currency suffix: `"5,198.97"`.
 *
 * Returned as `null` (not `"—"`) when the value is absent so a caller can decide
 * between rendering an em dash and omitting the element entirely.
 */
export function fmtMoneyNumber(n: number | null | undefined): string | null {
  if (n == null || isNaN(n) || !Number.isFinite(n)) return null;
  return n.toLocaleString("en-ET", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmtMoney(n: number | null | undefined): string {
  return fmtMoneyNumber(n) === null ? "—" : `${fmtMoneyNumber(n)} ETB`;
}

export function fmtNumber(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  return n.toLocaleString("en-ET");
}

// ── Units ────────────────────────────────────────────────────────────────────
// One convention for the whole app, replacing the `unit?.name || unit?.symbol`
// expression that used to be repeated inline on each purchasing screen.
//
// Rules, in order:
//   1. Only ever the text the BACKEND sent. No unit is defaulted, pluralised or
//      inferred from a quantity — a missing unit is genuinely missing data.
//   2. Name first, symbol as the fallback (a Unit may have no `name`).
//   3. Never a conversion: the quantity is printed exactly as supplied and the
//      unit is appended. Box → strip → tablet maths belongs to the backend.

/**
 * The shape every `unit` object shares across the app's API DTOs — `{ id, name,
 * symbol }` from purchasing/inventory, and `UnitRefDto`'s `symbol: string | null`
 * from the catalogue. Both are accepted, as is a bare unit name.
 */
export interface UnitRefLike {
  id?: string | null;
  name?: string | null;
  symbol?: string | null;
}

/**
 * A unit's display text, or `""` when the API carried no unit. Callers that
 * render a dedicated cell use `unitCell`; callers that append it to a number use
 * `quantityWithUnit`.
 */
export function unitName(unit: UnitRefLike | string | null | undefined): string {
  if (unit == null) return "";
  if (typeof unit === "string") return unit.trim();
  const name = typeof unit.name === "string" ? unit.name.trim() : "";
  if (name) return name;
  return typeof unit.symbol === "string" ? unit.symbol.trim() : "";
}

/**
 * A dedicated "Unit" column value: the backend's unit text, or the app's
 * standard missing-value fallback. Never a guess.
 */
export function unitCell(unit: UnitRefLike | string | null | undefined): string {
  return unitName(unit) || "—";
}

/**
 * `"50 Tablet"` — a quantity followed by its unit. The unit is omitted entirely
 * when unknown so a table never reads `"50 —"`.
 */
export function quantityWithUnit(
  quantity: string | number,
  unit: UnitRefLike | string | null | undefined,
): string {
  const label = unitName(unit);
  return label ? `${quantity} ${label}` : `${quantity}`;
}

/**
 * A percentage the backend already supplied. No rounding is applied to the
 * source value beyond display formatting, and a non-finite value (the backend
 * documents it guards against NaN/Infinity) renders as "—" rather than as 0.
 */
export function fmtPercent(n: number | null | undefined): string {
  if (n == null || isNaN(n) || !Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

/**
 * "Showing 21-40 of 147 products" for a server-paginated list.
 *
 * Deliberately built from `page` / `limit` / `total` — never from the length of
 * the rows currently on screen, which only describes one page. `to` is capped at
 * `total` so a short final page reads "141-147", not "141-160".
 */
export function rangeLabel(
  page: number,
  limit: number,
  total: number,
  noun: string,
): string {
  if (total === 0 || limit === 0) return "No records";
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return `Showing ${from.toLocaleString("en-ET")}–${to.toLocaleString(
    "en-ET",
  )} of ${total.toLocaleString("en-ET")} ${noun}`;
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "Date not set";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "Date not set";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * A UTC calendar day (`"2026-10-03"`) as `"03 Oct 2026"`.
 *
 * Formatted by STRING SPLIT, never `new Date(raw)`. A bare `YYYY-MM-DD` is
 * parsed by `Date` as UTC midnight, so on a UTC+3 browser `new Date("2026-10-03")`
 * is 03:00 local on the 3rd — fine — but the ISO *timestamp* form
 * `2026-10-03T23:59:59.999Z` becomes 04 Oct 02:59 local and renders as the
 * following day. Reporting an inclusive UTC end-of-day through `fmtDate` is what
 * made a range ending 03 Oct display as "04 Oct".
 *
 * `period.fromDate`/`period.toDate` are already calendar days, so no instant
 * conversion is wanted here at all.
 */
export function fmtCalendarDay(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  // Validate the WHOLE shape before splitting. A partial guard still lets
  // "not-a-date" through — split on "-" yields three truthy non-numeric parts,
  // and `Date.UTC(NaN, …)` formats as the literal text "Invalid Date".
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return "—";
  const [, year, month, day] = m;
  const monthName = new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toLocaleDateString("en-GB", {
    month: "short",
    timeZone: "UTC",
  });
  return `${day} ${monthName} ${year}`;
}

/**
 * Abbreviated magnitude for dense chart axes: `1.5k`, `12k`, `1.2M`.
 *
 * Axis-tick presentation only. Never used for a value the user reads as a
 * balance — `fmtMoney` is the only thing allowed to state a figure of money.
 */
export function fmtCompact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return n.toLocaleString("en-ET", { maximumFractionDigits: 0 });
}

/**
 * A ratio as a whole-number percentage, for progress bars.
 *
 * Returns `null` — never `0` — when it cannot be computed, so a missing or
 * zero denominator renders as "—" rather than as a confident 0%.
 */
export function ratioPercent(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
): number | null {
  if (numerator == null || denominator == null) return null;
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  const pct = (numerator / denominator) * 100;
  if (!Number.isFinite(pct)) return null;
  return Math.max(0, Math.min(100, pct));
}

export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Compact human-readable relative time, e.g. "5 minutes ago", "Yesterday". */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "—";
  const diffMs = Date.now() - then;
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const days = Math.round(hr / 24);
  if (days < 2) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}