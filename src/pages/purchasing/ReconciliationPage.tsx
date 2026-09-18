import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import PurchasingSubNav from "./PurchasingSubNav";
import PageHeader from "../../components/ui/PageHeader";
import { getDelivery, fmtMoney } from "../../features/purchasing/purchasingService";
import type { Delivery } from "../../features/purchasing/purchasingMock";

interface ReconcileRow {
  id: string;
  productName: string;
  brand: string;
  poQty: number;
  deliveryQty: number;
  physicalCount: number;
  unit: string;
  discrepancyReason: string;
  resolution: string;
  notes: string;
}

const REASONS = ["", "Damaged", "Shortage", "Incorrect Item", "Quality Issue"];
const RESOLUTIONS = ["", "Accept Discrepancy", "Return to Supplier", "Adjust PO"];

export default function ReconciliationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [rows, setRows] = useState<ReconcileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    getDelivery(id ?? "del-1").then((d) => {
      if (d) {
        setDelivery(d);
        setRows(
          d.items.map((item) => ({
            id: item.id,
            productName: item.productName,
            brand: item.productName.split(" ")[0],
            poQty: item.orderedQty,
            deliveryQty: item.deliveredQty,
            physicalCount: item.deliveredQty,
            unit: item.orderedUnit,
            discrepancyReason: "",
            resolution: "",
            notes: "",
          }))
        );
      }
      setLoading(false);
    });
  }, [id]);

  function updateRow(rowId: string, field: keyof ReconcileRow, value: string | number) {
    setRows((prev) => prev.map((r) => r.id === rowId ? { ...r, [field]: value } : r));
  }

  const reconciled = rows.filter((r) => {
    const variance = r.physicalCount - r.poQty;
    return variance === 0 || (r.discrepancyReason && r.resolution);
  }).length;

  const allReconciled = reconciled === rows.length;

  const totalOrdered = rows.reduce((s, r) => s + r.poQty, 0);
  const totalReceived = rows.reduce((s, r) => s + r.physicalCount, 0);
  const discrepancyRows = rows.filter((r) => r.physicalCount !== r.poQty);

  async function handleConfirm() {
    setConfirming(true);
    await new Promise((r) => setTimeout(r, 1000));
    setConfirming(false);
    navigate("/purchasing/orders");
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-0 flex-1">
        <PageHeader title="Stock Intake Reconciliation" subtitle="Purchasing → Deliveries → Reconcile" />
        
        <div className="flex-1 flex items-center justify-center text-[#666666]">Loading…</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <PageHeader
        title="Stock Intake Reconciliation"
        subtitle={`Purchasing → Deliveries → Reconcile · ${delivery?.poReference ?? ""}`}
        actions={
          <div className="flex items-center gap-3">
            <span className="text-sm text-white/80">{reconciled} of {rows.length} items reconciled</span>
            <button
              onClick={handleConfirm}
              disabled={!allReconciled || confirming}
              className="rounded-lg bg-green-500 border border-green-300 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {confirming ? "Confirming…" : "✓ Confirm Receiving"}
            </button>
          </div>
        }
      />
     

      <div className="flex-1 overflow-y-auto pb-24">
        {/* Summary cards */}
        <div className="px-4 sm:px-6 py-4 bg-[#DBEFF3]">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-4 text-center border border-[#ABDBE3]/30">
              <p className="text-xs text-[#666666]">Purchase Order</p>
              <p className="text-xl font-bold text-[#333333] mt-1">{totalOrdered} Units</p>
              <p className="text-xs text-[#666666] mt-0.5">{delivery?.poReference}</p>
            </div>
            <div className="bg-white rounded-xl p-4 text-center border border-[#ABDBE3]/30">
              <p className="text-xs text-[#666666]">Delivery Note</p>
              <p className={`text-xl font-bold mt-1 ${delivery?.items.some((i) => i.deliveredQty < i.orderedQty) ? "text-yellow-500" : "text-[#333333]"}`}>
                {rows.reduce((s, r) => s + r.deliveryQty, 0)} Units
              </p>
              <p className="text-xs text-[#666666] mt-0.5">{delivery?.deliveryNote}</p>
            </div>
            <div className="bg-white rounded-xl p-4 text-center border border-[#ABDBE3]/30">
              <p className="text-xs text-[#666666]">Physical Count</p>
              <p className="text-xl font-bold text-green-600 mt-1">{totalReceived} Units</p>
              <p className="text-xs text-[#666666] mt-0.5">Counted by: Staff</p>
            </div>
          </div>
        </div>

        {/* Three-way comparison table */}
        <div className="px-4 sm:px-6 py-4">
          <div className="rounded-xl border border-[#DBEFF3] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#ABDBE3]">
                  {["#", "Product", "PO Qty", "Delivery Note Qty", "Physical Count", "Variance", "Status"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-[#333333]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const variance = row.physicalCount - row.poQty;
                  const isMatch = variance === 0;
                  return (
                    <tr key={row.id} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"}>
                      <td className="px-4 py-3 text-[#666666]">{i + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#333333]">{row.productName}</p>
                        <p className="text-xs text-[#666666]">{row.brand}</p>
                      </td>
                      <td className="px-4 py-3 text-[#333333]">{row.poQty} {row.unit}s</td>
                      <td className={`px-4 py-3 font-medium ${row.deliveryQty < row.poQty ? "text-yellow-600" : "text-[#333333]"}`}>
                        {row.deliveryQty} {row.unit}s
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={row.physicalCount}
                          min={0}
                          onChange={(e) => updateRow(row.id, "physicalCount", Number(e.target.value))}
                          className="w-16 rounded border border-[#ABDBE3] bg-white px-2 py-1 text-sm focus:border-[#49B0C1] focus:outline-none"
                        />
                      </td>
                      <td className={`px-4 py-3 font-semibold ${isMatch ? "text-green-600" : "text-red-500"}`}>
                        {isMatch ? "✓ 0" : `${variance > 0 ? "+" : ""}${variance} ${row.unit}s`}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${isMatch ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                          {isMatch ? "✅ Match" : "⚠ Discrepancy"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Discrepancy resolution */}
        {discrepancyRows.length > 0 && (
          <div className="px-4 sm:px-6">
            <div className="bg-[#DBEFF3] rounded-xl p-4">
              <p className="font-bold text-[#333333] mb-3">Discrepancy Resolution</p>
              <div className="flex flex-col gap-2">
                {discrepancyRows.map((row) => (
                  <div key={row.id} className="bg-white rounded-lg p-3 flex flex-wrap items-center gap-3">
                    <div className="min-w-[120px]">
                      <p className="text-sm font-bold text-[#333333]">{row.productName}</p>
                      <p className="text-xs text-red-500">{row.physicalCount - row.poQty} {row.unit}s discrepancy</p>
                    </div>
                    <div>
                      <label className="block text-xs text-[#666666] mb-0.5">Reason</label>
                      <select
                        value={row.discrepancyReason}
                        onChange={(e) => updateRow(row.id, "discrepancyReason", e.target.value)}
                        className="rounded border border-[#ABDBE3] bg-white px-2 py-1 text-xs focus:border-[#49B0C1] focus:outline-none"
                      >
                        {REASONS.map((r) => <option key={r} value={r}>{r || "Select reason"}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[#666666] mb-0.5">Resolution</label>
                      <select
                        value={row.resolution}
                        onChange={(e) => updateRow(row.id, "resolution", e.target.value)}
                        className="rounded border border-[#ABDBE3] bg-white px-2 py-1 text-xs focus:border-[#49B0C1] focus:outline-none"
                      >
                        {RESOLUTIONS.map((r) => <option key={r} value={r}>{r || "Select resolution"}</option>)}
                      </select>
                    </div>
                    <div className="flex-1 min-w-[100px]">
                      <label className="block text-xs text-[#666666] mb-0.5">Notes</label>
                      <input
                        value={row.notes}
                        onChange={(e) => updateRow(row.id, "notes", e.target.value)}
                        placeholder="Add notes..."
                        className="w-full rounded border border-[#ABDBE3] bg-white px-2 py-1 text-xs focus:border-[#49B0C1] focus:outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Summary bottom */}
        <div className="px-4 sm:px-6 py-4">
          <div className="bg-white rounded-xl border border-[#DBEFF3] p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-[#666666]">Total Ordered</p>
                <p className="text-lg font-bold text-[#333333]">{rows.length} items</p>
                <p className="text-sm text-[#333333]">{totalOrdered} units</p>
              </div>
              <div>
                <p className="text-xs text-[#666666]">Total Received</p>
                <p className="text-lg font-bold text-[#333333]">{rows.length} items</p>
                <p className="text-sm text-[#333333]">{totalReceived} units</p>
              </div>
              <div>
                <p className="text-xs text-[#666666]">Acceptance</p>
                <p className={`text-lg font-bold ${allReconciled ? "text-green-600" : "text-yellow-600"}`}>
                  {allReconciled ? "Full Acceptance" : "Pending Review"}
                </p>
                <p className="text-xs text-[#666666]">{allReconciled ? "All items reconciled" : `${discrepancyRows.length} discrepancies`}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#DBEFF3] px-4 sm:px-6 py-3 flex items-center justify-end gap-3 z-30">
        <button onClick={() => navigate("/purchasing")} className="rounded-lg bg-red-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-600 transition-colors">Cancel</button>
        <button className="rounded-lg bg-[#ABDBE3] px-5 py-2.5 text-sm font-semibold text-[#333333] hover:bg-[#9acbd5] transition-colors">Save for Later</button>
        <button
          onClick={handleConfirm}
          disabled={!allReconciled || confirming}
          className="rounded-lg bg-green-500 px-6 py-2.5 text-sm font-bold text-white hover:bg-green-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {confirming ? "Confirming…" : "✓ Confirm Receiving"}
        </button>
      </div>
    </div>
  );
}
