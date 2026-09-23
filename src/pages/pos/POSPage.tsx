import { useEffect, useRef, useState } from "react"
import { CheckCircle2, Minus, Plus, Search, X, XCircle } from "lucide-react"
import type { POSProduct } from "../../features/pos/posMock"
import {
  getPosProducts,
  adaptPosProduct,
  PosApiError,
} from "../../features/pos/posApi"
import type { PosProductsMeta } from "../../features/pos/posApi"
import { listProductGroups } from "../../features/inventory/productGroupsApi"
import type { ProductGroupDto } from "../../features/inventory/productGroupsApi"
import { listLocations } from "../../features/inventory/locationsApi"
import { completeSale } from "../../features/sales/salesApi"
import { fmt } from "../../features/pos/posService"
import { useCart, type BillDiscount } from "../../features/pos/useCart"
import type { POSUnit } from "../../features/pos/posMock"
import ProductSelectionModal, {
  ProductIcon,
} from "./components/ProductSelectionModal"
import PaymentModal from "./components/PaymentModal"
import Pagination from "../../components/ui/Pagination"

type Modal = "none" | "product" | "payment"

const PAGE_SIZE = 20

// ─── Toast component ──────────────────────────────────────────────────────────

function Toast({
  message,
  type = "success",
  onDismiss,
}: {
  message: string
  type?: "success" | "error"
  onDismiss: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl px-5 py-3 shadow-xl text-white text-sm font-semibold animate-in fade-in slide-in-from-bottom-4 duration-300 ${
        type === "success" ? "bg-green-600" : "bg-red-600"
      }`}
    >
      <span aria-hidden>
        {type === "success" ? (
          <CheckCircle2 className="h-5 w-5" />
        ) : (
          <XCircle className="h-5 w-5" />
        )}
      </span>
      {message}
      <button
        onClick={onDismiss}
        className="ml-2 opacity-70 hover:opacity-100"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export default function POSPage() {
  // Products
  const [products, setProducts] = useState<POSProduct[]>([])
  const [meta, setMeta] = useState<PosProductsMeta>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Filters / pagination
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [selectedGroupId, setSelectedGroupId] = useState<string>("")
  const [selectedLocation, setSelectedLocation] = useState("")
  const [retryTick, setRetryTick] = useState(0)

  // Reference data
  const [groups, setGroups] = useState<ProductGroupDto[]>([])
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([])

  // UI state
  const [selectedProduct, setSelectedProduct] = useState<POSProduct | null>(
    null,
  )
  const [modal, setModal] = useState<Modal>("none")
  const [cartOpen, setCartOpen] = useState(false)
  const [toast, setToast] = useState<{
    message: string
    type: "success" | "error"
  } | null>(null)

  const cart = useCart()

  // Discount inline UI state
  const [discountType, setDiscountType] =
    useState<"PERCENTAGE" | "FIXED_AMOUNT">("PERCENTAGE")
  const [discountValue, setDiscountValue] = useState("")

  // Load groups and locations once
  useEffect(() => {
    let cancelled = false
    Promise.all([
      listProductGroups({ isActive: true, limit: 100 }),
      listLocations({ isActive: true, limit: 100 }),
    ])
      .then(([groupRes, locRes]) => {
        if (cancelled) return
        setGroups(groupRes.data.filter((g) => g.isActive))
        const locs = locRes.data.filter((l) => l.isActive)
        setLocations(locs)
        if (locs.length > 0) setSelectedLocation(locs[0].id)
      })
      .catch(() => {
        if (cancelled) return
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Debounced product fetch
  const searchRef = useRef(search)
  searchRef.current = search

  useEffect(() => {
    let cancelled = false
    const t = setTimeout(
      () => {
        setLoading(true)
        getPosProducts({
          page,
          limit: PAGE_SIZE,
          search: search.trim() || undefined,
          productGroupId: selectedGroupId || undefined,
          locationId: selectedLocation || undefined,
        })
          .then((res) => {
            if (cancelled) return
            setProducts(res.data.map(adaptPosProduct))
            setMeta(res.meta)
            setLoadError(null)
          })
          .catch((err: unknown) => {
            if (cancelled) return
            setLoadError(
              err instanceof PosApiError
                ? err.message
                : "Failed to load products. Please try again.",
            )
          })
          .finally(() => {
            if (!cancelled) setLoading(false)
          })
      },
      search !== searchRef.current ? 0 : 300,
    )
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [search, selectedGroupId, selectedLocation, page, retryTick])

  // Reset to page 1 when any filter changes
  useEffect(() => {
    setPage(1)
  }, [search, selectedGroupId, selectedLocation])

  // Apply/clear discount
  function applyDiscount() {
    const v = parseFloat(discountValue)
    if (!discountValue || isNaN(v) || v <= 0) {
      cart.setBillDiscount(null)
      return
    }
    const bill: BillDiscount = { type: discountType, value: v }
    cart.setBillDiscount(bill)
  }

  function clearDiscount() {
    cart.setBillDiscount(null)
    setDiscountValue("")
  }

  function handleProductClick(p: POSProduct) {
    if (p.status === "out_of_stock") return
    setSelectedProduct(p)
    setModal("product")
  }

  function handleAddToCart(unit: POSUnit, quantity: number) {
    if (!selectedProduct) return
    cart.addItem(selectedProduct, unit, quantity)
    setSelectedProduct(null)
    setModal("none")
  }

  async function handleCompleteSale(
    payments: {
      method: "CASH" | "CARD" | "DIGITAL_TRANSFER"
      amount: number
      reference?: string
    }[],
  ) {
    if (!selectedLocation) {
      setToast({ message: "Please select a location first.", type: "error" })
      return
    }
    const input = {
      locationId: selectedLocation,
      items: cart.cart.items.map((item) => ({
        productId: item.product.id,
        unitId: item.unit.id, // ProductUnit row id
        quantity: item.quantity,
        actualUnitPrice:
          item.unitPrice !== item.unit.price ? item.unitPrice : undefined,
      })),
      payments,
      billDiscount: cart.cart.billDiscount ?? undefined,
    }
    await completeSale(input)
    cart.clearCart()
    setDiscountValue("")
    setModal("none")
    setCartOpen(false)
    setToast({ message: "Sale completed successfully!", type: "success" })
    setRetryTick((t) => t + 1)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-[#FAF9F4]">
      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* POS header */}
      <div className="bg-white border-b border-[#E6ECE2] px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-[#333333]">
            Point of Sale
          </span>
          <div className="h-4 w-px bg-[#E6ECE2]" />
          <select
            value={selectedLocation}
            onChange={(e) => {
              setSelectedLocation(e.target.value)
              setPage(1)
            }}
            className="text-xs text-[#333333] border border-[#E6ECE2] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#B6C8AF] transition-colors"
            aria-label="Select location"
          >
            {locations.length === 0 && (
              <option value="">Loading locations...</option>
            )}
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ─── LEFT: Product browser ──────────────────────── */}
        <div
          className={`flex flex-col flex-1 min-w-0 ${
            cartOpen ? "hidden lg:flex" : "flex"
          }`}
        >
          {/* Filters row */}
          <div className="px-6 pt-5 pb-3 flex flex-col gap-3 flex-shrink-0">
            {/* Search */}
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#999]"
                aria-hidden
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, brand, SKU..."
                className="w-full rounded-lg border border-[#E6ECE2] bg-white pl-9 pr-9 py-2.5 text-sm text-[#333333] placeholder:text-[#999] focus:border-[#B6C8AF] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/15 transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999] hover:text-[#333333]"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Product groups */}
            <div className="flex gap-1 overflow-x-auto pb-0.5">
              <button
                onClick={() => setSelectedGroupId("")}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs transition-colors ${
                  selectedGroupId === ""
                    ? "bg-[#E6ECE2] text-[#4F6B4A] font-semibold"
                    : "text-[#666666] font-medium hover:bg-[#E6ECE2]/60 hover:text-[#333333]"
                }`}
              >
                All
              </button>
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGroupId(g.id)}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs transition-colors ${
                    selectedGroupId === g.id
                      ? "bg-[#E6ECE2] text-[#4F6B4A] font-semibold"
                      : "text-[#666666] font-medium hover:bg-[#E6ECE2]/60 hover:text-[#333333]"
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>

          {/* Product grid */}
          <div className="flex-1 overflow-y-auto px-6 pb-6 flex flex-col gap-4">
            {loadError ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-lg font-semibold text-[#333333]">
                  Couldn't load products
                </p>
                <p className="text-sm text-red-600 mt-1 max-w-sm">
                  {loadError}
                </p>
                <button
                  onClick={() => setRetryTick((t) => t + 1)}
                  className="mt-4 rounded-lg bg-[#B6C8AF] text-[#333333] px-5 py-2 text-sm font-semibold hover:bg-[#A0B59C] transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {[...Array(10)].map((_, i) => (
                  <div
                    key={i}
                    className="h-32 rounded-xl bg-white border border-[#E6ECE2] animate-pulse"
                  />
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <p className="text-lg font-semibold text-[#333333]">
                  No products found
                </p>
                <p className="text-sm text-[#666666] mt-1">
                  Try adjusting your search or group filter
                </p>
                <button
                  onClick={() => {
                    setSearch("")
                    setSelectedGroupId("")
                  }}
                  className="mt-4 rounded-lg bg-[#B6C8AF] text-[#333333] px-5 py-2 text-sm font-semibold hover:bg-[#A0B59C] transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {products.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleProductClick(p)}
                      disabled={p.status === "out_of_stock"}
                      className={`relative flex flex-col items-start rounded-xl border bg-white p-3.5 text-left transition-all ${
                        p.status === "out_of_stock"
                          ? "border-[#E6ECE2] opacity-50 cursor-not-allowed"
                          : "border-[#E6ECE2] hover:border-[#C6D4BF] hover:shadow-sm"
                      }`}
                    >
                      <div className="mb-2.5 text-[#7A9076]">
                        <ProductIcon type={p.icon} size={24} />
                      </div>
                      <p className="text-sm font-semibold text-[#333333] leading-snug line-clamp-2">
                        {p.name}
                      </p>
                      {p.status === "out_of_stock" && (
                        <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-[#999]">
                          Out of stock
                        </p>
                      )}
                      <div className="mt-1.5 flex w-full items-center justify-between gap-2">
                        <span className="text-base font-bold text-[#4F6B4A]">
                          {fmt(p.units[0]?.price ?? 0)}
                        </span>
                        {p.status === "low_stock" && (
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-amber-400"
                            title="Low stock"
                            aria-label="Low stock"
                          />
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Pagination */}
                <Pagination
                  page={page}
                  totalPages={meta.totalPages}
                  onPageChange={setPage}
                  total={meta.total}
                  pageSize={PAGE_SIZE}
                  itemLabel="products"
                />
              </>
            )}
          </div>
        </div>

        {/* ─── RIGHT: Cart ──────────────────────────────── */}
        <div
          className={`flex flex-col bg-white border-l border-[#E6ECE2] w-full lg:w-80 xl:w-96 flex-shrink-0 ${
            !cartOpen ? "hidden lg:flex" : "flex"
          }`}
        >
          {/* Cart header */}
          <div className="border-b border-[#E6ECE2] px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div>
              <p className="text-sm font-semibold text-[#333333]">
                Current Sale
              </p>
              <p className="text-xs text-[#666666]">
                {cart.cart.items.length} item
                {cart.cart.items.length !== 1 ? "s" : ""}
              </p>
            </div>
            <button
              onClick={() => setCartOpen(false)}
              className="lg:hidden text-[#333333]/70 hover:text-[#333333]"
              aria-label="Close cart"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Cart items */}
          <div className="flex-1 overflow-y-auto">
            {cart.cart.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                <svg
                  className="h-9 w-9 text-[#C6D4BF] mb-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
                  />
                </svg>
                <p className="text-sm font-semibold text-[#333333]">
                  Cart is empty
                </p>
                <p className="text-xs text-[#666666] mt-1">
                  Search and add products
                </p>
              </div>
            ) : (
              <div>
                {cart.cart.items.map((item) => (
                  <div
                    key={item.id}
                    className="px-4 py-3 border-b border-[#E6ECE2]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-[#333333] leading-tight truncate">
                        {item.product.name}
                      </p>
                      <button
                        onClick={() => cart.removeItem(item.id)}
                        className="text-[#C6D4BF] hover:text-red-500 transition-colors flex-shrink-0"
                        aria-label={`Remove ${item.product.name}`}
                      >
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden
                        >
                          <path
                            fillRule="evenodd"
                            d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>
                    <p className="text-xs text-[#666666] mt-0.5">
                      {item.unit.name} · {fmt(item.unitPrice)}/unit
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() =>
                            cart.updateQuantity(item.id, item.quantity - 1)
                          }
                          className="h-6 w-6 rounded-md border border-[#E6ECE2] text-[#666666] flex items-center justify-center hover:bg-[#E6ECE2] hover:text-[#333333] transition-colors"
                          aria-label="Decrease quantity"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-7 text-center text-xs font-semibold text-[#333333]">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            cart.updateQuantity(item.id, item.quantity + 1)
                          }
                          className="h-6 w-6 rounded-md border border-[#E6ECE2] text-[#666666] flex items-center justify-center hover:bg-[#E6ECE2] hover:text-[#333333] transition-colors"
                          aria-label="Increase quantity"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="text-sm font-semibold text-[#333333]">
                        {fmt(cart.lineTotal(item))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totals & actions */}
          <div className="border-t border-[#E6ECE2] p-4 flex flex-col gap-3 flex-shrink-0">
            <div className="flex flex-col gap-2.5 text-sm">
              {/* Subtotal */}
              <div className="flex items-center justify-between">
                <span className="text-[#666666]">Subtotal</span>
                <span className="font-medium text-[#333333]">
                  {fmt(cart.subtotal)}
                </span>
              </div>

              {/* Inline discount control */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-[#666666]">
                  Discount
                </span>
                <select
                  value={discountType}
                  onChange={(e) =>
                    setDiscountType(
                      e.target.value as "PERCENTAGE" | "FIXED_AMOUNT",
                    )
                  }
                  className="flex-shrink-0 rounded-md border border-[#E6ECE2] px-1.5 py-1 text-xs focus:border-[#B6C8AF] focus:outline-none"
                  aria-label="Discount type"
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
                  className="w-16 rounded-md border border-[#E6ECE2] px-2 py-1 text-xs focus:border-[#B6C8AF] focus:outline-none"
                />
                <button
                  onClick={applyDiscount}
                  disabled={cart.cart.items.length === 0}
                  className="rounded-md border border-[#B6C8AF] px-2.5 py-1 text-xs font-semibold text-[#4F6B4A] hover:bg-[#B6C8AF] hover:text-[#333333] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Apply
                </button>
                {cart.cart.billDiscount && (
                  <button
                    onClick={clearDiscount}
                    className="rounded-md p-1 text-[#666666] hover:text-red-500 transition-colors"
                    aria-label="Clear discount"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Applied discount readout */}
              {cart.cart.billDiscount && cart.discountAmount > 0 && (
                <div className="flex items-center justify-between text-green-600">
                  <span>
                    Discount (
                    {cart.cart.billDiscount.type === "PERCENTAGE"
                      ? `${cart.cart.billDiscount.value}%`
                      : `${fmt(cart.cart.billDiscount.value)} fixed`}
                    )
                  </span>
                  <span>− {fmt(cart.discountAmount)}</span>
                </div>
              )}

              {/* Total */}
              <div className="flex items-center justify-between border-t border-[#E6ECE2] pt-2.5 mt-0.5">
                <span className="text-sm font-semibold text-[#333333]">
                  Total
                </span>
                <span className="text-2xl font-bold text-[#4F6B4A]">
                  {fmt(cart.total)}
                </span>
              </div>
            </div>

            {/* Action row */}
            <div className="flex gap-2">
              <button
                onClick={cart.clearCart}
                disabled={cart.cart.items.length === 0}
                className="flex-1 rounded-lg border border-[#E6ECE2] px-3 py-2.5 text-xs font-semibold text-[#666666] hover:bg-[#FAF9F4] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Clear
              </button>
              <button
                onClick={() => setModal("payment")}
                disabled={cart.cart.items.length === 0}
                className={`flex-[2] rounded-xl py-2.5 text-sm font-bold text-[#333333] transition-all ${
                  cart.cart.items.length > 0
                    ? "bg-[#B6C8AF] hover:bg-[#A0B59C] shadow-sm hover:shadow-md active:scale-[0.98]"
                    : "bg-gray-200 cursor-not-allowed"
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
          className="lg:hidden fixed bottom-6 right-6 z-30 flex items-center gap-2 rounded-full bg-[#B6C8AF] text-[#333333] px-5 py-3 text-sm font-bold shadow-xl hover:bg-[#A0B59C] transition-all"
        >
          Cart ({cart.cart.items.length}) · {fmt(cart.total)}
        </button>
      )}

      {/* Product selection modal */}
      {modal === "product" && selectedProduct && (
        <ProductSelectionModal
          product={selectedProduct}
          onAdd={handleAddToCart}
          onClose={() => {
            setModal("none")
            setSelectedProduct(null)
          }}
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
  )
}
