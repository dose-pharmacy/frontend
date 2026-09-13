import { useState, useMemo } from "react";
import ReportsSubNav from "./ReportsSubNav";
import PageHeader from "../../components/ui/PageHeader";

type ActionType =
  | "login"
  | "logout"
  | "inventory_update"
  | "prescription_edit"
  | "po_created"
  | "po_approved"
  | "delivery_recorded"
  | "payment_recorded"
  | "margin_config"
  | "product_added"
  | "stock_transfer"
  | "user_action";

interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  role: string;
  actionType: ActionType;
  action: string;
  details: string;
  module: string;
  ip: string;
  severity: "info" | "warning" | "success" | "error";
}

const MOCK_LOGS: AuditLog[] = [
  { id: "AL-001", timestamp: "2026-09-08 09:42:15", user: "Dr. Amara Tadesse", role: "Pharmacist", actionType: "login", action: "User Login", details: "Successful login from Chrome / Windows 11", module: "Auth", ip: "192.168.1.45", severity: "info" },
  { id: "AL-002", timestamp: "2026-09-08 09:44:02", user: "Dr. Amara Tadesse", role: "Pharmacist", actionType: "prescription_edit", action: "Prescription Edited", details: "Updated dosage for RX-2026-0412 (Amoxicillin 500mg → 250mg)", module: "Prescriptions", ip: "192.168.1.45", severity: "warning" },
  { id: "AL-003", timestamp: "2026-09-08 09:55:30", user: "Mesfin Bekele", role: "Inventory Manager", actionType: "inventory_update", action: "Stock Adjusted", details: "Adjusted stock for Panadol 500mg: +200 units (batch B-2026-041)", module: "Inventory", ip: "192.168.1.22", severity: "success" },
  { id: "AL-004", timestamp: "2026-09-08 10:02:44", user: "Mesfin Bekele", role: "Inventory Manager", actionType: "product_added", action: "Product Added", details: "New product registered: Cecon 500mg Vitamin C (SKU: VIT-CEF-500)", module: "Inventory", ip: "192.168.1.22", severity: "success" },
  { id: "AL-005", timestamp: "2026-09-08 10:18:07", user: "Tigist Haile", role: "Purchasing Officer", actionType: "po_created", action: "Purchase Order Created", details: "PO-2026-0019 created for AlemPharm Supplier — 8 line items, 12,450.00 ETB", module: "Purchasing", ip: "192.168.1.67", severity: "info" },
  { id: "AL-006", timestamp: "2026-09-08 10:31:55", user: "Admin", role: "System Admin", actionType: "margin_config", action: "Margin Config Updated", details: "Default margin for Antibiotics group changed: 18% → 22%", module: "Reports", ip: "192.168.1.10", severity: "warning" },
  { id: "AL-007", timestamp: "2026-09-08 10:45:12", user: "Tigist Haile", role: "Purchasing Officer", actionType: "po_approved", action: "Purchase Order Approved", details: "PO-2026-0017 approved and sent to EthioPharm Ltd.", module: "Purchasing", ip: "192.168.1.67", severity: "success" },
  { id: "AL-008", timestamp: "2026-09-08 11:03:28", user: "Dr. Amara Tadesse", role: "Pharmacist", actionType: "prescription_edit", action: "Prescription Created", details: "New prescription RX-2026-0415 issued to patient ID P-1042", module: "Prescriptions", ip: "192.168.1.45", severity: "info" },
  { id: "AL-009", timestamp: "2026-09-08 11:22:40", user: "Mesfin Bekele", role: "Inventory Manager", actionType: "stock_transfer", action: "Stock Transfer", details: "Transferred 50 units of Ibuprofen 400mg from Main Store → Pharmacy Counter", module: "Inventory", ip: "192.168.1.22", severity: "info" },
  { id: "AL-010", timestamp: "2026-09-08 11:45:00", user: "Tigist Haile", role: "Purchasing Officer", actionType: "delivery_recorded", action: "Delivery Recorded", details: "Delivery DN-2026-0008 received: 6/8 items fully received, 2 partial", module: "Purchasing", ip: "192.168.1.67", severity: "warning" },
  { id: "AL-011", timestamp: "2026-09-08 12:10:18", user: "Admin", role: "System Admin", actionType: "payment_recorded", action: "Payment Recorded", details: "Invoice INV-2026-0031 paid — 18,450.00 ETB via Bank Transfer (Ref: TXN-990211)", module: "Purchasing", ip: "192.168.1.10", severity: "success" },
  { id: "AL-012", timestamp: "2026-09-08 13:05:33", user: "Dr. Amara Tadesse", role: "Pharmacist", actionType: "logout", action: "User Logout", details: "Session ended after 3h 23m", module: "Auth", ip: "192.168.1.45", severity: "info" },
  { id: "AL-013", timestamp: "2026-09-08 13:12:04", user: "Yohannes Girma", role: "Cashier", actionType: "login", action: "User Login", details: "Successful login from Firefox / macOS", module: "Auth", ip: "192.168.1.88", severity: "info" },
  { id: "AL-014", timestamp: "2026-09-08 13:30:51", user: "Yohannes Girma", role: "Cashier", actionType: "user_action", action: "POS Session Opened", details: "POS terminal T-03 session started", module: "POS", ip: "192.168.1.88", severity: "info" },
  { id: "AL-015", timestamp: "2026-09-08 14:02:10", user: "Mesfin Bekele", role: "Inventory Manager", actionType: "inventory_update", action: "Expiry Alert Acknowledged", details: "Batch B-2026-012 (Amoxicillin) flagged as expiring in 14 days — notified purchasing team", module: "Inventory", ip: "192.168.1.22", severity: "warning" },
];

