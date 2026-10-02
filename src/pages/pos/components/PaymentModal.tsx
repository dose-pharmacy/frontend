import { useState } from "react";
import { fmt } from "../../../features/pos/posService";
import { CURRENCY } from "../../../features/pos/posMock";
import { NARCOTIC_SALE_REMINDER } from "../../../components/ui/NarcoticBadge";
import type { CartItem } from "../../../features/pos/useCart";
import type { BillDiscount } from "../../../features/pos/useCart";
import type { CompleteSalePaymentMethod } from "../../../features/sales/salesApi";

type BackendMethod = CompleteSalePaymentMethod;

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
  onComplete: (
    payments: { method: BackendMethod; amount: number; reference?: string }[],
    customer: { customerName?: string; customerPhone?: string },
  ) => Promise<void>;
  onBack: () => void;
}

/**
 * Labels for the `SalePaymentInput.method` enum. The list is exactly the
 * contract's enum — no `CARD` (rejected with 422) and no `CREDIT` (not a
 * payment method; credit is the outstanding remainder).
 */
const METHOD_LABELS: Record<BackendMethod, string> = {
  CASH: "Cash",
  MOBILE_TRANSFER: "Digital Transfer",
  CHECK: "Check",
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
  // Customer details are OPTIONAL metadata about who owes a credit balance.
  // Neither field is ever required and neither affects whether the sale can be
  // completed — both are trimmed, and empty is sent as "not provided".
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Mirrors exactly what handleComplete will send: only rows with a positive
  // amount count, so the live preview can never disagree with the payload
  // (a half-typed "-5" or "" contributes nothing rather than skewing the total).
  const totalPaid = paymentRows.reduce((s, r) => {
    const v = parseFloat(r.amount);
    return s + (Number.isFinite(v) && v > 0 ? v : 0);
  }, 0);
  // Credit is the unpaid remainder — never negative — and is NOT a payment
  // method. Change appears only on an overpayment. Both are live previews of
  // what the backend derives; the POST response values remain authoritative.
  const credit = Math.max(0, total - totalPaid);
  const change = totalPaid > total ? totalPaid - total : 0;
  const hasCredit = credit > 0;
  // Optional metadata about who owes a credit balance. Whitespace is trimmed
  // and empty is treated as "not provided" — never sent as "".
  const trimmedName = customerName.trim();
  const trimmedPhone = customerPhone.trim();
  // Light format check ONLY: digits, +, spaces and dashes. Deliberately no
  // length or locale pattern rules — an invented strict rule would reject
  // valid Ethiopian numbers.
  const phoneInvalid = trimmedPhone !== "" && !/^[0-9+\-\s]+$/.test(trimmedPhone);
  // A sale can be completed whenever the cart holds at least one item,
  // including with NO payment at all (the whole total becomes credit). Never
  // depends on Paid >= Total, and never on the optional customer fields.
  const canComplete = items.length > 0;
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
    // Empty rows are dropped before submission (never sent as blank payment
    // objects). A row that HAS content but is not a positive number is a
    // mistake, so it blocks submission with an explanation instead of being
    // silently discarded.
    const parsed: { method: BackendMethod; amount: number; reference?: string }[] = [];
    let invalidRows = 0;
    for (const row of paymentRows) {
      const raw = row.amount.trim();
      if (raw === "") continue;
      const value = parseFloat(raw);
      if (!Number.isFinite(value) || value <= 0) {
        invalidRows += 1;
        continue;
      }
      parsed.push({ method: row.method, amount: value, reference: row.reference });
    }

    if (invalidRows > 0) {
      setError(
        `${invalidRows} payment ${invalidRows === 1 ? "row has" : "rows have"} an amount that is not a positive number. ` +
          `Fix ${invalidRows === 1 ? "it" : "them"} or clear ${invalidRows === 1 ? "the row" : "the rows"}.`,
      );
      return;
    }
    if (phoneInvalid) {
      setError(
        "Customer phone can only contain digits, spaces, + and dashes. Leave it empty if you don't have one.",
      );
      return;
    }
    // NOTE: `parsed` may legitimately be EMPTY — a zero-payment sale is valid
    // and its whole total becomes credit. The backend is the source of truth:
    // if it rejects the sale, its real error is surfaced below, never
    // swallowed. Empty rows were already dropped above, so no blank payment
    // objects are ever sent.
    // Customer details are optional; trimmed, and omitted entirely when empty.
    setCompleting(true);
    try {
      await onComplete(parsed, {
        customerName: trimmedName || undefined,
        customerPhone: trimmedPhone || undefined,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to complete sale. Please try again.",
      );
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

        {/* min-h-0 lets this flex child shrink below its content height so
            overflow-y-auto actually scrolls instead of being clipped. */}
        <div className="overflow-y-auto flex-1 min-h-0 p-4 flex flex-col gap-4">
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
                    min="0.01"
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

          {/* Total and Paid always; the third line is EITHER Change (overpaid)
              OR Credit / Balance due (underpaid). Credit is never negative and
              is never sent to the API — the backend derives it. */}
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
              {hasCredit ? (
                <>
                  <span className="font-semibold text-orange-600">Credit / Balance due</span>
                  <span className="font-bold text-orange-600">{fmt(credit)}</span>
                </>
              ) : (
                <>
                  <span className="font-semibold text-green-600">Change</span>
                  <span className="font-bold text-green-600">{fmt(change)}</span>
                </>
              )}
            </div>
          </div>

          {/* Credit notice — purely informational. It never blocks completion,
              with or without a customer name. */}
          {hasCredit && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-2">
              <svg className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <div className="flex flex-col gap-1">
                <p className="text-xs font-medium text-amber-800">
                  Remaining <strong>{fmt(credit)}</strong> will be recorded as
                  credit.
                </p>
                {trimmedName === "" && (
                  <p className="text-xs text-amber-700">
                    No customer name entered, so this credit can&rsquo;t be
                    traced to a customer.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Customer capture — BOTH fields are always optional. No validation
              rule may require them; empty, whitespace-only and missing are all
              treated as "not provided". The fields are stacked so the phone
              input is never overlapped or clipped. */}
          <div className="rounded-xl border border-[#E6ECE2] overflow-hidden">
            <div className="bg-[#E6ECE2] px-4 py-2 flex items-center gap-2">
              <p className="text-xs font-semibold text-[#666666] uppercase tracking-wide">
                Customer
              </p>
              <span className="text-[10px] font-medium text-[#7A9076] bg-white border border-[#C6D4BF] rounded-full px-2 py-0.5">
                Optional
              </span>
            </div>
            <div className="px-4 py-3 flex flex-col gap-3">
              <div>
                <label
                  htmlFor="pos-customer-name"
                  className="block text-sm font-medium text-[#333333] mb-1"
                >
                  Customer Name <span className="text-[#999999] font-normal">(optional)</span>
                </label>
                <input
                  id="pos-customer-name"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Leave empty if not provided"
                  className="w-full rounded-lg border border-[#C6D4BF] bg-white px-3 py-2 text-sm focus:border-[#B6C8AF] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/20"
                />
              </div>
              <div>
                <label
                  htmlFor="pos-customer-phone"
                  className="block text-sm font-medium text-[#333333] mb-1"
                >
                  Customer Phone <span className="text-[#999999] font-normal">(optional)</span>
                </label>
                <input
                  id="pos-customer-phone"
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Leave empty if not provided"
                  className="w-full rounded-lg border border-[#C6D4BF] bg-white px-3 py-2 text-sm focus:border-[#B6C8AF] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/20"
                />
              </div>
              <p className="text-[11px] text-[#999999]">
                Any remaining balance is recorded as credit on the sale whether
                or not a customer is entered here.
              </p>
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
            disabled={!canComplete || completing}
            className={`rounded-lg px-8 py-2.5 text-sm font-bold text-white transition-all disabled:cursor-not-allowed ${
              canComplete && !completing
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
