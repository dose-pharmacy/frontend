import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import {
  fetchBatchById,
  daysUntilExpiry,
  updateBatch,
  deleteBatch,
  type BatchDetail,
} from "../../features/inventory/inventoryService";
import { getBatchTransactions, type StockTransactionDto } from "../../features/inventory/stockApi";
import Breadcrumb from "../../components/ui/Breadcrumb";
import StatusBadge from "../../components/ui/StatusBadge";
import Button from "../../components/ui/Button";
import ConfirmationDialog from "../../components/ui/ConfirmationDialog";
import Modal from "../../components/ui/Modal";
import Input from "../../components/ui/Input";
import DatePicker from "../../components/ui/DatePicker";
import FormError from "../../components/ui/FormError";

interface EditBatchForm {
  batchNumber: string;
  expiryDate: string;
  purchaseCost: string;
  supplierReference: string;
}

interface TxRow {
  id: string;
  type: string;
  direction: "IN" | "OUT";
  quantity: number;
  balanceAfter: number;
  date: string;
  reference: string;
}

function adaptTx(tx: StockTransactionDto): TxRow {
  return {
    id: tx.id,
    type: tx.transactionType,
    direction: tx.direction,
    quantity: tx.quantity,
    balanceAfter: tx.balanceAfter,
    date: tx.createdAt,
    reference: [tx.referenceType, tx.referenceId].filter(Boolean).join(" · ") || "—",
  };
}

