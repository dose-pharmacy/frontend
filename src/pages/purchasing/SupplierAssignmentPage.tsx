import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import PurchasingSubNav from "./PurchasingSubNav";
import PageHeader from "../../components/ui/PageHeader";
import { getRequirement, getSuppliers, fmtMoney, fmtDate } from "../../features/purchasing/purchasingService";
import { getSupplierById } from "../../features/purchasing/suppliersApi";
import type { SupplierDetailDto } from "../../features/purchasing/suppliersApi";
import type { PurchaseRequirement, Supplier } from "../../features/purchasing/purchasingMock";

export default function SupplierAssignmentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [req, setReq] = useState<PurchaseRequirement | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [panelSupplier, setPanelSupplier] = useState<Supplier | null>(null);
  const [panelDetail, setPanelDetail] = useState<SupplierDetailDto | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getRequirement(id ?? ""), getSuppliers()]).then(([r, s]) => {
      if (r) {
        setReq(r);
        const initial: Record<string, string> = {};
        r.products.forEach((p) => { if (p.supplierId) initial[p.id] = p.supplierId; });
        setAssignments(initial);
      }
      setSuppliers(s);
      setLoading(false);
    });
  }, [id]);

  const assignedCount = Object.keys(assignments).length;
  const totalProducts = req?.products.length ?? 0;
  const progress = totalProducts > 0 ? (assignedCount / totalProducts) * 100 : 0;
  const allAssigned = assignedCount === totalProducts && totalProducts > 0;

  async function handleGenerate() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 900));
    setSaving(false);
    navigate("/purchasing/orders");
  }

  /** Opens the side panel and loads live data from GET /purchasing/suppliers/{id}. */
  function openSupplierPanel(supplier: Supplier) {
    setPanelSupplier(supplier);
    setPanelDetail(null);
    setPanelError(null);
    setPanelLoading(true);
    getSupplierById(supplier.id)
      .then(setPanelDetail)
      .catch(() => setPanelError("Could not load supplier details. Please try again."))
      .finally(() => setPanelLoading(false));
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-0 flex-1">
        <PageHeader title="Supplier Assignment" subtitle="Purchasing → Requirements → Assign Suppliers" />
       
        <div className="flex-1 flex items-center justify-center text-[#666666]">Loading…</div>
      </div>
    );
  }

  if (!req) {
    return (
      <div className="flex flex-col min-h-0 flex-1">
        <PageHeader title="Supplier Assignment" subtitle="Purchasing → Requirements → Assign Suppliers" />
        
        <div className="flex-1 flex items-center justify-center text-[#666666]">Requirement not found.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <PageHeader
        title="Supplier Selection"
        subtitle={`Purchasing → Requirements → Assign Suppliers · ${req.reference}`}
        actions={
          <div className="flex items-center gap-3">
            <span className="text-sm text-white/80">{assignedCount} products assigned</span>
            <button
              onClick={handleGenerate}
              disabled={!allAssigned || saving}
              className="rounded-lg bg-white/20 border border-white/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Generating…" : "Generate Purchase Orders"}
            </button>
          </div>
        }
      />
    

      <div className="flex-1 overflow-y-auto pb-24 relative">
        {/* Requirement info */}
        <div className="px-4 sm:px-6 pt-4">
          <div className="bg-[#DBEFF3] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-bold text-[#333333]">Requirement: {req.reference}</p>
              <p className="text-sm text-[#666666]">Date: {fmtDate(req.date)}</p>
              <p className="text-sm text-[#666666]">Total Items: {req.products.length} products</p>
              <p className="text-sm text-[#666666]">Created By: {req.createdBy}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-[#333333] mb-2">{assignedCount} of {totalProducts} products assigned</p>
              <div className="w-40 h-2 bg-[#ABDBE3] rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-[#666666] mt-1">{progress.toFixed(0)}% complete</p>
            </div>
          </div>
        </div>

        {/* Product cards */}
        <div className="px-4 sm:px-6 py-4 flex flex-col gap-3">
          {req.products.map((product) => {
            const assignedSup = suppliers.find((s) => s.id === assignments[product.id]);
            return (
              <div key={product.id} className="bg-white rounded-xl border border-[#DBEFF3] p-4 flex flex-wrap items-center gap-4">
                {/* Left: product info */}
                <div className="flex-1 min-w-[140px]">
                  <p className="font-bold text-[#333333]">{product.productName}</p>
                  <p className="text-sm text-[#666666]">{product.brand}</p>
                  <p className="text-sm text-[#333333]">Required: {product.quantity} {product.unit}s</p>
                  <p className="text-xs text-[#666666]">Est. price: {fmtMoney(product.suggestedPrice)}/{product.unit}</p>
                </div>

                {/* Middle: assignment status */}
                <div className="flex flex-col gap-1.5 min-w-[140px]">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold w-fit ${assignedSup ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
                    {assignedSup ? "Confirmed" : "Not Assigned"}
                  </span>
                  {assignedSup && (
                    <>
                      <p className="text-sm font-medium text-[#333333]">{assignedSup.name}</p>
                      <p className="text-xs text-[#666666]">Contact: {assignedSup.contact}</p>
                    </>
                  )}
                </div>

                {/* Right: supplier dropdown */}
                <div className="flex flex-col gap-2 min-w-[200px]">
                  <label className="text-xs text-[#666666]">Select Supplier</label>
                  <select
                    value={assignments[product.id] ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAssignments((prev) => {
                        const next = { ...prev };
                        if (val) next[product.id] = val; else delete next[product.id];
                        return next;
                      });
                    }}
                    className="rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none"
                  >
                    <option value="">— Select Supplier —</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {assignedSup && (
                    <div className="text-xs text-[#666666] space-y-0.5">
                      <p>📞 {assignedSup.phone}</p>
                      <p>✉ {assignedSup.email}</p>
                      <button onClick={() => openSupplierPanel(assignedSup)} className="text-[#49B0C1] hover:underline">{assignedSup.previousOrders} previous orders →</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#DBEFF3] px-4 sm:px-6 py-3 flex items-center justify-between z-30">
        <button onClick={() => navigate("/purchasing")} className="rounded-lg bg-[#ABDBE3] px-5 py-2.5 text-sm font-semibold text-[#333333] hover:bg-[#9acbd5] transition-colors">← Back to Requirements</button>
        <div className="flex gap-3">
          <button className="rounded-lg bg-[#ABDBE3] px-5 py-2.5 text-sm font-semibold text-[#333333] hover:bg-[#9acbd5] transition-colors">Save Assignments</button>
          <button
            onClick={handleGenerate}
            disabled={!allAssigned || saving}
            className="rounded-lg bg-[#49B0C1] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#3a9baf] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Generating…" : "Generate Purchase Orders"}
          </button>
        </div>
      </div>

      {/* Supplier detail panel */}
      {panelSupplier && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setPanelSupplier(null)} />
          <div className="relative bg-white w-80 max-w-full h-full shadow-2xl overflow-y-auto flex flex-col">
            <div className="bg-[#49B0C1] px-5 py-4 flex items-center justify-between flex-shrink-0">
              <h3 className="text-base font-bold text-white">Supplier Details</h3>
              <button onClick={() => setPanelSupplier(null)} className="text-white/80 hover:text-white">
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/></svg>
              </button>
            </div>
            <div className="p-5 flex flex-col gap-4">
              <div>
                <p className="text-xl font-bold text-[#333333]">{panelSupplier.name}</p>
                <p className="text-sm text-[#666666]">{panelSupplier.contact}</p>
              </div>
              <div className="space-y-1.5 text-sm text-[#666666]">
                <p>📞 {panelSupplier.phone}</p>
                <p>✉ {panelSupplier.email}</p>
                <p>📍 {panelSupplier.address}</p>
              </div>
              {panelError && (
                <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">⚠ {panelError}</div>
              )}
              {panelLoading && <div className="h-28 rounded-lg bg-[#DBEFF3] animate-pulse" />}
              <div>
                <p className="text-sm font-semibold text-[#333333] mb-1">Outstanding Balance</p>
                <p className="text-[#49B0C1] font-bold">{fmtMoney(panelDetail?.totalOutstanding ?? 0)}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#333333] mb-1">Payment Terms</p>
                <p className="text-sm text-[#666666]">{panelDetail?.paymentTerms ?? "—"}</p>
              </div>
              <div>
                <p className="font-bold text-[#333333] mb-2">Previous Orders</p>
                <div className="rounded-lg overflow-hidden border border-[#DBEFF3] text-sm">
                  <table className="w-full">
                    <thead><tr className="bg-[#ABDBE3]"><th className="px-3 py-2 text-left text-xs">PO #</th><th className="px-3 py-2 text-right text-xs">Order Date</th><th className="px-3 py-2 text-right text-xs">Status</th></tr></thead>
                    <tbody>
                      {(panelDetail?.purchaseOrders ?? []).length === 0 ? (
                        <tr><td colSpan={3} className="px-3 py-6 text-center text-[#666666]">No purchase orders yet.</td></tr>
                      ) : (
                        (panelDetail?.purchaseOrders ?? []).map((po, i) => (
                          <tr key={po.id} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/30"}>
                            <td className="px-3 py-2 text-[#49B0C1]">{po.poNumber}</td>
                            <td className="px-3 py-2 text-right text-[#333333]">{fmtDate(po.orderDate)}</td>
                            <td className="px-3 py-2 text-right"><span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{po.status}</span></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