const ALL_USERS = ["All Users", ...Array.from(new Set(MOCK_LOGS.map((l) => l.user)))];
const ALL_TYPES: { value: ActionType | "all"; label: string }[] = [
  { value: "all", label: "All Actions" },
  { value: "login", label: "Login / Logout" },
  { value: "logout", label: "Logout" },
  { value: "inventory_update", label: "Inventory Update" },
  { value: "prescription_edit", label: "Prescription Edit" },
  { value: "po_created", label: "PO Created" },
  { value: "po_approved", label: "PO Approved" },
  { value: "delivery_recorded", label: "Delivery Recorded" },
  { value: "payment_recorded", label: "Payment Recorded" },
  { value: "margin_config", label: "Margin Config" },
  { value: "product_added", label: "Product Added" },
  { value: "stock_transfer", label: "Stock Transfer" },
];

const MODULE_COLORS: Record<string, string> = {
  Auth: "bg-[#DBEFF3] text-[#49B0C1]",
  Inventory: "bg-green-50 text-green-700",
  Prescriptions: "bg-purple-50 text-purple-700",
  Purchasing: "bg-orange-50 text-orange-700",
  Reports: "bg-blue-50 text-blue-700",
  POS: "bg-yellow-50 text-yellow-700",
};

const SEVERITY_CONFIG = {
  info: { dot: "bg-[#49B0C1]", badge: "text-[#49B0C1]", label: "Info" },
  success: { dot: "bg-green-500", badge: "text-green-600", label: "Success" },
  warning: { dot: "bg-yellow-500", badge: "text-yellow-600", label: "Warning" },
  error: { dot: "bg-red-500", badge: "text-red-600", label: "Error" },
};

const PAGE_SIZE = 10;

