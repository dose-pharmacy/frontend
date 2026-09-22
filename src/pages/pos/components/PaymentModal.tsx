import { useState } from "react";
import { fmt } from "../../../features/pos/posService";
import { CURRENCY } from "../../../features/pos/posMock";
import { NARCOTIC_SALE_REMINDER } from "../../../components/ui/NarcoticBadge";
import type { CartItem } from "../../../features/pos/useCart";
import type { BillDiscount } from "../../../features/pos/useCart";

type BackendMethod = "CASH" | "CARD" | "DIGITAL_TRANSFER";

interface PaymentRow {
  id: string;
  method: BackendMethod;
  amount: string; // string while typing
  reference?: string;
}

interface Props {
  total: number;
  subtotal: number;
  discountAmount: number;
  billDiscount: BillDiscount | null;
  items: CartItem[];
  lineTotal: (item: CartItem) => number;
  onComplete: (payments: { method: BackendMethod; amount: number; reference?: string }[]) => Promise<void>;
  onBack: () => void;
}

const METHOD_LABELS: Record<BackendMethod, string> = {
  CASH: "Cash",
  CARD: "Card",
  DIGITAL_TRANSFER: "Digital Transfer",
};

export default function PaymentModal({
  total,
  subtotal,
  discountAmount,
  billDiscount,
  items,
  lineTotal,
  onComplete,
  onBack,
}: Props) {
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([
    { id: "1", method: "CASH", amount: String(total > 0 ? total.toFixed(2) : "") },
  ]);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPaid = paymentRows.reduce((s, r) => {
    const v = parseFloat(r.amount);
    return s + (isNaN(v) ? 0 : v);
  }, 0);
  const remaining = Math.max(0, total - totalPaid);
  const change = totalPaid > total ? totalPaid - total : 0;
  const isFullyPaid = totalPaid >= total && total > 0;
  const hasNarcotic = items.some((item) => item.product.isNarcotic);

  function addRow() {
    setPaymentRows((prev) => [
      ...prev,
      { id: Date.now().toString(), method: "CASH", amount: "" },
    ]);
  }

  function removeRow(id: string) {
    setPaymentRows((prev) => prev.filter((r) => r.id !== id));
  }

  function updateRow(id: string, field: Partial<Omit<PaymentRow, "id">>) {
    setPaymentRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...field } : r))
    );
  }

  async function handleComplete() {
    setError(null);
    const parsed = paymentRows
      .map((r) => ({ method: r.method, amount: parseFloat(r.amount), reference: r.reference }))
      .filter((r) => !isNaN(r.amount) && r.amount > 0);

    if (parsed.length === 0) {
      setError("Add at least one payment.");
      return;
    }
    if (!isFullyPaid) {
      setError(`Remaining balance: ${fmt(remaining)}. Add more payment.`);
      return;
    }
    setCompleting(true);
    try {
      await onComplete(parsed);
    } catch (err: any) {
      setError(err?.message ?? "Failed to complete sale. Please try again.");
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal
      aria-labelledby="pay-title"
    >
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[95vh]">
        {/* Header */}
        <div className="bg-[#E6ECE2] px-6 py-4 flex items-center justify-between gap-4 border-b border-[#C6D4BF]">
          <h2 id="pay-title" className="text-base font-bold text-[#333333]">
            Payment
          </h2>
          <div className="text-xl font-bold text-[#4F6B4A]">{fmt(total)}</div>
          <button onClick={onBack} className="text-[#666666] hover:text-[#333333]" aria-label="Back">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-4">
          {/* Sale summary */}
          <div className="rounded-xl border border-[#E6ECE2] overflow-hidden">
            <div className="bg-[#E6ECE2] px-4 py-2">
              <p className="text-xs font-semibold text-[#666666] uppercase tracking-wide">Summary</p>
            </div>
            <div className="px-4 py-3 flex flex-col gap-1 text-sm">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between text-xs text-[#666666]">
                  <span>{item.product.name} ({item.unit.name}) × {item.quantity}</span>
                  <span>{fmt(lineTotal(item))}</span>
                </div>
              ))}
              <div className="border-t border-[#E6ECE2] mt-2 pt-2 flex flex-col gap-1">
                <div className="flex justify-between text-[#666666]">
                  <span>Subtotal</span>
                  <span>{fmt(subtotal)}</span>
                </div>
                {discountAmount > 0 && billDiscount && (
                  <div className="flex justify-between text-green-600">
                    <span>
                      Discount (
                      {billDiscount.type === "PERCENTAGE"
                        ? `${billDiscount.value}%`
                        : `${fmt(billDiscount.value)} fixed`}
                      )
                    </span>
                    <span>− {fmt(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-[#333333] text-base border-t border-[#E6ECE2] pt-1 mt-1">
                  <span>Total</span>
                  <span className="text-[#7A9076]">{fmt(total)}</span>
                </div>
              </div>
            </div>
          </div>

          {hasNarcotic && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2">
              <svg className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <p className="text-xs font-medium text-red-700">{NARCOTIC_SALE_REMINDER}</p>
            </div>
          )}

          {/* Payment rows */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[#333333]">Payments</p>
              <button
                onClick={addRow}
                className="text-xs font-semibold text-[#7A9076] hover:underline"
              >
                + Add payment
              </button>
            </div>

            {paymentRows.map((row, idx) => (
              <div key={row.id} className="flex items-center gap-2 bg-[#E6ECE2]/50 rounded-lg p-2.5">
                <span className="text-xs text-[#999] w-4 flex-shrink-0">{idx + 1}.</span>
                <select
                  value={row.method}
                  onChange={(e) => updateRow(row.id, { method: e.target.value as BackendMethod })}
                  className="flex-1 rounded-lg border border-[#C6D4BF] bg-white px-2.5 py-1.5 text-sm focus:border-[#B6C8AF] focus:outline-none"
                >
                  {(Object.keys(METHOD_LABELS) as BackendMethod[]).map((m) => (
                    <option key={m} value={m}>{METHOD_LABELS[m]}</option>
                  ))}
                </select>
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#999]">{CURRENCY}</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={row.amount}
                    onChange={(e) => updateRow(row.id, { amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-[#C6D4BF] bg-white pl-9 pr-2 py-1.5 text-sm focus:border-[#B6C8AF] focus:outline-none"
                  />
                </div>
                {paymentRows.length > 1 && (
                  <button
                    onClick={() => removeRow(row.id)}
                    className="text-[#C6D4BF] hover:text-red-500 flex-shrink-0 transition-colors"
                    aria-label="Remove payment"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zm0 0" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Paid / Remaining / Change */}
          <div className="rounded-xl border border-[#E6ECE2] px-4 py-3 flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-[#666666]">Total</span>
              <span className="font-semibold text-[#333333]">{fmt(total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#666666]">Paid</span>
              <span className="font-semibold text-[#333333]">{fmt(totalPaid)}</span>
            </div>
            <div className="flex justify-between border-t border-[#E6ECE2] pt-1.5 mt-0.5">
              {remaining > 0 ? (
                <>
                  <span className="font-semibold text-orange-600">Remaining</span>
                  <span className="font-bold text-orange-600">{fmt(remaining)}</span>
                </>
              ) : (
                <>
                  <span className="font-semibold text-green-600">Change</span>
                  <span className="font-bold text-green-600">{fmt(change)}</span>
                </>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-[#E6ECE2] px-4 py-3 flex gap-3 justify-end">
          <button
            onClick={onBack}
            className="rounded-lg px-5 py-2.5 text-sm font-semibold text-[#333333] bg-[#C6D4BF] hover:bg-[#B5C6AE] transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleComplete}
            disabled={!isFullyPaid || completing}
            className={`rounded-lg px-8 py-2.5 text-sm font-bold text-white transition-all disabled:cursor-not-allowed ${
              isFullyPaid && !completing
                ? "bg-green-600 hover:bg-green-700 shadow-md"
                : "bg-gray-300"
            }`}
          >
            {completing ? "Processing…" : "Complete Sale"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Re-export fmt for use in other components
export { fmt };
