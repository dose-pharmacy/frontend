// ── PurchaseOrderSelect ──────────────────────────────────────────────────────
// Accessible custom dropdown for choosing a Purchase Order, with a hover/focus
// preview of the products the order contains.
//
// A native <select> cannot render rich per-option content, so this mirrors the
// established `SearchableSelect` pattern (portal + outside-click + Escape +
// flip-above-viewport + arrow-key navigation) and adds a preview panel. Visual
// language is kept identical to the rest of the purchasing screens.
//
// The preview is read-only and never `pointer-events`, so it can never block
// selecting an order. It shows only INVOICE-ELIGIBLE products — items with
// `quantityRemainingToInvoice > 0` — because that is what this workflow bills.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { createPortal } from "react-dom"
import type { POItemDto, PurchaseOrderDto } from "../../features/purchasing/purchaseOrdersApi"

// ── Shared status presentation (also used by the invoice page's side panel) ──

const PO_STATUS_BADGE: Record<string, string> = {
  AWAITING_DELIVERY: "bg-yellow-100 text-yellow-700",
  PARTIALLY_RECEIVED: "bg-orange-100 text-orange-700",
  RECEIVED: "bg-green-100 text-green-700",
  CLOSED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-100 text-red-700",
}

/** `PARTIALLY_RECEIVED` → `PARTIALLY RECEIVED` (the enum stays authoritative). */
export function poStatusLabel(status: string): string {
  return status.replace(/_/g, " ")
}

export function PoStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${PO_STATUS_BADGE[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      {poStatusLabel(status)}
    </span>
  )
}

// ── Invoice-eligibility helpers ──────────────────────────────────────────────

/**
 * Items that can still be billed on this PO.
 *
 * `quantityRemainingToInvoice` is the backend's own figure and is authoritative.
 * When the field is absent (list rows loaded without items) we never guess from
 * `quantityReceived` — fully invoiced items would then look billable.
 */
export function invoiceableItems(po: PurchaseOrderDto | null): POItemDto[] {
  return (po?.items ?? []).filter(
    (it) => (it.quantityRemainingToInvoice ?? 0) > 0,
  )
}

/** Short unit label for a PO item (name, or symbol when there is no name). */
export function unitLabel(item: POItemDto): string {
  return item.unit?.name || item.unit?.symbol || ""
}

function fmtQty(n: number | undefined): string {
  const v = n ?? 0
  return Number.isInteger(v) ? String(v) : String(Number(v.toFixed(2)))
}

// ── Component ────────────────────────────────────────────────────────────────

/** Compact per-product line inside the preview. */
function PreviewProduct({ item }: { item: POItemDto }) {
  const unit = unitLabel(item)
  const received = fmtQty(item.quantityReceived)
  const invoiced = fmtQty(item.quantityInvoiced)
  const billable = fmtQty(item.quantityRemainingToInvoice)
  const ordered = fmtQty(item.quantityOrdered)
  return (
    <li className="px-3 py-1.5">
      <p className="truncate text-xs font-semibold text-[#333333]">
        {item.product?.name ?? "Unnamed product"}
      </p>
      {item.product?.sku && (
        <p className="truncate text-[10px] text-[#999]">{item.product.sku}</p>
      )}
      <p className="mt-0.5 text-[11px] text-[#666666]">
        Received:{" "}
        <span className="font-semibold text-[#333333]">{received}</span>
        <span className="text-[#999]"> / {ordered}</span>
        {unit && <span className="text-[#999]"> {unit}</span>}
        {invoiced !== "0" && (
          <span className="text-[#999]"> · invoiced {invoiced}</span>
        )}
      </p>
      <p className="text-[11px] text-[#666666]">
        To invoice:{" "}
        <span className="font-semibold text-[#7A9076]">{billable}</span>
        {unit && <span className="text-[#999]"> {unit}</span>}
      </p>
    </li>
  )
}

/** The hover/focus preview panel body. Purely presentational. */
function PoPreview({ po }: { po: PurchaseOrderDto | null }) {
  if (!po) return null
  const billable = invoiceableItems(po)
  const totalBillable = billable.reduce(
    (n, it) => n + (it.quantityRemainingToInvoice ?? 0),
    0,
  )
  const totalCount = po.items?.length ?? 0

  return (
    <div className="flex w-[300px] shrink-0 flex-col border-l border-[#E6ECE2]">
      <div className="flex items-center justify-between gap-2 border-b border-[#E6ECE2] bg-[#E6ECE2]/40 px-3 py-2">
        <p className="truncate text-xs font-bold text-[#333333]">
          {po.poNumber}
        </p>
        <PoStatusBadge status={po.status} />
      </div>

      <div className="flex items-center justify-between px-3 pt-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-[#7A9076]">
          Products
        </p>
        {billable.length > 0 && (
          <p className="text-[10px] text-[#666666]">
            {fmtQty(totalBillable)} billable
          </p>
        )}
      </div>

      <div className="max-h-52 overflow-y-auto py-1">
        {po.items === undefined ? (
          <p className="px-3 py-2 text-[11px] text-[#999]">
            Products are not loaded for this order.
          </p>
        ) : billable.length === 0 ? (
          <p className="px-3 py-2 text-[11px] text-[#999]">
            {totalCount === 0
              ? "This order has no products."
              : "No received goods are awaiting invoicing on this order."}
          </p>
        ) : (
          <>
            <ul className="divide-y divide-[#E6ECE2]/70">
              {billable.slice(0, 6).map((it) => (
                <PreviewProduct key={it.id} item={it} />
              ))}
            </ul>
            {billable.length > 6 && (
              <p className="px-3 py-1.5 text-[11px] font-semibold text-[#7A9076]">
                + {billable.length - 6} more product
                {billable.length - 6 === 1 ? "" : "s"}
              </p>
            )}
          </>
        )}
      </div>

      <div className="border-t border-[#E6ECE2] px-3 py-1.5 text-[10px] text-[#999]">
        {totalCount > 0 ? `${totalCount} product${totalCount === 1 ? "" : "s"} on this order` : ""}
        {totalCount > 0 && billable.length > 0 && " · "}
        {billable.length} awaiting invoicing
      </div>
    </div>
  )
}

