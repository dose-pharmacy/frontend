import { useState, useEffect } from "react";
import { ArrowDownRight } from "lucide-react";
import { fmt } from "../../../features/pos/posService";
import { MAX_DISCOUNT_PCT } from "../../../features/pos/posMock";

interface Props {
  total: number;
  currentDiscount: number;
  onApply: (pct: number) => void;
  onClose: () => void;
}

export default function DiscountModal({ total, currentDiscount, onApply, onClose }: Props) {
  const [type, setType] = useState<"item" | "bill">("bill");
  const [pct, setPct] = useState(currentDiscount > 0 ? String(currentDiscount) : "");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const pctNum = parseFloat(pct) || 0;
  const amtNum = parseFloat(amount) || 0;
  const savings = pctNum > 0 ? total * (pctNum / 100) : amtNum;
  const discountedTotal = Math.max(0, total - savings);
  const exceedsLimit = pctNum > MAX_DISCOUNT_PCT;

  useEffect(() => {
    if (pct) setAmount((total * (parseFloat(pct) / 100)).toFixed(2));
  }, [pct, total]);

  useEffect(() => {
    if (amount && !pct) setPct(((parseFloat(amount) / total) * 100).toFixed(1));
  }, [amount, total]);

  function handleApply() {
    if (exceedsLimit) { setError(`Discount exceeds maximum allowed (${MAX_DISCOUNT_PCT}%).`); return; }
    if (pctNum < 0 || pctNum > 100) { setError("Enter a valid discount percentage."); return; }
    onApply(pctNum);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal aria-labelledby="disc-title">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-[#E6ECE2] px-6 py-4 flex items-center justify-between">
          <h2 id="disc-title" className="text-lg font-bold text-[#333333]">Apply Discount</h2>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#333333]/80">{fmt(total)}</span>
            <button onClick={onClose} className="text-[#333333]/80 hover:text-[#333333]" aria-label="Close"><svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/></svg></button>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {/* Discount type */}
          <div className="bg-[#E6ECE2] rounded-xl p-4 flex gap-6">
            {(["bill", "item"] as const).map((t) => (
              <label key={t} className="flex items-start gap-3 cursor-pointer">
                <input type="radio" name="dtype" value={t} checked={type === t} onChange={() => setType(t)} className="mt-0.5 accent-[#B6C8AF]" />
                <div>
                  <p className="text-sm font-semibold text-[#333333] capitalize">{t} Discount</p>
                  <p className="text-xs text-[#666666]">{t === "bill" ? "Apply to entire bill" : "Apply to selected item"}</p>
                </div>
              </label>
            ))}
          </div>

          {/* Inputs */}
          <div className="flex gap-4">
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-xs font-medium text-[#666666]">Percentage (%)</label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={pct}
                  onChange={(e) => { setPct(e.target.value); setAmount(""); setError(null); }}
                  placeholder="0"
                  className="w-full rounded-lg border border-[#C6D4BF] bg-white px-3 py-2.5 pr-8 text-sm focus:border-[#B6C8AF] focus:outline-none"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#666666]">%</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-xs font-medium text-[#666666]">Amount (ETB)</label>
              <input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setPct(""); setError(null); }}
                placeholder="0.00"
                className="w-full rounded-lg border border-[#C6D4BF] bg-white px-3 py-2.5 text-sm focus:border-[#B6C8AF] focus:outline-none"
              />
            </div>
          </div>

          {pctNum > 0 && (
            <p className="text-sm text-green-600 font-medium inline-flex items-center gap-1"><ArrowDownRight className="h-4 w-4" /> Savings: {fmt(savings)}</p>
          )}

          {/* Reason */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#333333]">Reason for Discount</label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Customer bulk purchase, Expiry clearance..."
              className="w-full rounded-lg border border-[#C6D4BF] bg-white px-3.5 py-2.5 text-sm resize-none focus:border-[#B6C8AF] focus:outline-none"
            />
          </div>

          {/* Authorization note */}
          <div className="bg-[#E6ECE2] rounded-lg px-4 py-2.5 flex items-center gap-2 text-sm text-[#333333]">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-[#7A9076] flex-shrink-0" aria-hidden>
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
            </svg>{" "}
            Authorized By: {useCurrentUser()}
          </div>

          {/* Validation */}
          <div className={`rounded-lg border px-4 py-3 ${exceedsLimit ? "bg-red-50 border-red-300" : "bg-yellow-50 border-yellow-300"}`}>
            <p className="text-xs text-[#666666]">Maximum allowed discount: {MAX_DISCOUNT_PCT}%</p>
            {pctNum > 0 && (
              <div className={`flex items-center gap-1.5 text-sm font-semibold mt-1 ${exceedsLimit ? "text-red-600" : "text-green-700"}`}>
                {exceedsLimit ? (
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 flex-shrink-0" aria-hidden>
                    <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 flex-shrink-0" aria-hidden>
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd"/>
                  </svg>
                )}
                <span>Current: {pctNum}% — {exceedsLimit ? "exceeds limit" : "within limit"}</span>
              </div>
            )}
            <div className="mt-2 h-1.5 rounded-full bg-gray-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${exceedsLimit ? "bg-red-500" : pctNum > MAX_DISCOUNT_PCT * 0.8 ? "bg-yellow-400" : "bg-green-500"}`}
                style={{ width: `${Math.min(100, (pctNum / MAX_DISCOUNT_PCT) * 100)}%` }}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* Results preview */}
          {savings > 0 && (
            <div className="flex items-center justify-between rounded-xl bg-[#E6ECE2] px-4 py-3">
              <div>
                <p className="text-xs text-[#666666]">Discounted Total</p>
                <p className="text-xl font-bold text-green-600">{fmt(discountedTotal)}</p>
              </div>
              <p className="text-sm font-semibold text-green-600 inline-flex items-center gap-1"><ArrowDownRight className="h-4 w-4" /> -{fmt(savings)}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#E6ECE2] px-6 py-4 flex gap-3 justify-end bg-white">
          <button onClick={onClose} className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors">Cancel</button>
          <button
            onClick={handleApply}
            disabled={exceedsLimit || pctNum < 0}
            className="rounded-lg px-8 py-2.5 text-sm font-bold text-[#333333] bg-[#B6C8AF] hover:bg-[#A0B59C] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Apply Discount
          </button>
        </div>
      </div>
    </div>
  );
}

function useCurrentUser() {
  try {
    // Session lives in an HTTP-only cookie now; read the cached user
    // snapshot that AuthContext persists alongside it.
    const stored = sessionStorage.getItem("pharmacy_user_cache");
    if (stored) { const u = JSON.parse(stored); return `${u.name} (${u.role})`; }
  } catch {}
  return "Admin (Pharmacist)";
}
