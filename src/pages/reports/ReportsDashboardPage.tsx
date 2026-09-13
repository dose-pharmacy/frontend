import { useNavigate } from "react-router";
import ReportsSubNav from "./ReportsSubNav";
import PageHeader from "../../components/ui/PageHeader";
import { RECENT_REPORTS } from "../../features/reports/reportsMock";

const fmtK = (n: number) =>
  n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(n);

const REPORT_CATEGORIES = [
  {
    icon: "🛒",
    title: "Sales Reports",
    desc: "Daily, weekly, monthly sales analysis",
    color: "text-green-600",
    to: "/reports/sales",
    subs: ["Daily Sales", "Weekly Sales", "Monthly Sales", "Sales by Product"],
  },
  {
    icon: "📦",
    title: "Inventory Reports",
    desc: "Stock levels, movement, and valuation",
    color: "text-[#49B0C1]",
    to: "/reports/stock-performance",
    subs: ["Stock Valuation", "Stock Movement", "Slow-Moving Items", "Expiry Report"],
  },
  {
    icon: "📊",
    title: "Financial Reports",
    desc: "Revenue, costs, and profitability",
    color: "text-purple-600",
    to: "/reports/profitability",
    subs: ["Profit & Loss", "Profit Margins", "Revenue Analysis", "Tax Report"],
  },
  {
    icon: "🚚",
    title: "Purchasing Reports",
    desc: "Orders, suppliers, and spending",
    color: "text-orange-500",
    to: "/purchasing",
    subs: ["Supplier Performance", "Order History", "Purchase Spend", "Returns Analysis"],
  },
  {
    icon: "👥",
    title: "Customer Reports",
    desc: "Customer buying patterns",
    color: "text-green-600",
    to: "/reports",
    subs: ["Purchase History", "Customer Preferences", "Repeat Customers"],
  },
  {
    icon: "⚖️",
    title: "Regulatory Reports",
    desc: "Compliance and audit reports",
    color: "text-red-500",
    to: "/reports",
    subs: ["Controlled Substance Log", "Expiry Compliance", "Audit Trail"],
  },
];

const QUICK_STATS = [
  { icon: "🛒", label: "Today's Sales", value: "45,750 ETB", to: "/reports/sales" },
  { icon: "📅", label: "This Week", value: "312,400 ETB", to: "/reports/sales" },
  { icon: "🗓", label: "This Month", value: "1,245,750 ETB", to: "/reports/sales" },
  { icon: "📈", label: "Year to Date", value: "4,892,300 ETB", to: "/reports/sales" },
];

const SCHEDULED = [
  { name: "Daily Sales Summary", freq: "Daily at 6:00 PM", recipients: 2 },
  { name: "Weekly Inventory Report", freq: "Weekly on Monday", recipients: 3 },
  { name: "Monthly P&L Report", freq: "Monthly on 1st", recipients: 5 },
];

export default function ReportsDashboardPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <PageHeader
        title="Reports Dashboard"
        subtitle="Reports → Dashboard"
        actions={
          <div className="flex items-center gap-2">
            <button className="rounded-lg bg-white/20 border border-white/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/30 transition-colors">+ New Report</button>
            <button className="rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/20 transition-colors">Export</button>
          </div>
        }
      />
      <ReportsSubNav />

      <div className="flex-1 overflow-y-auto">
        {/* Quick stats */}
        <div className="bg-white px-4 sm:px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-[#DBEFF3]">
          {QUICK_STATS.map(({ icon, label, value, to }) => (
            <div key={label} className="bg-[#DBEFF3] rounded-xl p-4 border border-[#ABDBE3]/30 shadow-sm flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xl" aria-hidden>{icon}</span>
                <p className="text-xs text-[#666666]">{label}</p>
              </div>
              <p className="text-lg font-bold text-[#333333]">{value}</p>
              <button onClick={() => navigate(to)} className="text-xs text-[#49B0C1] hover:underline text-left">View Details →</button>
            </div>
          ))}
        </div>

        {/* Report categories grid */}
        <div className="px-4 sm:px-6 py-4">
          <div className="bg-[#DBEFF3] rounded-xl p-4">
            <p className="font-bold text-[#333333] mb-4">Report Categories</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {REPORT_CATEGORIES.map(({ icon, title, desc, color, to, subs }) => (
                <div
                  key={title}
                  className="bg-white rounded-xl p-4 border border-[#DBEFF3] shadow-sm hover:shadow-md hover:border-[#49B0C1] transition-all cursor-pointer group"
                  onClick={() => navigate(to)}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`text-2xl ${color}`} aria-hidden>{icon}</span>
                    <div>
                      <p className="font-bold text-[#333333] text-sm">{title}</p>
                      <p className="text-xs text-[#666666]">{desc}</p>
                    </div>
                  </div>
                  <ul className="space-y-1 mb-3">
                    {subs.map((s) => (
                      <li key={s} className="text-xs text-[#666666] flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-[#ABDBE3] flex-shrink-0" />
                        {s}
                      </li>
                    ))}
                  </ul>
                  <button className="text-xs text-[#49B0C1] group-hover:underline font-medium">View All →</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent reports */}
        <div className="px-4 sm:px-6">
          <div className="bg-white rounded-xl border border-[#DBEFF3] p-4">
            <p className="font-bold text-[#333333] mb-3">Recent Reports</p>
            <div className="rounded-xl overflow-hidden border border-[#DBEFF3]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#ABDBE3]">
                    {["Report Name", "Type", "Generated By", "Date", "Actions"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left font-semibold text-[#333333]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RECENT_REPORTS.map((r, i) => (
                    <tr key={r.name} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"}>
                      <td className="px-4 py-2.5 text-[#49B0C1] hover:underline cursor-pointer font-medium">{r.name}</td>
                      <td className="px-4 py-2.5"><span className="text-xs bg-[#DBEFF3] text-[#333333] px-2 py-0.5 rounded-full">{r.type}</span></td>
                      <td className="px-4 py-2.5 text-[#666666]">{r.generatedBy}</td>
                      <td className="px-4 py-2.5 text-[#666666]">{r.date}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <button className="text-[#49B0C1] hover:text-[#3a9baf]" title="View">
                            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"/><path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41z" clipRule="evenodd"/></svg>
                          </button>
                          <button className="text-[#666666] hover:text-[#333333]" title="Download">
                            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z"/><path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="mt-3 text-sm text-[#49B0C1] hover:underline">View All Reports →</button>
          </div>
        </div>

        {/* Scheduled reports */}
        <div className="px-4 sm:px-6 py-4 pb-6">
          <div className="bg-[#DBEFF3] rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-[#333333]">Scheduled Reports</p>
              <button className="rounded-lg bg-[#ABDBE3] px-3 py-1.5 text-xs font-medium text-[#333333] hover:bg-[#9acbd5] transition-colors">+ Schedule New</button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {SCHEDULED.map((s) => (
                <div key={s.name} className="flex-shrink-0 w-60 bg-white rounded-xl p-4 border border-[#ABDBE3]/30">
                  <p className="font-bold text-[#333333] text-sm">{s.name}</p>
                  <p className="text-xs text-[#666666] mt-1">{s.freq}</p>
                  <p className="text-xs text-[#666666]">{s.recipients} recipients</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-green-600 font-semibold">✅ Active</span>
                    <div className="flex gap-2 text-[#666666]">
                      <button className="hover:text-[#49B0C1]" title="Edit">✏</button>
                      <button className="hover:text-orange-500" title="Pause">⏸</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