export default function AuditTrailPage() {
  const [userFilter, setUserFilter] = useState("All Users");
  const [typeFilter, setTypeFilter] = useState<ActionType | "all">("all");
  const [dateFrom, setDateFrom] = useState("2026-09-08");
  const [dateTo, setDateTo] = useState("2026-09-08");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const filtered = useMemo(() => {
    return MOCK_LOGS.filter((log) => {
      if (userFilter !== "All Users" && log.user !== userFilter) return false;
      if (typeFilter !== "all" && log.actionType !== typeFilter) return false;
      if (search && !log.action.toLowerCase().includes(search.toLowerCase()) &&
          !log.details.toLowerCase().includes(search.toLowerCase()) &&
          !log.user.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [userFilter, typeFilter, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = {
    total: filtered.length,
    warnings: filtered.filter((l) => l.severity === "warning").length,
    errors: filtered.filter((l) => l.severity === "error").length,
    users: new Set(filtered.map((l) => l.user)).size,
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <PageHeader
        title="Audit Trail"
        subtitle="Reports → Audit Trail"
        actions={
          <div className="flex items-center gap-2">
            <button className="rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/20 transition-colors">Export CSV</button>
            <button className="rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-sm text-white/80 hover:bg-white/20 transition-colors">🖨 Print Log</button>
          </div>
        }
      />
      <ReportsSubNav />

      <div className="flex-1 overflow-y-auto">
        {/* Summary stats */}
        <div className="bg-white px-4 sm:px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-[#DBEFF3]">
          {[
            { label: "Total Events", value: stats.total, icon: "📋", color: "text-[#49B0C1]" },
            { label: "Active Users", value: stats.users, icon: "👤", color: "text-green-600" },
            { label: "Warnings", value: stats.warnings, icon: "⚠️", color: "text-yellow-600" },
            { label: "Errors", value: stats.errors, icon: "🚫", color: "text-red-600" },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="bg-[#DBEFF3] rounded-xl p-4 border border-[#ABDBE3]/30">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-lg" aria-hidden>{icon}</span>
                <p className="text-xs text-[#666666]">{label}</p>
              </div>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-[#DBEFF3] px-4 sm:px-6 py-3 border-b border-[#ABDBE3] flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="flex items-center gap-2 bg-white rounded-lg border border-[#ABDBE3] px-3 py-2 w-56">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-[#666666] flex-shrink-0">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd"/>
            </svg>
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search logs…"
              className="bg-transparent text-sm text-[#333333] placeholder-[#999] outline-none w-full"
            />
          </div>

          {/* User */}
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-[#666666] uppercase tracking-wide">User</label>
            <select
              value={userFilter}
              onChange={(e) => { setUserFilter(e.target.value); setPage(1); }}
              className="rounded-md border border-[#ABDBE3] bg-white px-2 py-1.5 text-sm focus:border-[#49B0C1] focus:outline-none"
            >
              {ALL_USERS.map((u) => <option key={u}>{u}</option>)}
            </select>
          </div>

          {/* Action type */}
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-[#666666] uppercase tracking-wide">Action Type</label>
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value as ActionType | "all"); setPage(1); }}
              className="rounded-md border border-[#ABDBE3] bg-white px-2 py-1.5 text-sm focus:border-[#49B0C1] focus:outline-none"
            >
              {ALL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Date from */}
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-[#666666] uppercase tracking-wide">From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-md border border-[#ABDBE3] bg-white px-2 py-1.5 text-sm focus:border-[#49B0C1] focus:outline-none" />
          </div>

          {/* Date to */}
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-[#666666] uppercase tracking-wide">To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-md border border-[#ABDBE3] bg-white px-2 py-1.5 text-sm focus:border-[#49B0C1] focus:outline-none" />
          </div>

          <button
            onClick={() => { setUserFilter("All Users"); setTypeFilter("all"); setSearch(""); setPage(1); }}
            className="ml-auto self-end rounded-md bg-white border border-[#ABDBE3] px-3 py-1.5 text-sm text-[#666666] hover:bg-[#ABDBE3] transition-colors"
          >
            ✕ Clear
          </button>
        </div>

        {/* Table */}
        <div className="px-4 sm:px-6 py-4">
          <div className="rounded-xl border border-[#DBEFF3] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="bg-[#ABDBE3]">
                    {["", "Timestamp", "User", "Module", "Action", "Details", "IP Address"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-semibold text-[#333333] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-[#666666] text-sm">
                        No audit log entries match the current filters.
                      </td>
                    </tr>
                  ) : paginated.map((log, i) => {
                    const sev = SEVERITY_CONFIG[log.severity];
                    return (
                      <tr
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className={`transition-colors cursor-pointer hover:bg-[#DBEFF3]/50 ${i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"}`}
                      >
                        {/* Severity dot */}
                        <td className="px-4 py-3">
                          <span className={`inline-block h-2.5 w-2.5 rounded-full ${sev.dot}`} title={sev.label} />
                        </td>
                        {/* Timestamp */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-mono text-xs text-[#666666]">{log.timestamp}</span>
                        </td>
                        {/* User */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div>
                            <p className="font-semibold text-[#333333] text-xs">{log.user}</p>
                            <p className="text-[10px] text-[#666666]">{log.role}</p>
                          </div>
                        </td>
                        {/* Module */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${MODULE_COLORS[log.module] ?? "bg-gray-100 text-gray-600"}`}>
                            {log.module}
                          </span>
                        </td>
                        {/* Action */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-medium text-[#333333]">{log.action}</span>
                        </td>
                        {/* Details */}
                        <td className="px-4 py-3 max-w-xs">
                          <p className="text-[#666666] text-xs truncate" title={log.details}>{log.details}</p>
                        </td>
                        {/* IP */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-mono text-xs text-[#999]">{log.ip}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between bg-[#DBEFF3]/40 px-4 py-3 border-t border-[#DBEFF3]">
              <p className="text-xs text-[#666666]">
                Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} events
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium bg-white border border-[#ABDBE3] text-[#333333] hover:bg-[#ABDBE3] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ← Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${p === page ? "bg-[#49B0C1] text-white" : "bg-white border border-[#ABDBE3] text-[#333333] hover:bg-[#ABDBE3]"}`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || totalPages === 0}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium bg-white border border-[#ABDBE3] text-[#333333] hover:bg-[#ABDBE3] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setSelectedLog(null)}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="font-bold text-[#333333] text-base">{selectedLog.action}</p>
                <p className="text-xs text-[#666666] mt-0.5 font-mono">{selectedLog.timestamp}</p>
              </div>
              <button onClick={() => setSelectedLog(null)} className="rounded-lg p-1.5 text-[#666666] hover:bg-[#DBEFF3] transition-colors">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
              </button>
            </div>

            <div className="space-y-3">
              {[
                { label: "Log ID", value: selectedLog.id },
                { label: "User", value: `${selectedLog.user} (${selectedLog.role})` },
                { label: "Module", value: selectedLog.module },
                { label: "Action Type", value: selectedLog.actionType.replace(/_/g, " ") },
                { label: "Severity", value: SEVERITY_CONFIG[selectedLog.severity].label },
                { label: "IP Address", value: selectedLog.ip },
                { label: "Details", value: selectedLog.details },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-4">
                  <p className="text-xs font-semibold text-[#666666] w-28 flex-shrink-0 pt-0.5">{label}</p>
                  <p className="text-sm text-[#333333] flex-1">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-4 border-t border-[#DBEFF3] flex justify-end">
              <button onClick={() => setSelectedLog(null)} className="rounded-lg bg-[#49B0C1] px-5 py-2 text-sm font-semibold text-white hover:bg-[#3a9baf] transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
