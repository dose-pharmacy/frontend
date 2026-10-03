// ── Finance Reports · sections ───────────────────────────────────────────────
// One component per section of `GET /finance-reporting/report`. Each reads only
// from the response; none computes a money figure the backend already supplies.
//
// RULES OBSERVED IN EVERY SECTION
//  • `grossMargin` arrives as a PERCENTAGE (`20` = 20%). It is displayed through a
//    pass-through formatter, never multiplied by 100.
//  • A zero renders as 0.00 ETB. Only an ABSENT value renders as "—". The two
//    are different facts and must never look alike.
//  • Trend buckets are never dropped or regrouped. The backend emits empty
//    buckets as zeroes on purpose, so "all buckets are zero" is plottable data,
//    not an empty result — see `trendsHaveActivity`.
//  • A section flagged `COMPANY` in `scopeNotes` ignores the location and
//    product-group filters, and says so in its header via `ScopeBadge`.
//  • Every chart has an aria-label summary AND a real data table below it, so
//    nothing is conveyed by colour or position alone.

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FinanceReport, PaymentMethodTotal } from "../../features/finance/financeReportingApi";
import { fmtCompact, fmtMoneyNumber, ratioPercent } from "../../utils/format";
import { SalesWaterfallBar } from "./components/OverviewBars";
import {
  ChartFrame,
  CountValue,
  EmptyState,
  LegendSwatch,
  MoneyValue,
  PercentValue,
  ProgressBar,
  ScopeBadge,
  SectionCard,
  StatCard,
  ToggleButton,
} from "./components/primitives";
import { GRID, SERIES, TEXT, expirySeverityColor } from "./components/tokens";
import {
  granularityHint,
  paymentData,
  shouldUseBars,
  toFiniteNumber,
  trendAxisMax,
  trendsHaveActivity,
  useExpiryData,
  useLocationRows,
  useProductGroupRows,
  useTrendData,
  type TrendDatum,
} from "./financeCharts";
import { GRANULARITY_WORD, scopeBasisOf } from "./financeReportsView";

// ─── Tooltips ────────────────────────────────────────────────────────────────

/**
 * A currency tooltip.
 *
 * The value is formatted through `fmtMoneyNumber` so it reads as an amount, and
 * any non-finite payload entry is dropped rather than rendered as "NaN".
 */
function MoneyTooltip({
  active,
  payload,
  label,
  seriesNames,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ name?: string | number; dataKey?: string | number; value?: unknown; color?: string }>;
  label?: string | number;
  /** Optional override of the displayed series name per dataKey. */
  seriesNames?: Record<string, string>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm">
      {label !== undefined && <p className="mb-1 text-xs font-semibold text-text-primary">{label}</p>}
      <div className="flex flex-col gap-0.5">
        {payload.map((entry, i) => {
          const key = String(entry.dataKey ?? i);
          const name = seriesNames?.[key] ?? String(entry.name ?? key);
          const value = toFiniteNumber(entry.value);
          return (
            <p key={i} className="flex items-center gap-2 text-xs text-text-secondary">
              <span
                className="w-2 h-2 rounded-sm shrink-0"
                style={{ backgroundColor: entry.color }}
                aria-hidden
              />
              <span>{name}</span>
              <span className="ml-auto font-semibold tabular-nums text-text-primary">
                {fmtMoneyNumber(value) ?? "—"} ETB
              </span>
            </p>
          );
        })}
      </div>
    </div>
  );
}

/** A value tooltip for the payment-method / breakdown charts. */
function ValueTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ name?: string | number; dataKey?: string | number; value?: unknown; color?: string }>;
  label?: string | number;
  unit: "money" | "count";
}) {
  if (!active || !payload || payload.length === 0) return null;
  const first = payload[0];
  const value = toFiniteNumber(first?.value);
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm">
      {label !== undefined && <p className="mb-1 text-xs font-semibold text-text-primary">{label}</p>}
      <p className="text-xs text-text-secondary">
        {value === null
          ? "—"
          : unit === "money"
            ? `${fmtMoneyNumber(value)} ETB`
            : value.toLocaleString("en-ET")}
      </p>
    </div>
  );
}

const AXIS = { stroke: "#B0B0A8", fontSize: 11 } as const;

// ─── 1 · KPI strip ───────────────────────────────────────────────────────────

/** The six headline figures, all read from `summary` and the purchasing section. */
export function ReportKpiStrip({ data }: { data: FinanceReport }) {
  const s = data.summary;
  const p = data.purchasing;
  const cards: { label: string; node: React.ReactNode; tone?: "positive" | "negative" | "warning"; hint?: string }[] = [
    {
      label: "Net Sales After Returns",
      node: <MoneyValue value={s?.netSalesAfterReturns} tone="positive" />,
      tone: "positive",
    },
    { label: "Gross Profit", node: <MoneyValue value={s?.grossProfit} tone="positive" />, tone: "positive" },
    { label: "Gross Margin", node: <PercentValue value={s?.grossMargin} tone="positive" />, tone: "positive" },
    { label: "Net Purchases", node: <MoneyValue value={p?.netPurchases} /> },
    { label: "Customer Collections", node: <MoneyValue value={s?.customerCollections} tone="positive" />, tone: "positive" },
    {
      label: "Supplier Outstanding",
      node: <MoneyValue value={p?.supplierOutstanding} tone="warning" />,
      tone: "warning",
    },
  ];

  // Six cards × `lg:col-span-2` fills exactly one 12-col row on desktop, two
  // rows on tablet and one column on mobile — so there is never an orphan cell.
  return (
    <div className={GRID}>
      {cards.map((c) => (
        <div key={c.label} className="lg:col-span-2">
          <StatCard label={c.label} tone={c.tone} hint={c.hint} className="h-full">
            {c.node}
          </StatCard>
        </div>
      ))}
    </div>
  );
}

