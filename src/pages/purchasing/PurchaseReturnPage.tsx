import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import PageHeader from "../../components/ui/PageHeader";
import {
  createPurchaseReturn,
  listPurchaseReturns,
  type PurchaseReturnDto,
  type PurchaseReturnReason,
  PurchaseReturnsApiError,
} from "../../features/purchasing/purchaseReturnsApi";
import { listSuppliers, type SupplierDto } from "../../features/purchasing/suppliersApi";
import { listProducts, type ProductDto } from "../../features/inventory/productsApi";
import { listBatches, type BatchDto } from "../../features/inventory/batchesApi";
import { listLocations, type LocationDto } from "../../features/inventory/locationsApi";

const REASON_LABELS: Record<PurchaseReturnReason, string> = {
  EXPIRED: "Expired",
  DAMAGED: "Damaged",
  INCORRECT_DELIVERY: "Incorrect Delivery",
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtMoney(n: number | null | undefined) {
  return `${Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
}

export default function PurchaseReturnPage() {
  const navigate = useNavigate();

  // Form state
  const [supplierId, setSupplierId] = useState("");
  const [productId, setProductId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [reason, setReason] = useState<PurchaseReturnReason>("EXPIRED");
  const [quantity, setQuantity] = useState(1);
  const [unitCost, setUnitCost] = useState(0);
  const [debitNoteAmount, setDebitNoteAmount] = useState("");
  const [notes, setNotes] = useState("");

  // Reference data
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [batches, setBatches] = useState<BatchDto[]>([]);
  const [locations, setLocations] = useState<LocationDto[]>([]);

  // History
  const [returns, setReturns] = useState<PurchaseReturnDto[]>([]);
  const [returnsLoading, setReturnsLoading] = useState(true);

  // UI
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    listSuppliers({ limit: 100, isActive: true }).then((r) => setSuppliers(r.data)).catch(() => {});
    listProducts({ limit: 200, isActive: true }).then((r) => setProducts(r.data)).catch(() => {});
    listLocations({ limit: 100, isActive: true }).then((r) => setLocations(r.data)).catch(() => {});
    loadReturns();
  }, []);

  async function loadReturns() {
    setReturnsLoading(true);
    try {
      const r = await listPurchaseReturns({ limit: 50 });
      setReturns(r.data);
    } catch {
      // silent
    } finally {
      setReturnsLoading(false);
    }
  }

  async function handleProductChange(newProductId: string) {
    setProductId(newProductId);
    setBatchId("");
    setBatches([]);
    // Set default unit cost to 0 since ProductDto doesn't have units
    setUnitCost(0);
    if (!newProductId) return;
    try {
      const result = await listBatches({ productId: newProductId, limit: 50 });
      setBatches(result.data);
    } catch {
      // silent
    }
  }

  // Get available stock for a batch at a location (simplified - shows total batch stock)
  function getAvailableStock(batchId: string): number {
    const batch = batches.find((b) => b.id === batchId);
    return batch?.totalQuantity ?? 0;
  }

  async function handleSubmit() {
    if (!supplierId || !productId || !locationId) {
      setError("Supplier, Product, and Location are required.");
      return;
    }
    if (quantity <= 0 || unitCost <= 0) {
      setError("Quantity and Unit Cost must be greater than zero.");
      return;
    }
    if (batchId) {
      const available = getAvailableStock(batchId);
      if (quantity > available) {
        setError(`Insufficient stock. Available: ${available}, Requested: ${quantity}`);
        return;
      }
    }
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await createPurchaseReturn({
        supplierId,
        productId,
        batchId: batchId || undefined,
        locationId,
        reason,
        quantity: Number(quantity),
        unitCost: Number(unitCost),
        debitNoteAmount: debitNoteAmount ? Number(debitNoteAmount) : undefined,
        notes: notes || undefined,
      });
      setSuccess("Purchase return recorded successfully.");
      // Reset form
      setSupplierId("");
      setProductId("");
      setBatchId("");
      setLocationId("");
      setReason("EXPIRED");
      setQuantity(1);
      setUnitCost(0);
      setDebitNoteAmount("");
      setNotes("");
      setShowForm(false);
      void loadReturns();
    } catch (e) {
      setError(e instanceof PurchaseReturnsApiError ? e.message : "Failed to create purchase return.");
      setSaving(false);
    } finally {
      setSaving(false);
    }
  }

  const selectedProduct = products.find((p) => p.id === productId);
  const selectedBatch = batches.find((b) => b.id === batchId);
  const estimatedValue = Number(quantity) * Number(unitCost);

  const inputClass = "w-full rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none";

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <PageHeader
        title="Purchase Returns"
        subtitle="Purchasing → Returns"
        actions={
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-white/20 border border-white/40 px-4 py-2 text-sm font-semibold text-white hover:bg-white/30 transition-colors"
          >
            + New Return
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto pb-8">
        {success && (
          <div className="mx-4 sm:mx-6 mt-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm border border-green-200">
            {success}
          </div>
        )}

        {/* New Return Form */}
        {showForm && (
          <div className="px-4 sm:px-6 py-4">
            <div className="bg-white rounded-xl border border-[#DBEFF3] p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-[#333333]">New Purchase Return</h2>
                <button onClick={() => setShowForm(false)} className="text-sm text-gray-400 hover:text-gray-600">✕ Cancel</button>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">{error}</div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[#666666] mb-1">Supplier *</label>
                  <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputClass}>
                    <option value="">— Select Supplier —</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-[#666666] mb-1">Product *</label>
                  <select value={productId} onChange={(e) => handleProductChange(e.target.value)} className={inputClass}>
                    <option value="">— Select Product —</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-[#666666] mb-1">Batch</label>
                  <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className={inputClass} disabled={batches.length === 0}>
                    <option value="">— No specific batch —</option>
                    {batches.map((b) => {
                      const available = getAvailableStock(b.id);
                      return (
                        <option key={b.id} value={b.id}>
                          {b.batchNumber} · Exp: {fmtDate(b.expiryDate)} · Stock: {available}
                        </option>
                      );
                    })}
                  </select>
                  {batchId && (
                    <p className="mt-1 text-xs text-[#666666]">
                      Available at location: {getAvailableStock(batchId)}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-[#666666] mb-1">Location *</label>
                  <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={inputClass}>
                    <option value="">— Select Location —</option>
                    {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-[#666666] mb-1">Return Reason *</label>
                  <select value={reason} onChange={(e) => setReason(e.target.value as PurchaseReturnReason)} className={inputClass}>
                    {Object.entries(REASON_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-[#666666] mb-1">Quantity *</label>
                  <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm text-[#666666] mb-1">Unit Cost *</label>
                  <input type="number" min={0.01} step="0.01" value={unitCost} onChange={(e) => setUnitCost(Number(e.target.value))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm text-[#666666] mb-1">Debit Note Amount</label>
                  <input type="number" min={0} step="0.01" value={debitNoteAmount} onChange={(e) => setDebitNoteAmount(e.target.value)} placeholder="Optional" className={inputClass} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm text-[#666666] mb-1">Notes</label>
                  <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes..." className={`${inputClass} resize-none`} />
                </div>
              </div>

              {productId && quantity > 0 && unitCost > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-[#DBEFF3] text-sm text-[#333333]">
                  <strong>Summary:</strong> Return {quantity} × {selectedProduct?.name ?? "?"} — Total Value: <strong>{fmtMoney(estimatedValue)}</strong>
                  {selectedBatch && ` · Batch: ${selectedBatch.batchNumber}`}
                </div>
              )}

              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-[#DBEFF3]">
                <button onClick={() => setShowForm(false)} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="rounded-lg bg-[#49B0C1] px-5 py-2 text-sm font-bold text-white hover:bg-[#3a9baf] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? "Recording…" : "Record Return"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Returns history */}
        <div className="px-4 sm:px-6 py-4">
          <div className="bg-white rounded-xl border border-[#DBEFF3] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#DBEFF3] flex items-center justify-between">
              <h3 className="font-bold text-[#333333]">Return History</h3>
              <span className="text-sm text-[#666666]">{returns.length} records</span>
            </div>
            {returnsLoading ? (
              <div className="py-8 text-center text-[#666666] text-sm">Loading…</div>
            ) : returns.length === 0 ? (
              <div className="py-8 text-center text-[#666666] text-sm">
                No purchase returns recorded yet.
                <button onClick={() => setShowForm(true)} className="ml-2 text-[#49B0C1] hover:underline">+ Record a return</button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="bg-[#DBEFF3]/50">
                      {["Return #", "Supplier", "Product", "Reason", "Qty", "Unit Cost", "Total Value", "Date"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left font-semibold text-[#333333] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {returns.map((ret, i) => (
                      <tr key={ret.id} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/20"}>
                        <td className="px-4 py-3 font-mono text-xs text-[#666666]">{ret.returnNumber}</td>
                        <td className="px-4 py-3 text-[#333333]">{ret.supplier?.name ?? "—"}</td>
                        <td className="px-4 py-3 font-medium text-[#333333]">{ret.product?.name ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-orange-100 text-orange-700">
                            {REASON_LABELS[ret.reason] ?? ret.reason}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-[#333333]">{ret.quantity}</td>
                        <td className="px-4 py-3 text-right text-[#333333]">{fmtMoney(ret.unitCost)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-[#333333]">{fmtMoney(ret.totalValue)}</td>
                        <td className="px-4 py-3 text-[#666666]">{fmtDate(ret.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
