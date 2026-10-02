// ── Dashboard → Sales ────────────────────────────────────────────────────────
// The Sales tab of the dashboard, built entirely from existing endpoints:
//
//   GET /financials/reports/sales/summary   →  KPI cards + Payment Breakdown
//   GET /financials/reports/sales/trend     →  Sales Overview chart
//   GET /financials/reports/sales           →  Recent Sales table
//
// All three accept `dateFrom`, `dateTo` and `locationId`, so the period and
// location filters below drive real server-side filtering — there is no
// client-side filtering and no client-side counting of transactions.
//
// Every figure is taken from a real response field. Nothing is estimated,
// derived from a formatted string, or defaulted to a placeholder number.

import { useCallback, useEffect, useMemo, useState, type DependencyList, type ReactNode } from "react";
import DashboardSubNav from "../dashboard/DashboardSubNav";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import Pagination from "../../components/ui/Pagination";
import EmptyState from "../../components/ui/EmptyState";
import ReportFilterBar from "./ReportFilterBar";
import { listLocations } from "../../features/inventory/locationsApi";
import {
  getSalesSummary,
  getSalesTrend,
  getSalesReport,
  type SalesSummaryDto,
  type ReportPaginatedResult,
  type SalesSummaryPaymentEntry,
  type SalesTrendPointDto,
  type SalesTrendPeriod,
  type SalesReportSortBy,
  type SortOrder,
} from "../../features/reports/reportsApi";
import type { SaleDto } from "../../features/sales/salesApi";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { fmtMoney, fmtNumber, fmtDate, fmtDateTime } from "../../utils/format";

const PAGE_SIZE = 10;

// ── Period presets ───────────────────────────────────────────────────────────
// The presets only pre-fill the real From/To inputs; the backend still does
// the filtering. Hand-editing either date switches the selector to CUSTOM.

const PERIOD_PRESETS = ["TODAY", "THIS_WEEK", "THIS_MONTH", "THIS_YEAR", "CUSTOM"] as const;
type PeriodPreset = (typeof PERIOD_PRESETS)[number];

const PRESET_LABELS: Record<PeriodPreset, string> = {
  TODAY: "Today",
  THIS_WEEK: "This Week",
  THIS_MONTH: "This Month",
  THIS_YEAR: "This Year",
  CUSTOM: "Custom Range",
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Local calendar date as `YYYY-MM-DD` (never UTC-shifted). */
function localDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function shiftDays(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return localDay(new Date(y, m - 1, d + delta));
}

/**
 * The sales endpoints declare `dateFrom` / `dateTo` as `date-time`, so a bare
 * `YYYY-MM-DD` upper bound risks truncating the final day. Each boundary is
 * expanded to the full local day before being sent.
 */
function dayStartIso(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}

function dayEndIso(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
}

function presetRange(preset: Exclude<PeriodPreset, "CUSTOM">): { from: string; to: string } {
  const today = localDay(new Date());
  if (preset === "TODAY") return { from: today, to: today };
  if (preset === "THIS_MONTH") return { from: `${today.slice(0, 8)}01`, to: today };
  if (preset === "THIS_YEAR") return { from: `${today.slice(0, 4)}-01-01`, to: today };

  // This Week starts on Monday.
  const [y, m, d] = today.split("-").map(Number);
  const dow = (new Date(y, m - 1, d).getDay() + 6) % 7;
  return { from: shiftDays(today, -dow), to: today };
}

function spanInDays(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const ms = new Date(ty, tm - 1, td).getTime() - new Date(fy, fm - 1, fd).getTime();
  if (Number.isNaN(ms)) return 1;
  return Math.round(ms / 86_400_000) + 1;
}

/**
 * Chart granularity follows the selected range.
 *
 * `/financials/reports/sales/trend` accepts only DAILY, MONTHLY and ANNUAL —
 * there is no HOURLY bucket, so a single-day range is still grouped by day and
 * renders one point. Bins are never fabricated client-side to fill a gap.
 */
function deriveGranularity(from: string, to: string): SalesTrendPeriod {
  return spanInDays(from, to) > 120 ? "MONTHLY" : "DAILY";
}

// ── Payment methods ──────────────────────────────────────────────────────────
// Labels come from the values the API actually returns. "Credit" is never a
// payment method — an unpaid remainder is outstanding, not a fourth method.

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  CARD: "Card",
  MOBILE_TRANSFER: "Digital Transfer",
  DIGITAL_TRANSFER: "Digital Transfer",
  CHECK: "Cheque",
  BANK_TRANSFER: "Bank Transfer",
};

