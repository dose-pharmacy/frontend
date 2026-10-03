// ── Finance presentation helpers ─────────────────────────────────────────────
// Shared building blocks for every Finance tab: the global filter row, server
// sort headers, KPI cards, and the loading / empty / error states.
//
// Rules encoded here, so no tab can quietly break them:
//   • Nothing renders a financial figure that the backend did not send. Absent
//     values format as "—", never as 0.
//   • A KPI card shows a skeleton while loading, so a pending request can never
//     be misread as a genuine zero.
//   • Money and percentages go through the shared formatters; "ETB" is never
//     appended by a component.

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Button from "../../components/ui/Button";
import DatePicker from "../../components/ui/DatePicker";
import Select from "../../components/ui/Select";
import { useSearchableResource } from "../../hooks/useSearchableResource";
import SearchableSelect from "../../components/ui/SearchableSelect";
import type { SearchableOption } from "../../components/ui/SearchableSelect";
import { searchLocations } from "../../features/inventory/searchSelectors";
import { listProductGroups } from "../../features/inventory/productGroupsApi";
import { fmtMoney, fmtNumber, fmtPercent, fmtDate, fmtDateTime, rangeLabel } from "../../utils/format";
import type { SortOrder } from "../../features/reports/reportsApi";
import type { FinanceReport } from "../../features/finance/financeReportingApi";

export { fmtMoney, fmtNumber, fmtPercent, fmtDate, fmtDateTime, rangeLabel };

/**
 * The single `/finance-reporting/report` response, shared by every Finance tab.
 *
 * The report is fetched ONCE at page level rather than per tab, so switching
 * tabs never refetches and two tabs can never disagree about the same figures.
 * Sections read `data`/`loading`/`error` — they never issue their own report
 * request.
 */