// ─── 2 · Sales & profitability trends ────────────────────────────────────────

type TrendSeriesKey =
  | "netSales"
  | "grossProfit"
  | "customerCollections"
  | "supplierPayments"
  | "supplierReturns";

const TREND_SERIES: { key: TrendSeriesKey; label: string; color: string }[] = [
  { key: "netSales", label: "Net sales", color: SERIES.netSales },
  { key: "grossProfit", label: "Gross profit", color: SERIES.grossProfit },
  { key: "customerCollections", label: "Customer collections", color: SERIES.collections },
  { key: "supplierPayments", label: "Supplier payments", color: SERIES.supplierPayments },
  { key: "supplierReturns", label: "Supplier returns", color: SERIES.supplierReturns },
];

const TREND_SERIES_NAMES: Record<string, string> = Object.fromEntries(
  TREND_SERIES.map((s) => [s.key, s.label]),
);

/**
 * The composed trend chart: bars for net sales, a line for gross profit, and
 * three further series the reader can toggle off.
 *
 * THE SMALL-N FIX. A line encodes the relationship BETWEEN points, so one bucket
 * is not a line — and with dots off, that single value was invisible. Under three
 * buckets every line series switches its dots ON, so a lone bucket is still a
 * visible mark rather than a blank axis, and net sales is always a BAR (drawn as
 * a length, so one bucket is one visible column). The Y domain is floored at 1 so
 * an all-zero window still has somewhere to draw its zeros.
 *
 * The chart stays a ComposedChart at every bucket count. Swapping to a plain
 * BarChart for small N would be tidier, but BarChart silently ignores <Line>
 * children — so enabling "Customer collections" on a 2-bucket range would look
 * like a broken toggle. One chart type keeps every legend switch honest.
 */
export function ReportTrendsPanel({ data }: { data: FinanceReport }) {
  const { granularity, points } = useTrendData(data);
  const [hidden, setHidden] = useState<Set<TrendSeriesKey>>(new Set());
  const hasActivity = trendsHaveActivity(points);
  // Fewer than three buckets cannot express a trend, so every line series is
  // given dot markers. See the note above the function.
  const showDots = shouldUseBars(points.length);
  const hint = granularityHint(points.length, granularity);
  const active = TREND_SERIES.filter((s) => !hidden.has(s.key));
  const axisMax = trendAxisMax(points);

  function toggle(key: TrendSeriesKey) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const Chart = ComposedChart;

  return (
    <SectionCard
      title="Sales & Profitability Trends"
      subtitle={`${GRANULARITY_WORD[granularity]} buckets across the effective range`}
      action={
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {TREND_SERIES.map((s) => (
            <ToggleButton
              key={s.key}
              active={!hidden.has(s.key)}
              onClick={() => toggle(s.key)}
              title={`${hidden.has(s.key) ? "Show" : "Hide"} ${s.label}`}
            >
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-sm"
                  style={{ backgroundColor: hidden.has(s.key) ? "#C8C8C0" : s.color }}
                  aria-hidden
                />
                {s.label}
              </span>
            </ToggleButton>
          ))}
        </div>
      }
      bodyClassName="p-4 flex flex-col gap-3"
    >
      {points.length === 0 ? (
        <EmptyState
          message="No trend buckets in this range."
          hint="Widen the date range or choose a different granularity."
          icon="chart"
        />
      ) : (
        <>
          {!hasActivity && (
            <p className="rounded-lg border border-gray-200 bg-canvas px-3 py-2 text-xs text-text-secondary">
              Every bucket in this range is zero — a real result, not missing data. The buckets
              below are the ones the server returned.
            </p>
          )}
          {hint && <p className={`${TEXT.hint}`}>{hint}</p>}

          <ChartFrame
            title={`Net sales and gross profit by ${GRANULARITY_WORD[granularity]} bucket`}
            height={280}
          >
            <Chart data={points} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
              <CartesianGrid stroke="#E6ECE2" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={8} />
              <YAxis {...AXIS} width={52} tickFormatter={fmtCompact} domain={[0, axisMax]} />
              <Tooltip
                content={<MoneyTooltip seriesNames={TREND_SERIES_NAMES} />}
                cursor={{ fill: "#E6ECE2", opacity: 0.4 }}
              />
              <ReferenceLine y={0} stroke="#C8C8C0" />
              {active.some((s) => s.key === "netSales") && (
                <Bar dataKey="netSales" fill={SERIES.netSales} radius={[3, 3, 0, 0]} maxBarSize={64} isAnimationActive={false} />
              )}
              {active.some((s) => s.key === "grossProfit") && (
                <Line
                  type="monotone"
                  dataKey="grossProfit"
                  stroke={SERIES.grossProfit}
                  strokeWidth={2}
                  dot={showDots}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              )}
              {active.some((s) => s.key === "customerCollections") && (
                <Line
                  type="monotone"
                  dataKey="customerCollections"
                  stroke={SERIES.collections}
                  strokeWidth={2}
                  dot={showDots}
                  isAnimationActive={false}
                />
              )}
              {active.some((s) => s.key === "supplierPayments") && (
                <Line
                  type="monotone"
                  dataKey="supplierPayments"
                  stroke={SERIES.supplierPayments}
                  strokeWidth={2}
                  dot={showDots}
                  isAnimationActive={false}
                />
              )}
              {active.some((s) => s.key === "supplierReturns") && (
                <Line
                  type="monotone"
                  dataKey="supplierReturns"
                  stroke={SERIES.supplierReturns}
                  strokeWidth={2}
                  dot={showDots}
                  isAnimationActive={false}
                />
              )}
            </Chart>
          </ChartFrame>

          <p className={TEXT.meta}>
            Toggle a series to show or hide it. {points.length} {GRANULARITY_WORD[granularity]}{" "}
            bucket{points.length === 1 ? "" : "s"} returned.
          </p>

          {/* The visible data-table fallback: exact figures without hovering. */}
          <TrendTable points={points} />
        </>
      )}
    </SectionCard>
  );
}