/** Requested display order first, then anything else the API reports. */
const METHOD_ORDER = ["CASH", "CARD", "MOBILE_TRANSFER"];

function methodLabel(method: string): string {
  return METHOD_LABELS[method] ?? method.replace(/[_-]+/g, " ").toLowerCase();
}

function paymentEntries(
  entries: SalesSummaryPaymentEntry[] | null | undefined,
): { method: string; label: string; amount: number }[] {
  if (!Array.isArray(entries)) return [];
  const merged = new Map<string, number>();
  for (const entry of entries) {
    const method = entry?.method;
    if (typeof method !== "string") continue;
    const amount = typeof entry.amount === "number" && Number.isFinite(entry.amount) ? entry.amount : 0;
    merged.set(method, (merged.get(method) ?? 0) + amount);
  }
  return Array.from(merged, ([method, amount]) => ({ method, label: methodLabel(method), amount })).sort(
    (a, b) => {
      const ai = METHOD_ORDER.indexOf(a.method);
      const bi = METHOD_ORDER.indexOf(b.method);
      if (ai !== bi) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      return a.label.localeCompare(b.label);
    },
  );
}

// ── Money helpers ────────────────────────────────────────────────────────────

/**
 * Unpaid remainder of a sale: `totalAmount - paidAmount`.
 * `changeAmount` is money handed back to the customer and is never counted.
 * A payable cannot be negative, so a window where collections exceed revenue
 * clamps to zero rather than displaying a negative debt.
 */
function outstandingFor(total: number | null | undefined, paid: number | null | undefined): number {
  if (typeof total !== "number" || !Number.isFinite(total)) return 0;
  const collected = typeof paid === "number" && Number.isFinite(paid) ? paid : 0;
  return Math.max(0, total - collected);
}

function axisLabel(value: string): string {
  // Only shorten full ISO day buckets; month/year labels pass through untouched
  // so a backend bucket is never relabelled.
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return fmtDate(value).replace(/\s+\d{4}$/, "");
  return value;
}

// ── Section loading ──────────────────────────────────────────────────────────

/**
 * One independently-loaded section. A failing endpoint never blanks the rest of
 * the page, and a failed *refresh* keeps the last good data on screen.
 */
function useSection<T>(loader: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loader());
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}

// ── Shared blocks ────────────────────────────────────────────────────────────

const focusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7A9076]/40 focus-visible:ring-offset-1";

const ICON = "h-5 w-5";

function PanelError({ title, detail, onRetry }: { title: string; detail?: string | null; onRetry: () => void }) {
  return (
    <div className="px-5 py-6 flex flex-col items-center gap-3">
      <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 text-center">{title}</p>
      {detail && detail !== title && <p className="text-xs text-[#666666] text-center">{detail}</p>}
      <Button onClick={onRetry}>Try again</Button>
    </div>
  );
}

function StaleBanner({ children }: { children: ReactNode }) {
  return (
    <p className="mx-5 mt-4 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
      {children}
    </p>
  );
}

function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="px-5 py-4 flex flex-col gap-3" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-12 rounded-lg bg-[#E6ECE2]/60 animate-pulse" />
      ))}
    </div>
  );
}