export interface FinanceReportState {
  data: FinanceReport | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

// ── Date bounds ──────────────────────────────────────────────────────────────
// The financial reports document `dateFrom` as an INCLUSIVE UTC start-of-day and
// `dateTo` as an INCLUSIVE UTC end-of-day. The DatePicker hands back a bare
// "YYYY-MM-DD", so each bound is expanded against UTC — not the browser's local
// timezone. Using local midnight here (as the Sales page does) would shift a
// UTC+3 browser three hours into the previous day and silently drop the first
// and last day of the selected window.

export function utcDayStart(day: string): string {
  return `${day}T00:00:00.000Z`;
}

export function utcDayEnd(day: string): string {
  return `${day}T23:59:59.999Z`;
}

/** Sends the bounds only when the user actually picked a date. */
export function dateBounds(dateFrom: string, dateTo: string): { dateFrom?: string; dateTo?: string } {
  return {
    dateFrom: dateFrom ? utcDayStart(dateFrom) : undefined,
    dateTo: dateTo ? utcDayEnd(dateTo) : undefined,
  };
}

/** Sensible opening window: the first day of the current month through today. */
export function defaultWindow(): { from: string; to: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  return {
    from: `${y}-${pad(m)}-01`,
    to: `${y}-${pad(m)}-${pad(d)}`,
  };
}

// ── Global filter row ────────────────────────────────────────────────────────

export interface FinanceFilters {
  dateFrom: string;
  dateTo: string;
  locationId: string;
}

/**
 * The shared Date From / Date To / Location filter area.
 *
 * `showLocation` is kept as an explicit prop rather than always rendered so a
 * caller that genuinely cannot honour `locationId` can say so instead of
 * implying a filter the request would silently drop. `/finance-reporting/report`
 * accepts `locationId` on every tab, so the Finance page passes `true`
 * throughout — the previous limitation belonged to the older
 * `/financials/reports/profitability` endpoints, which the report replaces.
 */
export function FilterBar({
  filters,
  onChange,
  showLocation,
  children,
}: {
  filters: FinanceFilters;
  onChange: (next: Partial<FinanceFilters>) => void;
  showLocation: boolean;
  /** Extra tab-specific controls (product group, group-by, status). */
  children?: ReactNode;
}) {
  const locationSearch = useSearchableResource(searchLocations, true);
  const selected = locationSearch.options.find((o) => o.value === filters.locationId) ?? null;
  const options: SearchableOption[] = [
    ...(selected ? [selected] : []),
    ...locationSearch.options,
  ].filter((o, i, arr) => arr.findIndex((x) => x.value === o.value) === i);

  return (
    <div className="bg-white rounded-xl border border-[#E6ECE2] p-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
          <label className="text-sm font-medium text-[#333333]">Date from</label>
          <DatePicker
            value={filters.dateFrom}
            onChange={(v) => onChange({ dateFrom: v })}
            placeholder="From date"
          />
        </div>
        <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
          <label className="text-sm font-medium text-[#333333]">Date to</label>
          <DatePicker
            value={filters.dateTo}
            onChange={(v) => onChange({ dateTo: v })}
            placeholder="To date"
          />
        </div>
        {showLocation && (
          <div className="flex flex-col gap-1.5 flex-1 min-w-[190px]">
            <label className="text-sm font-medium text-[#333333]">Location</label>
            <SearchableSelect
              value={filters.locationId || null}
              onChange={(v) => onChange({ locationId: v })}
              options={options}
              onSearch={locationSearch.setTerm}
              loading={locationSearch.loading}
              error={locationSearch.error}
              onRetry={locationSearch.retry}
              allowClear
              placeholder="All locations"
              searchPlaceholder="Search locations..."
              emptyMessage="No locations found"
              noResultsMessage="No locations matching your search"
            />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/**
 * A simple labelled `<Select>`, matching the filter row's styling.
 *
 * The label is delegated to `Select`, which derives an id and renders a real
 * `<label htmlFor>`. Previously this rendered its own `<label>` as a SIBLING of
 * the select with no `htmlFor`, so the control had no accessible name — a bare
 * `<label>` next to an input associates with nothing.
 */
export function FilterSelect({
  label,
  value,
  onChange,
  children,
  className = "flex-1 min-w-[170px]",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Select
        label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full"
      >
        {children}
      </Select>
    </div>
  );
}

/**
 * A compact row for tab-specific controls (status, group-by, drill-down fields).
 * Sits directly above the tab's content, under the single global filter bar.
 */
export function SubFilters({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3">{children}</div>
  );
}

/**
 * Product group filter, populated from the real `/inventory/product-groups`
 * endpoint.
 *
 * The list is fetched once per mount and a failed read degrades to the
 * "All product groups" option only — it never invents group names. There is no
 * matching manufacturer endpoint in the API, so no manufacturer control exists
 * anywhere in Finance even though `manufacturerId` is a valid query parameter.
 */
export function ProductGroupFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    setLoading(true);
    listProductGroups({ limit: 100, isActive: true })
      .then((result) => {
        if (live) setGroups(result.data);
      })
      .catch(() => {
        if (live) setGroups([]);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <FilterSelect label="Product group" value={value} onChange={onChange}>
      <option value="">{loading ? "Loading product groups…" : "All product groups"}</option>
      {groups.map((group) => (
        <option key={group.id} value={group.id}>
          {group.name}
        </option>
      ))}
    </FilterSelect>
  );
}

// ── KPI card ─────────────────────────────────────────────────────────────────

/**
 * A financial KPI. `loading` renders a skeleton rather than the previous value,
 * so figures from the old filter are never shown as if they belonged to the new
 * one.
 */
export function KpiCard({
  label,
  value,
  tone = "default",
  loading,
  error,
  onRetry,
  hint,
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative";
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  hint?: string;
}) {
  const toneClass =
    tone === "positive"
      ? "text-green-700"
      : tone === "negative"
        ? "text-red-700"
        : "text-[#333333]";

  // A failed KPI never renders as 0 — it states the failure and offers a retry.
  if (error) {
    return (
      <div className="rounded-xl bg-[#E6ECE2] p-5">
        <p className="text-xs font-medium text-[#666666] uppercase tracking-wide">{label}</p>
        <p
          className="text-xs text-red-700 mt-2 line-clamp-2"
          title={error}
        >
          {error}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 text-xs font-semibold text-[#4F6B4A] hover:underline"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-[#E6ECE2] p-5">
      <p className="text-xs font-medium text-[#666666] uppercase tracking-wide">{label}</p>
      {loading ? (
        <div className="mt-2 h-7 w-28 rounded bg-white/70 animate-pulse" aria-hidden />
      ) : (
        <p className={`text-2xl font-bold leading-tight mt-0.5 tabular-nums ${toneClass}`}>{value}</p>
      )}
      {hint && <p className="text-xs text-[#666666] mt-0.5">{hint}</p>}
    </div>
  );
}

// ── Server-side sorting ──────────────────────────────────────────────────────

/**
 * A column header that asks the BACKEND to sort. Clicking cycles asc → desc and
 * resets the page. No row array is ever sorted locally.
 *
 * `sortable={false}` renders a plain heading for derived columns (e.g. an
 * outstanding balance computed from two server-sorted columns) so it is visibly
 * not clickable rather than silently inert.
 */
export function SortHeader<T extends string>({
  active,
  order,
  onClick,
  align,
  title,
  sortable = true,
  children,
}: {
  active: boolean;
  order: SortOrder;
  onClick: () => void;
  align?: "right";
  title?: string;
  sortable?: boolean;
  children: ReactNode;
}) {
  const className = `px-4 py-3 font-semibold text-[#333333] ${align === "right" ? "text-right" : ""}`;

  if (!sortable) {
    return (
      <th className={className} title={title}>
        {children}
      </th>
    );
  }

  return (
    <th className={className}>
      <button
        type="button"
        onClick={onClick}
        title={title ? `${title} (server-side sorting)` : "Sort (server-side)"}
        aria-label={`Sort by ${typeof children === "string" ? children : "this column"}`}
        className={`inline-flex items-center gap-1.5 hover:text-[#7A9076] ${
          align === "right" ? "flex-row-reverse" : ""
        }`}
      >
        {children}
        <span className={active ? "text-[#7A9076]" : "text-[#C6D4BF]"}>
          {active ? (order === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

/**
 * Click handler shared by every sortable header: re-click the active column to
 * flip direction, otherwise start ascending and jump back to page 1.
 */
export function nextSort<T extends string>(
  current: T,
  active: T,
  order: SortOrder,
): { sortBy: T; sortOrder: SortOrder } {
  if (current === active) return { sortBy: current, sortOrder: order === "asc" ? "desc" : "asc" };
  return { sortBy: current, sortOrder: "asc" };
}

// ── States ───────────────────────────────────────────────────────────────────

export function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3" role="status">
      <div className="h-7 w-7 rounded-full border-4 border-[#E6ECE2] border-t-[#4F6B4A] animate-spin" />
      <p className="text-sm text-[#666666]">{label}</p>
    </div>
  );
}

/** Table-shaped placeholder used while a list request is in flight. */
export function TableSkeleton({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-[#E6ECE2]" aria-hidden>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-4">
          {Array.from({ length: cols }, (_, c) => (
            <div
              key={c}
              className={`h-3 rounded bg-[#E6ECE2]/${c === 0 ? "80" : "50"} animate-pulse ${
                c === 0 ? "w-32" : "w-20"
              }`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * A failed request. The backend's own wording is shown beneath a plain-language
 * headline; a failed call is never silently replaced by zero.
 */
export function ErrorBlock({
  headline,
  message,
  onRetry,
}: {
  headline: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-5 py-10 text-center" role="alert">
      <p className="text-sm font-semibold text-[#333333]">{headline}</p>
      <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3 max-w-md">
        {message}
      </p>
      <Button onClick={onRetry}>Retry</Button>
    </div>
  );
}

export function EmptyBlock({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <p className="text-sm font-semibold text-[#333333]">{title}</p>
      {description && <p className="text-xs text-[#666666] mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-[#E6ECE2] bg-white overflow-hidden ${className}`}>
      <header className="flex items-center justify-between gap-3 border-b border-[#E6ECE2] px-5 py-3">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#4F6B4A]">{title}</h3>
        {action}
      </header>
      {children}
    </section>
  );
}

/** `ReportsApiError` / `CreditApiError` / `SalesApiError` all populate `message` from the backend. */
export function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

/**
 * The one data-fetching hook for every Finance section.
 *
 * Two behaviours the tabs depend on:
 *
 *  • Changing a filter flips `loading` to true IMMEDIATELY, so a stale figure
 *    from the previous filter can never be read as belonging to the new one.
 *    Consumers must render the skeleton whenever `loading` is true rather than
 *    falling back to `data`.
 *
 *  • Responses are sequence-stamped. If the user changes a filter again before
 *    the first request lands, the stale response is discarded instead of
 *    overwriting the newer one.
 *
 * `deps` is the filter set — the same values the request is built from. The
 * fetcher itself is held in a ref so it may be a fresh closure every render
 * without triggering a request.
 */
export function useFinanceFetch<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
  fallbackError = "Could not load this data. Please try again.",
  opts?: {
    /** Refetch when the tab regains focus. Off by default. */
    refreshOnFocus?: boolean;
  },
): {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const seq = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const fallbackRef = useRef(fallbackError);
  fallbackRef.current = fallbackError;

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    const mine = ++seq.current;
    // A real abort, not just a sequence guard. The sequence check alone stops a
    // stale response overwriting a newer one, but it leaves the request running
    // and its body downloading — so rapidly clicking Apply would fan out several
    // full report payloads, of which only the last is used.
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetcherRef
      .current(controller.signal)
      .then((result) => {
        if (mine !== seq.current) return;
        setData(result);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (mine !== seq.current) return;
        // A cancellation is not a failure — stay quiet rather than showing a
        // connection error for a request this hook deliberately tore down.
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(errorMessage(e, fallbackRef.current));
        setLoading(false);
      });
    return () => controller.abort();
    // Deliberately keyed on the caller's `deps` (the filters the request is
    // built from) plus a retry nonce — not on `fetcher`, which is a fresh
    // closure every render and would loop. There is no linter configured in
    // this project, hence no disable comment.
  }, [...deps, nonce]);

  // Opt-in refocus refetch, so a snapshot left open in a background tab does not
  // keep showing figures from before the user switched away.
  const refreshOnFocus = opts?.refreshOnFocus === true;
  useEffect(() => {
    if (!refreshOnFocus) return;
    function onFocus() {
      if (document.visibilityState === "visible") reload();
    }
    document.addEventListener("visibilitychange", onFocus);
    return () => document.removeEventListener("visibilitychange", onFocus);
  }, [refreshOnFocus, reload]);

  return { data, loading, error, reload };
}

/** "Showing 21–40 of 312" — driven by the limit the backend actually applied. */
// Moved to utils/format so non-finance pages (e.g. inventory products) can share
// the exact same server-pagination range wording instead of re-deriving it.