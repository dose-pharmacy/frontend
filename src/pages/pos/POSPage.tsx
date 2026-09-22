import { useEffect, useRef, useState } from "react";
import type { POSProduct } from "../../features/pos/posMock";
import { getPosProducts, adaptPosProduct, PosApiError } from "../../features/pos/posApi";
import type { PosProductsMeta } from "../../features/pos/posApi";
import { listProductGroups } from "../../features/inventory/productGroupsApi";
import type { ProductGroupDto } from "../../features/inventory/productGroupsApi";
import { listLocations } from "../../features/inventory/locationsApi";
import { completeSale } from "../../features/sales/salesApi";
import { fmt } from "../../features/pos/posService";
import { useCart, type BillDiscount } from "../../features/pos/useCart";
import { useAuth } from "../../features/auth/AuthContext";
import type { POSUnit } from "../../features/pos/posMock";
import ProductSelectionModal, { ProductIcon } from "./components/ProductSelectionModal";
import PaymentModal from "./components/PaymentModal";
import NarcoticBadge from "../../components/ui/NarcoticBadge";

type Modal = "none" | "product" | "payment";

const PAGE_SIZE = 20;

// ─── Toast component ──────────────────────────────────────────────────────────

function Toast({
  message,
  type = "success",
  onDismiss,
}: {
  message: string;
  type?: "success" | "error";
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl px-5 py-3 shadow-xl text-white text-sm font-semibold animate-in fade-in slide-in-from-bottom-4 duration-300 ${
        type === "success" ? "bg-green-600" : "bg-red-600"
      }`}
    >
      <span aria-hidden>{type === "success" ? "✓" : "✕"}</span>
      {message}
      <button
        onClick={onDismiss}
        className="ml-2 opacity-70 hover:opacity-100"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function POSPage() {
  const { user } = useAuth();

  // Products
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [meta, setMeta] = useState<PosProductsMeta>({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters / pagination
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [retryTick, setRetryTick] = useState(0);

  // Reference data
  const [groups, setGroups] = useState<ProductGroupDto[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);

  // UI state
  const [selectedProduct, setSelectedProduct] = useState<POSProduct | null>(null);
  const [modal, setModal] = useState<Modal>("none");
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [now, setNow] = useState(new Date());

  const cart = useCart();

  // Discount inline UI state
  const [discountType, setDiscountType] = useState<"PERCENTAGE" | "FIXED_AMOUNT">("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState("");

  // Clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Load groups and locations once
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listProductGroups({ isActive: true, limit: 100 }),
      listLocations({ isActive: true, limit: 100 }),
    ])
      .then(([groupRes, locRes]) => {
        if (cancelled) return;
        setGroups(groupRes.data.filter((g) => g.isActive));
        const locs = locRes.data.filter((l) => l.isActive);
        setLocations(locs);
        if (locs.length > 0) setSelectedLocation(locs[0].id);
      })
      .catch(() => {
        if (cancelled) return;
      });
    return () => { cancelled = true; };
  }, []);

  // Debounced product fetch
  const searchRef = useRef(search);
  searchRef.current = search;

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      setLoading(true);
      getPosProducts({
        page,
        limit: PAGE_SIZE,
        search: search.trim() || undefined,
        productGroupId: selectedGroupId || undefined,
        locationId: selectedLocation || undefined,
      })
        .then((res) => {
          if (cancelled) return;
          setProducts(res.data.map(adaptPosProduct));
          setMeta(res.meta);
          setLoadError(null);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setLoadError(
            err instanceof PosApiError ? err.message : "Failed to load products. Please try again."
          );
        })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, search !== searchRef.current ? 0 : 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search, selectedGroupId, selectedLocation, page, retryTick]);

  // Reset to page 1 when any filter changes
  useEffect(() => { setPage(1); }, [search, selectedGroupId, selectedLocation]);

  // Apply/clear discount
  function applyDiscount() {
    const v = parseFloat(discountValue);
    if (!discountValue || isNaN(v) || v <= 0) {
      cart.setBillDiscount(null);
      return;
    }
    const bill: BillDiscount = { type: discountType, value: v };
    cart.setBillDiscount(bill);
  }

  function clearDiscount() {
    cart.setBillDiscount(null);
    setDiscountValue("");
  }

  function handleProductClick(p: POSProduct) {
    if (p.status === "out_of_stock") return;
    setSelectedProduct(p);
    setModal("product");
  }

  function handleAddToCart(unit: POSUnit, quantity: number) {
    if (!selectedProduct) return;
    cart.addItem(selectedProduct, unit, quantity);
    setSelectedProduct(null);
    setModal("none");
  }

  async function handleCompleteSale(
    payments: { method: "CASH" | "CARD" | "DIGITAL_TRANSFER"; amount: number; reference?: string }[]
  ) {
    if (!selectedLocation) {
      setToast({ message: "Please select a location first.", type: "error" });
      return;
    }
    const input = {
      locationId: selectedLocation,
      items: cart.cart.items.map((item) => ({
        productId: item.product.id,
        unitId: item.unit.id, // ProductUnit row id
        quantity: item.quantity,
        actualUnitPrice: item.unitPrice !== item.unit.price ? item.unitPrice : undefined,
      })),
      payments,
      billDiscount: cart.cart.billDiscount ?? undefined,
    };
    await completeSale(input);
    cart.clearCart();
    setDiscountValue("");
    setModal("none");
    setCartOpen(false);
    setToast({ message: "Sale completed successfully!", type: "success" });
    setRetryTick((t) => t + 1);
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      )}

      {/* POS sub-header */}
      <div className="bg-[#49B0C1] px-6 py-2.5 flex items-center justify-between border-t border-white/10">
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-white">Pharmacy POS</span>
          <select
            value={selectedLocation}
            onChange={(e) => { setSelectedLocation(e.target.value); setPage(1); }}
            className="text-xs bg-white/20 text-white border border-white/30 rounded-lg px-2.5 py-1.5 focus:outline-none focus:bg-white focus:text-[#333333] transition-colors"
          >
            {locations.length === 0 && <option value="">Loading locations...</option>}
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>
        <span className="text-xs text-white/80">
          {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {now.toLocaleDateString()}
        </span>
        <span className="text-xs text-white/80">Cashier: {user?.name}</span>
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ─── LEFT: Product browser ──────────────────────── */}
        <div className={`flex flex-col bg-white flex-1 min-w-0 ${cartOpen ? "hidden lg:flex" : "flex"}`}>
          {/* Filters row */}
          <div className="p-4 flex flex-col gap-3 border-b border-[#DBEFF3]">
            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#999]" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, brand, SKU..."
                className="w-full rounded-lg border border-[#ABDBE3] pl-9 pr-4 py-2.5 text-sm text-[#333333] placeholder:text-[#999] focus:border-[#49B0C1] focus:outline-none focus:ring-2 focus:ring-[#49B0C1]/20 transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999] hover:text-[#333333]"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Product groups */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setSelectedGroupId("")}
                className={`flex items-center whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                  selectedGroupId === ""
                    ? "bg-[#49B0C1] text-white shadow-sm"
                    : "bg-[#ABDBE3]/60 text-[#333333] hover:bg-[#ABDBE3]"
                }`}
              >
                All Products
              </button>
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGroupId(g.id)}
                  className={`flex items-center whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                    selectedGroupId === g.id
                      ? "bg-[#49B0C1] text-white shadow-sm"
                      : "bg-[#ABDBE3]/60 text-[#333333] hover:bg-[#ABDBE3]"
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            {loadError ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-lg font-semibold text-[#333333]">Couldn't load products</p>
                <p className="text-sm text-red-600 mt-1 max-w-sm">{loadError}</p>
                <button
                  onClick={() => setRetryTick((t) => t + 1)}
                  className="mt-4 rounded-lg bg-[#49B0C1] text-white px-5 py-2 text-sm font-semibold hover:bg-[#3a9baf] transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-40 rounded-xl bg-[#DBEFF3] animate-pulse" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-lg font-semibold text-[#333333]">No products found</p>
                <p className="text-sm text-[#666666] mt-1">Try adjusting your search or group filter</p>
                <button
                  onClick={() => { setSearch(""); setSelectedGroupId(""); }}
                  className="mt-4 rounded-lg bg-[#49B0C1] text-white px-5 py-2 text-sm font-semibold hover:bg-[#3a9baf] transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {products.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleProductClick(p)}
                      disabled={p.status === "out_of_stock"}
                      className={`relative flex flex-col items-start rounded-xl border p-3 text-left transition-all group ${
                        p.status === "out_of_stock"
                          ? "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
                          : "border-[#DBEFF3] bg-white hover:border-[#49B0C1] hover:shadow-md"
                      }`}
                    >
                      {p.isNarcotic && (
                        <NarcoticBadge className="absolute top-2 right-2" />
                      )}
                      <div className="h-12 w-12 rounded-lg bg-[#DBEFF3] flex items-center justify-center text-[#49B0C1] mb-2 group-hover:bg-[#ABDBE3]/40 transition-colors">
                        <ProductIcon type={p.icon} size={24} />
                      </div>
                      <p className="text-sm font-bold text-[#333333] leading-tight line-clamp-2">{p.name}</p>
                      {p.brand !== "—" && <p className="text-xs text-[#666666] mt-0.5">{p.brand}</p>}
                      <div className="mt-2 flex items-center justify-between w-full gap-1">
                        <POSStatusBadge status={p.status} />
                        <span className="text-xs text-[#999]">{p.availableStock} avail.</span>
                      </div>
                      <p className="text-sm font-bold text-[#49B0C1] mt-1">{fmt(p.units.find((u) => u.isBaseUnit)?.price ?? p.units[0]?.price ?? 0)}</p>
                      {p.status !== "out_of_stock" && (
                        <div className="absolute bottom-3 right-3 h-6 w-6 rounded-full bg-[#49B0C1] text-white flex items-center justify-center text-base leading-none shadow-sm group-hover:scale-110 transition-transform">
                          +
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {/* Pagination */}
                {meta.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="rounded-lg border border-[#ABDBE3] px-3 py-1.5 text-xs font-semibold text-[#333333] hover:bg-[#DBEFF3] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-xs text-[#666666]">
                      Page {meta.page} of {meta.totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                      disabled={page >= meta.totalPages}
                      className="rounded-lg border border-[#ABDBE3] px-3 py-1.5 text-xs font-semibold text-[#333333] hover:bg-[#DBEFF3] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                    <span className="text-xs text-[#999]">{meta.total} products</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ─── RIGHT: Cart ──────────────────────────────── */}
        <div className={`flex flex-col bg-[#DBEFF3] border-l border-[#ABDBE3] w-full lg:w-80 xl:w-96 flex-shrink-0 ${!cartOpen ? "hidden lg:flex" : "flex"}`}>
          {/* Cart header */}
          <div className="bg-[#49B0C1] px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white">Current Sale</p>
              <p className="text-xs text-white/70">{cart.cart.items.length} item{cart.cart.items.length !== 1 ? "s" : ""}</p>
            </div>
            <button
              onClick={() => setCartOpen(false)}
              className="lg:hidden text-white/70 hover:text-white"
              aria-label="Close cart"
            >
              ✕
            </button>
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto">
            {cart.cart.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                <svg className="h-10 w-10 text-[#ABDBE3] mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                </svg>
                <p className="text-sm font-semibold text-[#333333]">Cart is empty</p>
                <p className="text-xs text-[#666666] mt-1">Search and add products</p>
              </div>
            ) : (
              <div>
                {cart.cart.items.map((item, i) => (
                  <div key={item.id} className={`px-4 py-3 border-b border-[#DBEFF3] ${i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/60"}`}>
                    <div className="flex gap-3">
                      {/* Left: info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#333333] leading-tight truncate">
                          {item.product.name}
                          {item.product.isNarcotic && <NarcoticBadge className="ml-1 align-middle" />}
                        </p>
                        <p className="text-xs text-[#666666] mt-0.5">{item.unit.name} · {fmt(item.unitPrice)}/unit</p>
                      </div>
                      {/* Right: total + remove */}
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <p className="text-sm font-bold text-[#333333]">{fmt(cart.lineTotal(item))}</p>
                        <button
                          onClick={() => cart.removeItem(item.id)}
                          className="text-[#ABDBE3] hover:text-red-500 transition-colors"
                          aria-label="Remove item"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {/* Qty controls */}
                    <div className="flex items-center gap-1 mt-2">
                      <button
                        onClick={() => cart.updateQuantity(item.id, item.quantity - 1)}
                        className="h-6 w-6 rounded bg-[#ABDBE3] text-xs font-bold hover:bg-[#9acbd5] transition-colors"
                      >
                        −
                      </button>
                      <span className="text-xs w-8 text-center font-semibold">{item.quantity}</span>
                      <button
                        onClick={() => cart.updateQuantity(item.id, item.quantity + 1)}
                        className="h-6 w-6 rounded bg-[#49B0C1] text-white text-xs font-bold hover:bg-[#3a9baf] transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals & actions */}
          <div className="bg-white border-t-2 border-[#49B0C1] p-4 flex flex-col gap-3">
            {/* Subtotal */}
            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[#666666]">Subtotal</span>
                <span className="font-semibold text-[#333333]">{fmt(cart.subtotal)}</span>
              </div>

              {/* Inline discount control */}
              <div className="rounded-lg border border-[#ABDBE3] p-2.5 flex flex-col gap-2">
                <p className="text-xs font-semibold text-[#666666]">Bill Discount</p>
                <div className="flex gap-2">
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as "PERCENTAGE" | "FIXED_AMOUNT")}
                    className="flex-shrink-0 rounded border border-[#ABDBE3] px-2 py-1 text-xs focus:border-[#49B0C1] focus:outline-none"
                  >
                    <option value="PERCENTAGE">%</option>
                    <option value="FIXED_AMOUNT">Fixed</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    max={discountType === "PERCENTAGE" ? 100 : undefined}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder="0"
                    className="flex-1 min-w-0 rounded border border-[#ABDBE3] px-2 py-1 text-xs focus:border-[#49B0C1] focus:outline-none"
                  />
                  <button
                    onClick={applyDiscount}
                    disabled={cart.cart.items.length === 0}
                    className="rounded bg-[#49B0C1] text-white px-2.5 py-1 text-xs font-semibold hover:bg-[#3a9baf] disabled:opacity-40 transition-colors"
                  >
                    Apply
                  </button>
                  {cart.cart.billDiscount && (
                    <button
                      onClick={clearDiscount}
                      className="rounded bg-[#ABDBE3] text-[#333333] px-2 py-1 text-xs font-semibold hover:bg-[#9acbd5] transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {cart.cart.billDiscount && cart.discountAmount > 0 && (
                  <p className="text-xs text-green-600">
                    − {fmt(cart.discountAmount)} discount applied
                  </p>
                )}
              </div>

              {/* Total */}
              <div className="flex items-center justify-between rounded-lg bg-[#DBEFF3] px-3 py-2 mt-1">
                <span className="text-base font-bold text-[#333333]">TOTAL</span>
                <span className="text-2xl font-bold text-[#49B0C1]">{fmt(cart.total)}</span>
              </div>
            </div>

            {/* Action row */}
            <div className="flex gap-2">
              <button
                onClick={cart.clearCart}
                disabled={cart.cart.items.length === 0}
                className="flex-1 rounded-lg bg-[#ABDBE3] px-3 py-2.5 text-xs font-semibold text-[#333333] hover:bg-[#9acbd5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Clear
              </button>
              <button
                onClick={() => setModal("payment")}
                disabled={cart.cart.items.length === 0}
                className={`flex-[2] rounded-xl py-2.5 text-sm font-bold text-white transition-all ${
                  cart.cart.items.length > 0
                    ? "bg-[#49B0C1] hover:bg-[#3a9baf] shadow-md hover:shadow-lg active:scale-[0.98]"
                    : "bg-gray-300 cursor-not-allowed"
                }`}
              >
                Pay {cart.cart.items.length > 0 ? fmt(cart.total) : ""}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile cart FAB */}
      {!cartOpen && cart.cart.items.length > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="lg:hidden fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full bg-[#49B0C1] text-white px-5 py-3 text-sm font-bold shadow-xl hover:bg-[#3a9baf] transition-all"
        >
          Cart ({cart.cart.items.length}) · {fmt(cart.total)}
        </button>
      )}

      {/* Product selection modal */}
      {modal === "product" && selectedProduct && (
        <ProductSelectionModal
          product={selectedProduct}
          onAdd={handleAddToCart}
          onClose={() => { setModal("none"); setSelectedProduct(null); }}
        />
      )}

      {/* Payment modal */}
      {modal === "payment" && (
        <PaymentModal
          total={cart.total}
          subtotal={cart.subtotal}
          discountAmount={cart.discountAmount}
          billDiscount={cart.cart.billDiscount}
          items={cart.cart.items}
          lineTotal={cart.lineTotal}
          onComplete={handleCompleteSale}
          onBack={() => setModal("none")}
        />
      )}
    </div>
  );
}

function POSStatusBadge({ status }: { status: string }) {
  if (status === "in_stock") return <span className="text-xs font-medium text-green-700">In Stock</span>;
  if (status === "low_stock") return <span className="text-xs font-medium text-yellow-600">Low Stock</span>;
  return <span className="text-xs font-medium text-gray-400">Out of Stock</span>;
}
