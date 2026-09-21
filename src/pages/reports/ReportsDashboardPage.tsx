import { useState, useEffect, useCallback } from "react";
import ReportsSubNav from "./ReportsSubNav";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import ReportFilterBar from "./ReportFilterBar";
import { fmtMoney, fmtNumber, defaultDateRange } from "./reportHelpers";
import { listLocations } from "../../features/inventory/locationsApi";
import {
  getSalesSummary,
  getSalesTrend,
  ReportsApiError,
  type SalesSummaryDto,
  type SalesTrendPeriod,
  type SalesTrendPointDto,
} from "../../features/reports/reportsApi";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { TrendingUp, ShoppingCart, Receipt, Tag, Percent } from "lucide-react";

function IconTrend() {
  return <TrendingUp className="h-5 w-5" aria-hidden />;
}
function IconCart() {
  return <ShoppingCart className="h-5 w-5" aria-hidden />;
}
function IconReceipt() {
  return <Receipt className="h-5 w-5" aria-hidden />;
}
function IconTag() {
  return <Tag className="h-5 w-5" aria-hidden />;
}
function IconPercent() {
  return <Percent className="h-5 w-5" aria-hidden />;
}

const PERIODS: { value: SalesTrendPeriod; label: string }[] = [
  { value: "DAILY", label: "Daily" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "ANNUAL", label: "Annual" },
];

