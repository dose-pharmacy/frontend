import { useState } from "react";
import { fmt } from "../../../features/pos/posService";
import { CURRENCY } from "../../../features/pos/posMock";
import type { CartItem } from "../../../features/pos/useCart";

type PaymentMethod = "cash" | "card" | "digital";

interface Payment { id: string; method: PaymentMethod; amount: number; }

interface Props {
  total: number;
  subtotal: number;
  tax: number;
  discountAmount: number;
  items: CartItem[];
  lineTotal: (item: CartItem) => number;
  onComplete: () => void;
  onBack: () => void;
}

const METHOD_LABELS: Record<PaymentMethod, string> = { cash: "Cash", card: "Card", digital: "Digital Transfer" };
const METHOD_ICONS: Record<PaymentMethod, string> = { cash: "💵", card: "💳", digital: "📱" };

export default function PaymentModal({ total, subtotal, tax, discountAmount, items, lineTotal, onComplete, onBack }: Props) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [addMethod, setAddMethod] = useState<PaymentMethod>("cash");
  const [addAmount, setAddAmount] = useState("");
  const [activeMethod, setActiveMethod] = useState<PaymentMethod>("cash");
  const [mismatchOpen, setMismatchOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const remaining = total - totalPaid;
  const change = totalPaid > total ? totalPaid - total : 0;
  const isFullyPaid = totalPaid >= total;

  function addPayment() {
    const amt = parseFloat(addAmount);
    if (!addAmount || isNaN(amt) || amt <= 0) return;
    setPayments((prev) => [...prev, { id: Date.now().toString(), method: addMethod, amount: amt }]);
    setAddAmount("");
  }

  function removePayment(id: string) { setPayments((prev) => prev.filter((p) => p.id !== id)); }

  async function handleComplete() {
    if (!isFullyPaid) { setMismatchOpen(true); return; }
    setCompleting(true);
    await new Promise((r) => setTimeout(r, 1000));
    setCompleting(false);
    onComplete();
  }

  function quickAddRemaining(method: PaymentMethod) {
    if (remaining <= 0) return;
    setPayments((prev) => [...prev, { id: Date.now().toString(), method, amount: remaining }]);
    setMismatchOpen(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal aria-labelledby="pay-title">
      <div className="relative bg-[#DBEFF3] rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[95vh]">
        {/* Header */}
        <div className="bg-[#49B0C1] px-6 py-4 flex items-center justify-between gap-4">
          <h2 id="pay-title" className="text-lg font-bold text-white">Payment Processing</h2>
          <div className="text-2xl font-bold text-white">{fmt(total)}</div>
          <button onClick={onBack} className="text-white/80 hover:text-white" aria-label="Back"><svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/></svg></button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-4">
          {/* Payment method selector */}
          <div className="bg-white rounded-xl p-4">
            <p className="text-sm font-semibold text-[#666666] mb-3">Payment Method</p>
            <div className="flex gap-3 flex-wrap">
              {(["cash", "card", "digital"] as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  onClick={() => { setActiveMethod(m); setAddMethod(m); }}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 px-6 py-4 min-w-[100px] transition-all ${
                    activeMethod === m ? "border-[#49B0C1] bg-[#DBEFF3]" : "border-transparent bg-[#DBEFF3] hover:border-[#ABDBE3]"
                  }`}
                >
                  <span className="text-2xl" aria-hidden>{METHOD_ICONS[m]}</span>
                  <span className="text-sm font-semibold text-[#333333]">{METHOD_LABELS[m]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Payments table */}
          {payments.length > 0 && (
            <div className="bg-white rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#ABDBE3]">
                    <th className="px-4 py-3 text-left font-semibold text-[#333333]">Method</th>
                    <th className="px-4 py-3 text-right font-semibold text-[#333333]">Amount</th>
                    <th className="px-4 py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p, i) => (
                    <tr key={p.id} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/30"}>
                      <td className="px-4 py-3 flex items-center gap-2">
                        <span aria-hidden>{METHOD_ICONS[p.method]}</span>
                        <span className="text-[#333333]">{METHOD_LABELS[p.method]}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[#333333]">{fmt(p.amount)}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => removePayment(p.id)} className="text-red-500 hover:text-red-700" aria-label="Remove">🗑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#49B0C1]">
                    <td className="px-4 py-3 text-sm font-bold text-white">TOTAL PAID: {fmt(totalPaid)}</td>
                    <td colSpan={2} className="px-4 py-3 text-right text-sm font-bold" style={{ color: remaining > 0 ? "#FFC107" : "white" }}>
                      {remaining > 0 ? `REMAINING: ${fmt(remaining)}` : change > 0 ? `CHANGE: ${fmt(change)}` : "PAID IN FULL ✓"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Add payment form */}
          <div className="bg-[#DBEFF3] rounded-xl p-4 flex items-end gap-3 flex-wrap">
            <div className="flex flex-col gap-1 flex-shrink-0">
              <label className="text-xs font-medium text-[#666666]">Method</label>
              <select value={addMethod} onChange={(e) => setAddMethod(e.target.value as PaymentMethod)} className="rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none">
                {(["cash", "card", "digital"] as PaymentMethod[]).map((m) => (
                  <option key={m} value={m}>{METHOD_LABELS[m]}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#666666]">Amount ({CURRENCY})</label>
              <input
                type="number"
                min={0}
                value={addAmount}
                onChange={(e) => setAddAmount(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addPayment()}
                placeholder="0.00"
                className="w-36 rounded-lg border border-[#ABDBE3] bg-white px-3 py-2 text-sm focus:border-[#49B0C1] focus:outline-none"
              />
            </div>
            <button
              onClick={addPayment}
              className="rounded-lg bg-[#49B0C1] px-5 py-2 text-sm font-bold text-white hover:bg-[#3a9baf] transition-colors"
            >
              + Add Payment
            </button>
          </div>

          {/* Status cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-4 flex items-center gap-3">
              <span className="text-2xl" aria-hidden>{isFullyPaid ? "✅" : "⏳"}</span>
              <div>
                <p className="text-xs text-[#666666]">Payment Status</p>
                <p className={`text-sm font-bold ${isFullyPaid ? "text-green-600" : "text-orange-500"}`}>
                  {isFullyPaid ? "Fully Paid" : "Partially Paid"}
                </p>
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 flex items-center gap-3">
              <span className="text-2xl" aria-hidden>💰</span>
              <div>
                <p className="text-xs text-[#666666]">Change Due</p>
                <p className={`text-sm font-bold ${change > 0 ? "text-green-600" : "text-[#333333]"}`}>{fmt(change)}</p>
              </div>
            </div>
          </div>

          {/* Receipt toggle */}
          <div className="bg-white rounded-xl overflow-hidden">
            <button
              onClick={() => setShowReceipt((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-[#49B0C1] hover:bg-[#DBEFF3]/50 transition-colors"
            >
              <span>📄 Receipt Preview</span>
              <span>{showReceipt ? "▲" : "▼"}</span>
            </button>
            {showReceipt && (
              <div className="border-t border-[#DBEFF3] px-4 py-4 text-sm font-mono">
                <p className="text-center font-bold text-[#333333] mb-2">PharmaCare POS</p>
                <p className="text-center text-xs text-[#666666] mb-3">{new Date().toLocaleString()}</p>
                <div className="divide-y divide-dashed divide-[#ABDBE3]">
                  {items.map((item) => (
                    <div key={item.id} className="py-1.5 flex justify-between text-xs">
                      <span>{item.product.name} ({item.unit.name}) x{item.quantity}</span>
                      <span>{fmt(lineTotal(item))}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-[#ABDBE3] mt-2 pt-2 space-y-1 text-xs">
                  <div className="flex justify-between"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                  {discountAmount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-{fmt(discountAmount)}</span></div>}
                  <div className="flex justify-between"><span>Tax (15%)</span><span>{fmt(tax)}</span></div>
                  <div className="flex justify-between font-bold text-sm border-t border-[#ABDBE3] pt-1 mt-1"><span>TOTAL</span><span>{fmt(total)}</span></div>
                </div>
                <button onClick={() => window.print()} className="mt-3 w-full rounded-lg bg-[#ABDBE3] py-2 text-xs font-semibold text-[#333333] hover:bg-[#9acbd5] transition-colors">
                  🖨 Print Receipt
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white border-t border-[#DBEFF3] px-4 py-3 flex gap-3 justify-end flex-wrap">
          <button
            onClick={onBack}
            className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
          >
            Cancel Transaction
          </button>
          <button
            onClick={onBack}
            className="rounded-lg px-5 py-2.5 text-sm font-semibold text-[#333333] bg-[#ABDBE3] hover:bg-[#9acbd5] transition-colors"
          >
            ← Back to Sale
          </button>
          <button
            onClick={handleComplete}
            disabled={!isFullyPaid || completing}
            className={`rounded-lg px-8 py-2.5 text-sm font-bold text-white transition-all disabled:cursor-not-allowed ${
              isFullyPaid
                ? "bg-green-500 hover:bg-green-600 shadow-md hover:shadow-lg"
                : "bg-gray-300"
            }`}
          >
            {completing ? "Processing…" : "COMPLETE SALE ✓"}
          </button>
        </div>
      </div>

      {/* Mismatch dialog */}
      {mismatchOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMismatchOpen(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-red-500 px-6 py-4 flex items-center gap-3">
              <span className="text-xl text-white" aria-hidden>⚠</span>
              <h3 className="text-base font-bold text-white">Payment Mismatch</h3>
              <button onClick={() => setMismatchOpen(false)} className="ml-auto text-white/80 hover:text-white" aria-label="Close"><svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/></svg></button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                ⚠ Payment total does not match the bill amount.
              </div>
              <div className="bg-[#DBEFF3] rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-[#666666]">Bill Total</span><span className="font-bold text-[#333333]">{fmt(total)}</span></div>
                <div className="flex justify-between"><span className="text-[#666666]">Amount Paid</span><span className="font-bold text-[#333333]">{fmt(totalPaid)}</span></div>
                <div className="flex justify-between border-t border-[#ABDBE3] pt-2"><span className="text-[#666666]">Remaining</span><span className="text-xl font-bold text-red-600">{fmt(remaining)}</span></div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => quickAddRemaining("cash")} className="flex-1 rounded-lg bg-[#49B0C1] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#3a9baf] transition-colors">
                  💵 Add as Cash
                </button>
                <button onClick={() => quickAddRemaining("card")} className="flex-1 rounded-lg bg-[#ABDBE3] px-4 py-2.5 text-sm font-semibold text-[#333333] hover:bg-[#9acbd5] transition-colors">
                  💳 Add as Card
                </button>
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setMismatchOpen(false)} className="rounded-lg bg-red-500 px-5 py-2 text-sm font-semibold text-white hover:bg-red-600">Cancel Payment</button>
                <button onClick={() => setMismatchOpen(false)} className="rounded-lg bg-[#49B0C1] px-5 py-2 text-sm font-semibold text-white hover:bg-[#3a9baf]">Back to Payments</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Re-export fmt for use in other components
export { fmt };
