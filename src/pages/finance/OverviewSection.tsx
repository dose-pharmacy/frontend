// ── Finance · Overview ──────────────────────────────────────────────────────
// ONE call to `GET /finance-reporting/report` feeds every figure on this tab:
// the revenue KPIs, the payment-method breakdown AND the trend chart; the
// profitability KPIs come from the same response's `profitability` / `summary`
// blocks. Nothing here is computed in the browser — every figure is a value the
// backend sent.
//
// ONE EXCEPTION: the Top-products table. `/finance-reporting/report` has no
// product-level array, and the only endpoint that returns product names and
// SKUs is `/financials/reports/sales/summary`. That one call is kept and used
// for that table ALONE; its summary fields are deliberately ignored here so no
// figure can come from two different sources on the same screen (§11).

import { useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getSalesSummary } from "../../features/reports/reportsApi";
import type { FinanceGranularity } from "../../features/finance/financeReportingApi";
import {
  KpiCard,
  Panel,
  ErrorBlock,
  EmptyBlock,
  LoadingBlock,
  dateBounds,
  fmtMoney,
  fmtNumber,
  fmtPercent,
  useFinanceFetch,
  type FinanceFilters,
  type FinanceReportState,
} from "./financeView";

const PERIODS: { value: FinanceGranularity; label: string }[] = [
  { value: "DAY", label: "Daily" },
  { value: "MONTH", label: "Monthly" },
  { value: "YEAR", label: "Annual" },
];

const TREND_METRICS = [
  { key: "revenue", label: "Revenue", money: true },
  { key: "transactionCount", label: "Transactions", money: false },
  { key: "quantitySold", label: "Quantity sold", money: false },
] as const;

type TrendMetric = (typeof TREND_METRICS)[number]["key"];

/** Human wording for the bucket width, reusing the backend's own enum values. */
const GRANULARITY_LABEL: Record<FinanceGranularity, string> = {
  DAY: "daily",
  MONTH: "monthly",
  YEAR: "annual",
};

/**
 * Axis label for a trend bucket.
 *
 * The backend already returns the bucket at the requested granularity
 * (`YYYY-MM-DD` / `YYYY-MM` / `YYYY`) and documents those as UTC boundaries, so
 * this is a pure string reshape — nothing is passed through `new Date()`, which
 * would risk shifting a bucket into the neighbouring day.
 *
 * The granularity is taken from the RESPONSE (`trends.granularity`) rather than
 * the requested one, so a bucket is always labelled for the width the backend
 * actually used.
 */
function bucketLabel(period: string, granularity: FinanceGranularity): string {
  const parts = period.split("-");
  if (granularity === "YEAR") return parts[0] ?? period;
  if (parts.length < 2) return period;
  const year = parts[0];
  const month = parts[1];
  if (granularity === "MONTH") {
    const name = new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toLocaleDateString("en-GB", {
      month: "short",
      timeZone: "UTC",
    });
    return `${name} ${year}`;
  }
  const name = new Date(Date.UTC(Number(year), Number(month) - 1, Number(parts[2]))).toLocaleDateString(
    "en-GB",
    { day: "2-digit", month: "short", timeZone: "UTC" },
  );
  return `${name}`;
}

