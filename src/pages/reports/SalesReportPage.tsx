import { useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import ReportsSubNav from "./ReportsSubNav";
import PageHeader from "../../components/ui/PageHeader";
import {
  MOCK_DAILY_SALES,
  SALES_TREND_DATA,
  SALES_BY_CATEGORY,
  TOP_PRODUCTS,
  HOURLY_SALES,
} from "../../features/reports/reportsMock";

const fmtMoney = (n: number) =>
  `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;

const PERIOD_TABS = ["Daily", "Weekly", "Monthly", "Quarterly", "Annual", "Custom"];
const BREAKDOWN_TABS = ["By Product", "By Brand", "By Category", "By Payment Method"];

const BREAKDOWN_DATA = {
  "By Product": [
    { name: "Panadol 500mg", units: 48, revenue: 4500, pct: 9.8 },
    { name: "Advil 200mg", units: 34, revenue: 3200, pct: 7.0 },
    { name: "Amoxicillin 500mg", units: 29, revenue: 2800, pct: 6.1 },
    { name: "Vitamin C 1000mg", units: 22, revenue: 2100, pct: 4.6 },
    { name: "Ibuprofen 400mg", units: 20, revenue: 1900, pct: 4.2 },
  ],
  "By Brand": [
    { name: "Panadol", units: 65, revenue: 8200, pct: 17.9 },
    { name: "Advil", units: 48, revenue: 6100, pct: 13.3 },
    { name: "Cecon", units: 37, revenue: 4800, pct: 10.5 },
    { name: "Amoxil", units: 29, revenue: 3600, pct: 7.9 },
  ],
  "By Category": [
    { name: "Painkillers", units: 148, revenue: 16012, pct: 35.0 },
    { name: "Antibiotics", units: 98, revenue: 11437, pct: 25.0 },
    { name: "Vitamins", units: 74, revenue: 9150, pct: 20.0 },
    { name: "Supplements", units: 44, revenue: 5490, pct: 12.0 },
    { name: "Medical Devices", units: 29, revenue: 3660, pct: 8.0 },
  ],
  "By Payment Method": [
    { name: "Cash", units: 68, revenue: 24500, pct: 53.5 },
    { name: "Card", units: 38, revenue: 14800, pct: 32.3 },
    { name: "Digital Transfer", units: 21, revenue: 6450, pct: 14.1 },
  ],
};

const AVG_SALES = SALES_TREND_DATA.reduce((s, d) => s + d.sales, 0) / SALES_TREND_DATA.length;

export default function SalesReportPage() {
  const [activeTab, setActiveTab] = useState("Daily");
  const [breakdownTab, setBreakdownTab] = useState("By Product");
  const [comparePrev, setComparePrev] = useState(false);
  const [includeTax, setIncludeTax] = useState(false);
  const [fromDate, setFromDate] = useState("2026-02-01");
  const [toDate, setToDate] = useState("2026-02-28");

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <PageHeader
        title="Sales Reports"
        subtitle="Reports → Sales"
        actions={
          <div className="flex items-center gap-2">
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-lg border border-white/30 bg-white/10 px-3 py-1.5 text-sm text-white focus:outline-none" />
            <span className="text-white/60 text-sm">→</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-lg border border-white/30 bg-white/10 px-3 py-1.5 text-sm text-white focus:outline-none" />
            <button className="rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/20 transition-colors">Export</button>
            <button className="rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-sm text-white/80 hover:bg-white/20 transition-colors">🖨 Print</button>
          </div>
        }
      />
      <ReportsSubNav />

      <div className="flex-1 overflow-y-auto">
        {/* Period tabs */}
        <div className="bg-[#DBEFF3] px-4 sm:px-6 py-2 flex gap-2 overflow-x-auto border-b border-[#ABDBE3]">
          {PERIOD_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`flex-shrink-0 rounded-lg px-5 py-2 text-sm font-medium transition-colors ${activeTab === t ? "bg-[#49B0C1] text-white" : "bg-white text-[#333333] hover:bg-[#ABDBE3]"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* KPI cards */}
        <div className="bg-white px-4 sm:px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-[#DBEFF3]">
          {[
            { icon: "💰", label: "Total Sales", value: "45,750.00 ETB", change: "+12.5% vs yesterday", up: true },
            { icon: "🛒", label: "Transactions", value: "127", change: "+8.3% vs yesterday", up: true },
            { icon: "💳", label: "Avg. Transaction", value: "360.24 ETB", change: "+3.9% vs yesterday", up: true },
            { icon: "💊", label: "Top Product", value: "Panadol", sub: "48 units today" },
          ].map(({ icon, label, value, change, up, sub }) => (
            <div key={label} className="bg-[#DBEFF3] rounded-xl p-4 border border-[#ABDBE3]/30 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl" aria-hidden>{icon}</span>
                <p className="text-xs text-[#666666]">{label}</p>
              </div>
              <p className="text-xl font-bold text-[#333333]">{value}</p>
              {change && <p className={`text-xs mt-1 font-medium ${up ? "text-green-600" : "text-red-500"}`}>{up ? "↑" : "↓"} {change}</p>}
              {sub && <p className="text-xs mt-1 text-[#666666]">{sub}</p>}
            </div>
          ))}
        </div>

        {/* Extra filters */}
        <div className="bg-[#DBEFF3] px-4 sm:px-6 py-3 flex flex-wrap items-center gap-4 border-b border-[#ABDBE3]">
          <label className="flex items-center gap-2 cursor-pointer">
            <div onClick={() => setComparePrev((v) => !v)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${comparePrev ? "bg-[#49B0C1]" : "bg-gray-300"}`}>
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${comparePrev ? "translate-x-4" : "translate-x-0.5"}`} />
            </div>
            <span className="text-sm text-[#333333]">Compare with Previous Period</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <div onClick={() => setIncludeTax((v) => !v)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${includeTax ? "bg-[#49B0C1]" : "bg-gray-300"}`}>
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${includeTax ? "translate-x-4" : "translate-x-0.5"}`} />
            </div>
            <span className="text-sm text-[#333333]">Include Tax</span>
          </label>
          <div className="flex items-center gap-2">
            <label className="text-xs text-[#666666]">Group By</label>
            <select className="rounded-md border border-[#ABDBE3] bg-white px-2 py-1.5 text-sm focus:border-[#49B0C1] focus:outline-none">
              {["Product", "Category", "Brand", "Payment Method"].map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <button className="ml-auto rounded-md bg-white border border-[#ABDBE3] px-3 py-1.5 text-sm text-[#666666] hover:bg-[#ABDBE3] transition-colors">⟳ Refresh</button>
        </div>

        {/* Sales summary table */}
        <div className="px-4 sm:px-6 py-4">
          <div className="rounded-xl border border-[#DBEFF3] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#ABDBE3]">
                  {["Period", "Transactions", "Total Sales", "Tax", "Net Sales", "Avg. Transaction", "Growth"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-[#333333]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MOCK_DAILY_SALES.map((row, i) => (
                  <tr key={row.period} className={`hover:bg-[#DBEFF3]/60 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"}`}>
                    <td className="px-4 py-3 font-medium text-[#333333]">{row.period}</td>
                    <td className="px-4 py-3 text-[#333333]">{row.transactions}</td>
                    <td className="px-4 py-3 text-[#333333]">{fmtMoney(row.totalSales)}</td>
                    <td className="px-4 py-3 text-[#333333]">{fmtMoney(row.tax)}</td>
                    <td className="px-4 py-3 font-bold text-[#49B0C1]">{fmtMoney(row.netSales)}</td>
                    <td className="px-4 py-3 text-[#333333]">{row.avgTransaction.toFixed(2)} ETB</td>
                    <td className={`px-4 py-3 font-semibold ${row.growth >= 0 ? "text-green-600" : "text-red-500"}`}>
                      {row.growth >= 0 ? "↑" : "↓"} {Math.abs(row.growth).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Charts 2x2 */}
        <div className="px-4 sm:px-6">
          <div className="bg-[#ABDBE3] rounded-xl p-4 grid sm:grid-cols-2 gap-4">
            {/* Sales trend */}
            <div className="bg-[#DBEFF3] rounded-xl p-3">
              <p className="text-sm font-bold text-[#333333] mb-2">Daily Sales Trend</p>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={SALES_TREND_DATA} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ABDBE3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#333333" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#666666" }} />
                  <Tooltip formatter={(v: any) => [`${v.toLocaleString()} ETB`, "Sales"]} contentStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={AVG_SALES} stroke="#49B0C1" strokeDasharray="4 4" label={{ value: "Avg", position: "right", fontSize: 10 }} />
                  <Area type="monotone" dataKey="sales" stroke="#49B0C1" strokeWidth={2} fill="#DBEFF3" fillOpacity={0.6} dot={{ r: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Sales by category pie */}
            <div className="bg-[#DBEFF3] rounded-xl p-3">
              <p className="text-sm font-bold text-[#333333] mb-2">Sales by Product Category</p>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={SALES_BY_CATEGORY} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" nameKey="name">
                    {SALES_BY_CATEGORY.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: any, name: any) => [`${v}%`, name]} contentStyle={{ fontSize: 11 }} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Top products */}
            <div className="bg-[#DBEFF3] rounded-xl p-3">
              <p className="text-sm font-bold text-[#333333] mb-2">Top Products by Sales</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={TOP_PRODUCTS} layout="vertical" margin={{ top: 4, right: 16, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ABDBE3" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#666666" }} />
                  <YAxis type="category" dataKey="product" tick={{ fontSize: 10, fill: "#333333" }} width={80} />
                  <Tooltip formatter={(v: any) => [`${v.toLocaleString()} ETB`, "Sales"]} contentStyle={{ fontSize: 11 }} />
                  <Bar dataKey="sales" fill="#49B0C1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Hourly distribution */}
            <div className="bg-[#DBEFF3] rounded-xl p-3">
              <p className="text-sm font-bold text-[#333333] mb-1">Hourly Sales Distribution</p>
              <p className="text-xs text-[#49B0C1] mb-2 font-medium">10 AM – 12 PM: Peak Hours</p>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={HOURLY_SALES} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ABDBE3" />
                  <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "#333333" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#666666" }} />
                  <Tooltip formatter={(v: any) => [v, "Transactions"]} contentStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="txn" stroke="#ABDBE3" strokeWidth={2} fill="#DBEFF3" fillOpacity={0.7} dot={{ r: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Detailed breakdown */}
        <div className="px-4 sm:px-6 py-4">
          <div className="bg-white rounded-xl border border-[#DBEFF3] p-4">
            <p className="font-bold text-[#333333] mb-3">Detailed Breakdown</p>
            <div className="flex gap-2 mb-4 flex-wrap">
              {BREAKDOWN_TABS.map((t) => (
                <button key={t} onClick={() => setBreakdownTab(t)} className={`rounded-lg px-4 py-2 text-xs font-medium transition-colors ${breakdownTab === t ? "bg-[#49B0C1] text-white" : "bg-[#ABDBE3] text-[#333333] hover:bg-[#9acbd5]"}`}>{t}</button>
              ))}
            </div>
            <div className="rounded-xl overflow-hidden border border-[#DBEFF3]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#ABDBE3]">
                    {["Name", "Units Sold", "Revenue", "% of Total"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left font-semibold text-[#333333]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(BREAKDOWN_DATA[breakdownTab as keyof typeof BREAKDOWN_DATA] ?? []).map((row, i) => (
                    <tr key={row.name} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"}>
                      <td className="px-4 py-2.5 font-medium text-[#333333]">{row.name}</td>
                      <td className="px-4 py-2.5 text-[#333333]">{row.units}</td>
                      <td className="px-4 py-2.5 text-[#333333]">{fmtMoney(row.revenue)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 bg-[#DBEFF3] rounded-full overflow-hidden">
                            <div className="h-full bg-[#49B0C1] rounded-full" style={{ width: `${row.pct}%` }} />
                          </div>
                          <span className="text-[#333333]">{row.pct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-[#ABDBE3]">
                    <td className="px-4 py-2.5 font-bold text-[#333333]">Total</td>
                    <td className="px-4 py-2.5 font-bold text-[#333333]">127</td>
                    <td className="px-4 py-2.5 font-bold text-[#333333]">45,750.00 ETB</td>
                    <td className="px-4 py-2.5 font-bold text-[#333333]">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Comparative analysis */}
        <div className="px-4 sm:px-6 pb-6">
          <div className="bg-[#DBEFF3] rounded-xl p-4">
            <p className="font-bold text-[#333333] mb-3">Comparative Analysis</p>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                {
                  title: "Period Comparison",
                  current: "Feb 2026", prev: "Jan 2026",
                  rows: [
                    { metric: "Sales", cur: "45,750 ETB", pre: "40,200 ETB", chg: "+13.8%", up: true },
                    { metric: "Transactions", cur: "127", pre: "115", chg: "+10.4%", up: true },
                    { metric: "Avg. Transaction", cur: "360.24 ETB", pre: "349.57 ETB", chg: "+3.1%", up: true },
                  ],
                },
                {
                  title: "Year-over-Year",
                  current: "Feb 2026", prev: "Feb 2025",
                  rows: [
                    { metric: "Sales", cur: "45,750 ETB", pre: "38,200 ETB", chg: "+19.8%", up: true },
                    { metric: "Transactions", cur: "127", pre: "108", chg: "+17.6%", up: true },
                    { metric: "Avg. Transaction", cur: "360.24 ETB", pre: "353.70 ETB", chg: "+1.8%", up: true },
                  ],
                },
              ].map(({ title, current, prev, rows }) => (
                <div key={title} className="bg-white rounded-xl p-4 border border-[#ABDBE3]/30">
                  <p className="font-bold text-[#333333] text-sm mb-1">{title}</p>
                  <div className="flex gap-4 text-xs text-[#666666] mb-3">
                    <span>Current: {current}</span>
                    <span>Previous: {prev}</span>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#DBEFF3]">
                        <th className="px-2 py-1.5 text-left text-[#333333]">Metric</th>
                        <th className="px-2 py-1.5 text-right text-[#333333]">Current</th>
                        <th className="px-2 py-1.5 text-right text-[#333333]">Previous</th>
                        <th className="px-2 py-1.5 text-right text-[#333333]">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.metric} className="border-t border-[#DBEFF3]">
                          <td className="px-2 py-1.5 text-[#333333]">{r.metric}</td>
                          <td className="px-2 py-1.5 text-right font-semibold text-[#333333]">{r.cur}</td>
                          <td className="px-2 py-1.5 text-right text-[#666666]">{r.pre}</td>
                          <td className={`px-2 py-1.5 text-right font-bold ${r.up ? "text-green-600" : "text-red-500"}`}>{r.chg}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
