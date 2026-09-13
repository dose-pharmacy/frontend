import { useEffect, useState, useMemo } from "react";
import { CATEGORIES, type POSProduct } from "../../features/pos/posMock";
import { searchProducts, fmt } from "../../features/pos/posService";
import { useCart } from "../../features/pos/useCart";
import { useAuth } from "../../features/auth/AuthContext";
import type { POSUnit } from "../../features/pos/posMock";
import ProductSelectionModal, { ProductIcon } from "./components/ProductSelectionModal";
import PaymentModal from "./components/PaymentModal";
import DiscountModal from "./components/DiscountModal";
import PriceOverrideModal from "./components/PriceOverrideModal";

type Modal = "none" | "product" | "payment" | "discount" | "override";

export default function POSPage() {
  const { user } = useAuth();
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState<POSProduct | null>(null);
  const [modal, setModal] = useState<Modal>("none");
  const [overrideItem, setOverrideItem] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false); // mobile cart toggle
  const [saleComplete, setSaleComplete] = useState(false);
  const [now, setNow] = useState(new Date());

  const cart = useCart();

  // Clock
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  // Load products
  useEffect(() => {
    setLoading(true);
    searchProducts(search, category).then((data) => { setProducts(data); setLoading(false); });
  }, [search, category]);

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

  function handleCompleteSale() {
    cart.clearCart();
    setModal("none");
    setSaleComplete(true);
  }

  if (saleComplete) return (
    <div className="flex flex-1 items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl border border-[#DBEFF3] p-12 text-center max-w-sm w-full shadow-lg">
        <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4 text-3xl">✅</div>
        <h2 className="text-xl font-bold text-[#333333]">Sale Complete!</h2>
        <p className="text-sm text-[#666666] mt-2">Transaction recorded successfully.</p>
        <button onClick={() => setSaleComplete(false)} className="mt-6 rounded-xl bg-[#49B0C1] text-white px-8 py-3 text-sm font-bold hover:bg-[#3a9baf] transition-colors">
          New Sale
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* POS-specific sub-header */}
      <div className="bg-[#49B0C1] px-6 py-2.5 flex items-center justify-between border-t border-white/10">
        <span className="text-sm font-semibold text-white">🏥 Pharmacy POS System</span>
        <span className="text-sm text-white/80">{now.toLocaleTimeString()} · {now.toLocaleDateString()}</span>
        <span className="text-sm text-white/80">Cashier: {user?.name}</span>
      </div>

      {/* Main two-panel layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ─── LEFT PANEL ──────────────────────────────── */}
        <div className={`flex flex-col bg-white flex-1 min-w-0 ${cartOpen ? "hidden lg:flex" : "flex"}`}>
          <div className="p-4 flex flex-col gap-3 border-b border-[#DBEFF3]">
            {/* Search */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#999]" viewBox="0 0 20 20" fill="currentColor" aria-hidden><path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd"/></svg>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by product name, brand, or code..."
                  className="w-full rounded-lg border border-[#ABDBE3] pl-9 pr-4 py-2.5 text-sm text-[#333333] placeholder:text-[#999] focus:border-[#49B0C1] focus:outline-none focus:ring-2 focus:ring-[#49B0C1]/20 transition-all"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999] hover:text-[#333333]" aria-label="Clear search">✕</button>
                )}
              </div>
              <div className="flex gap-1">
                {["By Name", "By Code"].map((label) => (
                  <button key={label} className="rounded-lg bg-[#ABDBE3] px-3 py-2 text-xs font-semibold text-[#333333] hover:bg-[#49B0C1] hover:text-white transition-colors">
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Categories */}
            <div className="bg-[#DBEFF3] rounded-lg px-3 py-2 flex gap-2 overflow-x-auto">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                    category === cat.id
                      ? "bg-[#49B0C1] text-white shadow-sm"
                      : "bg-[#ABDBE3]/60 text-[#333333] hover:bg-[#ABDBE3]"
                  }`}
                >
                  <CategoryIcon icon={cat.icon} />
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="h-40 rounded-xl bg-[#DBEFF3] animate-pulse" />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-16 w-16 rounded-full bg-[#DBEFF3] flex items-center justify-center text-3xl mb-4">🔍</div>
                <p className="text-lg font-semibold text-[#333333]">No products found</p>
                <p className="text-sm text-[#666666] mt-1">Try adjusting your search or category filter</p>
                <button onClick={() => { setSearch(""); setCategory("all"); }} className="mt-4 rounded-lg bg-[#49B0C1] text-white px-5 py-2 text-sm font-semibold hover:bg-[#3a9baf] transition-colors">
                  Clear Filters
                </button>
              </div>
            ) : (
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
                    {/* Product image */}
                    <div className="h-14 w-14 rounded-lg bg-[#DBEFF3] flex items-center justify-center text-[#49B0C1] mb-2 group-hover:bg-[#ABDBE3]/40 transition-colors">
                      <ProductIcon type={p.icon} size={28} />
                    </div>
                    <p className="text-sm font-bold text-[#333333] leading-tight line-clamp-2">{p.name}</p>
                    <p className="text-xs text-[#666666] mt-0.5">{p.brand}</p>

                    <div className="mt-2 flex items-center justify-between w-full">
                      <POSStatusBadge status={p.status} />
                    </div>
                    <p className="text-sm font-bold text-[#49B0C1] mt-1">{fmt(p.units[0]?.price ?? 0)}</p>

                    {/* Add button */}
                    {p.status !== "out_of_stock" && (
                      <div className="absolute bottom-3 right-3 h-7 w-7 rounded-full bg-[#49B0C1] text-white flex items-center justify-center text-lg leading-none shadow-sm group-hover:scale-110 transition-transform">
                        +
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── RIGHT PANEL — CART ──────────────────────── */}
        <div className={`flex flex-col bg-[#DBEFF3] border-l border-[#ABDBE3] w-full lg:w-80 xl:w-96 flex-shrink-0 ${!cartOpen ? "hidden lg:flex" : "flex"}`}>
          {/* Cart header */}
          <div className="bg-[#49B0C1] px-4 py-3 flex items-center justify-between rounded-none">
            <div>
              <p className="text-sm font-bold text-white">Current Sale</p>
              <p className="text-xs text-white/70">{cart.cart.items.length} item{cart.cart.items.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/70">🕐 {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              <button onClick={() => setCartOpen(false)} className="lg:hidden text-white/70 hover:text-white" aria-label="Close cart">✕</button>
            </div>
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto">
            {cart.cart.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                <span className="text-4xl mb-3">🛒</span>
                <p className="text-sm font-semibold text-[#333333]">Cart is empty</p>
                <p className="text-xs text-[#666666] mt-1">Search and add products</p>
              </div>
            ) : (
              <div>
                {cart.cart.items.map((item, i) => (
                  <div key={item.id} className={`flex gap-3 px-4 py-3 border-b border-[#DBEFF3] ${i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/60"}`}>
                    {/* Qty badge */}
                    <div className="h-7 w-7 rounded-full bg-[#49B0C1] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {item.quantity}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#333333] leading-tight truncate">{item.product.name}</p>
                      <p className="text-xs text-[#666666]">{item.unit.name} · {fmt(item.unitPrice)} each</p>
                      {item.discount > 0 && (
                        <p className="text-xs text-green-600">−{item.discount}% discount</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <p className="text-sm font-bold text-[#333333]">{fmt(cart.lineTotal(item))}</p>
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setOverrideItem(item.id); setSelectedProduct(item.product); setModal("override"); }}
                          className="text-[#ABDBE3] hover:text-[#49B0C1] transition-colors text-xs"
                          aria-label="Override price"
                          title="Override price"
                        >✏️</button>
                        <button
                          onClick={() => cart.removeItem(item.id)}
                          className="text-[#ABDBE3] hover:text-red-500 transition-colors text-xs"
                          aria-label="Remove item"
                          title="Remove"
                        >🗑</button>
                      </div>
                      {/* Qty controls */}
                      <div className="flex items-center gap-1">
                        <button onClick={() => cart.updateQuantity(item.id, item.quantity - 1)} className="h-5 w-5 rounded bg-[#ABDBE3] text-xs font-bold hover:bg-[#9acbd5] transition-colors">−</button>
                        <span className="text-xs w-5 text-center font-semibold">{item.quantity}</span>
                        <button onClick={() => cart.updateQuantity(item.id, item.quantity + 1)} className="h-5 w-5 rounded bg-[#49B0C1] text-white text-xs font-bold hover:bg-[#3a9baf] transition-colors">+</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals & actions */}
          <div className="bg-white border-t-2 border-[#49B0C1] p-4 flex flex-col gap-3">
            {/* Breakdown */}
            <div className="flex flex-col gap-1.5 text-sm">
              <TotalRow label="Subtotal" value={fmt(cart.subtotal)} />
              <TotalRow label={`Tax (15%)`} value={fmt(cart.tax)} />
              {cart.cart.billDiscount > 0 && (
                <TotalRow label={`Discount (${cart.cart.billDiscount}%)`} value={`-${fmt(cart.discountAmount)}`} green />
              )}
              <div className="flex items-center justify-between rounded-lg bg-[#DBEFF3] px-3 py-2 mt-1">
                <span className="text-base font-bold text-[#333333]">TOTAL</span>
                <span className="text-2xl font-bold text-[#49B0C1]">{fmt(cart.total)}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setModal("discount")}
                disabled={cart.cart.items.length === 0}
                className="rounded-lg bg-[#ABDBE3] px-2 py-2.5 text-xs font-semibold text-[#333333] hover:bg-[#9acbd5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                % Discount
              </button>
              <button
                onClick={() => alert("Override requires item selection")}
                disabled={cart.cart.items.length === 0}
                className="rounded-lg bg-[#ABDBE3] px-2 py-2.5 text-xs font-semibold text-[#333333] hover:bg-[#9acbd5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ✏️ Override
              </button>
              <button
                onClick={cart.clearCart}
                disabled={cart.cart.items.length === 0}
                className="rounded-lg bg-red-500 px-2 py-2.5 text-xs font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                🗑 Clear
              </button>
            </div>

            <button
              onClick={() => setModal("payment")}
              disabled={cart.cart.items.length === 0}
              className={`w-full rounded-xl py-4 text-base font-bold text-white transition-all ${
                cart.cart.items.length > 0
                  ? "bg-[#49B0C1] hover:bg-[#3a9baf] shadow-md hover:shadow-lg active:scale-[0.98]"
                  : "bg-gray-300 cursor-not-allowed"
              }`}
            >
              💳 PAY {cart.cart.items.length > 0 ? fmt(cart.total) : ""}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile cart FAB */}
      {!cartOpen && cart.cart.items.length > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="lg:hidden fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full bg-[#49B0C1] text-white px-5 py-3 text-sm font-bold shadow-xl hover:bg-[#3a9baf] transition-all"
        >
          🛒 View Cart ({cart.cart.items.length}) · {fmt(cart.total)}
        </button>
      )}

      {/* Modals */}
      {modal === "product" && selectedProduct && (
        <ProductSelectionModal
          product={selectedProduct}
          onAdd={handleAddToCart}
          onClose={() => { setModal("none"); setSelectedProduct(null); }}
        />
      )}

      {modal === "payment" && (
        <PaymentModal
          total={cart.total}
          subtotal={cart.subtotal}
          tax={cart.tax}
          discountAmount={cart.discountAmount}
          items={cart.cart.items}
          lineTotal={cart.lineTotal}
          onComplete={handleCompleteSale}
          onBack={() => setModal("none")}
        />
      )}

      {modal === "discount" && (
        <DiscountModal
          total={cart.subtotal}
          currentDiscount={cart.cart.billDiscount}
          onApply={(pct) => cart.applyBillDiscount(pct)}
          onClose={() => setModal("none")}
        />
      )}

      {modal === "override" && selectedProduct && overrideItem && (
        <PriceOverrideModal
          productName={selectedProduct.name}
          originalPrice={selectedProduct.units[0]?.price ?? 0}
          onConfirm={(newPrice) => {
            // In a real system this would update the item's price via an API call
            alert(`Price override recorded: ${fmt(newPrice)} for ${selectedProduct.name} (mock — backend pending)`);
          }}
          onClose={() => { setModal("none"); setOverrideItem(null); setSelectedProduct(null); }}
        />
      )}
    </div>
  );
}

function TotalRow({ label, value, green = false }: { label: string; value: string; green?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-sm ${green ? "text-green-600" : "text-[#666666]"}`}>{label}</span>
      <span className={`text-sm font-semibold ${green ? "text-green-600" : "text-[#333333]"}`}>{value}</span>
    </div>
  );
}

function POSStatusBadge({ status }: { status: string }) {
  if (status === "in_stock") return <span className="text-xs font-medium text-green-700">✓ In Stock</span>;
  if (status === "low_stock") return <span className="text-xs font-medium text-yellow-600">⚠ Low Stock</span>;
  return <span className="text-xs font-medium text-gray-400">✕ Out of Stock</span>;
}

function CategoryIcon({ icon }: { icon: string }) {
  const icons: Record<string, string> = {
    grid: "⊞", pill: "💊", flask: "🧪", drop: "💧", shield: "🛡", heart: "❤️",
  };
  return <span className="text-xs" aria-hidden>{icons[icon] ?? "•"}</span>;
}
