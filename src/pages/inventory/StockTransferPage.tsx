import { useEffect, useState } from "react";
import { getProducts, getBatches } from "../../features/inventory/inventoryService";
import type { Product, Batch } from "../../features/inventory/inventoryMock";
import PageHeader from "../../components/ui/PageHeader";
import Select from "../../components/ui/Select";
import Button from "../../components/ui/Button";
import FormError from "../../components/ui/FormError";

const LOCATIONS = ["Main Store", "Dispensing Area"];

interface TransferRow { batchId: string; qty: string; }

export default function StockTransferPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [from, setFrom] = useState(LOCATIONS[0]);
  const [to, setTo] = useState(LOCATIONS[1]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [rows, setRows] = useState<TransferRow[]>([{ batchId: "", qty: "" }]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    Promise.all([getProducts(), getBatches()]).then(([p, b]) => { setProducts(p); setBatches(b); });
  }, []);

  function availableBatchesForLocation() {
    return batches.filter((b) => b.location === from && b.quantity > 0);
  }

  function getBatchById(id: string) { return batches.find((b) => b.id === id); }
  function getProductName(pid: string) { return products.find((p) => p.id === pid)?.name ?? pid; }

  function updateRow(i: number, field: keyof TransferRow, value: string) {
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }

  function addRow() { setRows((r) => [...r, { batchId: "", qty: "" }]); }
  function removeRow(i: number) { setRows((r) => r.filter((_, idx) => idx !== i)); }

  function validate(): string | null {
    if (from === to) return "Source and destination locations must be different.";
    for (const row of rows) {
      if (!row.batchId) return "Please select a batch for each row.";
      const qty = Number(row.qty);
      if (!row.qty || isNaN(qty) || qty <= 0) return "Quantity must be a positive number.";
      const batch = getBatchById(row.batchId);
      if (batch && qty > batch.quantity) return `Quantity for ${batch.batchNumber} exceeds available stock (${batch.quantity}).`;
    }
    return null;
  }

  async function handleTransfer() {
    setError(null);
    const e = validate();
    if (e) { setError(e); return; }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 1000));
    setSubmitting(false);
    setSuccess(true);
    setRows([{ batchId: "", qty: "" }]);
    setReason("");
  }

  if (success) return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-6 flex items-center justify-center min-h-64">
        <div className="bg-white rounded-2xl border border-[#DBEFF3] p-10 text-center max-w-sm w-full shadow-sm">
          <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <svg className="h-7 w-7 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <p className="text-base font-bold text-[#333333]">Transfer Recorded</p>
          <p className="text-sm text-[#666666] mt-1">The stock transfer has been recorded (mock).</p>
          <Button className="mt-6" onClick={() => setSuccess(false)}>New Transfer</Button>
        </div>
      </div>
    </div>
  );

  const availBatches = availableBatchesForLocation();

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader breadcrumb="Inventory / Transfers" title="Transfers" subtitle="Manage stock movements between pharmacy locations." />

      <div className="p-6 flex flex-col gap-6 max-w-3xl">
        <FormError message={error} />

        {/* Transfer details */}
        <div className="bg-[#DBEFF3] rounded-xl p-5 grid sm:grid-cols-3 gap-4">
          <Select label="From Location" value={from} onChange={(e) => setFrom(e.target.value)}>
            {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
          </Select>
          <Select label="To Location" value={to} onChange={(e) => setTo(e.target.value)}>
            {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
          </Select>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#333333]">Transfer Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-[#ABDBE3] bg-white px-3.5 py-2.5 text-sm focus:border-[#49B0C1] focus:outline-none" />
          </div>
        </div>

        {/* Products table */}
        <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
          <div className="px-4 py-3 border-b border-[#DBEFF3] flex items-center justify-between">
            <p className="text-sm font-bold text-[#333333]">Products to Transfer</p>
            <button onClick={addRow} className="text-xs font-semibold text-[#49B0C1] hover:underline">+ Add Row</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#DBEFF3]">
                  {["Batch", "Product", "Available", "Qty to Transfer", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-[#333333]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const batch = getBatchById(row.batchId);
                  return (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/30"}>
                      <td className="px-4 py-3">
                        <select value={row.batchId} onChange={(e) => updateRow(i, "batchId", e.target.value)} className="w-full rounded-lg border border-[#ABDBE3] bg-white px-2 py-1.5 text-xs focus:border-[#49B0C1] focus:outline-none">
                          <option value="">Select batch</option>
                          {availBatches.map((b) => <option key={b.id} value={b.id}>{b.batchNumber}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-[#666666] text-xs">{batch ? getProductName(batch.productId) : "—"}</td>
                      <td className="px-4 py-3 font-semibold text-[#333333]">{batch ? batch.quantity : "—"}</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min={1}
                          max={batch?.quantity}
                          value={row.qty}
                          onChange={(e) => updateRow(i, "qty", e.target.value)}
                          className="w-24 rounded-lg border border-[#ABDBE3] px-3 py-1.5 text-sm focus:border-[#49B0C1] focus:outline-none"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-4 py-3">
                        {rows.length > 1 && <button onClick={() => removeRow(i)} className="text-xs text-red-500 hover:underline">Remove</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Reason */}
        <div className="bg-[#DBEFF3] rounded-xl p-4">
          <label className="text-sm font-medium text-[#333333] block mb-2">Reason for Transfer</label>
          <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-lg border border-[#ABDBE3] bg-white px-3.5 py-2.5 text-sm resize-none focus:border-[#49B0C1] focus:outline-none" placeholder="Enter reason..." />
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => { setRows([{ batchId: "", qty: "" }]); setError(null); }}>Cancel</Button>
          <Button onClick={handleTransfer} loading={submitting}>Transfer</Button>
        </div>
      </div>
    </div>
  );
}
