import { useState } from "react";
import type { POSProduct, POSUnit } from "../../../features/pos/posMock";
import { fmt } from "../../../features/pos/posService";
import NarcoticBadge from "../../../components/ui/NarcoticBadge";

interface Props {
  product: POSProduct;
  onAdd: (unit: POSUnit, quantity: number) => void;
  onClose: () => void;
}

export default function ProductSelectionModal({ product, onAdd, onClose }: Props) {
  // Default to base unit if possible
  const defaultUnit = product.units.find((u) => u.isBaseUnit) ?? product.units[0];
  const [selectedUnit, setSelectedUnit] = useState<POSUnit>(defaultUnit);
  const [quantity, setQuantity] = useState(1);

  const isOutOfStock = product.status === "out_of_stock" || product.availableStock <= 0;
  const maxQty = selectedUnit
    ? (selectedUnit.isBaseUnit
        ? product.availableStock
        : Math.floor(product.availableStock / selectedUnit.conversionFactor))
    : 0;
  const totalPrice = (selectedUnit?.price ?? 0) * quantity;

  function decrement() { setQuantity((q) => Math.max(1, q - 1)); }
  function increment() { setQuantity((q) => Math.min(Math.max(1, maxQty), q + 1)); }

  function handleAdd() {
    if (!selectedUnit || isOutOfStock) return;
    onAdd(selectedUnit, quantity);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal aria-labelledby="ps-title">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="bg-[#49B0C1] px-6 py-4 flex items-center justify-between">
          <h2 id="ps-title" className="text-base font-bold text-white">Add to Sale</h2>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors" aria-label="Close">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Product info */}
        <div className="bg-[#DBEFF3] px-6 py-4 flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-white/70 flex items-center justify-center text-[#49B0C1] flex-shrink-0">
            <ProductIcon type={product.icon} size={28} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-[#333333] text-base leading-tight">
              {product.name}
              {product.isNarcotic && <NarcoticBadge className="ml-2 align-middle" />}
            </h3>
            {product.brand && product.brand !== "—" && (
              <p className="text-sm text-[#666666]">{product.brand}</p>
            )}
            <StockBadge status={product.status} availableStock={product.availableStock} />
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-lg font-bold text-[#49B0C1]">{fmt(selectedUnit?.price ?? 0)}</p>
            <p className="text-xs text-[#666666]">per {selectedUnit?.name}</p>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {/* Unit selection */}
          {product.units.length > 1 && (
            <div>
              <p className="text-sm font-semibold text-[#666666] mb-2">Select Unit</p>
              <div className="flex flex-wrap gap-2">
                {product.units.map((u) => {
                  const unitAvail = u.isBaseUnit
                    ? product.availableStock
                    : Math.floor(product.availableStock / u.conversionFactor);
                  return (
                    <button
                      key={u.id}
                      onClick={() => { setSelectedUnit(u); setQuantity(1); }}
                      disabled={unitAvail <= 0}
                      className={`flex flex-col items-start rounded-lg border-2 px-4 py-2.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                        selectedUnit?.id === u.id
                          ? "border-[#49B0C1] bg-[#DBEFF3]"
                          : "border-[#ABDBE3] bg-white hover:border-[#49B0C1] hover:bg-[#DBEFF3]/50"
                      }`}
                    >
                      <span className="text-sm font-bold text-[#333333]">{u.name}</span>
                      <span className="text-xs text-[#49B0C1] font-semibold">{fmt(u.price)}</span>
                      <span className="text-xs text-[#999]">{unitAvail} avail.</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div>
            <p className="text-sm font-semibold text-[#666666] mb-2">Quantity</p>
            <div className="flex items-center gap-3">
              <button
                onClick={decrement}
                disabled={quantity <= 1}
                className="h-9 w-9 rounded-full bg-[#ABDBE3] text-[#333333] flex items-center justify-center hover:bg-[#9acbd5] transition-colors disabled:opacity-40 text-xl font-bold leading-none"
                aria-label="Decrease quantity"
              >
                −
              </button>
              <input
                type="number"
                value={quantity}
                min={1}
                max={maxQty}
                onChange={(e) => {
                  const v = Math.min(maxQty, Math.max(1, Number(e.target.value)));
                  setQuantity(isNaN(v) ? 1 : v);
                }}
                className="w-16 text-center rounded-lg border border-[#ABDBE3] py-1.5 text-base font-bold focus:border-[#49B0C1] focus:outline-none"
              />
              <button
                onClick={increment}
                disabled={quantity >= maxQty}
                className="h-9 w-9 rounded-full bg-[#49B0C1] text-white flex items-center justify-center hover:bg-[#3a9baf] transition-colors disabled:opacity-40 text-xl font-bold leading-none"
                aria-label="Increase quantity"
              >
                +
              </button>
              <span className="text-xs text-[#666666]">Max: {maxQty}</span>
            </div>
          </div>

          {/* Price preview */}
          <div className="flex items-center justify-between rounded-lg bg-[#DBEFF3] px-4 py-3">
            <span className="text-sm text-[#666666]">Total</span>
            <span className="text-xl font-bold text-[#49B0C1]">{fmt(totalPrice)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[#DBEFF3] px-6 py-4 flex gap-3 justify-end bg-white">
          <button
            onClick={onClose}
            className="rounded-lg px-6 py-2.5 text-sm font-semibold text-[#333333] bg-[#ABDBE3] hover:bg-[#9acbd5] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={isOutOfStock || quantity <= 0 || !selectedUnit}
            className="rounded-lg px-8 py-2.5 text-sm font-bold text-white bg-[#49B0C1] hover:bg-[#3a9baf] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add to Sale
          </button>
        </div>
      </div>
    </div>
  );
}

function StockBadge({ status, availableStock }: { status: string; availableStock: number }) {
  if (status === "in_stock") return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 mt-1">
      In Stock · {availableStock} units
    </span>
  );
  if (status === "low_stock") return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 mt-1">
      Low Stock · {availableStock} units
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 mt-1">
      Out of Stock
    </span>
  );
}

export function ProductIcon({ type, size = 24 }: { type: string; size?: number }) {
  const s = size;
  if (type === "pill") return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
    </svg>
  );
  if (type === "drop") return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3C12 3 5.25 10.5 5.25 14.25a6.75 6.75 0 0013.5 0C18.75 10.5 12 3 12 3z" />
    </svg>
  );
  if (type === "shield") return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
  if (type === "heart") return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  );
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  );
}
