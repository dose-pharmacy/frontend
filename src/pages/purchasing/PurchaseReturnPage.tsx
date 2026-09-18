import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import PurchasingSubNav from "./PurchasingSubNav";
import PageHeader from "../../components/ui/PageHeader";
import { getPurchaseOrders, fmtMoney } from "../../features/purchasing/purchasingService";
import type { PurchaseOrder, ReturnReason } from "../../features/purchasing/purchasingMock";
import { RETURN_REASONS } from "../../features/purchasing/purchasingMock";

const RETURN_REF = `RET-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`;

interface ReturnRow {
  id: string;
  productName: string;
  brand: string;
  originalQty: number;
  returnQty: number;
  unit: string;
  batch: string;
  reason: ReturnReason;
}

export default function PurchaseReturnPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [selectedPoId, setSelectedPoId] = useState("");
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split("T")[0]);
  const [returnReason, setReturnReason] = useState<ReturnReason>("expired");
  const [returnType, setReturnType] = useState<ReturnReason>("expired");
  const [rows, setRows] = useState<ReturnRow[]>([]);
  const [generateDebitNote, setGenerateDebitNote] = useState(true);
  const [debitNotes, setDebitNotes] = useState("Return due to expiry");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    getPurchaseOrders().then(setOrders);
  }, []);

  const selectedPo = orders.find((o) => o.id === selectedPoId);

  useEffect(() => {
    if (selectedPo) {
      setRows(
        selectedPo.items.map((item) => ({
          id: item.id,
          productName: item.productName,
          brand: item.brand,
          originalQty: item.quantity,
          returnQty: 0,
          unit: item.unit,
          batch: `BATCH-001`,
          reason: returnReason,
        }))
      );
    } else {
      setRows([]);
    }
  }, [selectedPoId]);

  function updateRow(rowId: string, field: keyof ReturnRow, value: string | number) {
    setRows((prev) => prev.map((r) => r.id === rowId ? { ...r, [field]: value } : r));
  }

  const returnItems = rows.filter((r) => r.returnQty > 0);
  const totalReturnValue = returnItems.reduce((s, r) => {
    const poItem = selectedPo?.items.find((i) => i.id === r.id);
    return s + r.returnQty * (poItem?.price ?? 0);
  }, 0);

  async function handleProcess() {
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 900));
    setProcessing(false);
    navigate("/purchasing");
  }

  const RETURN_TYPE_OPTIONS: { value: ReturnReason; label: string; icon: string }[] = [
    { value: "expired", label: "Expired", icon: "📅" },
    { value: "damaged", label: "Damaged", icon: "💥" },
    { value: "incorrect_delivery", label: "Incorrect", icon: "❌" },
    { value: "quality_issue", label: "Quality Issue", icon: "🔬" },
  ];

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <PageHeader
        title="Purchase Return"
        subtitle="Purchasing → Returns → New"
        actions={
          <div className="flex items-center gap-3">
            <span className="text-sm text-white/80">Return Reference: {RETURN_REF}</span>
            <button
              onClick={handleProcess}
              disabled={returnItems.length === 0 || processing}
              className="rounded-lg bg-white/20 border border-white/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {processing ? "Processing…" : "Process Return →"}
            </button>
          </div>
        }
      />
     

      <div className="flex-1 overflow-y-auto pb-24">
        {/* Return info form */}
        <div className="px-4 sm:px-6 py-4">
          <div className="bg-[#DBEFF3] rounded-xl p-5">
            <h2 className="text-base font-bold text-[#333333] mb-4">Return Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[#666666] mb-1">Return Date</label>
                <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="w-full rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-[#666666] mb-1">Return Reference</label>
                <input readOnly value={RETURN_REF} className="w-full rounded-lg border border-[#ABDBE3] bg-[#DBEFF3] px-3 py-2 text-sm" />
              </div>
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
                <label className="block text-sm text-[#666666] mb-1">Reason for Return</label>
                <select value={returnReason} onChange={(e) => setReturnReason(e.target.value as ReturnReason)} className="w-full rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none">
                  {RETURN_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#666666] mb-2">Return Type</label>
                <div className="flex flex-wrap gap-3">
                  {RETURN_TYPE_OPTIONS.map((opt) => (
                    <label key={opt.value} className={`flex items-center gap-2 rounded-lg border-2 px-3 py-2 cursor-pointer transition-all ${returnType === opt.value ? "border-[#49B0C1] bg-[#DBEFF3]" : "border-[#ABDBE3] bg-white"}`}>
                      <input type="radio" name="returnType" value={opt.value} checked={returnType === opt.value} onChange={() => setReturnType(opt.value)} className="sr-only" />
                      <span aria-hidden>{opt.icon}</span>
                      <span className="text-sm font-medium text-[#333333]">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Return items table */}
        {rows.length > 0 && (
          <div className="px-4 sm:px-6">
            <div className="rounded-xl border border-[#DBEFF3] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#ABDBE3]">
                    {["#", "Product", "Original Qty", "Return Qty", "Batch", "Reason", "Status"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left font-semibold text-[#333333]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.id} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"}>
                      <td className="px-4 py-3 text-[#666666]">{i + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#333333]">{row.productName}</p>
                        <p className="text-xs text-[#666666]">{row.brand}</p>
                      </td>
                      <td className="px-4 py-3 text-[#333333]">{row.originalQty} {row.unit}s</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={row.returnQty}
                          min={0}
                          max={row.originalQty}
                          onChange={(e) => updateRow(row.id, "returnQty", Number(e.target.value))}
                          className="w-16 rounded border border-[#ABDBE3] bg-white px-2 py-1 text-sm focus:border-[#49B0C1] focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-3 text-[#333333] text-xs">{row.batch}</td>
                      <td className="px-4 py-3">
                        <select
                          value={row.reason}
                          onChange={(e) => updateRow(row.id, "reason", e.target.value)}
                          className="rounded border border-[#ABDBE3] bg-white px-2 py-1 text-xs focus:border-[#49B0C1] focus:outline-none"
                        >
                          {RETURN_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${row.returnQty > 0 ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"}`}>
                          {row.returnQty > 0 ? "🔄 Pending" : "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {rows.length === 0 && (
          <div className="px-4 sm:px-6 py-4">
            <div className="rounded-xl bg-[#DBEFF3] border-2 border-dashed border-[#ABDBE3] py-10 text-center text-[#666666] text-sm">
              Select a Purchase Order above to load items for return.
            </div>
          </div>
        )}

        {/* Debit note section */}
        <div className="px-4 sm:px-6 py-4">
          <div className="bg-[#DBEFF3] rounded-xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex-1">
                <p className="font-bold text-[#333333] mb-1">Debit Note</p>
                <label className="flex items-center gap-2 cursor-pointer mb-1">
                  <div
                    onClick={() => setGenerateDebitNote((v) => !v)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${generateDebitNote ? "bg-[#49B0C1]" : "bg-gray-300"}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${generateDebitNote ? "translate-x-4.5" : "translate-x-0.5"}`} />
                  </div>
                  <span className="text-sm text-[#333333]">Generate Debit Note</span>
                </label>
                <p className="text-xs text-[#666666]">A debit note will be created for this return</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-[#666666]">Total Return Value</p>
                <p className="text-2xl font-bold text-[#49B0C1]">{fmtMoney(totalReturnValue)}</p>
                <p className="text-xs text-[#666666]">{returnItems.length} items returned</p>
              </div>
            </div>

            {generateDebitNote && (
              <div className="mt-4 bg-white rounded-xl p-4 border border-[#ABDBE3]/30 flex flex-col gap-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#666666] mb-1">Debit Note Number</label>
                    <input readOnly value={`DN-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`} className="w-full rounded-lg border border-[#ABDBE3] bg-[#DBEFF3] px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs text-[#666666] mb-1">Amount (ETB)</label>
                    <input readOnly value={fmtMoney(totalReturnValue)} className="w-full rounded-lg border border-[#ABDBE3] bg-[#DBEFF3] px-3 py-2 text-sm font-semibold text-[#49B0C1]" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-[#666666] mb-1">Notes</label>
                  <textarea rows={2} value={debitNotes} onChange={(e) => setDebitNotes(e.target.value)} className="w-full rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 text-sm resize-none focus:border-[#49B0C1] focus:outline-none" />
                </div>
                <button className="self-start rounded-lg bg-[#49B0C1] px-5 py-2 text-sm font-semibold text-white hover:bg-[#3a9baf] transition-colors">Generate Debit Note</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#DBEFF3] px-4 sm:px-6 py-3 flex items-center justify-end gap-3 z-30">
        <button onClick={() => navigate("/purchasing")} className="rounded-lg bg-red-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-600 transition-colors">Cancel</button>
        <button className="rounded-lg bg-[#ABDBE3] px-5 py-2.5 text-sm font-semibold text-[#333333] hover:bg-[#9acbd5] transition-colors">Save as Draft</button>
        <button
          onClick={handleProcess}
          disabled={returnItems.length === 0 || processing}
          className="rounded-lg bg-[#49B0C1] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#3a9baf] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {processing ? "Processing…" : "Process Return →"}
        </button>
      </div>
    </div>
  );
}
