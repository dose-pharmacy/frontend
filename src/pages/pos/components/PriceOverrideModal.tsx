import { useState } from "react";
import { fmt } from "../../../features/pos/posService";

interface Props {
  productName: string;
  originalPrice: number;
  onConfirm: (newPrice: number, reason: string) => void;
  onClose: () => void;
}

export default function PriceOverrideModal({ productName, originalPrice, onConfirm, onClose }: Props) {
  const [newPrice, setNewPrice] = useState(String(originalPrice));
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const newPriceNum = parseFloat(newPrice) || 0;
  const diff = newPriceNum - originalPrice;
  const diffPct = originalPrice > 0 ? (diff / originalPrice) * 100 : 0;

  function handleConfirm() {
    if (!password) { setError("Authorization password is required."); return; }
    if (!reason.trim()) { setError("Please provide a reason for the override."); return; }
    if (newPriceNum <= 0) { setError("New price must be greater than zero."); return; }
    onConfirm(newPriceNum, reason);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal aria-labelledby="po-title">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-orange-500 px-6 py-4 flex items-center gap-3">
          <span className="text-xl text-white" aria-hidden>⚠</span>
          <h2 id="po-title" className="text-base font-bold text-white flex-1">Price Override Authorization</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Close"><svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/></svg></button>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {/* Warning */}
          <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            🔒 You are attempting to override the price of a product. This action will be recorded in the audit log.
          </div>

          {/* Product info */}
          <div className="bg-[#E6ECE2] rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
            <div className="col-span-2">
              <p className="text-xs text-[#666666]">Product</p>
              <p className="font-bold text-[#333333] text-base">{productName}</p>
            </div>
            <div>
              <p className="text-xs text-[#666666]">Original Price</p>
              <p className="font-semibold text-[#666666] line-through">{fmt(originalPrice)}</p>
            </div>
            <div>
              <p className="text-xs text-[#666666]">New Price</p>
              <input
                type="number"
                min={0}
                value={newPrice}
                onChange={(e) => { setNewPrice(e.target.value); setError(null); }}
                className="w-full rounded-lg border border-[#C6D4BF] bg-white px-3 py-1.5 text-sm font-bold text-red-600 focus:border-[#B6C8AF] focus:outline-none"
              />
            </div>
            {newPriceNum > 0 && newPriceNum !== originalPrice && (
              <div className="col-span-2">
                <p className="text-xs text-[#666666]">Difference</p>
                <p className={`font-bold text-sm ${diff < 0 ? "text-red-600" : "text-green-600"}`}>
                  {diff >= 0 ? "+" : ""}{fmt(diff)} ({diffPct.toFixed(1)}%)
                </p>
              </div>
            )}
          </div>

          {/* Auth fields */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#333333]">Authorization Password</label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null); }}
                  placeholder="Enter supervisor password"
                  className="w-full rounded-lg border border-[#C6D4BF] bg-white px-3.5 py-2.5 pr-11 text-sm focus:border-[#B6C8AF] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/20"
                />
                <button type="button" onClick={() => setShowPwd((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666666] hover:text-[#7A9076]" aria-label="Toggle password">
                  {showPwd ? "🙈" : "👁"}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#333333]">Reason for Override</label>
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => { setReason(e.target.value); setError(null); }}
                placeholder="e.g., Expiry approaching — clearance sale"
                className="w-full rounded-lg border border-[#C6D4BF] bg-white px-3.5 py-2.5 text-sm resize-none focus:border-[#B6C8AF] focus:outline-none"
              />
            </div>
          </div>

          {/* Security note */}
          <div className="bg-[#E6ECE2] rounded-lg px-4 py-2.5 text-xs text-[#666666] flex items-center gap-2">
            <span>📋</span> This action will be recorded in the audit log.
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {/* Footer */}
        <div className="border-t border-[#E6ECE2] px-6 py-4 flex gap-3 justify-end bg-[#E6ECE2]">
          <button onClick={onClose} className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors">Cancel</button>
          <button
            onClick={handleConfirm}
            disabled={!password}
            className="rounded-lg px-6 py-2.5 text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ✓ Confirm Override
          </button>
        </div>
      </div>
    </div>
  );
}