function TrendTable({ points }: { points: TrendDatum[] }) {
  return (
    <details className="rounded-lg border border-gray-200">
      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-mid">
        View trend data as a table
      </summary>
      <div className="overflow-x-auto border-t border-gray-200">
        <table className="w-full" style={{ minWidth: 620 }}>
          <thead>
            <tr className="bg-canvas">
              {["Bucket", "Net sales", "Gross profit", "Collections", "Supplier payments"].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-text-secondary"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {points.map((p) => (
              <tr key={String(p.label)}>
                <th scope="row" className="px-3 py-2 text-left text-xs font-medium text-text-primary whitespace-nowrap">
                  {p.label}
                </th>
                <td className="px-3 py-2 text-xs tabular-nums">{fmtMoneyNumber(p.netSales) ?? "—"}</td>
                <td className="px-3 py-2 text-xs tabular-nums">{fmtMoneyNumber(p.grossProfit) ?? "—"}</td>
                <td className="px-3 py-2 text-xs tabular-nums">{fmtMoneyNumber(p.customerCollections) ?? "—"}</td>
                <td className="px-3 py-2 text-xs tabular-nums">{fmtMoneyNumber(p.supplierPayments) ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

// ─── 3 · Sales performance ───────────────────────────────────────────────────

/**
 * Payment methods as a share breakdown.
 *
 * A single returned method gets a compact stat plus one full-width row, because
 * a one-column bar chart on a 0–6,000 axis is a lonely bar that says less than a
 * labelled figure. Two or more methods get a donut. Either way the numbers are
 * the backend's `amount` values and the table below lists them exactly.
 */
export function PaymentMethodBreakdown({
  methods,
  title,
}: {
  methods: PaymentMethodTotal[] | undefined;
  title: string;
}) {
  const rows = useMemo(() => paymentData(methods), [methods]);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const single = rows.length === 1;

  if (rows.length === 0) {
    return <EmptyState message="No payment methods reported." icon="chart" compact />;
  }

  const donutData = rows.map((r) => ({ name: r.method, value: r.amount }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className={TEXT.cardLabel}>Total</span>
        <MoneyValue value={total} size="sm" />
      </div>

      {single ? (
        <div className="flex flex-col gap-2 p-4 rounded-xl border border-gray-200/80 bg-white">
          {rows.map((r) => (
            <div key={r.method} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-text-secondary">{r.method}</span>
                <MoneyValue value={r.amount} size="sm" tone="positive" />
              </div>
              <div className="h-3.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full transition-all" style={{ width: "100%", backgroundColor: SERIES.netSales }} />
              </div>
              <p className={TEXT.meta}>100% of {fmtMoneyNumber(total) ?? "—"} ETB</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="w-full sm:w-1/2 min-w-0">
            <ChartFrame title={`${title} by payment method`} height={190}>
              <PieChart>
                <Tooltip content={<ValueTooltip unit="money" />} />
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={78}
                  paddingAngle={2}
                  isAnimationActive={false}
                  stroke="#fff"
                >
                  {rows.map((r, i) => (
                    <Cell key={r.method} fill={[SERIES.netSales, SERIES.collections, SERIES.supplierPayments, SERIES.supplierReturns, SERIES.grossSales][i % 5]} />
                  ))}
                </Pie>
              </PieChart>
            </ChartFrame>
          </div>
          <ul className="flex-1 flex flex-col gap-2.5 min-w-0">
            {rows.map((r, i) => (
              <li key={r.method} className="flex items-center justify-between gap-2">
                <LegendSwatch
                  color={[SERIES.netSales, SERIES.collections, SERIES.supplierPayments, SERIES.supplierReturns, SERIES.grossSales][i % 5]}
                  label={r.method}
                />
                <span className="text-xs tabular-nums text-text-secondary">
                  {r.pct.toFixed(1)}% · {fmtMoneyNumber(r.amount) ?? "—"} ETB
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Sales performance: a small stat row, the gross → net funnel, then the three
 * breakdowns side by side on desktop with their full tables collapsed beneath.
 */
export function ReportSalesPanel({ data }: { data: FinanceReport }) {
  const sp = data.salesPerformance;
  const locations = useLocationRows(data);
  const groups = useProductGroupRows(data);
  const basis = scopeBasisOf(data, "salesPerformance");

  return (
    <SectionCard
      title="Sales Performance"
      subtitle="Transaction mix, payment methods and breakdowns"
      action={basis ? <ScopeBadge basis={basis} /> : undefined}
      bodyClassName="p-5 sm:p-6 flex flex-col gap-6"
    >
      {/* Stat row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Transactions" className="min-h-[115px] sm:min-h-[125px]">
          <CountValue value={sp?.transactionCount} size="sm" />
        </StatCard>
        <StatCard label="Units Sold" className="min-h-[115px] sm:min-h-[125px]">
          <CountValue value={sp?.unitsSold} size="sm" tone="neutral" />
        </StatCard>
        <StatCard label="Avg Transaction Value" className="min-h-[115px] sm:min-h-[125px]">
          <MoneyValue value={sp?.averageTransactionValue} size="sm" />
        </StatCard>
      </div>

      {/* Funnel */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200/70 bg-canvas/40 p-4 sm:p-5">
        <p className={TEXT.cardLabel}>Gross to net</p>
        <SalesWaterfallBar
          grossSales={sp?.grossSales}
          discounts={sp?.discounts}
          customerReturns={sp?.customerReturns}
          netSalesAfterReturns={sp?.netSalesAfterReturns}
        />
      </div>

      {/* Three breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        <div className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 min-h-[360px] shadow-xs">
          <div>
            <p className={TEXT.cardLabel}>Payment method</p>
            <div className="mt-3">
              <PaymentMethodBreakdown methods={sp?.byPaymentMethod} title="Sales" />
            </div>
          </div>
        </div>

        <HorizontalBreakdown
          title="By location"
          subtitle="Top 8 by net sales"
          rows={locations.top.map((r) => ({
            id: r.locationId,
            name: r.locationName,
            value: toFiniteNumber(r.netSales) ?? 0,
            extra: `${(toFiniteNumber(r.transactionCount) ?? 0).toLocaleString("en-ET")} transactions`,
          }))}
          allRows={locations.all.map((r) => ({
            id: r.locationId,
            name: r.locationName,
            value: toFiniteNumber(r.netSales) ?? 0,
            extra: `${(toFiniteNumber(r.transactionCount) ?? 0).toLocaleString("en-ET")} transactions`,
          }))}
        />

        <HorizontalBreakdown
          title="By product group"
          subtitle="Top 8 by line revenue"
          rows={groups.top.map((r) => ({
            id: r.productGroupId ?? r.productGroupName,
            name: r.productGroupName,
            value: toFiniteNumber(r.lineRevenue) ?? 0,
            extra: `${(toFiniteNumber(r.unitsSold) ?? 0).toLocaleString("en-ET")} units`,
          }))}
          allRows={groups.all.map((r) => ({
            id: r.productGroupId ?? r.productGroupName,
            name: r.productGroupName,
            value: toFiniteNumber(r.lineRevenue) ?? 0,
            extra: `${(toFiniteNumber(r.unitsSold) ?? 0).toLocaleString("en-ET")} units`,
          }))}
        />
      </div>
    </SectionCard>
  );
}

/**
 * A ranked horizontal bar breakdown with the full list behind a native
 * `<details>`, so the top-N view is never the only way to read a figure.
 *
 * Long location and product-group names are truncated visually and kept intact
 * in a `title` tooltip and in the table, so a name is never lost to a layout.
 */
function HorizontalBreakdown({
  title,
  subtitle,
  rows,
  allRows,
}: {
  title: string;
  subtitle?: string;
  rows: { id: string; name: string; value: number; extra?: string }[];
  allRows: { id: string; name: string; value: number; extra?: string }[];
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);

  if (allRows.length === 0) {
    return (
      <div className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 min-h-[360px] shadow-xs">
        <div>
          <p className={TEXT.cardLabel}>{title}</p>
          <div className="mt-3">
            <EmptyState message="No data reported." icon="list" compact />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-5 min-h-[360px] shadow-xs">
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <p className={TEXT.cardLabel}>{title}</p>
          <span className={TEXT.meta}>{allRows.length} total</span>
        </div>
        {subtitle && <p className="mt-0.5 text-[11px] text-text-muted">{subtitle}</p>}

        <div className="flex flex-col gap-2.5 mt-3">
          {rows.map((r) => (
            <div key={r.id} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-xs font-medium text-text-secondary" title={r.name}>
                  {r.name}
                </span>
                <span className="shrink-0 text-xs tabular-nums font-semibold text-text-primary">
                  {fmtMoneyNumber(r.value) ?? "—"}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${(r.value / max) * 100}%`, backgroundColor: SERIES.netSales }}
                />
              </div>
              {r.extra && <span className="text-[11px] text-text-muted">{r.extra}</span>}
            </div>
          ))}
        </div>
      </div>

      <details className="rounded-lg border border-gray-200 mt-4 bg-canvas/30">
        <summary className="cursor-pointer px-3 py-2 text-[11px] font-semibold text-text-secondary hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-mid">
          View all {allRows.length} as a table
        </summary>
        <div className="overflow-x-auto border-t border-gray-200 max-h-56 overflow-y-auto">
          <table className="w-full" style={{ minWidth: 320 }}>
            <thead className="sticky top-0 bg-canvas">
              <tr>
                <th scope="col" className="px-3 py-1.5 text-left text-[11px] font-bold uppercase tracking-wide text-text-secondary">
                  {title.replace("By ", "")}
                </th>
                <th scope="col" className="px-3 py-1.5 text-right text-[11px] font-bold uppercase tracking-wide text-text-secondary">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {allRows.map((r) => (
                <tr key={r.id}>
                  <th scope="row" className="px-3 py-1.5 text-left text-xs font-normal text-text-primary" title={r.name}>
                    <span className="block max-w-[180px] truncate">{r.name}</span>
                  </th>
                  <td className="px-3 py-1.5 text-right text-xs tabular-nums">{fmtMoneyNumber(r.value) ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

// ─── 4 · Profitability ───────────────────────────────────────────────────────

/** A ring gauge. `percent` is the backend's already-scaled margin. */
function MarginRing({ percent }: { percent: number | undefined }) {
  const value = typeof percent === "number" && Number.isFinite(percent) ? percent : null;
  const r = 48;
  const circumference = 2 * Math.PI * r;
  // Clamped for GEOMETRY only — the displayed figure is the backend's own value,
  // never the clamped one.
  const clamped = value === null ? 0 : Math.max(0, Math.min(100, value));
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5 p-5 rounded-xl border border-gray-200 bg-white min-h-[190px] shadow-xs h-full justify-center">
      <svg viewBox="0 0 120 120" className="w-32 h-32 shrink-0" role="img" aria-label={`Gross margin ${value === null ? "not reported" : `${value.toFixed(1)}%`}`}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="#E6ECE2" strokeWidth="12" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={SERIES.netSales}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 60 60)"
        />
        <text
          x="60"
          y="65"
          textAnchor="middle"
          className="fill-text-primary"
          style={{ fontSize: 20, fontWeight: 700 }}
        >
          {value === null ? "—" : `${value.toFixed(1)}%`}
        </text>
      </svg>
      <div className="flex flex-col gap-1.5 min-w-0 text-center sm:text-left">
        <p className={TEXT.cardLabel}>Gross margin</p>
        <p className="text-xs text-text-secondary">
          Supplied as a percentage by the API and shown unchanged — it is not multiplied.
        </p>
      </div>
    </div>
  );
}

/**
 * Net sales, COGS and gross profit as a stacked bar.
 *
 * The two segments are the backend's own `cogs` and `grossProfit`; the total
 * printed beside them is `netSales` as sent. The bar is scaled by the larger of
 * those three real figures, so no residual is invented to force the stack to
 * close, and a disagreement between them would be visible rather than hidden.
 */
export function ReportProfitabilityPanel({ data }: { data: FinanceReport }) {
  const p = data.profitability;
  const cogs = toFiniteNumber(p?.cogs) ?? 0;
  const profit = toFiniteNumber(p?.grossProfit) ?? 0;
  const netSales = toFiniteNumber(p?.netSales) ?? 0;
  const scale = Math.max(cogs + profit, netSales, 1);
  const cogsPct = (cogs / scale) * 100;
  const profitPct = (profit / scale) * 100;

  return (
    <SectionCard
      title="Profitability"
      subtitle="Cost of goods and gross profit against net sales"
      bodyClassName="p-5 sm:p-6 flex flex-col gap-6"
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div
            className="flex h-11 sm:h-12 w-full overflow-hidden rounded-xl bg-gray-100 shadow-inner"
            role="img"
            aria-label={`COGS ${fmtMoneyNumber(cogs) ?? "—"} ETB and gross profit ${fmtMoneyNumber(profit) ?? "—"} ETB, against net sales of ${fmtMoneyNumber(netSales) ?? "—"} ETB`}
          >
            <div className="h-full transition-all" style={{ width: `${cogsPct}%`, backgroundColor: SERIES.neutral }} />
            <div className="h-full transition-all" style={{ width: `${profitPct}%`, backgroundColor: SERIES.netSales }} />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Net Sales" tone="positive" className="h-full">
              <MoneyValue value={p?.netSales} tone="positive" size="sm" />
            </StatCard>
            <StatCard label="COGS" className="h-full">
              <MoneyValue value={p?.cogs} size="sm" />
            </StatCard>
            <StatCard label="Returned COGS" tone="negative" hint="Cost of goods returned by customers" className="h-full">
              <MoneyValue value={data.summary?.returnedCogs} tone="negative" size="sm" />
            </StatCard>
            <StatCard label="Gross Profit" tone="positive" className="h-full">
              <MoneyValue value={p?.grossProfit} tone="positive" size="sm" />
            </StatCard>
          </div>
          <p className={TEXT.meta}>
            COGS and gross profit are stacked; the bar is scaled to the larger of their sum and
            net sales, so the figures are shown as sent rather than forced to reconcile.
          </p>
        </div>
        <div className="lg:col-span-1 flex flex-col">
          <MarginRing percent={p?.grossMargin} />
        </div>
      </div>
    </SectionCard>
  );
}

// ─── 5 · Purchasing ──────────────────────────────────────────────────────────

/** Small icon tiles for the purchasing activity counts. */
function ActivityTile({
  icon,
  label,
  value,
}: {
  icon: "box" | "file" | "return" | "cash" | "alert";
  label: string;
  value: number | undefined;
}) {
  const paths: Record<string, string> = {
    box: "M3 6.5A1.5 1.5 0 014.5 5h3.879a1.5 1.5 0 011.06.44l.682.68A.5.5 0 0010.5 6h5A1.5 1.5 0 0117 7.5v8a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 013 15.5v-9z",
    file: "M4 3.5A1.5 1.5 0 015.5 2h5L16 7.5v9a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 014 16.5v-13z",
    return: "M4 9a6 6 0 116 4.9V17l-3-2 3-2v3.1A6 6 0 114 9z",
    cash: "M2 5.5A1.5 1.5 0 013.5 4h13A1.5 1.5 0 0118 5.5v9a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 012 14.5v-9z",
    alert: "M10 2a8 8 0 100 16 8 8 0 000-16zm0 4a1 1 0 011 1v4a1 1 0 11-2 0V7a1 1 0 011-1zm0 8.5a1.2 1.2 0 100-2.4 1.2 1.2 0 000 2.4z",
  };
  return (
    <div className="flex flex-col justify-between rounded-xl border border-gray-200/90 bg-white p-4 sm:p-5 min-h-[105px] sm:min-h-[115px] shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <svg viewBox="0 0 20 20" className="w-5 h-5 shrink-0 text-text-muted" fill="currentColor" aria-hidden>
          <path fillRule="evenodd" d={paths[icon]} clipRule="evenodd" />
        </svg>
        <span className="text-xl sm:text-2xl font-bold tabular-nums text-text-primary leading-none">
          {typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("en-ET") : "—"}
        </span>
      </div>
      <p className="mt-2 text-xs font-medium text-text-secondary truncate">{label}</p>
    </div>
  );
}

/** Gross purchases → supplier returns → net purchases, as a stacked track. */
function PurchasingFlow({ p }: { p: FinanceReport["purchasing"] }) {
  const gross = toFiniteNumber(p?.grossPurchases) ?? 0;
  const returns = toFiniteNumber(p?.supplierReturns) ?? 0;
  const net = toFiniteNumber(p?.netPurchases) ?? 0;
  const scale = Math.max(gross, 1);
  const pct = (v: number) => (scale > 0 ? (v / scale) * 100 : 0);

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex h-10 sm:h-11 w-full overflow-hidden rounded-xl bg-gray-100 shadow-inner"
        role="img"
        aria-label={`Gross purchases ${fmtMoneyNumber(gross) ?? "—"} ETB, supplier returns ${fmtMoneyNumber(returns) ?? "—"} ETB, net purchases ${fmtMoneyNumber(net) ?? "—"} ETB`}
      >
        <div className="h-full transition-all" style={{ width: `${pct(returns)}%`, backgroundColor: SERIES.supplierReturns }} />
        <div className="h-full transition-all" style={{ width: `${pct(net)}%`, backgroundColor: SERIES.netSales }} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Gross Purchases" className="h-full">
          <MoneyValue value={p?.grossPurchases} size="sm" />
        </StatCard>
        <StatCard label="Supplier Returns" tone="negative" className="h-full">
          <MoneyValue value={p?.supplierReturns} tone="negative" size="sm" />
        </StatCard>
        <StatCard label="Net Purchases" tone="positive" className="h-full">
          <MoneyValue value={p?.netPurchases} tone="positive" size="sm" />
        </StatCard>
      </div>
    </div>
  );
}

export function ReportPurchasingPanel({ data }: { data: FinanceReport }) {
  const p = data.purchasing;
  const basis = scopeBasisOf(data, "purchasing");
  // A chart proportion only — the invoice total and the payments are both real
  // backend figures, and a zero invoice yields "—" rather than a fabricated 0%.
  const paidPct = ratioPercent(toFiniteNumber(p?.supplierPayments), toFiniteNumber(p?.invoiceAmount));

  return (
    <SectionCard
      title="Purchasing"
      subtitle="Purchase flow, payments and outstanding balance"
      action={basis ? <ScopeBadge basis={basis} /> : undefined}
      bodyClassName="p-5 sm:p-6 flex flex-col gap-6"
    >
      <PurchasingFlow p={p} />

      {/* Payments against invoices */}
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200/70 bg-canvas/40 p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className={TEXT.cardLabel}>Payments against invoice value</p>
          <span className="text-xs font-semibold text-text-secondary">
            {fmtMoneyNumber(p?.supplierPayments) ?? "—"} of {fmtMoneyNumber(p?.invoiceAmount) ?? "—"} ETB
            {paidPct !== null ? ` · ${paidPct.toFixed(0)}%` : ""}
          </span>
        </div>
        <ProgressBar pct={paidPct} tone="positive" className="h-3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-1">
          <StatCard label="Supplier Payments" tone="positive" className="h-full">
            <MoneyValue value={p?.supplierPayments} tone="positive" size="sm" />
          </StatCard>
          <StatCard label="Supplier Outstanding" tone="warning" className="h-full">
            <MoneyValue value={p?.supplierOutstanding} tone="warning" size="sm" />
          </StatCard>
        </div>
      </div>

      {/* Activity counts */}
      <div className="flex flex-col gap-3">
        <p className={TEXT.cardLabel}>Activity in range</p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <ActivityTile icon="box" label="Purchase orders" value={p?.purchaseOrderCount} />
          <ActivityTile icon="file" label="Invoices" value={p?.invoiceCount} />
          <ActivityTile icon="return" label="Supplier returns" value={p?.supplierReturnCount} />
          <ActivityTile icon="cash" label="Payments" value={p?.supplierPaymentCount} />
          <ActivityTile icon="alert" label="Invoices outstanding" value={p?.outstandingInvoiceCount} />
        </div>
      </div>

      {/* The two supplier-return effect fields */}
      <div className="flex flex-col gap-3">
        <p className={TEXT.cardLabel}>Supplier return effects</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard label="Applied to Payable" tone="negative" hint="Returned value that reduced money owed to the supplier" className="h-full">
            <MoneyValue value={p?.supplierReturnAppliedToPayable} tone="negative" size="sm" />
          </StatCard>
          <StatCard label="Credit Effect" tone="negative" hint="Credit the return generated against future purchases" className="h-full">
            <MoneyValue value={p?.supplierReturnCreditEffect} tone="negative" size="sm" />
          </StatCard>
        </div>
      </div>
    </SectionCard>
  );
}

// ─── 6 · Collections ─────────────────────────────────────────────────────────

export function ReportCollectionsPanel({ data }: { data: FinanceReport }) {
  const c = data.collections;
  const basis = scopeBasisOf(data, "collections");
  const collected = toFiniteNumber(c?.customerCollections) ?? 0;
  const receivable = toFiniteNumber(c?.customerReceivables) ?? 0;
  const scale = Math.max(collected + receivable, 1);
  const collectedPct = (collected / scale) * 100;
  const receivablePct = (receivable / scale) * 100;

  return (
    <SectionCard
      title="Collections"
      subtitle="Cash received against money still owed"
      action={basis ? <ScopeBadge basis={basis} /> : undefined}
      bodyClassName="p-5 sm:p-6 flex flex-col gap-6"
    >
      <div className="flex flex-col gap-3 rounded-xl border border-gray-200/70 bg-canvas/40 p-4 sm:p-5">
        <p className={TEXT.cardLabel}>Collected versus receivable</p>
        <div
          className="flex h-10 sm:h-11 w-full overflow-hidden rounded-xl bg-gray-100 shadow-inner"
          role="img"
          aria-label={`Customer collections ${fmtMoneyNumber(collected) ?? "—"} ETB against receivables of ${fmtMoneyNumber(receivable) ?? "—"} ETB`}
        >
          <div className="h-full transition-all" style={{ width: `${collectedPct}%`, backgroundColor: SERIES.collections }} />
          <div className="h-full transition-all" style={{ width: `${receivablePct}%`, backgroundColor: SERIES.supplierPayments }} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard label="Customer Collections" tone="positive" className="h-full">
            <MoneyValue value={c?.customerCollections} tone="positive" size="sm" />
          </StatCard>
          <StatCard label="Customer Receivables" tone="warning" className="h-full">
            <MoneyValue value={c?.customerReceivables} tone="warning" size="sm" />
          </StatCard>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 min-h-[220px] shadow-xs">
        <p className={`${TEXT.cardLabel} mb-3`}>By payment method</p>
        <PaymentMethodBreakdown methods={c?.byPaymentMethod} title="Collections" />
      </div>
    </SectionCard>
  );
}

// ─── 7 · Inventory value ─────────────────────────────────────────────────────

/**
 * Inventory value with an expiry-bucket chart that can switch between value and
 * quantity.
 *
 * Quantity is the default because it is the more informative measure for the
 * buckets where value is unhelpful: expired stock is frequently written down to
 * zero, so a value chart shows a 0.00 ETB bar for what may be thousands of units
 * that still need disposing of. Both measures are available and the table below
 * always shows both.
 */
export function ReportInventoryPanel({ data }: { data: FinanceReport }) {
  const inv = data.inventoryValue;
  const buckets = useExpiryData(data);
  const [metric, setMetric] = useState<"value" | "quantity">("quantity");
  const basis = scopeBasisOf(data, "inventoryValue");

  return (
    <SectionCard
      title="Inventory Value"
      subtitle="Stock on hand valued at batch cost"
      action={basis ? <ScopeBadge basis={basis} /> : undefined}
      bodyClassName="p-5 sm:p-6 flex flex-col gap-6"
    >
      {/* Headline stats */}
      <div className={GRID}>
        <div className="lg:col-span-3">
          <StatCard label="Total Value" className="h-full min-h-[125px] sm:min-h-[135px]">
            <MoneyValue value={inv?.totalValue} size="lg" />
          </StatCard>
        </div>
        <div className="lg:col-span-3">
          <StatCard label="Batch Cost Value" className="h-full min-h-[125px] sm:min-h-[135px]">
            <MoneyValue value={inv?.batchCostValue} size="lg" />
          </StatCard>
        </div>
        <div className="lg:col-span-3">
          <StatCard label="Total Quantity" className="h-full min-h-[125px] sm:min-h-[135px]">
            <CountValue value={inv?.totalQuantity} size="lg" />
          </StatCard>
        </div>
        <div className="lg:col-span-3">
          <StatCard label="Stocked Products" className="h-full min-h-[125px] sm:min-h-[135px]">
            <CountValue value={inv?.stockedProducts} size="lg" />
          </StatCard>
        </div>
        <div className="lg:col-span-6">
          <StatCard label="Expired Value" tone="negative" hint="Stock past its expiry date" className="h-full min-h-[125px] sm:min-h-[135px]">
            <MoneyValue value={inv?.expiredValue} tone="negative" size="lg" />
          </StatCard>
        </div>
        <div className="lg:col-span-6">
          <StatCard label="Expiring in 30 Days" tone="warning" hint="Stock expiring within the next 30 days" className="h-full min-h-[125px] sm:min-h-[135px]">
            <MoneyValue value={inv?.expiringWithin30DaysValue} tone="warning" size="lg" />
          </StatCard>
        </div>
      </div>

      {/* Expiry buckets */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={TEXT.cardLabel}>Stock by expiry window</p>
          <div className="flex items-center gap-1.5">
            <ToggleButton active={metric === "value"} onClick={() => setMetric("value")}>
              Value
            </ToggleButton>
            <ToggleButton active={metric === "quantity"} onClick={() => setMetric("quantity")}>
              Quantity
            </ToggleButton>
          </div>
        </div>

        {buckets.length === 0 ? (
          <EmptyState message="No expiry buckets reported." icon="box" compact />
        ) : (
          <>
            <ChartFrame title={`Inventory by expiry window (${metric === "value" ? "value" : "quantity"})`} height={290}>
              <BarChart data={buckets} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                <CartesianGrid stroke="#E6ECE2" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" {...AXIS} interval={0} />
                <YAxis
                  {...AXIS}
                  width={52}
                  tickFormatter={metric === "value" ? fmtCompact : (v: number) => v.toLocaleString("en-ET")}
                />
                <Tooltip
                  content={
                    metric === "value" ? (
                      <ValueTooltip unit="money" />
                    ) : (
                      <ExpiryTooltip />
                    )
                  }
                  cursor={{ fill: "#E6ECE2", opacity: 0.4 }}
                />
                <Bar dataKey={metric} radius={[4, 4, 0, 0]} maxBarSize={76} isAnimationActive={false}>
                  {buckets.map((b) => (
                    <Cell key={b.key} fill={expirySeverityColor(b.key)} />
                  ))}
                </Bar>
              </BarChart>
            </ChartFrame>

            <p className={TEXT.meta}>
              Showing {metric === "value" ? "value in ETB" : "unit quantity"}. Expired stock is often
              written down to zero value, so quantity can be the more useful measure there.
            </p>

            {/* Both measures, exactly, always available. */}
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full" style={{ minWidth: 340 }}>
                <thead>
                  <tr className="bg-canvas">
                    {["Expiry window", "Value", "Quantity"].map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-text-secondary"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {buckets.map((b) => (
                    <tr key={b.key}>
                      <th scope="row" className="px-3 py-2 text-left text-xs font-normal text-text-primary">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: expirySeverityColor(b.key) }}
                            aria-hidden
                          />
                          {b.label}
                        </span>
                      </th>
                      <td className="px-3 py-2 text-xs tabular-nums">{fmtMoneyNumber(b.value) ?? "—"}</td>
                      <td className="px-3 py-2 text-xs tabular-nums">{b.quantity.toLocaleString("en-ET")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </SectionCard>
  );
}

/** Shows BOTH measures on hover, whichever is plotted. */
function ExpiryTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: { label?: string; value?: number; quantity?: number } }>;
}) {
  if (!active || !payload?.[0]?.payload) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm">
      <p className="mb-1 text-xs font-semibold text-text-primary">{row.label}</p>
      <p className="text-xs text-text-secondary">
        Value: <span className="tabular-nums">{fmtMoneyNumber(row.value) ?? "—"} ETB</span>
      </p>
      <p className="text-xs text-text-secondary">
        Quantity: <span className="tabular-nums">{toFiniteNumber(row.quantity)?.toLocaleString("en-ET") ?? "—"}</span>
      </p>
    </div>
  );
}

// ─── 8 · Report scope ────────────────────────────────────────────────────────

/**
 * The backend's own scope disclosure, collapsed by default.
 *
 * `scopeNotes` states, per section, whether the figures honour the active filters
 * or are company-wide. This is the one place that explanation is authoritative;
 * the per-section badges are derived from the same data.
 */
export function ReportScopePanel({ data }: { data: FinanceReport }) {
  const notes = data.scopeNotes;
  const entries = useMemo(() => {
    if (!notes) return [];
    return (Object.entries(notes) as [keyof typeof notes, { basis?: string; note?: string } | undefined][])
      .filter(([, v]) => v?.basis || v?.note)
      .map(([section, v]) => ({
        section: String(section),
        basis: v?.basis,
        note: v?.note,
      }));
  }, [notes]);

  if (entries.length === 0) {
    return (
      <SectionCard title="Report Scope" subtitle="How these numbers are calculated" bodyClassName="p-4">
        <EmptyState message="No scope notes were returned with this report." icon="list" compact />
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Report Scope" subtitle="How these numbers are calculated" bodyClassName="p-4">
      <details className="rounded-lg border border-gray-200">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-mid">
          Show which sections honour the filters ({entries.length})
        </summary>
        <ul className="divide-y divide-gray-200 border-t border-gray-200">
          {entries.map((e) => (
            <li key={e.section} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-xs font-medium text-text-primary">{e.section}</p>
                {e.note && <p className="mt-0.5 text-xs text-text-secondary">{e.note}</p>}
              </div>
              <span
                className={
                  e.basis === "COMPANY"
                    ? "shrink-0 rounded-full border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-[11px] font-semibold text-yellow-700"
                    : "shrink-0 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700"
                }
              >
                {e.basis === "COMPANY" ? "Company-wide" : e.basis === "REPORT_SCOPE" ? "Filtered" : "—"}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </SectionCard>
  );
}