function prettyTxType(t: string) {
  if (!t) return "";
  const spaced = t.replace(/_/g, " ");
  if (spaced === spaced.toUpperCase()) return spaced.charAt(0) + spaced.slice(1).toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export default function BatchDetailPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Deactivate (was Recall)
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Edit (was Adjust)
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditBatchForm>({
    batchNumber: "",
    expiryDate: "",
    purchaseCost: "",
    supplierReference: "",
  });
  const [editErrors, setEditErrors] = useState<Partial<Record<keyof EditBatchForm, string>>>({});
  const [editError, setEditError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!batchId) return;
    let cancelled = false;
    fetchBatchById(batchId)
      .then(async (b) => {
        if (cancelled) return;
        if (!b) {
          navigate("/inventory/batches");
          return;
        }
        setBatch(b);
        // GET /inventory/batches/{id}/transactions — real ledger for this batch.
        const t = await getBatchTransactions(batchId as string, { limit: 100 });
        if (cancelled) return;
        setTransactions(t.data.map(adaptTx));
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : "Failed to load batch. Please try again.",
        );
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [batchId, navigate]);

  // ── Deactivate (DELETE) ──
  async function handleDelete() {
    if (!batch) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteBatch(batch.id);
      setDeleteOpen(false);
      navigate("/inventory/batches");
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to deactivate batch.",
      );
    } finally {
      setDeleting(false);
    }
  }

  // ── Edit (PATCH) ──
  function openEdit() {
    if (!batch) return;
    setEditForm({
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate,
      purchaseCost: String(batch.purchaseCost ?? ""),
      supplierReference: batch.supplierReference ?? "",
    });
    setEditErrors({});
    setEditError(null);
    setEditOpen(true);
  }

  function validateEdit(f: EditBatchForm) {
    const e: Partial<Record<keyof EditBatchForm, string>> = {};
    if (!f.batchNumber.trim()) e.batchNumber = "Batch number is required.";
    if (!f.expiryDate) e.expiryDate = "Expiry date is required.";
    else if (f.expiryDate < batch!.receivedDate)
      e.expiryDate = "Expiry must be after received date.";
    if (f.purchaseCost.trim() !== "" && Number.isNaN(Number(f.purchaseCost)))
      e.purchaseCost = "Purchase cost must be a number.";
    return e;
  }

  async function handleEdit() {
    if (!batch) return;
    const e = validateEdit(editForm);
    if (Object.keys(e).length) {
      setEditErrors(e);
      return;
    }
    setEditing(true);
    setEditError(null);
    try {
      const updated = await updateBatch(
        batch.id,
        {
          batchNumber: editForm.batchNumber.trim(),
          expiryDate: editForm.expiryDate,
          purchaseCost:
            editForm.purchaseCost.trim() === ""
              ? undefined
              : Number(editForm.purchaseCost),
          supplierReference: editForm.supplierReference.trim() || undefined,
        },
        batch.productName,
      );
      setBatch(updated);
      setEditOpen(false);
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : "Failed to update batch.",
      );
    } finally {
      setEditing(false);
    }
  }

  if (loading)
    return (
      <div className="flex flex-col">
        <div className="p-6 animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-[#E6ECE2]" />
          ))}
        </div>
      </div>
    );

  if (loadError)
    return (
      <div className="flex-1 flex flex-col">
        <div className="p-6">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {loadError}
          </div>
        </div>
      </div>
    );

  if (!batch) return null;

  const days = daysUntilExpiry(batch.expiryDate);
  const daysColor =
    days < 0
      ? "text-red-600"
      : days <= 30
        ? "text-orange-600"
        : days <= 60
          ? "text-yellow-600"
          : "text-green-600";

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <Breadcrumb
        items={[
          { label: "Inventory", to: "/inventory/products" },
          { label: "Batches", to: "/inventory/batches" },
          { label: batch.batchNumber },
        ]}
      />

      <div className="p-6 flex flex-col gap-6">
        {/* Batch info */}
        <div className="bg-[#E6ECE2] rounded-xl p-6">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoItem label="Batch Number" value={batch.batchNumber} mono />
            <InfoItem label="Product" value={batch.productName} />
            <InfoItem label="Quantity" value={String(batch.quantity)} />
            <InfoItem label="Received Date" value={batch.receivedDate || "—"} />
            <InfoItem label="Expiry Date" value={batch.expiryDate} />
            <InfoItem label="Supplier" value={batch.supplier} />
            <InfoItem label="Location" value={batch.location} />
            <div>
              <p className="text-xs text-[#666666] font-medium uppercase tracking-wide">Status</p>
              <div className="mt-1"><StatusBadge status={batch.status} /></div>
            </div>
            <div>
              <p className="text-xs text-[#666666] font-medium uppercase tracking-wide">Days Remaining</p>
              <p className={`text-2xl font-bold mt-1 ${daysColor}`}>
                {days < 0 ? "Expired" : `${days} days`}
              </p>
            </div>
          </div>
        </div>

        {/* Transaction history */}
        <section>
          <h3 className="text-base font-bold text-[#333333] mb-3">Transaction History</h3>
          <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden flex-shrink-0">
            {transactions.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[#666666]">No transactions recorded for this batch.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#E6ECE2]">
                      {["Date", "Type", "Movement", "Balance After", "Reference"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left font-semibold text-[#333333]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t, i) => (
                      <tr key={t.id} className={i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/30"}>
                        <td className="px-4 py-3 text-[#666666] whitespace-nowrap">
                          {new Date(t.date).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-4 py-3 capitalize text-[#333333]">{prettyTxType(t.type)}</td>
                        <td className={`px-4 py-3 font-semibold ${t.direction === "IN" ? "text-green-700" : "text-red-700"}`}>
                          {t.direction === "IN" ? "+" : "−"}{t.quantity.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-[#666666]">{t.balanceAfter.toLocaleString()}</td>
                        <td className="px-4 py-3 font-mono text-xs text-[#666666]">{t.reference}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              setDeleteError(null);
              setDeleteOpen(true);
            }}
            className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
          >
            Deactivate Batch
          </button>
          <Button onClick={() => alert("Transfer — backend integration pending")}>Transfer</Button>
          <Button variant="secondary" onClick={openEdit}>Edit</Button>
        </div>
      </div>

      {/* ─────────── Deactivate confirm dialog ─────────── */}
      <ConfirmationDialog
        open={deleteOpen}
        title="Deactivate This Batch?"
        message={
          deleteError
            ? deleteError
            : `This will deactivate batch ${batch.batchNumber}. This action cannot be undone. Proceed?`
        }
        confirmLabel="Deactivate Batch"
        onConfirm={handleDelete}
        onCancel={() => {
          if (deleting) return;
          setDeleteOpen(false);
        }}
        loading={deleting}
        danger
      />

      {/* ─────────── Edit Batch Modal ─────────── */}
      <Modal
        open={editOpen}
        title="Edit Batch"
        onClose={() => !editing && setEditOpen(false)}
        size="md"
      >
        <div className="flex flex-col gap-4">
          <FormError message={editError} />

          {/* Product — locked */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#333333]">Product</label>
            <div className="flex items-center justify-between rounded-lg border border-[#E6ECE2] bg-[#FAF9F4] px-3.5 py-2.5 text-sm text-[#666666]">
              <span>{batch.productName}</span>
              <svg
                className="h-4 w-4 text-[#666666]"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden
              >
                <path
                  fillRule="evenodd"
                  d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>

          <Input
            label="Batch Number *"
            value={editForm.batchNumber}
            onChange={(e) => {
              setEditForm((f) => ({ ...f, batchNumber: e.target.value }));
              setEditErrors((er) => ({ ...er, batchNumber: undefined }));
            }}
            error={editErrors.batchNumber}
          />

          {/* Received Date — locked */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#333333]">Received Date</label>
            <div className="flex items-center justify-between rounded-lg border border-[#E6ECE2] bg-[#FAF9F4] px-3.5 py-2.5 text-sm text-[#666666]">
              <span>{batch.receivedDate || "—"}</span>
              <svg
                className="h-4 w-4 text-[#666666]"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden
              >
                <path
                  fillRule="evenodd"
                  d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#333333]">Expiry Date *</label>
            <DatePicker
              value={editForm.expiryDate}
              onChange={(v) => {
                setEditForm((f) => ({ ...f, expiryDate: v }));
                setEditErrors((er) => ({ ...er, expiryDate: undefined }));
              }}
              placeholder="Select expiry date..."
            />
            {editErrors.expiryDate && (
              <p className="text-xs text-red-600">{editErrors.expiryDate}</p>
            )}
          </div>

          <Input
            label="Purchase Cost"
            type="number"
            min={0}
            step="0.01"
            value={editForm.purchaseCost}
            onChange={(e) => {
              setEditForm((f) => ({ ...f, purchaseCost: e.target.value }));
              setEditErrors((er) => ({ ...er, purchaseCost: undefined }));
            }}
            error={editErrors.purchaseCost}
          />

          <Input
            label="Supplier Reference"
            value={editForm.supplierReference}
            onChange={(e) =>
              setEditForm((f) => ({ ...f, supplierReference: e.target.value }))
            }
            placeholder="e.g. ABC Pharma invoice 1042"
          />

          <div className="flex gap-3 justify-end pt-2">
            <Button
              variant="secondary"
              onClick={() => setEditOpen(false)}
              disabled={editing}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleEdit()} loading={editing}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function InfoItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-[#666666] font-medium uppercase tracking-wide">{label}</p>
      <p className={`mt-1 font-semibold text-[#333333] ${mono ? "font-mono text-sm" : "text-sm"}`}>{value}</p>
    </div>
  );
}