interface PurchaseOrderSelectProps {
  value: string | null
  onChange: (value: string) => void
  /** Orders to choose from (already filtered by the caller). */
  options: PurchaseOrderDto[]
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  disabled?: boolean
  placeholder?: string
  emptyMessage?: string
  noResultsMessage?: string
  /** Rendered under the trigger — e.g. the "no invoiceable orders" hint. */
  footerHint?: React.ReactNode
  id?: string
}

export default function PurchaseOrderSelect({
  value,
  onChange,
  options,
  loading = false,
  error = null,
  onRetry,
  disabled = false,
  placeholder = "Select purchase order...",
  emptyMessage = "No purchase orders found",
  noResultsMessage = "No purchase orders matching your search",
  footerHint,
  id,
}: PurchaseOrderSelectProps) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState("")
  const [highlight, setHighlight] = useState(-1)
  const [anchor, setAnchor] = useState<{
    left: number
    top: number
    width: number
    flip: boolean
  } | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const measure = useCallback(() => {
    const el = buttonRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setAnchor({ left: r.left, top: r.bottom + 4, width: r.width, flip: false })
  }, [])

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (rootRef.current && rootRef.current.contains(t)) return
      if (panelRef.current && panelRef.current.contains(t)) return
      setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  // Keep the portal anchored to the trigger while open (scroll/resize).
  useEffect(() => {
    if (!open) return undefined
    measure()
    window.addEventListener("scroll", measure, true)
    window.addEventListener("resize", measure)
    return () => {
      window.removeEventListener("scroll", measure, true)
      window.removeEventListener("resize", measure)
    }
  }, [open, measure])

  // Flip the panel above the trigger when it would overflow the viewport.
  useLayoutEffect(() => {
    if (!open || !anchor || anchor.flip) return
    const el = panelRef.current
    const btn = buttonRef.current
    if (!el || !btn) return
    const r = btn.getBoundingClientRect()
    if (r.bottom + el.offsetHeight > window.innerHeight - 8) {
      setAnchor((a) =>
        a && !a.flip
          ? { ...a, top: Math.max(8, r.top - el.offsetHeight - 4), flip: true }
          : a,
      )
    }
  }, [open, anchor])

  const selected = options.find((o) => o.id === value) ?? null

  // Client-side filtering: PO number, supplier name or status.
  const visibleOptions = useMemo(() => {
    const t = term.trim().toLowerCase()
    if (!t) return options
    return options.filter((o) =>
      [o.poNumber, o.supplier?.name, poStatusLabel(o.status)]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(t)),
    )
  }, [options, term])

  // Preview follows the keyboard highlight so focus users get the same info.
  const previewPo =
    (highlight >= 0 ? visibleOptions[highlight] : null) ?? null

  const toggle = () => {
    const next = !open
    if (next) {
      measure()
      setOpen(true)
      setTerm("")
      setHighlight(options.findIndex((o) => o.id === value))
      requestAnimationFrame(() => inputRef.current?.focus())
    } else {
      setOpen(false)
    }
  }

  const choose = (po: PurchaseOrderDto) => {
    onChange(po.id)
    setOpen(false)
    setTerm("")
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false)
      buttonRef.current?.focus()
      return
    }
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlight((h) => (h + 1) % Math.max(visibleOptions.length, 1))
      return
    }
    if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlight(
        (h) => (h - 1 + visibleOptions.length) % Math.max(visibleOptions.length, 1),
      )
      return
    }
    if (e.key === "Home" && visibleOptions.length) {
      e.preventDefault()
      setHighlight(0)
      return
    }
    if (e.key === "End" && visibleOptions.length) {
      e.preventDefault()
      setHighlight(visibleOptions.length - 1)
      return
    }
    if (e.key === "Enter") {
      const target = visibleOptions[highlight]
      if (target) {
        e.preventDefault()
        choose(target)
      } else if (visibleOptions.length === 1) {
        choose(visibleOptions[0])
      }
    }
  }

  // Keep the highlight inside the filtered result set.
  useEffect(() => {
    if (!open) return
    setHighlight((h) => (h >= visibleOptions.length ? visibleOptions.length - 1 : h))
  }, [open, term, visibleOptions.length])

  const listId = id ? `${id}-list` : "po-select-list"
  const previewId = id ? `${id}-preview` : "po-select-preview"

  return (
    <div className="flex flex-col gap-1.5">
      <div ref={rootRef} className="relative">
        <button
          type="button"
          id={id}
          ref={buttonRef}
          disabled={disabled}
          onClick={toggle}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-left text-sm transition-all flex items-center justify-between gap-2 ${
            disabled
              ? "bg-[#F5F4EE] text-[#999] cursor-not-allowed"
              : "border-[#C6D4BF] hover:border-[#B6C8AF] focus:border-[#B6C8AF] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/20"
          }`}
        >
          <span className="flex items-center gap-1.5 min-w-0">
            {selected ? (
              <>
                <span className="text-[#333333] truncate">
                  {selected.poNumber}
                </span>
                <PoStatusBadge status={selected.status} />
              </>
            ) : (
              <span className="text-[#999] truncate">
                {loading ? "Loading purchase orders..." : placeholder}
              </span>
            )}
          </span>
          <svg
            className={`h-4 w-4 shrink-0 text-[#999] transition-transform ${open ? "rotate-180" : ""}`}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {open &&
          anchor &&
          createPortal(
            <div
              ref={panelRef}
              className="z-[60] flex overflow-hidden rounded-lg border border-[#C6D4BF] bg-white shadow-lg"
              style={{
                position: "fixed",
                top: anchor.top,
                left: Math.max(8, Math.min(anchor.left, window.innerWidth - 344)),
                width: Math.max(anchor.width, 520),
              }}
            >
              <div className="flex w-[220px] shrink-0 flex-col">
                <div className="border-b border-[#E6ECE2] p-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Search purchase orders..."
                    aria-controls={listId}
                    role="combobox"
                    aria-expanded={open}
                    aria-activedescendant={
                      highlight >= 0 && visibleOptions[highlight]
                        ? `${listId}-${highlight}`
                        : undefined
                    }
                    aria-autocomplete="list"
                    className="w-full rounded-md border border-[#C6D4BF] px-3 py-2 text-sm text-[#333333] placeholder:text-[#999] focus:border-[#B6C8AF] focus:outline-none focus:ring-2 focus:ring-[#B6C8AF]/20"
                  />
                </div>

                <div
                  id={listId}
                  role="listbox"
                  aria-label="Purchase orders"
                  className="max-h-64 overflow-y-auto py-1"
                >
                  {loading ? (
                    <p className="px-4 py-3 text-sm text-[#666666]">
                      Loading purchase orders...
                    </p>
                  ) : error ? (
                    <div className="px-4 py-3">
                      <p className="text-sm text-red-500">{error}</p>
                      {onRetry && (
                        <button
                          type="button"
                          onClick={onRetry}
                          className="mt-1 text-xs font-semibold text-[#7A9076] hover:underline"
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  ) : visibleOptions.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-[#999]">
                      {term ? noResultsMessage : emptyMessage}
                    </p>
                  ) : (
                    visibleOptions.map((po, index) => {
                      const billable = invoiceableItems(po)
                      const isActive = index === highlight
                      return (
                        <div
                          key={po.id}
                          role="option"
                          aria-selected={po.id === value}
                          id={`${listId}-${index}`}
                          onMouseEnter={() => setHighlight(index)}
                          onClick={() => choose(po)}
                          className={`cursor-pointer px-3 py-2 ${
                            isActive ? "bg-[#E6ECE2]" : "hover:bg-[#E6ECE2]/60"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span
                              className={`truncate text-sm ${po.id === value ? "font-bold text-[#333333]" : "text-[#333333]"}`}
                            >
                              {po.poNumber}
                            </span>
                            <span
                              className={`text-[9px] font-semibold ${billable.length > 0 ? "text-[#7A9076]" : "text-[#C8C8C8]"}`}
                            >
                              {billable.length > 0
                                ? `${billable.length} billable`
                                : "no billable items"}
                            </span>
                          </div>
                          <p className="truncate text-[10px] text-[#999]">
                            {poStatusLabel(po.status)}
                          </p>
                        </div>
                      )
                    })
                  )}
                </div>

                <p className="border-t border-[#E6ECE2] px-3 py-1.5 text-[10px] text-[#999]">
                  Hover or arrow-key a purchase order to preview its products.
                </p>
              </div>

              {/* pointer-events-none: the preview can never swallow a click. */}
              <div
                id={previewId}
                aria-live="polite"
                className="pointer-events-none"
              >
                {previewPo ? (
                  <PoPreview po={previewPo} />
                ) : (
                  <div className="flex h-full min-h-[9rem] w-[300px] items-center justify-center px-4 text-center text-[11px] text-[#999]">
                    Hover over a purchase order to see the products it
                    contains.
                  </div>
                )}
              </div>
            </div>,
            document.body,
          )}
      </div>
      {footerHint}
    </div>
  )
}