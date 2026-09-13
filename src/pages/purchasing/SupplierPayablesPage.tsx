import { useState, useEffect } from "react";
import PurchasingSubNav from "./PurchasingSubNav";
import PageHeader from "../../components/ui/PageHeader";
import { getInvoices, getSuppliers, fmtMoney, fmtDate } from "../../features/purchasing/purchasingService";
import { MOCK_INVOICES } from "../../features/purchasing/purchasingMock";
import type { Invoice, Supplier } from "../../features/purchasing/purchasingMock";

const PAGE_SIZE = 5;

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-400 text-[#333333]",
  partial: "bg-orange-400 text-white",
  paid: "bg-green-500 text-white",
  overdue: "bg-red-500 text-white",
};

export default function SupplierPayablesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [suppFilter, setSuppFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Payment form state
  const [payInvoiceId, setPayInvoiceId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Bank Transfer");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [payRef, setPayRef] = useState("");
  const [paySuccess, setPaySuccess] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getInvoices({ supplierId: suppFilter, status: statusFilter, search }),
      getSuppliers(),
    ]).then(([invs, sups]) => {
      setInvoices(invs);
      setSuppliers(sups);
      setLoading(false);
    });
  }, [suppFilter, statusFilter, search]);

  const totalOutstanding = MOCK_INVOICES.filter((i) => i.status !== "paid").reduce((s, i) => s + (i.amount - i.paid), 0);
  const overdue = MOCK_INVOICES.filter((i) => i.status === "overdue").reduce((s, i) => s + i.amount, 0);
  const paidThisMonth = MOCK_INVOICES.filter((i) => i.status === "paid").reduce((s, i) => s + i.amount, 0);

  const totalPages = Math.ceil(invoices.length / PAGE_SIZE);
  const paged = invoices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function handleRecordPayment() {
    if (!payInvoiceId || !payAmount || !payRef) return;
    await new Promise((r) => setTimeout(r, 700));
    setPaySuccess(true);
    setTimeout(() => setPaySuccess(false), 3000);
    setPayAmount("");
    setPayRef("");
  }

  const isDueDatePast = (dateStr: string) => new Date(dateStr) < new Date();

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <PageHeader
        title="Supplier Accounts Payable"
        subtitle="Purchasing → Accounts Payable"
        actions={
          <div className="flex items-center gap-2">
            <button className="rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/20 transition-colors">Generate Report</button>
            <button className="rounded-lg bg-white/20 border border-white/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/30 transition-colors">Record Payment</button>
          </div>
        }
      />
      <PurchasingSubNav />

      <div className="flex-1 overflow-y-auto">
        {/* Stats */}
        <div className="bg-white px-4 sm:px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-[#DBEFF3]">
          {[
            { label: "Total Outstanding", value: fmtMoney(totalOutstanding), color: "text-red-500", icon: "💰" },
            { label: "Total Invoices", value: String(MOCK_INVOICES.length), color: "text-[#333333]", icon: "📄" },
            { label: "Overdue", value: fmtMoney(overdue), color: "text-red-500", icon: "⏰" },
            { label: "Paid This Month", value: fmtMoney(paidThisMonth), color: "text-green-600", icon: "✅" },
          ].map(({ label, value, color, icon }) => (
            <div key={label} className="bg-[#DBEFF3] rounded-xl p-4 flex items-center gap-3 border border-[#ABDBE3]/30 shadow-sm">
              <span className="text-2xl flex-shrink-0" aria-hidden>{icon}</span>
              <div className="min-w-0">
                <p className="text-xs text-[#666666]">{label}</p>
                <p className={`text-sm font-bold ${color} truncate`}>{value}</p>
              </div>
            </div>
          ))}
        </div>

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
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <div className="flex flex-col gap-0.5 flex-1 min-w-[160px] max-w-xs">
            <span className="text-[10px] text-[#666666] uppercase tracking-wide">Search</span>
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#666666]" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd"/></svg>
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search invoices..." className="w-full rounded-md border border-[#ABDBE3] bg-white pl-8 pr-3 py-1.5 text-sm focus:border-[#49B0C1] focus:outline-none" />
            </div>
          </div>
        </div>

        {/* Invoices table */}
        <div className="px-4 sm:px-6 py-4">
          <div className="rounded-xl border border-[#DBEFF3] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#ABDBE3]">
                  {["Invoice #", "Supplier", "Date", "Amount", "Due Date", "Status", "Actions"].map((h) => (
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
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-[#666666]">No invoices found.</td></tr>
                ) : (
                  paged.map((inv, i) => {
                    const isPastDue = isDueDatePast(inv.dueDate) && inv.status !== "paid";
                    return (
                      <tr key={inv.id} className={`hover:bg-[#DBEFF3]/60 transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"}`}>
                        <td className="px-4 py-3 text-[#49B0C1] font-medium hover:underline cursor-pointer">{inv.reference}</td>
                        <td className="px-4 py-3 text-[#333333]">{inv.supplierName}</td>
                        <td className="px-4 py-3 text-[#333333]">{fmtDate(inv.date)}</td>
                        <td className="px-4 py-3 font-semibold text-[#333333]">{fmtMoney(inv.amount)}</td>
                        <td className={`px-4 py-3 font-medium ${isPastDue ? "text-red-500" : "text-yellow-600"}`}>
                          {fmtDate(inv.dueDate)} {isPastDue ? "⚠" : "⏰"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_BADGE[inv.status]}`}>{inv.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button className="text-[#49B0C1] hover:text-[#3a9baf]" title="View">
                              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"/><path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41z" clipRule="evenodd"/></svg>
                            </button>
                            {inv.status !== "paid" && (
                              <button onClick={() => setPayInvoiceId(inv.id)} className="text-xs rounded-lg bg-[#49B0C1] px-3 py-1 text-white hover:bg-[#3a9baf] transition-colors">Pay</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {!loading && invoices.length > 0 && (
            <div className="flex items-center justify-between mt-3 px-1">
              <p className="text-sm text-[#666666]">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, invoices.length)} of {invoices.length} invoices</p>
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

        {/* Record payment form */}
        <div className="px-4 sm:px-6 pb-6">
          <div className="bg-[#DBEFF3] rounded-xl p-4">
            <p className="font-bold text-[#333333] mb-4">Record Payment</p>
            {paySuccess && (
              <div className="rounded-lg bg-green-50 border border-green-300 px-4 py-2.5 text-sm text-green-700 mb-3">✅ Payment recorded successfully!</div>
            )}
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs text-[#666666] mb-1">Select Invoice</label>
                <select value={payInvoiceId} onChange={(e) => setPayInvoiceId(e.target.value)} className="rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none">
                  <option value="">— Select Invoice —</option>
                  {invoices.filter((i) => i.status !== "paid").map((i) => <option key={i.id} value={i.id}>{i.reference} — {i.supplierName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#666666] mb-1">Payment Amount (ETB)</label>
                <input type="number" value={payAmount} min={0} onChange={(e) => setPayAmount(e.target.value)} placeholder="0.00" className="w-36 rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-[#666666] mb-1">Method</label>
                <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none">
                  <option>Cash</option>
                  <option>Bank Transfer</option>
                  <option>Check</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#666666] mb-1">Date</label>
                <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-[#666666] mb-1">Reference</label>
                <input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Payment ref..." className="w-36 rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none" />
              </div>
              <button
                onClick={handleRecordPayment}
                disabled={!payInvoiceId || !payAmount || !payRef}
                className="rounded-lg bg-[#49B0C1] px-5 py-2 text-sm font-bold text-white hover:bg-[#3a9baf] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ✓ Record Payment
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
