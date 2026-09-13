import { useState } from "react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import ReportsSubNav from "./ReportsSubNav";
import PageHeader from "../../components/ui/PageHeader";
import {
  MOCK_BRAND_PERF,
  MOCK_GROUP_PERF,
  MARGIN_TREND_DATA,
  REVENUE_BY_GROUP,
} from "../../features/reports/reportsMock";

const fmtMoney = (n: number) =>
  `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;

const PIE_COLORS = ["#49B0C1", "#ABDBE3", "#28A745", "#FFC107", "#6F42C1"];

const PERF_BADGE: Record<string, string> = {
  top: "text-green-600",
  growing: "text-yellow-600",
  stable: "text-[#49B0C1]",
  review: "text-red-500",
};
const PERF_LABEL: Record<string, string> = {
  top: "⭐ Top Performer",
  growing: "📈 Growing",
  stable: "📊 Stable",
  review: "⚠️ Needs Review",
};

export default function ProfitabilityDashboardPage() {
  const [analysisLevel, setAnalysisLevel] = useState("By Brand");
  const [compareOn, setCompareOn] = useState(false);
  const [fromDate, setFromDate] = useState("2026-02-01");
  const [toDate, setToDate] = useState("2026-02-28");

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <PageHeader
        title="Profitability Report"
        subtitle="Reports → Profitability"
        actions={
          <div className="flex items-center gap-2">
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-lg border border-white/30 bg-white/10 px-3 py-1.5 text-sm text-white placeholder-white/60 focus:outline-none" />
            <span className="text-white/60 text-sm">→</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-lg border border-white/30 bg-white/10 px-3 py-1.5 text-sm text-white focus:outline-none" />
            <button className="rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/20 transition-colors">Export</button>
            <button className="rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-sm text-white/80 hover:bg-white/20 transition-colors">🖨 Print</button>
          </div>
        }
      />
      <ReportsSubNav />

      <div className="flex-1 overflow-y-auto">
        {/* Filters */}
        <div className="bg-[#DBEFF3] px-4 sm:px-6 py-3 flex flex-wrap items-center gap-4 border-b border-[#ABDBE3]">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-[#666666] uppercase tracking-wide">Analysis Level</span>
            <select value={analysisLevel} onChange={(e) => setAnalysisLevel(e.target.value)} className="rounded-md border border-[#ABDBE3] bg-white px-2 py-1.5 text-sm focus:border-[#49B0C1] focus:outline-none">
              {["Overall", "By Brand", "By Product Group", "By Product"].map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <div
              onClick={() => setCompareOn((v) => !v)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${compareOn ? "bg-[#49B0C1]" : "bg-gray-300"}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${compareOn ? "translate-x-4" : "translate-x-0.5"}`} />
            </div>
            <span className="text-sm text-[#333333]">Compare to Previous Period</span>
          </label>
          <button className="ml-auto rounded-md bg-white border border-[#ABDBE3] px-3 py-1.5 text-sm text-[#666666] hover:bg-[#ABDBE3] transition-colors">⟳ Refresh</button>
        </div>

        {/* KPI cards */}
        <div className="bg-white px-4 sm:px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-[#DBEFF3]">
          {[
            { label: "Total Revenue", value: "1,245,750.00 ETB", change: "+12.5% from last month", up: true, icon: "💰" },
            { label: "Total Cost", value: "892,340.00 ETB", change: "+8.3% from last month", up: false, icon: "🪙" },
            { label: "Gross Profit", value: "353,410.00 ETB", change: "+15.2% from last month", up: true, icon: "📈" },
            { label: "Average Margin", value: "28.4%", change: "+2.1% from last month", up: true, icon: "%" },
          ].map(({ label, value, change, up, icon }) => (
            <div key={label} className="bg-[#DBEFF3] rounded-xl p-4 border border-[#ABDBE3]/30 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl" aria-hidden>{icon}</span>
                <p className="text-xs text-[#666666]">{label}</p>
              </div>
              <p className="text-lg font-bold text-[#333333] leading-tight">{value}</p>
              <p className={`text-xs mt-1 font-medium ${up ? "text-green-600" : "text-red-500"}`}>{up ? "↑" : "↓"} {change}</p>
            </div>
          ))}
        </div>

        {/* Brand analysis */}
        <div className="px-4 sm:px-6 py-4">
          <div className="bg-[#DBEFF3] rounded-xl p-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#ABDBE3] mb-3">
              <div>
                <p className="font-bold text-[#333333]">Brand Analysis</p>
                <p className="text-xs text-[#666666]">Top 5 brands by profitability</p>
              </div>
              <button className="text-sm text-[#49B0C1] hover:underline">View All →</button>
            </div>
            <div className="grid lg:grid-cols-2 gap-4">
              <div className="rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#ABDBE3]">
                      {["Brand", "Revenue", "Cost", "Profit", "Margin", "Trend"].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold text-[#333333]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {MOCK_BRAND_PERF.map((b, i) => (
                      <tr key={b.brand} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/30"}>
                        <td className="px-3 py-2 font-semibold text-[#333333]">{b.brand}</td>
                        <td className="px-3 py-2 text-[#333333]">{fmtMoney(b.revenue)}</td>
                        <td className="px-3 py-2 text-[#333333]">{fmtMoney(b.cost)}</td>
                        <td className="px-3 py-2 font-medium text-green-600">{fmtMoney(b.profit)}</td>
                        <td className={`px-3 py-2 font-bold ${b.margin > 25 ? "text-green-600" : "text-yellow-500"}`}>{b.margin}%</td>
                        <td className={`px-3 py-2 font-medium ${b.trend > 0 ? "text-green-600" : "text-red-500"}`}>
                          {b.trend > 0 ? "📈" : "📉"} {b.trend > 0 ? "+" : ""}{b.trend}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-[#ABDBE3] rounded-xl p-3">
                <p className="text-sm font-semibold text-[#333333] mb-2">Margin % by Brand</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={MOCK_BRAND_PERF} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff60" />
                    <XAxis dataKey="brand" tick={{ fontSize: 11, fill: "#333333" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#666666" }} unit="%" />
                    <Tooltip formatter={(v: any) => [`${v}%`, "Margin"]} contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="margin" fill="#49B0C1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Product group analysis */}
        <div className="px-4 sm:px-6">
          <div className="bg-white rounded-xl border border-[#DBEFF3] p-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#DBEFF3] mb-3">
              <div>
                <p className="font-bold text-[#333333]">Product Group Analysis</p>
                <p className="text-xs text-[#666666]">Performance by category</p>
              </div>
              <button className="text-sm text-[#49B0C1] hover:underline">View All →</button>
            </div>
            <div className="rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#ABDBE3]">
                    {["Product Group", "Sales", "Profit", "Margin %", "Performance"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left font-semibold text-[#333333]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MOCK_GROUP_PERF.map((g, i) => (
                    <tr key={g.group} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"}>
                      <td className="px-4 py-2.5 font-semibold text-[#333333]">{g.group}</td>
                      <td className="px-4 py-2.5 text-[#333333]">{fmtMoney(g.sales)}</td>
                      <td className="px-4 py-2.5 font-medium text-green-600">{fmtMoney(g.profit)}</td>
                      <td className={`px-4 py-2.5 font-bold ${g.margin > 20 ? "text-green-600" : g.margin > 16 ? "text-yellow-500" : "text-red-500"}`}>{g.margin}%</td>
                      <td className={`px-4 py-2.5 font-medium ${PERF_BADGE[g.performance]}`}>{PERF_LABEL[g.performance]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="px-4 sm:px-6 py-4 pb-6">
          <div className="bg-[#DBEFF3] rounded-xl p-4 grid lg:grid-cols-2 gap-4">
            {/* Line chart: margin trends */}
            <div className="bg-[#ABDBE3] rounded-xl p-4">
              <p className="text-sm font-bold text-[#333333] mb-3">Profit Margin Trends (Monthly)</p>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={MARGIN_TREND_DATA} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff60" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#333333" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#666666" }} unit="%" />
                  <Tooltip formatter={(v: any) => [`${v}%`]} contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="overall" name="Overall" stroke="#49B0C1" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="painkillers" name="Painkillers" stroke="#28A745" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="antibiotics" name="Antibiotics" stroke="#FFC107" strokeWidth={2} strokeDasharray="3 3" dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="vitamins" name="Vitamins" stroke="#6F42C1" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Pie chart: revenue by group */}
            <div className="bg-[#ABDBE3] rounded-xl p-4">
              <p className="text-sm font-bold text-[#333333] mb-3">Revenue by Product Group</p>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={REVENUE_BY_GROUP}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="pct"
                    nameKey="name"
                    label={({ name, value }) => `${name}: ${value}%`}
                    labelLine={false}
                  >
                    {REVENUE_BY_GROUP.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any, name: any) => [`${v}%`, name]} contentStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