export default function ReportsDashboardPage() {
  const range = defaultDateRange();
  const [dateFrom, setDateFrom] = useState(range.from);
  const [dateTo, setDateTo] = useState(range.to);
  const [locationId, setLocationId] = useState("");
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [period, setPeriod] = useState<SalesTrendPeriod>("MONTHLY");

  const [summary, setSummary] = useState<SalesSummaryDto | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [trend, setTrend] = useState<SalesTrendPointDto[]>([]);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendError, setTrendError] = useState<string | null>(null);

  useEffect(() => {
    listLocations({ limit: 100, isActive: true })
      .then((r) => setLocations(r.data))
      .catch(() => setLocations([]))
      .finally(() => setLocationsLoading(false));
  }, []);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const data = await getSalesSummary({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        locationId: locationId || undefined,
      });
      setSummary(data);
    } catch (e) {
      setSummaryError(e instanceof ReportsApiError ? e.message : "Failed to load sales summary.");
    } finally {
      setSummaryLoading(false);
    }
  }, [dateFrom, dateTo, locationId]);

  const loadTrend = useCallback(async () => {
    setTrendLoading(true);
    setTrendError(null);
    try {
      const data = await getSalesTrend({
        period,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        locationId: locationId || undefined,
      });
      setTrend(data ?? []);
    } catch (e) {
      setTrendError(e instanceof ReportsApiError ? e.message : "Failed to load sales trend.");
    } finally {
      setTrendLoading(false);
    }
  }, [period, dateFrom, dateTo, locationId]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadTrend();
  }, [loadTrend]);

  const kpis = [
    { label: "Total Sales", value: fmtMoney(summary?.totalSales), icon: <IconTrend /> },
    { label: "Transactions", value: fmtNumber(summary?.transactionCount), icon: <IconCart /> },
    { label: "Avg Transaction", value: fmtMoney(summary?.averageTransaction), icon: <IconReceipt /> },
    { label: "Subtotal", value: fmtMoney(summary?.totalSubtotal), icon: <IconTag /> },
    { label: "Discounts", value: fmtMoney(summary?.totalDiscount), icon: <IconPercent /> },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb="Reports / Overview"
        title="Reports Overview"
        subtitle="Sales summary, trend, payment methods, and top products."
      />
      <ReportsSubNav />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        <ReportFilterBar
          dateFrom={dateFrom}
          dateTo={dateTo}
          locationId={locationId}
          locations={locations}
          locationsLoading={locationsLoading}
          onDateFromChange={(v) => setDateFrom(v)}
          onDateToChange={(v) => setDateTo(v)}
          onLocationChange={(v) => setLocationId(v)}
        />

        {/* Summary KPIs */}
        {summaryLoading ? (
          <div className="bg-white rounded-xl border border-[#E6ECE2] p-6">
            <div className="flex items-center justify-center py-8 gap-3">
              <div className="h-8 w-8 rounded-full border-4 border-[#E6ECE2] border-t-[#B6C8AF] animate-spin" />
              <p className="text-sm text-[#666666]">Loading summary...</p>
            </div>
          </div>
        ) : summaryError && !summary ? (
          <div className="bg-white rounded-xl border border-[#E6ECE2] p-6">
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 max-w-md text-center">{summaryError}</p>
              <Button onClick={loadSummary}>Retry</Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            {kpis.map((k) => (
              <div key={k.label} className="bg-white rounded-xl border border-[#E6ECE2] p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E6ECE2]/60 text-[#7A9076]">
                  {k.icon}
                </div>
                <p className="text-xs font-medium text-[#666666] mt-3">{k.label}</p>
                <p className="text-lg font-bold text-[#333333] mt-0.5 leading-tight">{k.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Trend chart */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] p-5">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div>
              <h2 className="text-base font-bold text-[#333333]">Sales Trend</h2>
              <p className="text-xs text-[#666666] mt-0.5">
                Revenue by {period === "DAILY" ? "day" : period === "MONTHLY" ? "month" : "year"}
              </p>
            </div>
            <div className="flex rounded-lg border border-[#C6D4BF] overflow-hidden">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={`px-3.5 py-1.5 text-xs font-semibold transition-colors ${period === p.value ? "bg-[#B6C8AF] text-[#333333]" : "bg-white text-[#666666] hover:bg-[#E6ECE2]"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          {trendLoading ? (
            <div className="flex items-center justify-center py-16 gap-3">
              <div className="h-8 w-8 rounded-full border-4 border-[#E6ECE2] border-t-[#B6C8AF] animate-spin" />
              <p className="text-sm text-[#666666]">Loading trend...</p>
            </div>
          ) : trendError ? (
            <div className="flex flex-col items-center justify-center py-10 gap-4">
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 max-w-md text-center">{trendError}</p>
              <Button onClick={loadTrend}>Retry</Button>
            </div>
          ) : trend.length === 0 ? (
            <p className="text-sm text-[#666666] text-center py-14">
              No sales trend data for the selected period.
            </p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#B6C8AF" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#B6C8AF" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E6ECE2" vertical={false} />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: "#666666" }} tickLine={false} axisLine={{ stroke: "#E6ECE2" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#666666" }} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} tickLine={false} axisLine={false} width={52} />
                  <Tooltip formatter={(v: unknown) => fmtMoney(Number(v))} contentStyle={{ borderRadius: 12, borderColor: "#E6ECE2", fontSize: 12 }} />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#B6C8AF" strokeWidth={2.5} fill="url(#revenueFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Payment methods + Top products */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E6ECE2]">
              <h2 className="text-base font-bold text-[#333333]">Payment Methods</h2>
              <p className="text-xs text-[#666666] mt-0.5">Share of sales by payment method</p>
            </div>
            {summaryLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 rounded-full border-4 border-[#E6ECE2] border-t-[#B6C8AF] animate-spin" />
              </div>
            ) : !summary || (summary.paymentsByMethod?.length ?? 0) === 0 ? (
              <p className="text-sm text-[#666666] text-center py-12">No payment data for this period.</p>
            ) : (
              <div className="divide-y divide-[#E6ECE2]">
                {summary.paymentsByMethod.map((p) => (
                  <div key={p.method} className="flex items-center justify-between px-5 py-3.5">
                    <span className="text-sm font-medium text-[#333333] capitalize">
                      {p.method.replace(/_/g, " ").toLowerCase()}
                    </span>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-[#333333]">{fmtMoney(p.amount)}</p>
                      {typeof p.count === "number" && (
                        <p className="text-xs text-[#666666]">{fmtNumber(p.count)} payments</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E6ECE2]">
              <h2 className="text-base font-bold text-[#333333]">Top Products</h2>
              <p className="text-xs text-[#666666] mt-0.5">Best sellers by quantity and revenue</p>
            </div>
            {summaryLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 rounded-full border-4 border-[#E6ECE2] border-t-[#B6C8AF] animate-spin" />
              </div>
            ) : !summary || (summary.topProducts?.length ?? 0) === 0 ? (
              <p className="text-sm text-[#666666] text-center py-12">No product data for this period.</p>
            ) : (
              <div className="divide-y divide-[#E6ECE2]">
                {summary.topProducts.map((p) => (
                  <div key={p.productId} className="flex items-center justify-between gap-4 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#333333] truncate">{p.name}</p>
                      {p.sku && <p className="text-xs text-[#666666]">{p.sku}</p>}
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <p className="text-sm font-semibold text-[#333333]">{fmtMoney(p.revenue)}</p>
                      <p className="text-xs text-[#666666]">{fmtNumber(p.quantitySold)} sold</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}