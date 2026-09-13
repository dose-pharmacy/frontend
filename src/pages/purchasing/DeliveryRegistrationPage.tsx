import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import PurchasingSubNav from "./PurchasingSubNav";
import PageHeader from "../../components/ui/PageHeader";
import { getPurchaseOrders, fmtMoney } from "../../features/purchasing/purchasingService";
import type { PurchaseOrder, DeliveryItem } from "../../features/purchasing/purchasingMock";

const DELIVERY_REF = `DN-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`;

export default function DeliveryRegistrationPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [selectedPoId, setSelectedPoId] = useState("");
  const [deliveryNote, setDeliveryNote] = useState(DELIVERY_REF);
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split("T")[0]);
  const [delivNotes, setDelivNotes] = useState("");
  const [items, setItems] = useState<DeliveryItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPurchaseOrders({ status: "sent" }).then((pos) => {
      const withAll = pos.length ? pos : [];
      setOrders(withAll);
    });
    // also show delivered POs
    getPurchaseOrders().then(setOrders);
  }, []);

  const selectedPo = orders.find((o) => o.id === selectedPoId);

  useEffect(() => {
    if (selectedPo) {
      setItems(
        selectedPo.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          productName: item.productName,
          orderedQty: item.quantity,
          orderedUnit: item.unit,
          deliveredQty: item.quantity,
          batch: "",
          expiry: "",
          status: "received" as const,
        }))
      );
    } else {
      setItems([]);
    }
  }, [selectedPoId]);

  function updateItem(id: string, field: keyof DeliveryItem, value: string | number) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === "deliveredQty") {
          const dQty = Number(value);
          updated.status = dQty === 0 ? "missing" : dQty < item.orderedQty ? "partial" : "received";
        }
        return updated;
      })
    );
  }

  const expectedTotal = selectedPo?.total ?? 0;
  const allReceived = items.every((i) => i.status === "received");

  const STATUS_STYLE: Record<string, string> = {
    received: "text-green-600",
    partial: "text-yellow-600",
    missing: "text-red-600",
  };
  const STATUS_LABEL: Record<string, string> = {
    received: "✅ Received",
    partial: "⚠ Partial",
    missing: "❌ Missing",
  };

  async function handleProcess() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 900));
    setSaving(false);
    navigate("/purchasing/deliveries/del-1/reconcile");
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <PageHeader
        title="Delivery Registration"
        subtitle="Purchasing → Deliveries → New"
        actions={
          <div className="flex items-center gap-2">
            <button onClick={handleProcess} disabled={!selectedPoId || saving} className="rounded-lg bg-white/20 border border-white/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Process for Reconciliation →
            </button>
            <button className="rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/20 transition-colors">
              Generate Report
            </button>
          </div>
        }
      />
      <PurchasingSubNav />

      <div className="flex-1 overflow-y-auto pb-24">
        {/* Delivery info */}
        <div className="px-4 sm:px-6 py-4">
          <div className="bg-[#DBEFF3] rounded-xl p-5">
            <h2 className="text-base font-bold text-[#333333] mb-4">Delivery Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[#666666] mb-1">Purchase Order</label>
                <select value={selectedPoId} onChange={(e) => setSelectedPoId(e.target.value)} className="w-full rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none">
                  <option value="">— Select PO —</option>
                  {orders.map((o) => <option key={o.id} value={o.id}>{o.reference} — {o.supplierName}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#666666] mb-1">Supplier</label>
                <input readOnly value={selectedPo?.supplierName ?? ""} placeholder="Auto-filled from PO" className="w-full rounded-lg border border-[#ABDBE3] bg-[#DBEFF3] px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm text-[#666666] mb-1">Delivery Note #</label>
                <input value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} placeholder="DN-2026-015" className="w-full rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-[#666666] mb-1">Delivery Date</label>
                <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="w-full rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none" />
              </div>
              {selectedPo && (
                <div className="sm:col-span-2">
                  <label className="block text-sm text-[#666666] mb-1">Expected vs Actual</label>
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-sm text-[#333333]">Expected: {selectedPo.items.length} items — {fmtMoney(expectedTotal)}</span>
                    <span className={`text-sm font-semibold ${allReceived ? "text-green-600" : "text-yellow-600"}`}>
                      {allReceived ? "✅ Match" : "⚠ Discrepancy"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Received products table */}
        {items.length > 0 && (
          <div className="px-4 sm:px-6">
            <div className="rounded-xl border border-[#DBEFF3] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#ABDBE3]">
                    {["#", "Product", "Ordered Qty", "Delivered Qty", "Batch", "Expiry", "Status"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-semibold text-[#333333]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={item.id} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"}>
                      <td className="px-4 py-3 text-[#666666]">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-[#333333]">{item.productName}</td>
                      <td className="px-4 py-3 text-[#333333]">{item.orderedQty} {item.orderedUnit}s</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={item.deliveredQty}
                          min={0}
                          max={item.orderedQty * 2}
                          onChange={(e) => updateItem(item.id, "deliveredQty", Number(e.target.value))}
                          className="w-16 rounded border border-[#ABDBE3] bg-white px-2 py-1 text-sm focus:border-[#49B0C1] focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          value={item.batch}
                          onChange={(e) => updateItem(item.id, "batch", e.target.value)}
                          placeholder="BATCH-001"
                          className="w-24 rounded border border-[#ABDBE3] bg-white px-2 py-1 text-sm focus:border-[#49B0C1] focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="month"
                          value={item.expiry}
                          onChange={(e) => updateItem(item.id, "expiry", e.target.value)}
                          className="w-28 rounded border border-[#ABDBE3] bg-white px-2 py-1 text-sm focus:border-[#49B0C1] focus:outline-none"
                        />
                      </td>
                      <td className={`px-4 py-3 font-semibold text-xs ${STATUS_STYLE[item.status]}`}>
                        {STATUS_LABEL[item.status]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="px-4 sm:px-6 py-4">
          <div className="bg-[#DBEFF3] rounded-xl p-4">
            <p className="font-bold text-[#333333] mb-3">Delivery Notes</p>
            <textarea
              rows={3}
              value={delivNotes}
              onChange={(e) => setDelivNotes(e.target.value)}
              placeholder="All products received in good condition..."
              className="w-full rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none resize-none"
            />
            <div className="mt-3 flex items-center gap-3">
              <button className="inline-flex items-center gap-1.5 rounded-lg bg-[#ABDBE3] px-4 py-2 text-sm text-[#333333] hover:bg-[#9acbd5] transition-colors">
                📎 Attach Delivery Note
              </button>
              <span className="text-sm text-[#666666]">{deliveryNote}.pdf</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#DBEFF3] px-4 sm:px-6 py-3 flex items-center justify-end gap-3 z-30">
        <button onClick={() => navigate("/purchasing")} className="rounded-lg bg-red-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-600 transition-colors">Cancel</button>
        <button className="rounded-lg bg-[#ABDBE3] px-5 py-2.5 text-sm font-semibold text-[#333333] hover:bg-[#9acbd5] transition-colors">Save as Draft</button>
        <button
          onClick={handleProcess}
          disabled={!selectedPoId || saving}
          className="rounded-lg bg-[#49B0C1] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#3a9baf] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? "Processing…" : "Process for Reconciliation →"}
        </button>
      </div>
    </div>
  );
}
