import { useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from "recharts";
import ReportsSubNav from "./ReportsSubNav";
import PageHeader from "../../components/ui/PageHeader";
import {
  MOCK_SLOW_PRODUCTS,
  TURNOVER_BY_CATEGORY,
  DEAD_STOCK_TREND,
} from "../../features/reports/reportsMock";
import type { SlowProduct } from "../../features/reports/reportsMock";

const fmtMoney = (n: number) =>
  `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;

const PAGE_SIZE = 5;

const STATUS_BADGE: Record<string, string> = {
  slow: "bg-yellow-100 text-yellow-700",
  dead: "bg-red-100 text-red-700",
  moderate: "bg-blue-100 text-[#49B0C1]",
};
const STATUS_LABEL: Record<string, string> = {
  slow: "⚠️ Slow-Moving",
  dead: "🔥 Dead Stock",
  moderate: "📊 Moderate",
};

const TURNOVER_COLORS: Record<string, string> = {
  Painkillers: "#28A745",
  Antibiotics: "#49B0C1",
  Vitamins: "#FFC107",
  Supplements: "#FD7E14",
  "Medical Devices": "#DC3545",
};

export default function StockPerformancePage() {
  const [period, setPeriod] = useState("Last 90 Days");
  const [threshold, setThreshold] = useState(10);
  const [category, setCategory] = useState("All Categories");
  const [page, setPage] = useState(1);

  const filtered = MOCK_SLOW_PRODUCTS.filter(
    (p) => category === "All Categories" || p.category === category
  );

  const deadStock = filtered.filter((p) => p.status === "dead");
  const slowStock = filtered.filter((p) => p.status === "slow");
  const deadStockValue = deadStock.reduce((s, p) => s + p.stockValue, 0);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <PageHeader
        title="Stock Performance Report"
        subtitle="Reports → Stock Performance · Last Updated: Today, 10:30 AM"
        actions={
          <div className="flex items-center gap-2">
            <button className="rounded-lg bg-white/20 border border-white/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/30 transition-colors">⟳ Generate Report</button>
            <button className="rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/20 transition-colors">Export CSV</button>
            <button className="rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-sm text-white/80 hover:bg-white/20 transition-colors">🖨 Print</button>
          </div>
        }
      />
      <ReportsSubNav />

      <div className="flex-1 overflow-y-auto">
        {/* Filters */}
        <div className="bg-[#DBEFF3] px-4 sm:px-6 py-3 flex flex-wrap items-center gap-4 border-b border-[#ABDBE3]">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-[#666666] uppercase tracking-wide">Analysis Period</span>
            <select value={period} onChange={(e) => setPeriod(e.target.value)} className="rounded-md border border-[#ABDBE3] bg-white px-2 py-1.5 text-sm focus:border-[#49B0C1] focus:outline-none">
              {["Last 30 Days", "Last 60 Days", "Last 90 Days", "Custom"].map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-[#666666] uppercase tracking-wide">Movement Threshold</span>
            <div className="flex items-center gap-1">
              <input type="number" value={threshold} min={1} onChange={(e) => setThreshold(Number(e.target.value))} className="w-16 rounded-md border border-[#ABDBE3] bg-white px-2 py-1.5 text-sm focus:border-[#49B0C1] focus:outline-none" />
              <span className="text-xs text-[#666666]">units/month</span>
            </div>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-[#666666] uppercase tracking-wide">Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-md border border-[#ABDBE3] bg-white px-2 py-1.5 text-sm focus:border-[#49B0C1] focus:outline-none">
              {["All Categories", "Vitamins", "Antibiotics", "Supplements", "Cough & Cold", "Ophthalmic"].map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
          <button className="self-end rounded-md bg-[#49B0C1] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#3a9baf] transition-colors">Apply</button>
        </div>

        {/* Stats */}
        <div className="bg-white px-4 sm:px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-[#DBEFF3]">
          {[
            { icon: "💊", label: "Total Products", value: "1,245", sub: "All inventory items", color: "text-[#333333]" },
            { icon: "⏳", label: "Slow-Moving Items", value: String(slowStock.length), sub: `${((slowStock.length / filtered.length) * 100).toFixed(1)}% of total`, color: "text-yellow-500" },
            { icon: "📦", label: "Dead Stock Items", value: String(deadStock.length), sub: `${((deadStock.length / filtered.length) * 100).toFixed(1)}% of total`, color: "text-red-500" },
            { icon: "💵", label: "Value of Dead Stock", value: fmtMoney(deadStockValue), sub: "Tied in non-moving inventory", color: "text-red-500" },
          ].map(({ icon, label, value, sub, color }) => (
            <div key={label} className="bg-[#DBEFF3] rounded-xl p-4 border border-[#ABDBE3]/30 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl" aria-hidden>{icon}</span>
                <p className="text-xs text-[#666666]">{label}</p>
              </div>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-[#666666] mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* Slow-moving table */}
        <div className="px-4 sm:px-6 py-4">
          <div className="rounded-xl border border-[#DBEFF3] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#ABDBE3]">
                  {["#", "Product", "Category", "Stock Qty", "Days in Stock", "Units Sold", "Turnover Rate", "Status", "Action"].map((h) => (
                    <th key={h} className="px-3 py-3 text-left font-semibold text-[#333333]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((p: SlowProduct, i: number) => (
                  <tr key={p.id} className={`hover:bg-[#DBEFF3]/60 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"}`}>
                    <td className="px-3 py-3 text-[#666666]">{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-[#333333]">{p.name}</p>
                      <p className="text-xs text-[#666666]">{p.brand}</p>
                    </td>
                    <td className="px-3 py-3 text-[#333333]">{p.category}</td>
                    <td className={`px-3 py-3 font-semibold ${p.status === "dead" ? "text-red-500" : p.status === "slow" ? "text-yellow-600" : "text-[#333333]"}`}>
                      {p.stockQty} {p.stockUnit}s
                    </td>
                    <td className={`px-3 py-3 ${p.daysInStock > 120 ? "text-red-500" : p.daysInStock > 60 ? "text-yellow-600" : "text-[#333333]"}`}>
                      ⏰ {p.daysInStock} Days
                    </td>
                    <td className="px-3 py-3 text-[#333333]">{p.unitsSold} units</td>
                    <td className={`px-3 py-3 font-mono font-semibold ${p.turnoverRate < 0.1 ? "text-red-500" : p.turnoverRate < 0.3 ? "text-yellow-600" : "text-[#333333]"}`}>
                      {p.turnoverRate.toFixed(3)}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[p.status]}`}>
                        {STATUS_LABEL[p.status]}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <button className="text-[#49B0C1] hover:text-[#3a9baf]" title="View">
                          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"/><path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41z" clipRule="evenodd"/></svg>
                        </button>
                        <select className="text-xs rounded border border-[#ABDBE3] bg-white px-1 py-0.5 focus:outline-none">
                          <option>Action ▼</option>
                          <option>Discount Sale</option>
                          <option>Return to Supplier</option>
                          <option>Bundle</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mt-3 px-1">
            <p className="text-sm text-[#666666]">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} products</p>
            <div className="flex items-center gap-1">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg px-3 py-1.5 text-sm text-[#666666] border border-[#ABDBE3] hover:bg-[#DBEFF3] disabled:opacity-40">← Prev</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${p === page ? "bg-[#49B0C1] text-white" : "text-[#666666] border border-[#ABDBE3] hover:bg-[#DBEFF3]"}`}>{p}</button>
              ))}
              <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg px-3 py-1.5 text-sm text-[#666666] border border-[#ABDBE3] hover:bg-[#DBEFF3] disabled:opacity-40">Next →</button>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        <div className="px-4 sm:px-6">
          <div className="bg-[#DBEFF3] rounded-xl p-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#ABDBE3] mb-3">
              <div>
                <p className="font-bold text-[#333333]">Action Recommendations</p>
                <p className="text-xs text-[#666666]">Suggested actions for slow-moving products</p>
              </div>
              <label className="flex items-center gap-1.5 text-sm text-[#49B0C1] cursor-pointer">
                <input type="checkbox" className="accent-[#49B0C1]" />
                Apply Bulk Actions
              </label>
            </div>
            <div className="flex flex-col gap-2">
              {MOCK_SLOW_PRODUCTS.filter((p) => p.status !== "moderate").map((p) => (
                <div key={p.id} className="bg-white rounded-xl p-3 border border-[#DBEFF3] flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#333333]">{p.name}</p>
                    <p className="text-xs text-[#666666]">{p.category} — Stock Value: {fmtMoney(p.stockValue)}</p>
                    <p className={`text-xs font-semibold mt-0.5 ${p.daysInStock > 120 ? "text-red-500" : "text-yellow-600"}`}>⏰ {p.daysInStock} Days in Stock</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="rounded-lg bg-[#49B0C1] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#3a9baf] transition-colors">Discount Sale</button>
                    <button className="rounded-lg bg-[#ABDBE3] px-3 py-1.5 text-xs text-[#333333] hover:bg-[#9acbd5] transition-colors">Return to Supplier</button>
                    <button className="rounded-lg bg-[#ABDBE3] px-3 py-1.5 text-xs text-[#333333] hover:bg-[#9acbd5] transition-colors">Bundle</button>
                    <button className="rounded-lg bg-[#ABDBE3] px-3 py-1.5 text-xs text-[#333333] hover:bg-[#9acbd5] transition-colors">Promotion</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="px-4 sm:px-6 py-4 pb-6">
          <div className="bg-[#ABDBE3] rounded-xl p-4 grid lg:grid-cols-2 gap-4">
            <div className="bg-[#DBEFF3] rounded-xl p-4">
              <p className="text-sm font-bold text-[#333333] mb-3">Stock Turnover by Category</p>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={TURNOVER_BY_CATEGORY} layout="vertical" margin={{ top: 4, right: 16, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ABDBE3" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#666666" }} />
                  <YAxis type="category" dataKey="category" tick={{ fontSize: 11, fill: "#333333" }} width={110} />
                  <Tooltip formatter={(v: any) => [v.toFixed(1), "Turnover Rate"]} contentStyle={{ fontSize: 12 }} />
                  <ReferenceLine x={5} stroke="#49B0C1" strokeDasharray="5 5" label={{ value: "Target: 5.0", position: "top", fontSize: 10 }} />
                  <Bar dataKey="rate" radius={[0, 4, 4, 0]}>
                    {TURNOVER_BY_CATEGORY.map((entry) => (
                      <rect key={entry.category} fill={TURNOVER_COLORS[entry.category] ?? "#49B0C1"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-[#DBEFF3] rounded-xl p-4">
              <p className="text-sm font-bold text-[#333333] mb-3">Value of Dead Stock Over Time</p>
              <p className="text-xs font-bold text-red-500 mb-2">Dead Stock Value: 67,450 ETB</p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={DEAD_STOCK_TREND} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ABDBE3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#333333" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#666666" }} />
                  <Tooltip formatter={(v: any) => [`${v.toLocaleString()} ETB`, "Dead Stock"]} contentStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="value" stroke="#DC3545" strokeWidth={2} fill="#DC3545" fillOpacity={0.15} dot={{ r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
