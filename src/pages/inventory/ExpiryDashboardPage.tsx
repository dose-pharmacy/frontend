import { useEffect, useState } from "react";
import {
  getExpiryDashboard,
  createExpiryAction,
  ExpiryApiError,
  type ExpiryWindowDto,
  type ExpiryBatchDto,
} from "../../features/inventory/expiryApi";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";
import FormError from "../../components/ui/FormError";
import ExpiryActionHistory from "../../components/ui/ExpiryActionHistory";
import { IconWarningTriangle } from "../../components/ui/icons";

interface Thresholds { t30: number; t60: number; t90: number; }
type ExpiryAction = "return" | "clearance" | "dispose";

const DEFAULT_THRESHOLDS: Thresholds = { t30: 30, t60: 60, t90: 90 };

export default function ExpiryDashboardPage() {
  const [windows, setWindows] = useState<ExpiryWindowDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS);
  const [tempThresholds, setTempThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS);
  const [actionBatch, setActionBatch] = useState<ExpiryBatchDto | null>(null);
  const [actionType, setActionType] = useState<ExpiryAction>("return");
  const [actionForm, setActionForm] = useState({ supplier: "", returnQty: "", discount: "", notes: "", reason: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionRefreshKey, setActionRefreshKey] = useState(0);

  // Load the dashboard; re-runs whenever applied thresholds change (incl. first mount).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getExpiryDashboard({ thresholds: [thresholds.t30, thresholds.t60, thresholds.t90] })
      .then((result) => {
        if (cancelled) return;
        setWindows(result.windows);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ExpiryApiError ? err.message : "Failed to load expiry data. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [thresholds.t30, thresholds.t60, thresholds.t90]);

  function applyThresholds() { setThresholds({ ...tempThresholds }); }

  /** Batches whose days-remaining falls in [daysFrom, daysTo], from every window. */
  function windowBatches(daysFrom: number, daysTo: number): ExpiryBatchDto[] {
    return windows
      .flatMap((w) => w.batches)
      .filter((b) => b.daysRemaining >= daysFrom && b.daysRemaining <= daysTo);
  }

  function openAction(b: ExpiryBatchDto) {
    setActionBatch(b);
    setActionForm({ supplier: "", returnQty: "", discount: "", notes: "", reason: "" });
    setFormError(null);
    setActionType("return");
  }

  async function handleConfirmAction() {
    if (!actionBatch) return;
    setFormError(null);
    const qty = Number(actionForm.returnQty);
    if (actionType === "return" && (!actionForm.supplier || !actionForm.returnQty)) { setFormError("Supplier and return quantity are required."); return; }
    if (actionType === "clearance" && !actionForm.discount) { setFormError("Discount percentage is required."); return; }
    if (actionType === "dispose" && !actionForm.reason) { setFormError("Reason is required."); return; }

    setSubmitting(true);
    try {
      if (actionType === "return") {
        await createExpiryAction(actionBatch.id, {
          actionType: "RETURN_TO_SUPPLIER",
          quantity: qty,
          locationId: actionBatch.stock.location.id,
          discountPercent: 0,
          reason: `Return to supplier: ${actionForm.supplier}`,
          ...(actionForm.notes.trim() ? { notes: actionForm.notes.trim() } : {}),
        });
      } else if (actionType === "clearance") {
        // No dedicated clearance endpoint — sent as a discounted supplier
        // return, matching the API's supplierId/discountPercent schema.
        await createExpiryAction(actionBatch.id, {
          actionType: "RETURN_TO_SUPPLIER",
          quantity: actionBatch.stock.quantity,
          locationId: actionBatch.stock.location.id,
          discountPercent: Number(actionForm.discount) || 0,
          reason: "Clearance sale",
          ...(actionForm.notes.trim() ? { notes: actionForm.notes.trim() } : {}),
        });
      } else {
        await createExpiryAction(actionBatch.id, {
          actionType: "DISPOSE",
          quantity: actionBatch.stock.quantity,
          locationId: actionBatch.stock.location.id,
          reason: actionForm.reason,
          ...(actionForm.notes.trim() ? { notes: actionForm.notes.trim() } : {}),
        });
      }
      setActionBatch(null);
      setActionRefreshKey((k) => k + 1);
      // Re-fetch so the window counts/quantities reflect the action.
      getExpiryDashboard({ thresholds: [thresholds.t30, thresholds.t60, thresholds.t90] })
        .then((result) => setWindows(result.windows))
        .catch(() => undefined);
    } catch (err: unknown) {
      setFormError(err instanceof ExpiryApiError ? err.message : "Failed to perform the expiry action. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        title="Expiry Monitor"
        subtitle="Monitor and manage products approaching expiry"
        actions={<Button variant="secondary" onClick={() => alert("Export report — backend pending")}>Export Expiry Report</Button>}
      />

      <div className="flex-1 overflow-y-auto p-6 pb-12 flex flex-col gap-6">
        {/* Threshold configuration */}
        <div className="bg-[#E6ECE2] rounded-xl p-5">
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
                  className="w-24 rounded-lg border border-[#C6D4BF] bg-white px-3 py-2 text-sm focus:border-[#B6C8AF] focus:outline-none"
                />
              </div>
            ))}
            <Button onClick={applyThresholds}>Apply</Button>
          </div>
        </div>

        {error && <FormError message={error} />}

        {loading ? (
          <div className="p-6 animate-pulse space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-[#E6ECE2] rounded-xl" />)}</div>
        ) : !error ? (
          <>
            {/* Within 30 days */}
            <ExpirySection
              title={`EXPIRING SOON — Within ${thresholds.t30} Days`}
              batches={windowBatches(0, thresholds.t30)}
              urgency="high"
              onAction={openAction}
            />
            {/* 31–60 days */}
            <ExpirySection
              title={`EXPIRING SOON — ${thresholds.t30 + 1}–${thresholds.t60} Days`}
              batches={windowBatches(thresholds.t30 + 1, thresholds.t60)}
              urgency="medium"
              onAction={openAction}
            />
            {/* 61–90 days */}
            <ExpirySection
              title={`EXPIRING SOON — ${thresholds.t60 + 1}–${thresholds.t90} Days`}
              batches={windowBatches(thresholds.t60 + 1, thresholds.t90)}
              urgency="low"
              onAction={openAction}
            />
            {/* Already expired */}
            <ExpirySection
              title="EXPIRED"
              batches={windowBatches(-Infinity, -1)}
              urgency="expired"
              onAction={openAction}
            />
          </>
        ) : null}
      </div>

      {/* Action dialog */}
      <Modal open={!!actionBatch} title="Expiry Action" onClose={() => setActionBatch(null)} size="md">
        {actionBatch && (
          <div className="flex flex-col gap-5">
            {/* Batch summary */}
            <div className="rounded-xl bg-[#E6ECE2] p-4 grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-[#666666]">Product: </span><span className="font-semibold text-[#333333]">{actionBatch.product.name}</span></div>
              <div><span className="text-[#666666]">Batch: </span><span className="font-mono font-semibold text-[#333333]">{actionBatch.batchNumber}</span></div>
              <div><span className="text-[#666666]">Qty: </span><span className="font-semibold text-[#333333]">{actionBatch.stock.quantity}</span></div>
              <div><span className="text-[#666666]">Expires: </span><span className="font-semibold text-orange-600">{actionBatch.expiryDate.slice(0, 10)}</span></div>
              <div className="col-span-2"><span className="text-[#666666]">Days remaining: </span>
                <span className="font-bold text-orange-600">{actionBatch.daysRemaining}</span>
              </div>
            </div>

            <FormError message={formError} />

            <ExpiryActionHistory batchId={actionBatch.id} refreshKey={actionRefreshKey} />

            {/* Action selector */}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-[#333333]">Select Action</p>
              {(["return", "clearance", "dispose"] as ExpiryAction[]).map((a) => (
                <label key={a} className="flex items-center gap-3 cursor-pointer rounded-lg border border-[#C6D4BF] px-4 py-3 hover:bg-[#E6ECE2]/50 transition-colors">
                  <input type="radio" name="action" value={a} checked={actionType === a} onChange={() => setActionType(a)} className="accent-[#B6C8AF]" />
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
                <Input label="Return Quantity" type="number" min={1} max={actionBatch.stock.quantity} value={actionForm.returnQty} onChange={(e) => setActionForm((f) => ({ ...f, returnQty: e.target.value }))} />
              </div>
            )}
            {actionType === "clearance" && (
              <div className="flex flex-col gap-3">
                <Input label="Discount (%)" type="number" min={1} max={100} value={actionForm.discount} onChange={(e) => setActionForm((f) => ({ ...f, discount: e.target.value }))} />
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[#333333]">Notes</label>
                  <textarea rows={2} value={actionForm.notes} onChange={(e) => setActionForm((f) => ({ ...f, notes: e.target.value }))} className="w-full rounded-lg border border-[#C6D4BF] px-3.5 py-2.5 text-sm resize-none focus:border-[#B6C8AF] focus:outline-none" />
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

function ExpirySection({ title, batches, urgency, onAction }: {
  title: string; batches: ExpiryBatchDto[]; urgency: "high" | "medium" | "low" | "expired"; onAction: (b: ExpiryBatchDto) => void;
}) {
  const headerBg = urgency === "high" ? "bg-red-600" : urgency === "medium" ? "bg-yellow-600" : urgency === "expired" ? "bg-gray-600" : "bg-[#4F6B4A]";
  return (
    <section>
      <div className={`${headerBg} px-4 py-2 rounded-t-xl`}>
        <p className="text-sm font-bold text-white">{title}</p>
        <p className="text-xs text-white/80 mt-0.5">{batches.length} batch{batches.length !== 1 ? "es" : ""}</p>
      </div>
      <div className="bg-white rounded-b-xl border border-t-0 border-[#E6ECE2] overflow-hidden">
        {batches.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-[#666666]">No batches in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#E6ECE2]">
                  {["Product", "Batch", "Quantity", "Days Left", "Actions"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-[#333333]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batches.map((b, i) => {
                  const days = b.daysRemaining;
                  const key = `${b.id}-${i}`;
                  return (
                    <tr key={key} className={i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/30"}>
                      <td className="px-4 py-3 text-[#333333]">{b.product.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[#666666]">{b.batchNumber}</td>
                      <td className="px-4 py-3 font-semibold">{b.stock.quantity}</td>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${urgency === "high" ? "text-red-600" : urgency === "medium" ? "text-yellow-600" : urgency === "expired" ? "text-red-700" : "text-[#7A9076]"}`}>
                          {days} days
                        </span>
                        {urgency === "high" && <span className="ml-1.5 text-red-400" role="img" aria-label="Urgent"><IconWarningTriangle className="h-4 w-4 inline-block align-middle" /></span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => { onAction(b); }} className="text-xs font-semibold text-[#7A9076] hover:underline">Return</button>
                          <button onClick={() => { onAction(b); }} className="text-xs font-semibold text-orange-500 hover:underline">Clearance</button>
                          {urgency === "expired" && (
                            <button onClick={() => { onAction(b); }} className="text-xs font-semibold text-red-500 hover:underline">Dispose</button>
                          )}
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
