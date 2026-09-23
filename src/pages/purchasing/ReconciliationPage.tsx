import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import PageHeader from "../../components/ui/PageHeader";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import DatePicker from "../../components/ui/DatePicker";
import { IconCheck } from "../../components/ui/icons";
import {
  getGoodsReceipt,
  resolveGoodsReceipt,
  confirmGoodsReceipt,
  deleteGoodsReceipt,
  type GoodsReceiptDto,
  type GRItemDto,
  GoodsReceiptsApiError,
} from "../../features/purchasing/goodsReceiptsApi";

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

interface ResolveItemState {
  id: string;
  deliveredQty: number;
  actualQty: number;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
}

const STATUS_BADGE: Record<string, string> = {
  MATCHED: "bg-green-100 text-green-700",
  DISCREPANCY: "bg-yellow-100 text-yellow-700",
  RESOLVED: "bg-blue-100 text-blue-700",
};

export default function ReconciliationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [receipt, setReceipt] = useState<GoodsReceiptDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resolveNote, setResolveNote] = useState("");
  const [resolveItems, setResolveItems] = useState<ResolveItemState[]>([]);
  const [resolving, setResolving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [actionError, setActionError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function fetchReceipt() {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const r = await getGoodsReceipt(id);
      setReceipt(r);
      if (r.status === "DISCREPANCY") {
        setResolveItems(
          r.items.map((item) => ({
            id: item.id,
            deliveredQty: item.deliveredQty,
            actualQty: item.actualQty,
            batchNumber: item.batchNumber ?? "",
            manufacturingDate: item.manufacturingDate ? item.manufacturingDate.split("T")[0] : "",
            expiryDate: item.expiryDate ? item.expiryDate.split("T")[0] : "",
          }))
        );
      }
    } catch (e) {
      setError("Failed to load goods receipt.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchReceipt();
  }, [id]);

  function updateResolveItem(itemId: string, field: keyof ResolveItemState, value: string | number) {
    setResolveItems((prev) => prev.map((r) => r.id === itemId ? { ...r, [field]: value } : r));
  }

  async function handleResolve() {
    setActionError("");
    setResolving(true);
    try {
      const updated = await resolveGoodsReceipt(id!, {
        discrepancyNote: resolveNote || undefined,
        items: resolveItems.map((item) => ({
          id: item.id,
          deliveredQty: Number(item.deliveredQty),
          actualQty: Number(item.actualQty),
          batchNumber: item.batchNumber || null,
          manufacturingDate: item.manufacturingDate ? new Date(item.manufacturingDate).toISOString() : null,
          expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString() : null,
        })),
      });
      setReceipt(updated);
      setSuccessMsg("Discrepancy resolved successfully.");
    } catch (e) {
      setActionError(e instanceof GoodsReceiptsApiError ? e.message : "Failed to resolve discrepancy.");
    } finally {
      setResolving(false);
    }
  }

  async function handleConfirm() {
    setActionError("");
    setConfirming(true);
    try {
      await confirmGoodsReceipt(id!);
      setSuccessMsg("Receipt confirmed! Stock has been updated.");
      setTimeout(() => navigate("/purchasing/orders"), 1500);
    } catch (e) {
      setActionError(e instanceof GoodsReceiptsApiError ? e.message : "Failed to confirm receipt.");
      setConfirming(false);
    }
  }

  async function handleDelete() {
    if (!id) return;
    setDeleting(true);
    try {
      await deleteGoodsReceipt(id);
      setSuccessMsg("Goods receipt deleted successfully.");
      setTimeout(() => navigate("/purchasing/deliveries"), 1500);
    } catch (e) {
      setActionError(e instanceof GoodsReceiptsApiError ? e.message : "Failed to delete goods receipt.");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-0 flex-1">
        <PageHeader title="Goods Receipt" subtitle="Purchasing → Goods Receipts → Detail" />
        <div className="flex-1 flex items-center justify-center text-[#666666]">Loading receipt…</div>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="flex flex-col min-h-0 flex-1">
        <PageHeader title="Goods Receipt" subtitle="Purchasing → Goods Receipts → Detail" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-500 mb-3">{error || "Receipt not found."}</p>
            <button onClick={fetchReceipt} className="text-[#7A9076] hover:underline text-sm">Retry</button>
          </div>
        </div>
      </div>
    );
  }

  const canConfirm = receipt.status === "MATCHED" || receipt.status === "RESOLVED";

  const totalOrdered = receipt.items.reduce((s, i) => s + i.expectedQty, 0);
  const totalDelivered = receipt.items.reduce((s, i) => s + i.deliveredQty, 0);
  const totalActual = receipt.items.reduce((s, i) => s + i.actualQty, 0);

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <PageHeader
        title="Goods Receipt"
        subtitle={`Purchasing → Goods Receipts · ${receipt.receiptNumber}`}
        actions={
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${STATUS_BADGE[receipt.status] ?? "bg-gray-100 text-gray-600"}`}>
              {receipt.status}
            </span>
            {receipt.confirmedAt === null && (
              <button onClick={() => setDeleteOpen(true)} className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 transition-colors">
                Delete Receipt
              </button>
            )}
            {canConfirm && (
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="rounded-lg bg-green-500 border border-green-300 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {confirming ? "Confirming…" : <span className="inline-flex items-center gap-2"><IconCheck className="h-4 w-4" />Confirm Receipt</span>}
              </button>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto pb-24">
        {successMsg && (
          <div className="mx-4 sm:mx-6 mt-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm border border-green-200">
            {successMsg}
          </div>
        )}
        {actionError && (
          <div className="mx-4 sm:mx-6 mt-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
            {actionError}
          </div>
        )}

        {/* Summary cards */}
        <div className="px-4 sm:px-6 py-4 bg-[#E6ECE2]">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 text-center border border-[#C6D4BF]/30">
              <p className="text-xs text-[#666666]">PO Number</p>
              <p className="text-lg font-bold text-[#333333] mt-1">{receipt.purchaseOrder?.poNumber ?? "—"}</p>
            </div>
            <div className="bg-white rounded-xl p-4 text-center border border-[#C6D4BF]/30">
              <p className="text-xs text-[#666666]">Expected Qty</p>
              <p className="text-lg font-bold text-[#333333] mt-1">{totalOrdered}</p>
            </div>
            <div className="bg-white rounded-xl p-4 text-center border border-[#C6D4BF]/30">
              <p className="text-xs text-[#666666]">Delivered Qty</p>
              <p className={`text-lg font-bold mt-1 ${totalDelivered < totalOrdered ? "text-yellow-500" : "text-[#333333]"}`}>
                {totalDelivered}
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 text-center border border-[#C6D4BF]/30">
              <p className="text-xs text-[#666666]">Actual Qty</p>
              <p className="text-lg font-bold text-green-600 mt-1">{totalActual}</p>
            </div>
          </div>
        </div>

        {/* Receipt info */}
        <div className="px-4 sm:px-6 py-4">
          <div className="bg-white rounded-xl border border-[#E6ECE2] p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-[#666666]">Supplier</p>
              <p className="font-medium text-[#333333]">{receipt.purchaseOrder?.supplier?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-[#666666]">Received Date</p>
              <p className="font-medium text-[#333333]">{fmtDate(receipt.receivedDate)}</p>
            </div>
            <div>
              <p className="text-xs text-[#666666]">Created By</p>
              <p className="font-medium text-[#333333]">{receipt.createdBy?.name ?? "—"}</p>
            </div>
            {receipt.discrepancyNote && (
              <div className="col-span-2 sm:col-span-4">
                <p className="text-xs text-[#666666]">Discrepancy Note</p>
                <p className="font-medium text-yellow-700">{receipt.discrepancyNote}</p>
              </div>
            )}
          </div>
        </div>

        {/* Items table */}
        <div className="px-4 sm:px-6">
          <div className="rounded-xl border border-[#E6ECE2] overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-[#C6D4BF]">
                  {["#", "Product", "Expected", "Delivered", "Actual", "Variance", "Batch", "Expiry", "Location"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold text-[#333333] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((item, i) => {
                  const variance = item.actualQty - item.expectedQty;
                  const isMatch = variance === 0;
                  return (
                    <tr key={item.id} className={i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/20"}>
                      <td className="px-3 py-2.5 text-[#666666]">{i + 1}</td>
                      <td className="px-3 py-2.5 font-medium text-[#333333]">
                        {item.purchaseOrderItem?.product?.name ?? `Product (${item.purchaseOrderItem?.productId?.slice(0, 8) ?? "?"})`}
                      </td>
                      <td className="px-3 py-2.5 text-[#333333]">{item.expectedQty}</td>
                      <td className="px-3 py-2.5 text-[#333333]">{item.deliveredQty}</td>
                      <td className="px-3 py-2.5 text-[#333333]">{item.actualQty}</td>
                      <td className={`px-3 py-2.5 font-semibold ${isMatch ? "text-green-600" : "text-red-500"}`}>
                        {isMatch ? <span className="inline-flex items-center gap-1"><IconCheck className="h-3.5 w-3.5" />0</span> : `${variance > 0 ? "+" : ""}${variance}`}
                      </td>
                      <td className="px-3 py-2.5 text-[#333333]">{item.batchNumber ?? "—"}</td>
                      <td className="px-3 py-2.5 text-[#333333]">{fmtDate(item.expiryDate)}</td>
                      <td className="px-3 py-2.5 text-[#333333]">{item.location?.name ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Discrepancy resolution panel */}
        {receipt.status === "DISCREPANCY" && (
          <div className="px-4 sm:px-6 py-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <p className="font-bold text-yellow-800 mb-3">Resolve Discrepancy</p>
              <p className="text-sm text-yellow-700 mb-4">
                This receipt has a discrepancy. Review and adjust quantities below, then resolve before confirming.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[600px] mb-4">
                  <thead>
                    <tr className="bg-yellow-100">
                      {["Product", "Actual Qty", "Batch #", "Mfg Date", "Expiry Date"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-yellow-800">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {resolveItems.map((item, i) => {
                      const originalItem = receipt.items.find((ri) => ri.id === item.id);
                      return (
                        <tr key={item.id} className={i % 2 === 0 ? "bg-white" : "bg-yellow-50/50"}>
                          <td className="px-3 py-2 font-medium text-[#333333]">
                            {originalItem?.purchaseOrderItem?.product?.name ?? `Item ${i + 1}`}
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min={0} value={item.actualQty} onChange={(e) => updateResolveItem(item.id, "actualQty", Number(e.target.value))} className="w-16 rounded border border-yellow-300 px-2 py-1 text-sm" />
                          </td>
                          <td className="px-3 py-2">
                            <input value={item.batchNumber} onChange={(e) => updateResolveItem(item.id, "batchNumber", e.target.value)} placeholder="BATCH-001" className="w-24 rounded border border-yellow-300 px-2 py-1 text-xs" />
                          </td>
                          <td className="px-3 py-2">
                            <DatePicker
                              value={item.manufacturingDate}
                              onChange={(v) => updateResolveItem(item.id, "manufacturingDate", v)}
                              placeholder="Mfg date"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <DatePicker
                              value={item.expiryDate}
                              onChange={(v) => updateResolveItem(item.id, "expiryDate", v)}
                              placeholder="Expiry date"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mb-3">
                <label className="block text-sm text-yellow-800 mb-1">Resolution Note</label>
                <textarea rows={2} value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} placeholder="Explain how the discrepancy was resolved…" className="w-full rounded-lg border border-yellow-300 bg-white px-3 py-2 text-sm focus:outline-none resize-none" />
              </div>

              <button
                onClick={handleResolve}
                disabled={resolving}
                className="rounded-lg bg-yellow-500 px-5 py-2 text-sm font-semibold text-white hover:bg-yellow-600 transition-colors disabled:opacity-40"
              >
                {resolving ? "Resolving…" : "Mark as Resolved"}
              </button>
            </div>
          </div>
        )}

        {/* Confirm section */}
        {canConfirm && (
          <div className="px-4 sm:px-6 py-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="font-bold text-green-800 mb-1">Ready to Confirm</p>
              <p className="text-sm text-green-700 mb-3">
                Confirming will update inventory stock levels with the actual quantities received.
              </p>
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="rounded-lg bg-green-500 px-5 py-2 text-sm font-semibold text-white hover:bg-green-600 transition-colors disabled:opacity-40"
              >
                {confirming ? "Confirming…" : <span className="inline-flex items-center gap-2"><IconCheck className="h-4 w-4" />Confirm &amp; Update Stock</span>}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E6ECE2] px-4 sm:px-6 py-3 flex items-center justify-end gap-3 z-30">
        <button onClick={() => navigate("/purchasing/orders")} className="rounded-lg bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors">
          Back to Orders
        </button>
        {canConfirm && (
          <button onClick={handleConfirm} disabled={confirming} className="rounded-lg bg-green-500 px-6 py-2.5 text-sm font-bold text-white hover:bg-green-600 transition-colors disabled:opacity-40">
            {confirming ? "Confirming…" : <span className="inline-flex items-center gap-2"><IconCheck className="h-4 w-4" />Confirm Receipt</span>}
          </button>
        )}
      </div>

      {/* Delete confirmation modal */}
      <Modal open={deleteOpen} title="Delete Goods Receipt?" onClose={() => setDeleteOpen(false)} size="sm">
        <p className="text-sm text-[#666666]">Are you sure you want to delete this goods receipt?</p>
        <p className="mt-2 text-xs text-[#999]">This action cannot be undone. Only unconfirmed receipts can be deleted.</p>
        <div className="flex gap-3 justify-end mt-6">
          <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <button onClick={handleDelete} disabled={deleting} className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 bg-red-600 hover:bg-red-700 text-white`}>
            {deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </Modal>
    </div>
  );
}