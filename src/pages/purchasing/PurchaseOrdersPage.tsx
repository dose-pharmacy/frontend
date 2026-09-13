import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import PurchasingSubNav from "./PurchasingSubNav";
import PageHeader from "../../components/ui/PageHeader";
import { getPurchaseOrders, getSuppliers, fmtMoney, fmtDate } from "../../features/purchasing/purchasingService";
import type { PurchaseOrder, Supplier } from "../../features/purchasing/purchasingMock";

const PAGE_SIZE = 5;

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-400 text-white",
  sent: "bg-[#49B0C1] text-white",
  delivered: "bg-purple-500 text-white",
  received: "bg-yellow-400 text-[#333333]",
  completed: "bg-green-500 text-white",
};

export default function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [suppFilter, setSuppFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getPurchaseOrders({ supplierId: suppFilter, status: statusFilter, search }),
      getSuppliers(),
    ]).then(([pos, sups]) => {
      setOrders(pos);
      setSuppliers(sups);
      setLoading(false);
    });
  }, [suppFilter, statusFilter, search]);

  const totalPages = Math.ceil(orders.length / PAGE_SIZE);
  const paged = orders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === "draft" || o.status === "sent").length,
    inProgress: orders.filter((o) => o.status === "delivered" || o.status === "received").length,
    completed: orders.filter((o) => o.status === "completed").length,
  };

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <PageHeader
        title="Purchase Orders"
        subtitle="Purchasing → Orders"
        actions={
          <button onClick={() => navigate("/purchasing/orders/new")} className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 border border-white/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/30 transition-colors">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"/></svg>
            Create New Order
          </button>
        }
      />
      <PurchasingSubNav />

      <div className="flex-1 overflow-y-auto">
        {/* Filters */}
        <div className="bg-[#DBEFF3] px-4 sm:px-6 py-3 flex flex-wrap items-center gap-3 border-b border-[#ABDBE3]">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-[#666666] uppercase tracking-wide">Supplier</span>
            <select value={suppFilter} onChange={(e) => { setSuppFilter(e.target.value); setPage(1); }} className="rounded-md border border-[#ABDBE3] bg-white px-2 py-1.5 text-sm focus:border-[#49B0C1] focus:outline-none">
              <option value="all">All Suppliers</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-[#666666] uppercase tracking-wide">Status</span>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="rounded-md border border-[#ABDBE3] bg-white px-2 py-1.5 text-sm focus:border-[#49B0C1] focus:outline-none">
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="delivered">Delivered</option>
              <option value="received">Received</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div className="flex flex-col gap-0.5 flex-1 min-w-[160px] max-w-xs">
            <span className="text-[10px] text-[#666666] uppercase tracking-wide">Search</span>
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#666666]" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd"/></svg>
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by PO # or supplier..." className="w-full rounded-md border border-[#ABDBE3] bg-white pl-8 pr-3 py-1.5 text-sm focus:border-[#49B0C1] focus:outline-none" />
            </div>
          </div>
          <button onClick={() => { setSuppFilter("all"); setStatusFilter("all"); setSearch(""); setPage(1); }} className="self-end rounded-md bg-white border border-[#ABDBE3] px-3 py-1.5 text-sm text-[#666666] hover:bg-[#ABDBE3] transition-colors">⟳ Refresh</button>
        </div>

        {/* Stats */}
        <div className="bg-white px-4 sm:px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-[#DBEFF3]">
          {[
            { label: "Total Orders", value: stats.total, color: "text-[#333333]", icon: "📋" },
            { label: "Pending", value: stats.pending, color: "text-orange-500", icon: "⏳" },
            { label: "In Progress", value: stats.inProgress, color: "text-yellow-600", icon: "🔄" },
            { label: "Completed", value: stats.completed, color: "text-green-600", icon: "✅" },
          ].map(({ label, value, color, icon }) => (
            <div key={label} className="bg-[#DBEFF3] rounded-xl p-4 flex items-center gap-3 border border-[#ABDBE3]/30 shadow-sm">
              <span className="text-2xl" aria-hidden>{icon}</span>
              <div>
                <p className="text-xs text-[#666666]">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="px-4 sm:px-6 py-4">
          <div className="rounded-xl border border-[#DBEFF3] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#ABDBE3]">
                  {["PO Number", "Supplier", "Date", "Items", "Total Amount", "Status", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-[#333333]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/30"}>
                      {Array.from({ length: 7 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-[#ABDBE3]/40 rounded animate-pulse" /></td>)}
                    </tr>
                  ))
                ) : paged.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-[#666666]">No purchase orders found.</td></tr>
                ) : (
                  paged.map((po, i) => (
                    <tr key={po.id} className={`hover:bg-[#DBEFF3]/60 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"}`}>
                      <td className="px-4 py-3">
                        <button onClick={() => navigate(`/purchasing/orders/${po.id}`)} className="text-[#49B0C1] font-medium hover:underline">{po.reference}</button>
                      </td>
                      <td className="px-4 py-3 text-[#333333]">{po.supplierName}</td>
                      <td className="px-4 py-3 text-[#333333]">{fmtDate(po.date)}</td>
                      <td className="px-4 py-3 text-[#333333]">{po.items.length} items</td>
                      <td className="px-4 py-3 font-semibold text-[#333333]">{fmtMoney(po.total)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_BADGE[po.status]}`}>{po.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => navigate(`/purchasing/orders/${po.id}`)} className="text-[#49B0C1] hover:text-[#3a9baf]" title="View">
                            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"/><path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41z" clipRule="evenodd"/></svg>
                          </button>
                          {(po.status === "draft") && (
                            <button className="text-[#ABDBE3] hover:text-[#49B0C1]" title="Edit">
                              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z"/></svg>
                            </button>
                          )}
                          {po.status === "draft" && (
                            <button className="text-red-400 hover:text-red-600" title="Delete">
                              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd"/></svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {!loading && orders.length > 0 && (
            <div className="flex items-center justify-between mt-3 px-1">
              <p className="text-sm text-[#666666]">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, orders.length)} of {orders.length} orders</p>
              <div className="flex items-center gap-1">
                <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg px-3 py-1.5 text-sm text-[#666666] border border-[#ABDBE3] hover:bg-[#DBEFF3] disabled:opacity-40 transition-colors">← Prev</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button key={p} onClick={() => setPage(p)} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${p === page ? "bg-[#49B0C1] text-white" : "text-[#666666] border border-[#ABDBE3] hover:bg-[#DBEFF3]"}`}>{p}</button>
                ))}
                <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg px-3 py-1.5 text-sm text-[#666666] border border-[#ABDBE3] hover:bg-[#DBEFF3] disabled:opacity-40 transition-colors">Next →</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
