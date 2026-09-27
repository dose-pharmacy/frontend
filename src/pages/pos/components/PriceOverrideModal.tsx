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
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-6 w-6 text-white" aria-hidden>
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
          </svg>
          <h2 id="po-title" className="text-base font-bold text-white flex-1">Price Override Authorization</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white" aria-label="Close"><svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/></svg></button>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {/* Warning */}
          <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 flex items-start gap-2">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-yellow-700 flex-shrink-0 mt-0.5" aria-hidden>
              <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd"/>
            </svg>
            <span>You are attempting to override the price of a product. This action will be recorded in the audit log.</span>
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
                  {showPwd ? (
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
                      <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.78zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.515a4 4 0 00-5.478-5.48zm-1.499 1.5a6 6 0 106.479 6.479l1.514 1.515A7.96 7.96 0 0110 17c-4.478 0-8.268-2.943-9.542-7a9.958 9.958 0 012.633-4.119l1.378 1.378z" clipRule="evenodd"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                    </svg>
                  )}
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
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-[#7A9076] flex-shrink-0" aria-hidden>
              <path fillRule="evenodd" d="M8 2a1 1 0 000 2h4a1 1 0 100-2H8zM4 3a1 1 0 011-1h.5a1 1 0 011 1v1h7V3a1 1 0 011-1h.5a1 1 0 011 1v1a3 3 0 012 3v9a3 3 0 01-3 3H5a3 3 0 01-3-3V7a3 3 0 012-3V3zm4.25 5.75a.75.75 0 000 1.5h3.5a.75.75 0 000-1.5h-3.5zM6 12a.75.75 0 01.75-.75h6.5a.75.75 0 010 1.5h-6.5A.75.75 0 016 12z" clipRule="evenodd"/>
            </svg>{" "}
            This action will be recorded in the audit log.
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
            <span className="inline-flex items-center gap-1.5">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd"/>
              </svg>
              Confirm Override
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