function Card({
  title,
  subtitle,
  actions,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-xl border border-[#E6ECE2] shadow-sm overflow-hidden min-w-0 ${className}`}>
      <div className="px-5 py-4 border-b border-[#E6ECE2] flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-[#333333] truncate">{title}</h2>
          {subtitle && <p className="text-xs text-[#666666] mt-0.5 truncate">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

// ── KPI cards ────────────────────────────────────────────────────────────────

const TONE_SALES = "bg-[#E1EAD9] text-[#4F6B4A]";
const TONE_COUNT = "bg-[#E6ECE2] text-[#4F6B4A]";
const TONE_PAID = "bg-[#E6ECE2] text-[#4F6B4A]";
const TONE_DUE = "bg-amber-50 text-amber-700";

/**
 * One KPI. Loading, error and "not reported" are three separate states — a
 * placeholder figure is never rendered in place of a real one.
 */
function KpiCard({
  label,
  icon,
  tone,
  hint,
  value,
  unit,
  note,
  loading,
  error,
  onRetry,
}: {
  label: string;
  icon: ReactNode;
  tone: string;
  hint: string;
  value: string | null;
  unit?: string;
  note?: string;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const showSkeleton = loading && value === null && !error;

  return (
    <div className="rounded-xl border border-[#E6ECE2] bg-white px-4 py-4 shadow-sm flex flex-col gap-3 min-w-0">
      <div className="flex items-center gap-2.5 min-w-0" title={hint}>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>{icon}</span>
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#666666] truncate">{label}</p>
      </div>

      {showSkeleton ? (
        <div className="h-8 w-28 rounded bg-[#E6ECE2]/60 animate-pulse" aria-hidden />
      ) : error && value === null ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-xl font-bold leading-none text-[#999999]">Unavailable</p>
          <button onClick={onRetry} className={`text-[11px] font-semibold text-[#7A9076] hover:underline self-start ${focusRing}`}>
            Retry
          </button>
        </div>
      ) : (
        <p className="text-2xl font-bold leading-none text-[#333333] tabular-nums truncate">
          {value ?? "—"}
          {unit && <span className="ml-1.5 text-xs font-semibold text-[#666666] tracking-normal">{unit}</span>}
        </p>
      )}

      <p className="text-[11px] text-[#999999] leading-snug">
        {error && value !== null ? "Refresh failed — showing last loaded value" : note}
      </p>
    </div>
  );
}

function KpiSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" aria-hidden>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="rounded-xl border border-[#E6ECE2] bg-white px-4 py-4 flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#E6ECE2]/70 animate-pulse" />
            <div className="h-2.5 w-20 rounded bg-[#E6ECE2]/70 animate-pulse" />
          </div>
          <div className="h-8 w-28 rounded bg-[#E6ECE2]/50 animate-pulse" />
          <div className="h-2 w-28 rounded bg-[#E6ECE2]/40 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

// ── Sales Overview chart ─────────────────────────────────────────────────────

function SalesOverviewChart({
  points,
  granularity,
  loading,
  error,
  onRetry,
}: {
  points: SalesTrendPointDto[] | null;
  granularity: SalesTrendPeriod;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const hasData = Array.isArray(points) && points.length > 0;
  const bucketWord = granularity === "MONTHLY" ? "month" : "day";
  const total = hasData ? points!.reduce((sum, p) => sum + (p.revenue ?? 0), 0) : 0;

  return (
    <Card
      title="Sales Overview"
      subtitle={
        hasData
          ? `${fmtMoney(total)} across ${points!.length} ${bucketWord}${points!.length === 1 ? "" : "s"}`
          : `Revenue by ${bucketWord}`
      }
      className="xl:col-span-2"
    >
      {error && !hasData ? (
        <PanelError title="Unable to load sales data." detail={error} onRetry={onRetry} />
      ) : loading && !hasData ? (
        <div className="px-5 py-5" aria-hidden>
          <div className="h-64 flex items-end gap-2">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="flex-1 rounded-t bg-[#E6ECE2]/50 animate-pulse" style={{ height: `${30 + ((i * 37) % 70)}%` }} />
            ))}
          </div>
        </div>
      ) : !hasData ? (
        <EmptyState title="No sales data available" description="There are no sales recorded for this period and location." />
      ) : (
        <>
          {error && <StaleBanner>Showing the last loaded chart — the latest refresh failed.</StaleBanner>}
          <div className="px-2 py-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6ECE2" vertical={false} />
                  <XAxis
                    dataKey="period"
                    tickFormatter={axisLabel}
                    tick={{ fontSize: 11, fill: "#666666" }}
                    tickLine={false}
                    axisLine={{ stroke: "#E6ECE2" }}
                    minTickGap={16}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#666666" }}
                    tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                  />
                  <Tooltip
                    formatter={(v: unknown) => fmtMoney(Number(v))}
                    labelFormatter={(l: unknown) => axisLabel(String(l))}
                    contentStyle={{ borderRadius: 12, borderColor: "#E6ECE2", fontSize: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    name="Revenue"
                    stroke="#7A9076"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

// ── Payment Breakdown ────────────────────────────────────────────────────────

/**
 * Uses the backend's own `paymentsByMethod` totals — the endpoint computes them
 * server-side, so no amount is aggregated or estimated in the browser. Only
 * methods the API actually reports are listed; no zero-valued row is invented.
 */
function PaymentBreakdown({
  entries,
  loading,
  error,
  onRetry,
}: {
  entries: SalesSummaryPaymentEntry[] | null | undefined;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const rows = useMemo(() => paymentEntries(entries), [entries]);
  const collected = rows.reduce((sum, r) => sum + r.amount, 0);

  return (
    <Card title="Payment Breakdown" subtitle={rows.length ? `${fmtMoney(collected)} collected` : undefined}>
      {error && rows.length === 0 ? (
        <PanelError title="Unable to load payment data." detail={error} onRetry={onRetry} />
      ) : loading && rows.length === 0 ? (
        <PanelSkeleton rows={3} />
      ) : rows.length === 0 ? (
        <EmptyState title="No payments recorded" description="No payment rows exist for this period and location." />
      ) : (
        <>
          {error && <StaleBanner>Showing the last loaded split — the latest refresh failed.</StaleBanner>}
          <ul className="divide-y divide-[#E6ECE2]">
            {rows.map((row) => {
              const share = collected > 0 ? (row.amount / collected) * 100 : 0;
              return (
                <li key={row.method} className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[#333333] truncate">{row.label}</p>
                    <div className="flex items-baseline gap-2 shrink-0">
                      <span className="text-sm font-bold text-[#333333] tabular-nums">{fmtMoney(row.amount)}</span>
                      {collected > 0 && (
                        <span className="text-[11px] font-semibold text-[#666666] tabular-nums w-10 text-right">
                          {share.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-[#E6ECE2] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#7A9076]"
                      style={{ width: collected > 0 ? `${Math.max(share, 1)}%` : "0%" }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}

// ── Recent Sales ─────────────────────────────────────────────────────────────

/** Raw backend status (DRAFT | COMPLETED | CANCELLED) — never invented. */
function SaleStatusBadge({ status }: { status: string | null | undefined }) {
  const key = (status ?? "").toUpperCase();
  const config: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    COMPLETED: { label: "Completed", bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
    DRAFT: { label: "Draft", bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" },
    CANCELLED: { label: "Cancelled", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  };
  const c = config[key];
  if (!c) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6ECE2] px-2.5 py-0.5 text-xs font-medium text-[#666666]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#C6D4BF]" aria-hidden />
        {status || "—"}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} aria-hidden />
      {c.label}
    </span>
  );
}

const SORT_COLUMNS: { key: SalesReportSortBy; label: string; align?: "right" }[] = [
  { key: "saleNumber", label: "Sale No" },
  { key: "createdAt", label: "Date" },
];

function RecentSalesTable({
  sales,
  loading,
  error,
  onRetry,
  page,
  totalPages,
  totalCount,
  onPageChange,
  sortBy,
  sortOrder,
  onSortChange,
}: {
  sales: SaleDto[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  sortBy: SalesReportSortBy;
  sortOrder: SortOrder;
  onSortChange: (key: SalesReportSortBy) => void;
}) {
  const showingEmpty = !loading && !error && sales.length === 0;

  return (
    <Card title="Recent Sales" subtitle={totalCount > 0 ? `${fmtNumber(totalCount)} sales in this period` : undefined}>
      {error && sales.length === 0 ? (
        <PanelError title="Unable to load sales." detail={error} onRetry={onRetry} />
      ) : loading && sales.length === 0 ? (
        <div className="px-5 py-4 flex flex-col gap-3" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-11 rounded-lg bg-[#E6ECE2]/60 animate-pulse" />
          ))}
        </div>
      ) : showingEmpty ? (
        <EmptyState title="No sales data available for this period" description="Adjust the period or location filter to widen the search." />
      ) : (
        <>
          {error && <StaleBanner>Showing the last loaded sales — the latest refresh failed.</StaleBanner>}
          {/* The table scrolls inside its own container so narrow screens never
              cause page-level horizontal overflow. */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="bg-[#E6ECE2] text-left">
                  {SORT_COLUMNS.map((col) => (
                    <th key={col.key} className="px-4 py-3 font-semibold text-[#333333] whitespace-nowrap">
                      <button
                        onClick={() => onSortChange(col.key)}
                        className={`inline-flex items-center gap-1.5 hover:text-[#7A9076] ${focusRing}`}
                      >
                        {col.label}
                        <span className={sortBy === col.key ? "text-[#7A9076]" : "text-[#C6D4BF]"}>
                          {sortBy === col.key ? (sortOrder === "asc" ? "↑" : "↓") : "↕"}
                        </span>
                      </button>
                    </th>
                  ))}
                  <th className="px-4 py-3 font-semibold text-[#333333] whitespace-nowrap">Cashier</th>
                  <th className="px-4 py-3 font-semibold text-[#333333] text-right whitespace-nowrap">Total</th>
                  <th className="px-4 py-3 font-semibold text-[#333333] text-right whitespace-nowrap">Paid</th>
                  <th className="px-4 py-3 font-semibold text-[#333333] text-right whitespace-nowrap">Outstanding</th>
                  <th className="px-4 py-3 font-semibold text-[#333333] whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale, i) => {
                  const outstanding = outstandingFor(sale.totalAmount, sale.paidAmount);
                  return (
                    <tr
                      key={sale.id}
                      className={`hover:bg-[#E6ECE2]/30 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/15"}`}
                    >
                      <td className="px-4 py-3 font-semibold text-[#7A9076] whitespace-nowrap">{sale.saleNumber}</td>
                      <td className="px-4 py-3 text-[#666666] whitespace-nowrap">
                        {fmtDateTime(sale.completedAt ?? sale.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-[#666666] whitespace-nowrap">{sale.cashier?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#333333] whitespace-nowrap tabular-nums">
                        {fmtMoney(sale.totalAmount)}
                      </td>
                      <td className="px-4 py-3 text-right text-[#666666] whitespace-nowrap tabular-nums">
                        {fmtMoney(sale.paidAmount)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right whitespace-nowrap tabular-nums ${
                          outstanding > 0 ? "font-semibold text-amber-700" : "text-[#666666]"
                        }`}
                      >
                        {fmtMoney(outstanding)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <SaleStatusBadge status={sale.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={onPageChange}
              label={
                <>
                  Showing{" "}
                  <span className="font-medium text-[#333333]">
                    {Math.min((page - 1) * PAGE_SIZE + 1, totalCount)}–{Math.min(page * PAGE_SIZE, totalCount)}
                  </span>{" "}
                  of <span className="font-medium text-[#333333]">{fmtNumber(totalCount)}</span> sales
                </>
              }
            />
          )}
        </>
      )}
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SalesReportPage() {
  const [preset, setPreset] = useState<PeriodPreset>("TODAY");
  const [dateFrom, setDateFrom] = useState(() => presetRange("TODAY").from);
  const [dateTo, setDateTo] = useState(() => presetRange("TODAY").to);
  const [locationId, setLocationId] = useState("");

  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SalesReportSortBy>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);

  useEffect(() => {
    listLocations({ limit: 100, isActive: true })
      .then((r) => setLocations(r.data))
      .catch(() => setLocations([]))
      .finally(() => setLocationsLoading(false));
  }, []);

  // Real server-side window, expanded to full local days.
  const dateFromIso = dayStartIso(dateFrom);
  const dateToIso = dayEndIso(dateTo);
  const location = locationId || undefined;
  const granularity = deriveGranularity(dateFrom, dateTo);

  // ── Section 1: KPIs + Payment Breakdown (one response feeds both) ──────────
  const summary = useSection<SalesSummaryDto>(
    () => getSalesSummary({ dateFrom: dateFromIso, dateTo: dateToIso, locationId: location }),
    [dateFromIso, dateToIso, locationId],
  );

  // ── Section 2: Sales Overview chart ────────────────────────────────────────
  const trend = useSection<SalesTrendPointDto[]>(
    () =>
      getSalesTrend({
        period: granularity,
        dateFrom: dateFromIso,
        dateTo: dateToIso,
        locationId: location,
      }),
    [granularity, dateFromIso, dateToIso, locationId],
  );

  // ── Section 3: Recent Sales ────────────────────────────────────────────────
  const recent = useSection<ReportPaginatedResult<SaleDto>>(
    () =>
      getSalesReport({
        dateFrom: dateFromIso,
        dateTo: dateToIso,
        locationId: location,
        page,
        limit: PAGE_SIZE,
        sortBy,
        sortOrder,
      }),
    [dateFromIso, dateToIso, locationId, page, sortBy, sortOrder],
  );

  const refreshing = summary.loading || trend.loading || recent.loading;
  const reloadAll = () => {
    void summary.reload();
    void trend.reload();
    void recent.reload();
  };

  function applyPreset(next: PeriodPreset) {
    setPreset(next);
    if (next === "CUSTOM") return;
    const range = presetRange(next);
    setDateFrom(range.from);
    setDateTo(range.to);
    setPage(1);
  }

  function onDateChange(setter: (v: string) => void) {
    return (value: string) => {
      setter(value);
      setPreset("CUSTOM");
      setPage(1);
    };
  }

  function toggleSort(key: SalesReportSortBy) {
    if (sortBy === key) setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key);
      setSortOrder("desc");
    }
    setPage(1);
  }

  // Payments are the backend's own per-method totals; summing them gives Paid,
  // and the remainder against totalSales gives Outstanding — so the four KPIs
  // always reconcile with each other.
  const paymentRows = useMemo(() => paymentEntries(summary.data?.paymentsByMethod), [summary.data]);
  const paidTotal = paymentRows.reduce((sum, r) => sum + r.amount, 0);
  const hasPayments = typeof summary.data?.paymentsByMethod !== "undefined";

  const totalSalesValue =
    typeof summary.data?.totalSales === "number" ? fmtMoney(summary.data.totalSales) : null;
  const transactionsValue =
    typeof summary.data?.transactionCount === "number" ? fmtNumber(summary.data.transactionCount) : null;
  const paidValue = hasPayments && summary.data ? fmtMoney(paidTotal) : null;
  const outstandingValue =
    hasPayments && summary.data ? fmtMoney(outstandingFor(summary.data.totalSales, paidTotal)) : null;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb="Dashboard / Sales"
        title="Sales"
        subtitle="Completed sales for the selected period and location."
        actions={
          <Button
            variant="secondary"
            onClick={reloadAll}
            disabled={refreshing}
            loading={refreshing}
            className="!bg-[#7A9076] !text-white hover:!bg-[#4F6B4A] focus-visible:!ring-[#7A9076]"
          >
            Refresh
          </Button>
        }
      />
      <DashboardSubNav />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        {/* ── Filters ───────────────────────────────────────────────────── */}
        <ReportFilterBar
          dateFrom={dateFrom}
          dateTo={dateTo}
          locationId={locationId}
          locations={locations}
          locationsLoading={locationsLoading}
          onDateFromChange={onDateChange(setDateFrom)}
          onDateToChange={onDateChange(setDateTo)}
          onLocationChange={(v) => {
            setLocationId(v);
            setPage(1);
          }}
          extra={
            <div className="flex flex-col gap-1.5 min-w-[160px]">
              <label htmlFor="sales-period" className="text-sm font-medium text-[#333333]">
                Period
              </label>
              <select
                id="sales-period"
                value={preset}
                onChange={(e) => applyPreset(e.target.value as PeriodPreset)}
                className={`rounded-lg border border-[#C6D4BF] bg-white px-3 py-2 text-sm text-[#333333] outline-none cursor-pointer ${focusRing}`}
              >
                {PERIOD_PRESETS.map((p) => (
                  <option key={p} value={p}>
                    {PRESET_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
          }
        />

        {/* ── KPI cards ──────────────────────────────────────────────────── */}
        <section aria-label="Sales key figures">
          {summary.loading && !summary.data ? (
            <KpiSkeletonGrid />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <KpiCard
                label="Total Sales"
                icon={
                  <svg viewBox="0 0 20 20" fill="currentColor" className={ICON} aria-hidden>
                    <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm2.5 3a1 1 0 100 2h11a1 1 0 100-2h-11zm0 4a1 1 0 100 2h7a1 1 0 100-2h-7z" />
                  </svg>
                }
                tone={TONE_SALES}
                hint="Sum of totalAmount over completed sales in the selected period."
                value={totalSalesValue}
                note="Revenue from completed sales"
                loading={summary.loading}
                error={summary.error}
                onRetry={summary.reload}
              />
              <KpiCard
                label="Transactions"
                icon={
                  <svg viewBox="0 0 20 20" fill="currentColor" className={ICON} aria-hidden>
                    <path
                      fillRule="evenodd"
                      d="M3 5a2 2 0 012-2h10a2 2 0 012 2v1.76l3.24 5.07A2 2 0 0120.62 15H18v0h-1.5l.3.9a1 1 0 01-.93 1.32h-.24a1 1 0 01-1.26-1.24l.32-.98H5.31l.32.98A1 1 0 014.37 17.2h-.24A1 1 0 012.88 15.9L3 14.76V15H2.38a1 1 0 01-.86-1.52L4.74 8.3A2 2 0 015 9.24V5zm2 1a1 1 0 100 2h10a1 1 0 100-2H5z"
                      clipRule="evenodd"
                    />
                  </svg>
                }
                tone={TONE_COUNT}
                hint="The backend's own count of sales in the period — payment rows are never counted as transactions."
                value={transactionsValue}
                unit={summary.data ? (summary.data.transactionCount === 1 ? "sale" : "sales") : undefined}
                note="One sale = one transaction"
                loading={summary.loading}
                error={summary.error}
                onRetry={summary.reload}
              />
              <KpiCard
                label="Paid"
                icon={
                  <svg viewBox="0 0 20 20" fill="currentColor" className={ICON} aria-hidden>
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.7-9.7a1 1 0 00-1.4-1.4L9 10.2 7.7 8.9a1 1 0 00-1.4 1.4l2 2a1 1 0 001.4 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                }
                tone={TONE_PAID}
                hint="Sum of the backend's recorded payment amounts. Change given back to the customer is not collected revenue."
                value={paidValue}
                note="Payments actually collected"
                loading={summary.loading}
                error={summary.error}
                onRetry={summary.reload}
              />
              <KpiCard
                label="Outstanding"
                icon={
                  <svg viewBox="0 0 20 20" fill="currentColor" className={ICON} aria-hidden>
                    <path
                      fillRule="evenodd"
                      d="M10 2a8 8 0 100 16 8 8 0 000-16zm1 4a1 1 0 10-2 0v4a1 1 0 000 2h2a1 1 0 100-2h-1V6h1z"
                      clipRule="evenodd"
                    />
                  </svg>
                }
                tone={TONE_DUE}
                hint="Total sales minus paid amount for the period. This is an unpaid remainder, not a payment method."
                value={outstandingValue}
                note="Unpaid balance on sales"
                loading={summary.loading}
                error={summary.error}
                onRetry={summary.reload}
              />
            </div>
          )}
        </section>

        {/* ── Sales Overview + Payment Breakdown ─────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
          <SalesOverviewChart
            points={trend.data}
            granularity={granularity}
            loading={trend.loading}
            error={trend.error}
            onRetry={trend.reload}
          />
          <PaymentBreakdown
            entries={summary.data?.paymentsByMethod}
            loading={summary.loading}
            error={summary.error}
            onRetry={summary.reload}
          />
        </div>

        {/* ── Recent Sales ───────────────────────────────────────────────── */}
        <RecentSalesTable
          sales={recent.data?.data ?? []}
          loading={recent.loading}
          error={recent.error}
          onRetry={recent.reload}
          page={page}
          totalPages={recent.data?.meta.totalPages ?? 1}
          totalCount={recent.data?.meta.total ?? 0}
          onPageChange={setPage}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={toggleSort}
        />
      </div>
    </div>
  );
}
