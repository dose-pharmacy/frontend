// ── Finance · Overview ──────────────────────────────────────────────────────
// The financial snapshot: one call to sales/summary feeds the revenue KPIs, the
// payment-method breakdown AND the top-products table; one call to
// profitability/summary feeds the profitability KPIs. Nothing here is computed
// in the browser — every figure is a value the backend sent.

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
import {
  getSalesSummary,
  getSalesTrend,
  getProfitabilitySummary,
  type SalesTrendPeriod,
  type SalesTrendPointDto,
} from "../../features/reports/reportsApi";
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
} from "./financeView";

const PERIODS: { value: SalesTrendPeriod; label: string }[] = [
  { value: "DAILY", label: "Daily" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "ANNUAL", label: "Annual" },
];

const TREND_METRICS = [
  { key: "revenue", label: "Revenue", money: true },
  { key: "transactionCount", label: "Transactions", money: false },
  { key: "quantitySold", label: "Quantity sold", money: false },
] as const;

type TrendMetric = (typeof TREND_METRICS)[number]["key"];

/**
 * Axis label for a trend bucket.
 *
 * The backend already returns the bucket at the requested granularity
 * (`YYYY-MM-DD` / `YYYY-MM` / `YYYY`) and documents those as UTC boundaries, so
 * this is a pure string reshape — nothing is passed through `new Date()`, which
 * would risk shifting a bucket into the neighbouring day.
 */
function bucketLabel(period: string, granularity: SalesTrendPeriod): string {
  const parts = period.split("-");
  if (granularity === "ANNUAL") return parts[0] ?? period;
  if (parts.length < 2) return period;
  const year = parts[0];
  const month = parts[1];
  if (granularity === "MONTHLY") {
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

export default function OverviewSection({ filters }: { filters: FinanceFilters }) {
  const [period, setPeriod] = useState<SalesTrendPeriod>("DAILY");
  const [metric, setMetric] = useState<TrendMetric>("revenue");

  const bounds = dateBounds(filters.dateFrom, filters.dateTo);

  // §44 — each endpoint is requested once; the response is distributed to every
  // consumer below rather than re-fetched per card.
  const summary = useFinanceFetch(
    () => getSalesSummary({ ...bounds, locationId: filters.locationId || undefined }),
    [filters.dateFrom, filters.dateTo, filters.locationId],
    "Could not load the sales summary.",
  );

  const profit = useFinanceFetch(
    () => getProfitabilitySummary({ ...bounds }),
    [filters.dateFrom, filters.dateTo],
    "Could not load the profitability summary.",
  );

  const trend = useFinanceFetch<SalesTrendPointDto[]>(
    () => getSalesTrend({ period, ...bounds, locationId: filters.locationId || undefined }),
    [period, filters.dateFrom, filters.dateTo, filters.locationId],
    "Could not load the sales trend.",
  );

  const s = summary.data;
  const p = profit.data;
  const activeMetric = TREND_METRICS.find((m) => m.key === metric) ?? TREND_METRICS[0];

  const chartData = (trend.data ?? []).map((point) => ({
    label: bucketLabel(point.period, period),
    revenue: point.revenue,
    transactionCount: point.transactionCount,
    quantitySold: point.quantitySold,
  }));

  const salesError = summary.error;
  const profitError = profit.error;

  return (
    <div className="flex flex-col gap-5">
      {/* Revenue KPIs — all from the single sales/summary response. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total revenue"
          value={fmtMoney(s?.totalSales)}
          loading={summary.loading}
          error={salesError}
          onRetry={summary.reload}
          hint="Backend totalSales"
        />
        <KpiCard
          label="Transactions"
          value={fmtNumber(s?.transactionCount)}
          loading={summary.loading}
          error={salesError}
          onRetry={summary.reload}
          hint="Completed transactions"
        />
        <KpiCard
          label="Average transaction"
          value={fmtMoney(s?.averageTransaction)}
          loading={summary.loading}
          error={salesError}
          onRetry={summary.reload}
          hint="Backend averageTransaction"
        />
        <KpiCard
          label="Total discounts"
          value={fmtMoney(s?.totalDiscount)}
          loading={summary.loading}
          error={salesError}
          onRetry={summary.reload}
          hint={`Subtotal ${fmtMoney(s?.totalSubtotal)}`}
        />
      </div>

      {/* Profitability KPIs — cost/profit/margin are the backend's, never derived. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Cost / COGS"
          value={fmtMoney(p?.cost)}
          loading={profit.loading}
          error={profitError}
          onRetry={profit.reload}
          hint="Batch-level COGS"
        />
        <KpiCard
          label="Profit"
          value={fmtMoney(p?.profit)}
          tone={(p?.profit ?? 0) < 0 ? "negative" : "positive"}
          loading={profit.loading}
          error={profitError}
          onRetry={profit.reload}
        />
        <KpiCard
          label="Margin"
          value={fmtPercent(p?.margin)}
          tone={(p?.margin ?? 0) < 0 ? "negative" : "positive"}
          loading={profit.loading}
          error={profitError}
          onRetry={profit.reload}
        />
        <KpiCard
          label="Products sold"
          value={fmtNumber(p?.productCount)}
          loading={profit.loading}
          error={profitError}
          onRetry={profit.reload}
          hint={`${fmtNumber(p?.quantity)} units`}
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
                  onClick={() => setPeriod(opt.value)}
                  className={`px-3 py-1 text-xs font-semibold transition-colors ${
                    period === opt.value
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
        {trend.loading ? (
          <LoadingBlock label="Loading sales trend" />
        ) : trend.error ? (
          <ErrorBlock
            headline="Sales trend unavailable"
            message={trend.error}
            onRetry={trend.reload}
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
              {chartData.length.toLocaleString("en-ET")} {period.toLowerCase()} buckets returned,
              including periods with no sales.
            </p>
          </>
        )}
      </Panel>

      {/* Payment methods + top products, both from the same sales/summary call. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel title="Payment methods">
          {summary.loading ? (
            <LoadingBlock label="Loading payment methods" />
          ) : salesError ? (
            <ErrorBlock headline="Payment breakdown unavailable" message={salesError} onRetry={summary.reload} />
          ) : (s?.paymentsByMethod?.length ?? 0) === 0 ? (
            <EmptyBlock title="No payments recorded for the selected period." />
          ) : (
            <div className="p-5">
              {/* Methods are rendered exactly as returned — no assumed set, and
                  never a synthetic CREDIT method (an unpaid balance is a
                  business state, not a way of paying). */}
              <PaymentBreakdown methods={s?.paymentsByMethod ?? []} />
            </div>
          )}
        </Panel>

        <Panel title="Top products by revenue">
          {summary.loading ? (
            <LoadingBlock label="Loading top products" />
          ) : salesError ? (
            <ErrorBlock headline="Top products unavailable" message={salesError} onRetry={summary.reload} />
          ) : (s?.topProducts?.length ?? 0) === 0 ? (
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
                  {(s?.topProducts ?? []).map((product) => (
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