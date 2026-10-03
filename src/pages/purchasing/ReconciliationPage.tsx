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
import { quantityWithUnit, unitCell, unitName } from "../../utils/format";

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

/** Per-field validation errors keyed as `<receiptItemId>:<field>`. */
type ResolveFieldErrors = Record<string, string>;

function resolveFieldKey(id: string, field: string): string {
  return `${id}:${field}`;
}

/** Convert a "YYYY-MM-DD" (or ISO) date to the API's UTC ISO timestamp — or null when blank/invalid. */
function toIsoTimestampOrNull(value: string): string | null {
  if (!value) return null;
  const d = new Date(value.includes("T") ? value : `${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Maximum quantity accepted by the backend resolve contract. */
const MAX_RESOLVE_QTY = 99999999999.999;

/** Validate every resolution row. Returns a map of field errors (empty = OK). */
function validateResolveItems(items: ResolveItemState[]): ResolveFieldErrors {
  const errors: ResolveFieldErrors = {};
  items.forEach((row) => {
    const delivered = Number(row.deliveredQty);
    const actual = Number(row.actualQty);
    // Backend contract: both quantities MUST be > 0 and ≤ MAX_RESOLVE_QTY.
    const qtyOk = (n: number) => Number.isFinite(n) && n > 0 && n <= MAX_RESOLVE_QTY;
    if (!qtyOk(delivered)) {
      errors[resolveFieldKey(row.id, "deliveredQty")] =
        "Delivered quantity must be greater than zero and at most 99999999999.999.";
    }
    if (!qtyOk(actual)) {
      errors[resolveFieldKey(row.id, "actualQty")] =
        "Actual quantity must be greater than zero and at most 99999999999.999.";
    }
    const batch = (row.batchNumber ?? "").trim();
    const mfg = (row.manufacturingDate ?? "").trim();
    const expiry = (row.expiryDate ?? "").trim();
    if (actual > 0 && !batch) {
      errors[resolveFieldKey(row.id, "batchNumber")] =
        "Batch number is required for quantities received.";
    }
    if (actual > 0 && !expiry) {
      errors[resolveFieldKey(row.id, "expiryDate")] =
        "Expiry date is required for quantities received.";
    }
    if (mfg && expiry && expiry < mfg) {
      errors[resolveFieldKey(row.id, "dates")] =
        "Expiry date cannot be before the manufacturing date.";
    }
  });
  return errors;
}

const STATUS_BADGE: Record<string, string> = {
  MATCHED: "bg-green-100 text-green-700",
  DISCREPANCY: "bg-yellow-100 text-yellow-700",
  RESOLVED: "bg-blue-100 text-blue-700",
};

// ─── Goods Receipt detail skeleton ───────────────────────────────────────────
// Shimmer placeholder while a goods receipt is loading — mirrors the loaded
// detail layout (header, summary cards, receipt info, items table, footer) so
// the page doesn't jump once the real data arrives.

function GoodsReceiptDetailSkeleton() {
  return (
    <div className="flex flex-col min-h-0 flex-1 animate-pulse">
      {/* Header (mirrors PageHeader for a loaded receipt) */}
      <div className="px-6 pt-5 pb-4 border-b border-[#E6ECE2] bg-white flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="h-3 w-40 rounded bg-[#E6ECE2] mb-1.5" />
          <div className="h-6 w-52 rounded-lg bg-[#E6ECE2]" />
          <div className="h-3 w-32 rounded bg-[#E6ECE2] mt-1.5" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-6 w-24 rounded-full bg-[#E6ECE2]" />
          <div className="h-9 w-32 rounded-lg bg-[#E6ECE2]" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        {/* Summary cards */}
        <div className="px-4 sm:px-6 py-4 bg-[#E6ECE2]">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-4 text-center border border-[#C6D4BF]/30">
                <div className="h-2.5 w-16 rounded bg-[#E6ECE2] mx-auto" />
                <div className="h-5 w-14 rounded bg-[#E6ECE2] mt-2 mx-auto" />
              </div>
            ))}
          </div>
        </div>

        {/* Receipt info */}
        <div className="px-4 sm:px-6 py-4">
          <div className="bg-white rounded-xl border border-[#E6ECE2] p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i}>
                <div className="h-2.5 w-16 rounded bg-[#E6ECE2] mb-1.5" />
                <div className="h-4 w-24 rounded bg-[#E6ECE2]" />
              </div>
            ))}
          </div>
        </div>

        {/* Items table */}
        <div className="px-4 sm:px-6">
          <div className="rounded-xl border border-[#E6ECE2] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[780px]">
                <thead>
                  <tr className="bg-[#C6D4BF]">
                    {[...Array(10)].map((_, i) => (
                      <th key={i} className="px-3 py-2.5">
                        <div className="h-3 w-10 rounded bg-[#E6ECE2]" />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...Array(4)].map((_, i) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/20"}>
                      {[...Array(10)].map((_, j) => (
                        <td key={j} className="px-3 py-2.5">
                          <div className="h-3 w-12 rounded bg-[#E6ECE2]" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E6ECE2] px-4 sm:px-6 py-3 flex items-center justify-end gap-3 z-30">
        <div className="h-10 w-28 rounded-lg bg-[#E6ECE2]" />
        <div className="h-10 w-40 rounded-lg bg-[#E6ECE2]" />
      </div>
    </div>
  );
}

export default function ReconciliationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [receipt, setReceipt] = useState<GoodsReceiptDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resolveNote, setResolveNote] = useState("");
  const [noteError, setNoteError] = useState("");
  const [resolveItems, setResolveItems] = useState<ResolveItemState[]>([]);
  const [resolving, setResolving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [actionError, setActionError] = useState("");
  const [resolveErrors, setResolveErrors] = useState<ResolveFieldErrors>({});
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
      setResolveErrors({});
      if (r.status === "DISCREPANCY") {
        const items = Array.isArray(r.items) ? r.items : [];
        setResolveItems(
          items.map((item) => ({
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
    // Clear validation errors for the edited field (and the cross-field date check).
    setResolveErrors((prev) => {
      if (!prev[resolveFieldKey(itemId, field)] && !prev[resolveFieldKey(itemId, "dates")]) return prev;
      const next = { ...prev };
      delete next[resolveFieldKey(itemId, field)];
      delete next[resolveFieldKey(itemId, "dates")];
      return next;
    });
  }

  async function handleResolve() {
    setActionError("");
    const errors = validateResolveItems(resolveItems);
    const noteMissing = !resolveNote.trim();
    if (noteMissing) {
      setNoteError("Resolution note is required before resolving.");
    }
    if (Object.keys(errors).length > 0 || noteMissing) {
      setResolveErrors(errors);
      return;
    }
    setNoteError("");
    setResolveErrors({});
    setResolving(true);
    try {
      // 1) Record the resolution. The PATCH response is NOT guaranteed to be a
      //    complete Goods Receipt (it may lack `items` or be empty) — never use
      //    it as the authoritative page state.
      await resolveGoodsReceipt(id!, {
        discrepancyNote: resolveNote.trim() || undefined,
        items: resolveItems.map((item) => ({
          id: item.id,
          deliveredQty: Number(item.deliveredQty),
          actualQty: Number(item.actualQty),
          batchNumber: item.batchNumber.trim() || null,
          manufacturingDate: toIsoTimestampOrNull(item.manufacturingDate),
          expiryDate: toIsoTimestampOrNull(item.expiryDate),
        })),
      });

      // 2) Resolution recorded — return to the Deliveries list. The list page
      //    re-fetches on mount and displays the backend's current status.
      //    Resolve and Confirm remain separate actions (Confirm is never called
      //    automatically, and the user is not kept on the detail page).
      navigate("/purchasing/deliveries");
    } catch (e) {
      setActionError(e instanceof GoodsReceiptsApiError ? e.message : "Unable to resolve discrepancy. Please review the quantities and try again.");
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
      // Keep `confirming` true (button stays disabled) until the refreshed
      // receipt hides the Confirm button — no duplicate-submit window.
      // Re-fetch the authoritative detail so `confirmedAt`/status reflect the
      // latest backend state (no auto-navigation; the footer/breadcrumb
      // buttons let the user leave whenever ready).
      try {
        const updated = await getGoodsReceipt(id!);
        setReceipt(updated);
      } catch {
        // Non-critical refresh — keep showing the pre-confirm state on failure.
      }
      setConfirming(false);
    } catch (e) {
      if (e instanceof GoodsReceiptsApiError) {
        if (e.status === 401) {
          setActionError("Your session has expired. Please sign in again.");
        } else if (e.status === 403) {
          setActionError("You do not have permission to confirm receipts.");
        } else if (e.status === 404) {
          setActionError("The Goods Receipt could not be found.");
        } else {
          // Backend validation/business messages are surfaced as-is.
          setActionError(e.message);
        }
      } else {
        setActionError("Failed to confirm receipt. Please try again.");
      }
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
    return <GoodsReceiptDetailSkeleton />;
  }

  if (error || !receipt) {
    return (
      <div className="flex flex-col min-h-0 flex-1">
        <div className="bg-white px-6 pt-4">
          <button
            onClick={() => navigate("/purchasing/deliveries")}
            className="flex items-center gap-1.5 text-sm font-medium text-[#666666] hover:text-[#4F6B4A] transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
            </svg>
            Goods Receipts
          </button>
        </div>
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

  // A receipt is confirmable only while it is NOT yet finalized. The backend
  // keeps `status` as MATCHED/RESOLVED after confirmation, so `confirmedAt` is
  // the authoritative "already confirmed" signal — never assume MATCHED means
  // unconfirmed.
  const isConfirmed = Boolean(receipt.confirmedAt);
  const canConfirm =
    !isConfirmed && (receipt.status === "MATCHED" || receipt.status === "RESOLVED");

  // Backend detail responses embed `items`; guard anyway so the page can never
  // crash (e.g. on a partial response shape) because the array is missing.
  const receiptItems = Array.isArray(receipt.items) ? receipt.items : [];

  const totalOrdered = receiptItems.reduce((s, i) => s + i.expectedQty, 0);
  const totalDelivered = receiptItems.reduce((s, i) => s + i.deliveredQty, 0);
  const totalActual = receiptItems.reduce((s, i) => s + i.actualQty, 0);

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="bg-white px-6 pt-4">
        <button
          onClick={() => navigate("/purchasing/deliveries")}
          className="flex items-center gap-1.5 text-sm font-medium text-[#666666] hover:text-[#4F6B4A] transition-colors"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
          Goods Receipts
        </button>
      </div>
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
            <table className="w-full text-sm min-w-[780px]">
              <thead>
                <tr className="bg-[#C6D4BF]">
                  {["#", "Product", "Unit", "Expected", "Delivered", "Actual", "Variance", "Batch", "Expiry", "Location"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold text-[#333333] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {receiptItems.map((item, i) => {
                  const variance = item.actualQty - item.expectedQty;
                  const isMatch = variance === 0;
                  // The unit the receipt row's own quantities are expressed in,
                  // falling back to the PO item it was snapshotted from. Never a
                  // conversion and never a guess — "—" when the backend sent none.
                  const unit = item.unit ?? item.purchaseOrderItem?.unit ?? null;
                  return (
                    <tr key={item.id} className={i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/20"}>
                      <td className="px-3 py-2.5 text-[#666666]">{i + 1}</td>
                      <td className="px-3 py-2.5 font-medium text-[#333333]">
                        {item.purchaseOrderItem?.product?.name ?? `Product (${item.purchaseOrderItem?.productId?.slice(0, 8) ?? "?"})`}
                      </td>
                      <td className="px-3 py-2.5 text-[#666666] whitespace-nowrap">{unitCell(unit)}</td>
                      <td className="px-3 py-2.5 text-[#333333] whitespace-nowrap">{quantityWithUnit(item.expectedQty, unit)}</td>
                      <td className="px-3 py-2.5 text-[#333333] whitespace-nowrap">{quantityWithUnit(item.deliveredQty, unit)}</td>
                      <td className="px-3 py-2.5 text-[#333333] whitespace-nowrap">{quantityWithUnit(item.actualQty, unit)}</td>
                      <td className={`px-3 py-2.5 font-semibold whitespace-nowrap ${isMatch ? "text-green-600" : "text-red-500"}`}>
                        {isMatch ? (
                          <span className="inline-flex items-center gap-1">
                            <IconCheck className="h-3.5 w-3.5" />
                            {quantityWithUnit(0, unit)}
                          </span>
                        ) : (
                          quantityWithUnit(`${variance > 0 ? "+" : ""}${variance}`, unit)
                        )}
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

              {Object.keys(resolveErrors).length > 0 && (
                <div className="mb-3 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                  <p className="font-semibold mb-1">Please fix the following before resolving:</p>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {Array.from(new Set(Object.values(resolveErrors))).map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}

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
                      const originalItem = receiptItems.find((ri) => ri.id === item.id);
                      const actualErr = resolveErrors[resolveFieldKey(item.id, "actualQty")];
                      const batchErr = resolveErrors[resolveFieldKey(item.id, "batchNumber")];
                      const mfgErr = resolveErrors[resolveFieldKey(item.id, "manufacturingDate")];
                      const expiryErr = resolveErrors[resolveFieldKey(item.id, "expiryDate")];
                      const dateErr = resolveErrors[resolveFieldKey(item.id, "dates")];
                      const inputCls = (hasErr: boolean) =>
                        `w-full rounded border px-2 py-1 text-sm ${hasErr ? "border-red-400 bg-red-50" : "border-yellow-300"}`;
                      const resolveUnit = originalItem
                        ? (originalItem.unit ?? originalItem.purchaseOrderItem?.unit ?? null)
                        : null;
                      return (
                        <tr key={item.id} className={i % 2 === 0 ? "bg-white" : "bg-yellow-50/50"}>
                          <td className="px-3 py-2 font-medium text-[#333333]">
                            {originalItem?.purchaseOrderItem?.product?.name ?? `Item ${i + 1}`}
                          </td>
                          <td className="px-3 py-2 align-top">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min={0}
                                step="any"
                                value={item.actualQty}
                                onChange={(e) => updateResolveItem(item.id, "actualQty", Number(e.target.value))}
                                className={`w-24 ${inputCls(!!actualErr)}`}
                                aria-invalid={!!actualErr}
                              />
                              {unitName(resolveUnit) && (
                                <span className="text-xs text-[#999999] whitespace-nowrap">
                                  {unitName(resolveUnit)}
                                </span>
                              )}
                            </div>
                            {actualErr && <p className="text-[11px] text-red-500 mt-0.5">{actualErr}</p>}
                          </td>
                          <td className="px-3 py-2 align-top">
                            <input
                              value={item.batchNumber}
                              onChange={(e) => updateResolveItem(item.id, "batchNumber", e.target.value)}
                              placeholder="Batch number"
                              className={`w-28 text-xs ${inputCls(!!batchErr)}`}
                              aria-invalid={!!batchErr}
                            />
                            {batchErr && <p className="text-[11px] text-red-500 mt-0.5">{batchErr}</p>}
                          </td>
                          <td className="px-3 py-2 align-top">
                            <DatePicker
                              value={item.manufacturingDate}
                              onChange={(v) => updateResolveItem(item.id, "manufacturingDate", v)}
                              placeholder="Mfg date"
                            />
                            {mfgErr && <p className="text-[11px] text-red-500 mt-0.5">{mfgErr}</p>}
                          </td>
                          <td className="px-3 py-2 align-top">
                            <DatePicker
                              value={item.expiryDate}
                              onChange={(v) => updateResolveItem(item.id, "expiryDate", v)}
                              placeholder="Expiry date"
                            />
                            {(expiryErr || dateErr) && (
                              <p className="text-[11px] text-red-500 mt-0.5">{expiryErr || dateErr}</p>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mb-3">
                <label className="block text-sm text-yellow-800 mb-1">
                  Resolution Note <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={resolveNote}
                  onChange={(e) => {
                    setResolveNote(e.target.value);
                    if (noteError) setNoteError("");
                  }}
                  placeholder="Explain how the discrepancy was resolved…"
                  aria-required="true"
                  aria-invalid={!!noteError}
                  className={`w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none resize-none ${noteError ? "border-red-400 bg-red-50" : "border-yellow-300"}`}
                />
                {noteError && <p className="text-[11px] text-red-500 mt-1">{noteError}</p>}
              </div>

              <button
                onClick={handleResolve}
                disabled={resolving}
                className="rounded-lg bg-yellow-500 px-5 py-2 text-sm font-semibold text-white hover:bg-yellow-600 transition-colors disabled:opacity-40"
              >
                {resolving ? "Resolving…" : "Resolve Discrepancy"}
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