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

function IconTrend() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
    </svg>
  );
}
function IconCart() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M1 1.75A.75.75 0 011.75 1h1.628a1.75 1.75 0 011.734 1.51L5.18 3a65.25 65.25 0 0113.36 1.412.75.75 0 01.58.875 48.645 48.645 0 01-1.618 6.2.75.75 0 01-.712.513H6a2.503 2.503 0 00-2.292 1.5H17.25a.75.75 0 010 1.5H2.76a.75.75 0 01-.748-.807 4.002 4.002 0 012.716-3.486L3.626 2.716a.25.25 0 00-.248-.216H1.75A.75.75 0 011 1.75zM6 17.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm8.5 1.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
    </svg>
  );
}
function IconReceipt() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13.78c0 .585.38 1.1.936 1.285a1.5 1.5 0 001.598-.423l.151-.177a.75.75 0 011.13 0l.15.177a1.5 1.5 0 002.27 0l.15-.177a.75.75 0 011.13 0l.151.177a1.5 1.5 0 001.598.423A1.5 1.5 0 0015 17.28V3.5A1.5 1.5 0 0013.5 2h-9zM8.25 5a.75.75 0 100 1.5h1.5A.75.75 0 109.75 5h-1.5zm-3 .75a.75.75 0 01.75-.75h.5a.75.75 0 010 1.5h-.5a.75.75 0 01-.75-.75zm3.5 3a.75.75 0 000 1.5h1.5a.75.75 0 100-1.5h-1.5zm-3 .75a.75.75 0 01.75-.75h.5a.75.75 0 010 1.5h-.5a.75.75 0 01-.75-.75z" clipRule="evenodd" />
    </svg>
  );
}
function IconTag() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M1 6.5A3.5 3.5 0 014.5 3h5.879a1.5 1.5 0 011.06.44l4.122 4.12A1.5 1.5 0 0116 8.622V13.5a3.5 3.5 0 01-3.5 3.5h-6A3.5 3.5 0 013 13.5v-7z" />
    </svg>
  );
}
function IconPercent() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M8.984.974a.75.75 0 00-1.06 0L5.6 3.6a5.854 5.854 0 00-.64.361L2.027.974a.75.75 0 00-1.06 1.06l2.768 2.769-.304.56a5.854 5.854 0 000 5.236l.304.56L.967 13.908a.75.75 0 00 1.06 1.06l2.768-2.768.56.304a5.854 5.854 0 005.236 0l.56-.304 2.768 2.768a.75.75 0 001.06-1.06l-2.768-2.769.304-.56a5.854 5.854 0 000-5.236l-.304-.56L13.908.967a.75.75 0 00-1.06-1.06l-2.769 2.768-.56-.304a5.854 5.854 0 00-5.236 0l-.56.304L.967 1.703a.75.75 0 00-1.06 1.06zM6.5 4.5a2 2 0 100 4 2 2 0 000-4zm7 5a2 2 0 110 4 2 2 0 010-4z" clipRule="evenodd" />
    </svg>
  );
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