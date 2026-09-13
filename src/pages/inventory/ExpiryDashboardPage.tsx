import { useEffect, useState } from "react";
import { getBatches, getProducts, daysUntilExpiry } from "../../features/inventory/inventoryService";
import type { Batch, Product } from "../../features/inventory/inventoryMock";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";
import FormError from "../../components/ui/FormError";

interface Thresholds { t30: number; t60: number; t90: number; }
type ExpiryAction = "return" | "clearance" | "dispose";

export default function ExpiryDashboardPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [thresholds, setThresholds] = useState<Thresholds>({ t30: 30, t60: 60, t90: 90 });
  const [tempThresholds, setTempThresholds] = useState<Thresholds>({ t30: 30, t60: 60, t90: 90 });
  const [actionBatch, setActionBatch] = useState<Batch | null>(null);
  const [actionType, setActionType] = useState<ExpiryAction>("return");
  const [actionForm, setActionForm] = useState({ supplier: "", returnQty: "", discount: "", notes: "", reason: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([getBatches(), getProducts()]).then(([b, p]) => {
      setBatches(b.filter((x) => x.status !== "depleted")); setProducts(p); setLoading(false);
    });
  }, []);

  function productName(id: string) { return products.find((p) => p.id === id)?.name ?? id; }

  function applyThresholds() { setThresholds({ ...tempThresholds }); }

  const expiring30 = batches.filter((b) => { const d = daysUntilExpiry(b.expiryDate); return d >= 0 && d <= thresholds.t30; });
  const expiring60 = batches.filter((b) => { const d = daysUntilExpiry(b.expiryDate); return d > thresholds.t30 && d <= thresholds.t60; });
  const expiring90 = batches.filter((b) => { const d = daysUntilExpiry(b.expiryDate); return d > thresholds.t60 && d <= thresholds.t90; });

  function openAction(b: Batch) { setActionBatch(b); setActionForm({ supplier: "", returnQty: "", discount: "", notes: "", reason: "" }); setFormError(null); setActionType("return"); }

  async function handleConfirmAction() {
    setFormError(null);
    if (actionType === "return" && (!actionForm.supplier || !actionForm.returnQty)) { setFormError("Supplier and return quantity are required."); return; }
    if (actionType === "clearance" && !actionForm.discount) { setFormError("Discount percentage is required."); return; }
    if (actionType === "dispose" && !actionForm.reason) { setFormError("Reason is required."); return; }
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 900));
    setSubmitting(false);
    setActionBatch(null);
    alert(`Action confirmed (mock): ${actionType} for ${actionBatch?.batchNumber}`);
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        title="Expiry Monitor"
        subtitle="Monitor and manage products approaching expiry"
        actions={<Button variant="secondary" onClick={() => alert("Export report — backend pending")}>Export Expiry Report</Button>}
      />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        {/* Threshold configuration */}
        <div className="bg-[#DBEFF3] rounded-xl p-5">
          <p className="text-sm font-bold text-[#333333] mb-3">Threshold Settings (days)</p>
          <div className="flex flex-wrap gap-4 items-end">
            {[
              { label: "30-day threshold", key: "t30" as const },
              { label: "60-day threshold", key: "t60" as const },
              { label: "90-day threshold", key: "t90" as const },
            ].map(({ label, key }) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-xs font-medium text-[#666666]">{label}</label>
                <input
                  type="number"
                  min={1}
                  value={tempThresholds[key]}
                  onChange={(e) => setTempThresholds((t) => ({ ...t, [key]: Number(e.target.value) }))}
                  className="w-24 rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none"
                />
              </div>
            ))}
            <Button onClick={applyThresholds}>Apply</Button>
          </div>
        </div>

        {loading ? (
          <div className="p-6 animate-pulse space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-[#DBEFF3] rounded-xl" />)}</div>
        ) : (
          <>
            {/* Within 30 days */}
            <ExpirySection
              title={`EXPIRING SOON — Within ${thresholds.t30} Days`}
              batches={expiring30}
              products={products}
              productName={productName}
              urgency="high"
              onAction={openAction}
            />
            {/* 31–60 days */}
            <ExpirySection
              title={`EXPIRING SOON — ${thresholds.t30 + 1}–${thresholds.t60} Days`}
              batches={expiring60}
              products={products}
              productName={productName}
              urgency="medium"
              onAction={openAction}
            />
            {/* 61–90 days */}
            <ExpirySection
              title={`EXPIRING SOON — ${thresholds.t60 + 1}–${thresholds.t90} Days`}
              batches={expiring90}
              products={products}
              productName={productName}
              urgency="low"
              onAction={openAction}
            />
          </>
        )}
      </div>

      {/* Action dialog */}
      <Modal open={!!actionBatch} title="Expiry Action" onClose={() => setActionBatch(null)} size="md">
        {actionBatch && (
          <div className="flex flex-col gap-5">
            {/* Batch summary */}
            <div className="rounded-xl bg-[#DBEFF3] p-4 grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-[#666666]">Product: </span><span className="font-semibold text-[#333333]">{productName(actionBatch.productId)}</span></div>
              <div><span className="text-[#666666]">Batch: </span><span className="font-mono font-semibold text-[#333333]">{actionBatch.batchNumber}</span></div>
              <div><span className="text-[#666666]">Qty: </span><span className="font-semibold text-[#333333]">{actionBatch.quantity}</span></div>
              <div><span className="text-[#666666]">Expires: </span><span className="font-semibold text-orange-600">{actionBatch.expiryDate}</span></div>
              <div className="col-span-2"><span className="text-[#666666]">Days remaining: </span>
                <span className="font-bold text-orange-600">{daysUntilExpiry(actionBatch.expiryDate)}</span>
              </div>
            </div>

            <FormError message={formError} />

            {/* Action selector */}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-[#333333]">Select Action</p>
              {(["return", "clearance", "dispose"] as ExpiryAction[]).map((a) => (
                <label key={a} className="flex items-center gap-3 cursor-pointer rounded-lg border border-[#ABDBE3] px-4 py-3 hover:bg-[#DBEFF3]/50 transition-colors">
                  <input type="radio" name="action" value={a} checked={actionType === a} onChange={() => setActionType(a)} className="accent-[#49B0C1]" />
                  <span className="text-sm font-medium capitalize text-[#333333]">
                    {a === "return" ? "Return to Supplier" : a === "clearance" ? "Clearance Sale" : "Dispose"}
                  </span>
                </label>
              ))}
            </div>

            {/* Action-specific fields */}
            {actionType === "return" && (
              <div className="flex flex-col gap-3">
                <Input label="Supplier" placeholder="Supplier name" value={actionForm.supplier} onChange={(e) => setActionForm((f) => ({ ...f, supplier: e.target.value }))} />
                <Input label="Return Quantity" type="number" min={1} max={actionBatch.quantity} value={actionForm.returnQty} onChange={(e) => setActionForm((f) => ({ ...f, returnQty: e.target.value }))} />
              </div>
            )}
            {actionType === "clearance" && (
              <div className="flex flex-col gap-3">
                <Input label="Discount (%)" type="number" min={1} max={100} value={actionForm.discount} onChange={(e) => setActionForm((f) => ({ ...f, discount: e.target.value }))} />
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[#333333]">Notes</label>
                  <textarea rows={2} value={actionForm.notes} onChange={(e) => setActionForm((f) => ({ ...f, notes: e.target.value }))} className="w-full rounded-lg border border-[#ABDBE3] px-3.5 py-2.5 text-sm resize-none focus:border-[#49B0C1] focus:outline-none" />
                </div>
              </div>
            )}
            {actionType === "dispose" && (
              <Input label="Reason for Disposal" value={actionForm.reason} onChange={(e) => setActionForm((f) => ({ ...f, reason: e.target.value }))} />
            )}

            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setActionBatch(null)}>Cancel</Button>
              <Button onClick={handleConfirmAction} loading={submitting}>Confirm Action</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function ExpirySection({ title, batches, productName, urgency, onAction }: {
  title: string; batches: Batch[]; products: Product[]; productName: (id: string) => string; urgency: "high" | "medium" | "low"; onAction: (b: Batch) => void;
}) {
  const headerBg = urgency === "high" ? "bg-red-500" : urgency === "medium" ? "bg-yellow-500" : "bg-[#49B0C1]";
  return (
    <section>
      <div className={`${headerBg} px-4 py-2 rounded-t-xl`}>
        <p className="text-sm font-bold text-white">{title}</p>
        <p className="text-xs text-white/80 mt-0.5">{batches.length} batch{batches.length !== 1 ? "es" : ""}</p>
      </div>
      <div className="bg-white rounded-b-xl border border-t-0 border-[#DBEFF3] overflow-hidden">
        {batches.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-[#666666]">No batches in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#DBEFF3]">
                  {["Product", "Batch", "Quantity", "Days Left", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-[#333333]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batches.map((b, i) => {
                  const days = daysUntilExpiry(b.expiryDate);
                  return (
                    <tr key={b.id} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/30"}>
                      <td className="px-4 py-3 text-[#333333]">{productName(b.productId)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[#666666]">{b.batchNumber}</td>
                      <td className="px-4 py-3 font-semibold">{b.quantity}</td>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${urgency === "high" ? "text-red-600" : urgency === "medium" ? "text-yellow-600" : "text-[#49B0C1]"}`}>
                          {days} days
                        </span>
                        {urgency === "high" && <span className="ml-2 text-xs text-red-400" aria-label="Urgent">⚠</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => { onAction(b); }} className="text-xs font-semibold text-[#49B0C1] hover:underline">Return</button>
                          <button onClick={() => { onAction(b); }} className="text-xs font-semibold text-orange-500 hover:underline">Clearance</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