export default function OverviewSection({
  filters,
  report,
  granularity,
  onGranularityChange,
}: {
  filters: FinanceFilters;
  report: FinanceReportState;
  granularity: FinanceGranularity;
  onGranularityChange: (next: FinanceGranularity) => void;
}) {
  const [metric, setMetric] = useState<TrendMetric>("revenue");

  const r = report.data;
  const summary = r?.summary;
  const sales = r?.salesPerformance;
  const profit = r?.profitability;

  // Top products is the single legacy call on this tab. The legacy endpoint uses
  // the SAME inclusive UTC start/end-of-day convention as `/report`, so
  // `dateBounds` produces identical bounds for both and the two always describe
  // the same window. Only `topProducts` is read — its summary fields are ignored
  // so no figure on this screen can come from two different sources (§11).
  const bounds = dateBounds(filters.dateFrom, filters.dateTo);
  const topProducts = useFinanceFetch(
    () => getSalesSummary({ ...bounds, locationId: filters.locationId || undefined }),
    [filters.dateFrom, filters.dateTo, filters.locationId],
    "Could not load top products.",
  );

  const activeMetric = TREND_METRICS.find((m) => m.key === metric) ?? TREND_METRICS[0];

  const points = r?.trends?.points ?? [];
  const chartData = points.map((point) => ({
    label: bucketLabel(point.period, r?.trends?.granularity ?? granularity),
    revenue: point.netSales,
    transactionCount: point.transactionCount,
    quantitySold: point.unitsSold,
  }));

  const reportError = report.error;
  // While a new report is in flight `data` still holds the previous window, so
  // every panel below is gated on `loading` and never renders those stale values.
  const loading = report.loading;

  return (
    <div className="flex flex-col gap-5">
      {/* Revenue KPIs — all from the single report response. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total revenue"
          value={fmtMoney(summary?.netSales)}
          loading={loading}
          error={reportError}
          onRetry={report.reload}
          hint="Net sales for the period"
        />
        <KpiCard
          label="Transactions"
          value={fmtNumber(sales?.transactionCount)}
          loading={loading}
          error={reportError}
          onRetry={report.reload}
          hint="Completed transactions"
        />
        <KpiCard
          label="Average transaction"
          value={fmtMoney(sales?.averageTransactionValue)}
          loading={loading}
          error={reportError}
          onRetry={report.reload}
          hint="Backend averageTransactionValue"
        />
        <KpiCard
          label="Total discounts"
          value={fmtMoney(summary?.discounts)}
          loading={loading}
          error={reportError}
          onRetry={report.reload}
          hint={`Gross ${fmtMoney(summary?.grossSales)}`}
        />
      </div>

      {/* Profitability KPIs — cost/profit/margin are the backend's, never derived. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Cost / COGS"
          value={fmtMoney(summary?.cogs)}
          loading={loading}
          error={reportError}
          onRetry={report.reload}
          hint="Batch-level COGS"
        />
        <KpiCard
          label="Profit"
          value={fmtMoney(profit?.grossProfit)}
          tone={(profit?.grossProfit ?? 0) < 0 ? "negative" : "positive"}
          loading={loading}
          error={reportError}
          onRetry={report.reload}
        />
        {/* `grossMargin` arrives as a PERCENTAGE (the backend computes
            `profit / netSales * 100`), and `fmtPercent` appends the sign — so the
            value is passed through untouched. Multiplying by 100 here would
            render a 20% margin as "2000.0%". */}
        <KpiCard
          label="Margin"
          value={fmtPercent(profit?.grossMargin)}
          tone={(profit?.grossMargin ?? 0) < 0 ? "negative" : "positive"}
          loading={loading}
          error={reportError}
          onRetry={report.reload}
        />
        <KpiCard
          label="Products sold"
          value={fmtNumber(sales?.unitsSold)}
          loading={loading}
          error={reportError}
          onRetry={report.reload}
          hint={`${fmtNumber(sales?.unitsSold)} units`}
        />
      </div>

      {/* Sales trend */}
      <Panel
        title="Sales trend"
        action={
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-lg border border-[#C6D4BF] overflow-hidden">
              {PERIODS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onGranularityChange(opt.value)}
                  className={`px-3 py-1 text-xs font-semibold transition-colors ${
                    granularity === opt.value
                      ? "bg-[#B6C8AF] text-[#333333]"
                      : "bg-white text-[#666666] hover:bg-[#E6ECE2]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as TrendMetric)}
              aria-label="Chart metric"
              className="rounded-lg border border-[#C6D4BF] px-2 py-1 text-xs bg-white text-[#333333]"
            >
              {TREND_METRICS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        }
      >
        {loading ? (
          <LoadingBlock label="Loading sales trend" />
        ) : reportError ? (
          <ErrorBlock
            headline="Sales trend unavailable"
            message={reportError}
            onRetry={report.reload}
          />
        ) : chartData.length === 0 ? (
          <EmptyBlock
            title="No sales found for the selected period."
            description="Widen the date range or clear the location filter."
          />
        ) : (
          <>
            <div className="h-[300px] px-3 py-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                  <CartesianGrid stroke="#E6ECE2" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "#666666" }}
                    interval="preserveStartEnd"
                    stroke="#C6D4BF"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#666666" }}
                    stroke="#C6D4BF"
                    width={72}
                    tickFormatter={(v: number) =>
                      activeMetric.money ? fmtMoney(v).replace(" ETB", "") : fmtNumber(v)
                    }
                  />
                  <Tooltip
                    formatter={(value) => {
                      // recharts types this as `ValueType | undefined`; coerce
                      // defensively so a non-numeric payload can't render NaN.
                      const n = typeof value === "number" ? value : Number(value);
                      return Number.isFinite(n)
                        ? activeMetric.money
                          ? fmtMoney(n)
                          : fmtNumber(n)
                        : "—";
                    }}
                    labelStyle={{ color: "#333333", fontWeight: 600 }}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #E6ECE2",
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey={metric}
                    name={activeMetric.label}
                    stroke="#4F6B4A"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {/* The backend returns every bucket in the window, including empty
                ones as zeroes. Those points are kept so the timeline stays
                continuous — dropping them would misrepresent the shape. */}
            <p className="px-5 pb-4 text-xs text-[#666666]">
              {chartData.length.toLocaleString("en-ET")}{" "}
              {GRANULARITY_LABEL[r?.trends?.granularity ?? granularity]} buckets returned, including
              periods with no sales.
            </p>
          </>
        )}
      </Panel>

      {/* Payment methods + top products. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel title="Payment methods">
          {loading ? (
            <LoadingBlock label="Loading payment methods" />
          ) : reportError ? (
            <ErrorBlock headline="Payment breakdown unavailable" message={reportError} onRetry={report.reload} />
          ) : (sales?.byPaymentMethod?.length ?? 0) === 0 ? (
            <EmptyBlock title="No payments recorded for the selected period." />
          ) : (
            <div className="p-5">
              {/* Methods are rendered exactly as returned — no assumed set, and
                  never a synthetic CREDIT method (an unpaid balance is a
                  business state, not a way of paying). */}
              <PaymentBreakdown methods={sales?.byPaymentMethod ?? []} />
            </div>
          )}
        </Panel>

        <Panel title="Top products by revenue">
          {topProducts.loading ? (
            <LoadingBlock label="Loading top products" />
          ) : topProducts.error ? (
            <ErrorBlock headline="Top products unavailable" message={topProducts.error} onRetry={topProducts.reload} />
          ) : (topProducts.data?.topProducts?.length ?? 0) === 0 ? (
            <EmptyBlock title="No sales found for the selected period." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-[#E6ECE2]">
                  <tr className="text-xs text-[#666666]">
                    <th className="px-5 py-2 text-left font-semibold">Product</th>
                    <th className="px-3 py-2 text-left font-semibold">SKU</th>
                    <th className="px-3 py-2 text-right font-semibold">Qty</th>
                    <th className="px-5 py-2 text-right font-semibold">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6ECE2]">
                  {(topProducts.data?.topProducts ?? []).map((product) => (
                    <tr key={product.productId} className="text-sm text-[#333333]">
                      <td className="px-5 py-2.5">{product.name}</td>
                      <td className="px-3 py-2.5 text-[#666666]">{product.sku ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {fmtNumber(product.quantity)}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums font-medium">
                        {fmtMoney(product.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

/** Horizontal bars sized as a share of the largest method. */
function PaymentBreakdown({
  methods,
}: {
  methods: { method: string; amount: number }[];
}) {
  const max = Math.max(...methods.map((m) => (Number.isFinite(m.amount) ? m.amount : 0)), 0);
  const total = methods.reduce((sum, m) => sum + (Number.isFinite(m.amount) ? m.amount : 0), 0);

  return (
    <div className="flex flex-col gap-3.5">
      {methods.map((entry) => {
        const share = max > 0 ? (entry.amount / max) * 100 : 0;
        const shareOfTotal = total > 0 ? (entry.amount / total) * 100 : 0;
        return (
          <div key={entry.method} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              {/* Raw backend value — an unrecognised method still displays. */}
              <span className="text-sm font-medium text-[#333333]">{entry.method}</span>
              <span className="text-sm tabular-nums text-[#666666]">
                {fmtMoney(entry.amount)}
                <span className="ml-2 text-xs text-[#999999]">
                  {shareOfTotal > 0 ? `${shareOfTotal.toFixed(1)}%` : ""}
                </span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#E6ECE2] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#7A9076]"
                style={{ width: `${Math.min(100, Math.max(0, share))}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}