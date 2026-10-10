// ── Purchase Requirements (product-oriented) ─────────────────────────────────

// The main purchasing screen is now a flat list of REQUIREMENT LINES (one row =

// one product inside one requirement) fetched from

//     GET /api/v1/purchase/requirement-lines

// so purchasers can search, filter by status and select individual products to

// order. The Order confirmation modal and the create/generate/edit/close flows

// are the existing ones, reused here.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import PageHeader from "../../components/ui/PageHeader"

import Modal from "../../components/ui/Modal"

import SearchInput from "../../components/ui/SearchInput"

import Button from "../../components/ui/Button"

import Pagination from "../../components/ui/Pagination"

import DatePicker from "../../components/ui/DatePicker"

import EmptyState from "../../components/ui/EmptyState"

import { TableSkeleton } from "../../components/ui/Skeleton"

import RequirementPreviewCard from "../../components/purchasing/RequirementPreviewCard"

import SearchableSelect from "../../components/ui/SearchableSelect"

import {
  Toast,
  StatusPill,
  SC,
  Fw,
  reasonCode,
  type LineReason,
  ConfirmModal,
  EditRequirementModal,
  AddProductModal,
  EditLineModal,
  OrderPreviewModal,
} from "./requirementShared"

import RequirementLineDetailScreen from "./RequirementLineDetailScreen"

import {
  listRequirementLines,
  isLineOrderable,
  isRequestCancelled,
  toRequirementLineRow,
  type RequirementLineRow,
  type RequirementLineListMeta,
} from "../../features/purchasing/requirementLinesApi"

import {
  createRequirement,
  previewRequirement,
  RequirementsApiError,
  type CreateRequirementInput,
  type RequirementPreviewResult,
  type RequirementActionDto,
} from "../../features/purchasing/requirementsApi";

import {
  listProducts,
  getProductUnits,
  type ProductDto,
  type ProductUnitDto,
} from "../../features/inventory/productsApi"

import { getReorderSuggestions } from "../../features/inventory/reorderApi"

import { useProductUnits } from "../../features/inventory/useProductUnits"

import GenerateRequirementsModal, {
  type ReorderSuggestion,
} from "../inventory/ReorderReq"

import { quantityWithUnit, rangeLabel } from "../../utils/format"

// ─── Shared constants ────────────────────────────────────────────────────────

const PAGE_SIZE = 20

type TabKey = "active" | "OPEN" | "PARTIALLY_FULFILLED" | "FULFILLED" | "CLOSED"

const TABS: { key: TabKey; label: string }[] = [
  { key: "active", label: "All Active" },

  { key: "OPEN", label: "Open" },

  { key: "PARTIALLY_FULFILLED", label: "Partially Fulfilled" },

  { key: "FULFILLED", label: "Fulfilled" },

  { key: "CLOSED", label: "Closed" },
]

/** The backend filters by a single `status`; "All Active" sends none so the
 *  server returns its default view (OPEN + PARTIALLY_FULFILLED). */

function statusForTab(tab: TabKey): string | undefined {
  return tab === "active" ? undefined : tab
}

function errMessage(e: unknown): string {
  return e instanceof RequirementsApiError
    ? e.message
    : "Something went wrong. Please try again."
}

/** Debounce a rapidly-changing value (search box). */

function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)

    return () => clearTimeout(t)
  }, [value, delay])

  return debounced
}

// ─── Orderable line handed to the (reused) Order modal ───────────────────────

interface OrderableLine {
  lineId: string

  productId: string

  productName: string

  productBrand: string

  productSku: string

  unitId: string | null

  unitName: string

  requirementReference: string

  requiredQuantity: number

  orderedQuantity: number

  remainingToOrder: number
}

function toOrderable(line: RequirementLineRow): OrderableLine {
  return {
    lineId: line.id,

    productId: line.productId,

    productName: line.productName,

    productBrand: line.productBrand,

    productSku: line.productSku,

    unitId: line.unitId,

    unitName: line.unitName,

    requirementReference: line.requirementReference,

    requiredQuantity: line.requiredQuantity,

    orderedQuantity: line.orderedQuantity,

    remainingToOrder: line.remainingToOrder,
  }
}

// ─── Root page ───────────────────────────────────────────────────────────────

export default function PurchaseRequirementsPage() {
  const [rows, setRows] = useState<RequirementLineRow[]>([])

  const [meta, setMeta] = useState<RequirementLineListMeta>({
    page: 1,

    limit: PAGE_SIZE,

    total: 0,

    totalPages: 1,
  })

  const [loading, setLoading] = useState(true)

  const [loadError, setLoadError] = useState("")

  const [tab, setTab] = useState<TabKey>("active")

  const [search, setSearch] = useState("")

  const debouncedSearch = useDebounced(search, 300)

  const [page, setPage] = useState(1)

  const [reloadTick, setReloadTick] = useState(0)

  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [detailLineId, setDetailLineId] = useState<string | null>(null)

  const [toast, setToast] = useState("")

  const [newOpen, setNewOpen] = useState(false)

  const [generateOpen, setGenerateOpen] = useState(false)

  const [orderLines, setOrderLines] = useState<OrderableLine[] | null>(null)

  const showToast = useCallback((msg: string) => setToast(msg), [])

  const reload = useCallback(() => setReloadTick((t) => t + 1), [])

  // Reset pagination + selection whenever the query scope changes.

  useEffect(() => {
    setPage(1)
  }, [tab, debouncedSearch])

  useEffect(() => {
    setSelected(new Set())
  }, [tab, debouncedSearch, page])

  // Stale-request guard: a monotonically increasing id plus an AbortController,

  // so an older response can never overwrite a newer one (rapid tab/search

  // changes, or pagination while a fetch is in flight).

  const requestSeq = useRef(0)

  useEffect(() => {
    const seq = ++requestSeq.current

    const controller = new AbortController()

    setLoading(true)

    setLoadError("")

    listRequirementLines(
      {
        page,

        limit: PAGE_SIZE,

        search: debouncedSearch.trim() || undefined,

        status: statusForTab(tab),

        sortBy: "createdAt",

        sortOrder: "desc",
      },

      { signal: controller.signal },
    )

      .then((result) => {
        if (seq !== requestSeq.current) return

        setRows(result.data.map(toRequirementLineRow))

        setMeta(result.meta)
      })

      .catch((e) => {
        if (seq !== requestSeq.current || isRequestCancelled(e)) return

        setLoadError(errMessage(e))
      })

      .finally(() => {
        if (seq === requestSeq.current) setLoading(false)
      })

    return () => controller.abort()
  }, [tab, debouncedSearch, page, reloadTick])

  const lineRows = rows

  const eligibleRows = useMemo(
    () => lineRows.filter((l) => isLineOrderable(l)),

    [lineRows],
  )

  const selectedEligible = useMemo(
    () => eligibleRows.filter((l) => selected.has(l.id)),

    [eligibleRows, selected],
  )

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)

      if (next.has(id)) next.delete(id)
      else next.add(id)

      return next
    })
  }

  function toggleAllOnPage() {
    const allSelected =
      eligibleRows.length > 0 && eligibleRows.every((l) => selected.has(l.id))

    setSelected((prev) => {
      const next = new Set(prev)

      if (allSelected) eligibleRows.forEach((l) => next.delete(l.id))
      else eligibleRows.forEach((l) => next.add(l.id))

      return next
    })
  }

  const allEligibleSelected =
    eligibleRows.length > 0 && eligibleRows.every((l) => selected.has(l.id))

  if (detailLineId) {
    return (
      <>
        <RequirementLineDetailScreen
          lineId={detailLineId}
          onBack={() => setDetailLineId(null)}
          onChanged={reload}
          onToast={showToast}
        />
        {toast && <Toast message={toast} onDone={() => setToast("")} />}
      </>
    )
  }

  return (
    <>
      <div className="flex-1 flex flex-col min-h-0">
        <PageHeader
          breadcrumb="Purchasing / Requirements"
          title="Purchase Requirements"
          subtitle="Manage products that need purchasing and track outstanding orders."
          actions={
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setOrderLines(selectedEligible.map(toOrderable))}
                disabled={selectedEligible.length === 0}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#B6C8AF] text-[#333333] px-3.5 py-2 text-sm font-semibold hover:bg-[#E6ECE2] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Order Selected
                {selectedEligible.length > 0 && (
                  <span className="rounded-full bg-white/70 px-1.5 text-xs font-bold">
                    {selectedEligible.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setNewOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#C6D4BF] bg-white px-3.5 py-2 text-sm font-medium text-[#333333] hover:bg-[#E6ECE2] transition-colors"
              >
                + New Requirement
              </button>
              <button
                onClick={() => setGenerateOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#C6D4BF] bg-white px-3.5 py-2 text-sm font-medium text-[#333333] hover:bg-[#E6ECE2] transition-colors"
              >
                Generate from Reorder
              </button>
            </div>
          }
        />

        {/* Status tabs — existing underline tab convention */}
        <nav
          className="bg-white border-b border-[#E6ECE2] px-4 sm:px-6 flex items-center gap-1 overflow-x-auto"
          aria-label="Requirement status"
        >
          {TABS.map(({ key, label }) => {
            // Only the active tab's count is known: `meta.total` is the server's

            // authoritative total for the CURRENT filter. Other tabs would need

            // per-status counts, which the response may not provide reliably, so

            // none are invented from the current page.

            const count =
              key === tab && !loading && !loadError ? meta.total : null

            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                aria-current={key === tab ? "page" : undefined}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7A9076]/40 ${
                  key === tab
                    ? "border-[#7A9076] text-[#4F6B4A]"
                    : "border-transparent text-[#666666] hover:text-[#333333] hover:border-[#C6D4BF]"
                }`}
              >
                {label}
                {count !== null && (
                  <span
                    className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      key === tab
                        ? "bg-[#E6ECE2] text-[#4F6B4A]"
                        : "bg-[#F1F0EA] text-[#666666]"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          {/* Filters */}
          <div className="bg-white rounded-xl border border-[#E6ECE2] p-4">
            <div className="flex flex-col sm:flex-row gap-3 items-center">
              <div className="flex-1 w-full">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Search by product, brand or requirement reference..."
                />
              </div>
              {(search || tab !== "active") && (
                <button
                  onClick={() => {
                    setSearch("")

                    setTab("active")
                  }}
                  className="text-xs font-semibold text-[#7A9076] hover:underline whitespace-nowrap"
                >
                  Reset filters
                </button>
              )}
            </div>
          </div>

          {/* Selection toolbar */}
          {selected.size > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[#C6D4BF] bg-[#E6ECE2]/50 px-4 py-3 flex-wrap">
              <p className="text-sm font-medium text-[#333333]">
                {selectedEligible.length} eligible line
                {selectedEligible.length !== 1 ? "s" : ""} selected
              </p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelected(new Set())}
                  className="text-xs font-semibold text-[#666666] hover:text-[#333333] hover:underline"
                >
                  Clear selection
                </button>
                <button
                  onClick={() =>
                    setOrderLines(selectedEligible.map(toOrderable))
                  }
                  disabled={selectedEligible.length === 0}
                  className="rounded-xl bg-[#B6C8AF] text-[#333333] px-3.5 py-1.5 text-sm font-semibold hover:bg-[#A5B89E] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Order Selected
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden flex-shrink-0">
            {loading ? (
              <TableSkeleton
                columns={LINE_COLUMNS}
                rows={8}
                minWidth="min-w-[1080px]"
                status="Loading purchase requirements"
              />
            ) : loadError ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 px-6 text-center">
                <p className="text-sm font-semibold text-red-600">
                  {loadError}
                </p>
                <Button variant="secondary" onClick={reload}>
                  Try Again
                </Button>
              </div>
            ) : lineRows.length === 0 ? (
              <EmptyState
                title={
                  search
                    ? "No requirement lines match your search"
                    : tab === "active"
                      ? "No active purchase requirements"
                      : "No requirement lines in this status"
                }
                description={
                  search
                    ? "Try a different product name, SKU or reference."
                    : "Create a requirement manually or generate one from reorder suggestions."
                }
                action={
                  <div className="flex gap-2">
                    <Button onClick={() => setNewOpen(true)}>
                      + New Requirement
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setGenerateOpen(true)}
                    >
                      Generate from Reorder
                    </Button>
                  </div>
                }
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1080px] text-sm">
                    <thead>
                      <tr className="bg-[#E6ECE2] text-left">
                        <th className="px-4 py-3 w-10">
                          <input
                            type="checkbox"
                            checked={allEligibleSelected}
                            onChange={toggleAllOnPage}
                            disabled={eligibleRows.length === 0}
                            className="accent-[#4F6B4A] w-4 h-4"
                            aria-label="Select all eligible lines on this page"
                          />
                        </th>
                        {[
                          "Product",

                          "Reference",

                          "Status",

                          "Required",

                          "Ordered",

                          "Received",

                          "Rem. to Order",

                          "Rem. to Receive",

                          "Reason",

                          "Actions",
                        ].map((h) => (
                          <th
                            key={h}
                            className={`px-4 py-3 font-semibold text-[#333333] whitespace-nowrap ${
                              h === "Received" ? "hidden lg:table-cell" : ""
                            }`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lineRows.map((line, i) => {
                        const eligible = isLineOrderable(line)

                        return (
                          <tr
                            key={line.id}
                            className={`hover:bg-[#E6ECE2]/30 transition-colors ${
                              i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/15"
                            }`}
                          >
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selected.has(line.id)}
                                onChange={() => toggleRow(line.id)}
                                disabled={!eligible}
                                className="accent-[#4F6B4A] w-4 h-4 disabled:opacity-40"
                                aria-label={`Select ${line.productName}`}
                                title={
                                  eligible
                                    ? undefined
                                    : "Only open or partially fulfilled lines can be ordered"
                                }
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-[#333333]">
                                {line.productName}
                              </div>
                              <div className="text-xs text-[#999]">
                                {line.productBrand || "—"}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => setDetailLineId(line.id)}
                                className="font-semibold text-[#7A9076] hover:underline whitespace-nowrap"
                              >
                                {line.requirementReference || "—"}
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <StatusPill status={line.lineStatus} />
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-[#333333] whitespace-nowrap">
                              {quantityWithUnit(
                                line.requiredQuantity,

                                line.unitName || line.unitSymbol,
                              )}
                            </td>
                            <td className="px-4 py-3 text-right text-[#333333] whitespace-nowrap">
                              {line.orderedQuantity}
                            </td>
                            <td className="px-4 py-3 text-right text-[#666666] whitespace-nowrap hidden lg:table-cell">
                              {line.quantityDelivered}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-[#7A9076] whitespace-nowrap">
                              {line.remainingToOrder}
                            </td>
                            <td className="px-4 py-3 text-right text-[#666666] whitespace-nowrap">
                              {line.remainingToReceive}
                            </td>
                            <td className="px-4 py-3 text-[#666666] whitespace-nowrap">
                              {reasonText(line.reasonCode)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 whitespace-nowrap">
                                <button
                                  onClick={() => setDetailLineId(line.id)}
                                  className="text-xs font-semibold text-[#7A9076] hover:underline"
                                >
                                  View →
                                </button>
                                {eligible && (
                                  <button
                                    onClick={() =>
                                      setOrderLines([toOrderable(line)])
                                    }
                                    className="text-xs font-semibold text-[#7A9076] hover:underline"
                                  >
                                    Order
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={meta.page}
                  totalPages={Math.max(1, meta.totalPages)}
                  onPageChange={setPage}
                  label={rangeLabel(
                    meta.page,
                    meta.limit,
                    meta.total,
                    "requirement lines",
                  )}
                />
              </>
            )}
          </div>
        </div>
      </div>

      <NewRequirementModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={() => {
          setNewOpen(false)

          reload()

          showToast("Requirement created successfully.")
        }}
      />
      <GenerateFromReorderModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onGenerated={() => {
          setGenerateOpen(false)

          reload()

          showToast("Requirement generated from reorder suggestions.")
        }}
      />
      <RequirementOrderModal
        lines={orderLines}
        onClose={() => setOrderLines(null)}
      />
      {toast && <Toast message={toast} onDone={() => setToast("")} />}
    </>
  )
}

// Headings shared with the loading skeleton.

const LINE_COLUMNS = [
  "",

  "Product",

  "Reference",

  "Status",

  "Required",

  "Ordered",

  "Received",

  "Rem. to Order",

  "Rem. to Receive",

  "Reason",

  "Actions",
] as const

function reasonText(code: string | null): string {
  switch (code) {
    case "LOW_STOCK":
      return "Low Stock"

    case "REORDER_ALERT":
      return "Reorder Alert"

    case "MANUAL":
      return "Manual"

    default:
      return "—"
  }
}

// ─── Order modal (bulk + single) ─────────────────────────────────────────────

// Opens from the per-row "Order" action or "Order Selected" — one table row
// per selected line with quantity, unit cost and the product's unit
// configuration (GET /inventory/products/{id}/units). On confirm the quantity
// is converted to the product's BASE unit and the flow hands off to the
// existing Create Purchase Order page via repeated `requirementLineId` query
// params — the same multi-line prefill that page already parses. All selected
// lines are placed on ONE purchase order; the supplier is chosen next.

interface OrderDraftLine {
  line: OrderableLine
  selected: boolean
  quantity: string
  unitCost: string
  /** Explicitly chosen order unit; null = follow the requirement line's unit. */
  unitId: string | null
}

function unitLabel(u: ProductUnitDto | null): string {
  if (!u) return ""
  return u.unit.symbol ? `${u.unit.name} (${u.unit.symbol})` : u.unit.name
}

/** Find the line's unit in the product's unit configuration (by id, then name). */
function findUnitForLine(
  list: ProductUnitDto[] | undefined,
  line: OrderableLine,
): ProductUnitDto | undefined {
  if (!list || list.length === 0) return undefined
  if (line.unitId) {
    const byId = list.find((u) => u.unitId === line.unitId)
    if (byId) return byId
  }
  if (line.unitName) {
    const byName = list.find(
      (u) => u.unit.name.toLowerCase() === line.unitName.toLowerCase(),
    )
    if (byName) return byName
  }
  return undefined
}

/**
 * Resolve the unit a draft row works in: an explicitly chosen unit wins,
 * otherwise the requirement line's unit, otherwise the product's base unit.
 * `factor` converts one selected unit into base units (base factor = 1).
 */
function resolveUnitChoice(
  list: ProductUnitDto[] | undefined,
  draft: OrderDraftLine,
): {
  selected: ProductUnitDto | null
  base: ProductUnitDto | null
  factor: number
} {
  const units = list ?? []
  const base = units.find((u) => u.isBaseUnit) ?? units[0] ?? null
  const explicit = draft.unitId
    ? units.find((u) => u.unitId === draft.unitId)
    : undefined
  const selected = explicit ?? findUnitForLine(units, draft.line) ?? base
  return { selected, base, factor: selected?.conversionFactor ?? 1 }
}

function RequirementOrderModal({
  lines,
  onClose,
}: {
  lines: OrderableLine[] | null
  onClose: () => void
}) {
  const [drafts, setDrafts] = useState<OrderDraftLine[]>([])
  const [error, setError] = useState("")
  const [unitsByProduct, setUnitsByProduct] = useState<
    Record<string, ProductUnitDto[]>
  >({})
  const [unitsLoading, setUnitsLoading] = useState(false)
  const [unitsError, setUnitsError] = useState("")

  useEffect(() => {
    if (!lines) return
    setDrafts(
      lines.map((l) => ({
        line: l,
        selected: true,
        quantity: String(l.remainingToOrder),
        unitCost: "",
        unitId: null,
      })),
    )
    setError("")
  }, [lines])

  // Load each product's unit configuration (base unit + conversion factors)
  // so quantities can be converted to base units before creating the PO.
  useEffect(() => {
    if (!lines) return
    const ids = Array.from(
      new Set(lines.map((l) => l.productId).filter(Boolean)),
    )
    if (ids.length === 0) return
    let cancelled = false
    setUnitsLoading(true)
    setUnitsError("")
    Promise.all(
      ids.map((id) =>
        getProductUnits(id).then(
          (units) => ({ id, units, ok: true as const }),
          () => ({ id, units: [] as ProductUnitDto[], ok: false as const }),
        ),
      ),
    ).then((results) => {
      if (cancelled) return
      setUnitsByProduct((prev) => {
        const next = { ...prev }
        for (const r of results) next[r.id] = r.units
        return next
      })
      if (results.some((r) => !r.ok)) {
        setUnitsError(
          "Unit conversion info could not be loaded for some products — their quantities will be sent as entered.",
        )
      }
      setUnitsLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [lines])

  if (!lines) return null

  function update(index: number, patch: Partial<OrderDraftLine>) {
    setDrafts((prev) =>
      prev.map((d, i) => (i === index ? { ...d, ...patch } : d)),
    )
    setError("")
  }

  const picked = drafts.filter((d) => d.selected)

  function handleCreate() {
    if (drafts.length === 0) {
      setError("This requirement has no products remaining to order.")
      return
    }
    if (picked.length === 0) {
      setError("Select at least one product to order.")
      return
    }
    const params = new URLSearchParams()
    for (const d of picked) {
      const qty = parseFloat(d.quantity)
      if (!Number.isFinite(qty) || qty <= 0) {
        setError(
          `Quantity must be greater than zero for ${d.line.productName}.`,
        )
        return
      }
      const unitCost = parseFloat(d.unitCost)
      if (d.unitCost === "" || !Number.isFinite(unitCost) || unitCost < 0) {
        setError(`Enter a valid unit cost for ${d.line.productName}.`)
        return
      }

      const list = unitsByProduct[d.line.productId]
      const { base, factor } = resolveUnitChoice(list, d)
      // Remaining allowance in base units: the line's remaining quantity is
      // in the requirement's unit, converted with its factor (unknown unit
      // → treated as base, factor 1). The entered quantity is converted with
      // the selected unit's factor.
      const lineFactor = findUnitForLine(list, d.line)?.conversionFactor ?? 1
      const remainingBase = d.line.remainingToOrder * lineFactor
      const baseQty = qty * factor
      if (baseQty > remainingBase + 1e-9) {
        setError(
          `Cannot order more than the remaining quantity for ${d.line.productName}.`,
        )
        return
      }

      params.append("requirementLineId", d.line.lineId)
      params.append("quantity", String(Math.round(baseQty * 1000) / 1000))
      params.append("unitCost", d.unitCost)
      params.append("requirementReference", d.line.requirementReference)
      params.append("productName", d.line.productName)
      params.append("productSku", d.line.productSku)
      const unitName = base?.unit.name || d.line.unitName
      if (unitName) params.append("unitName", unitName)
    }
    setError("")
    window.location.href = `/purchasing/orders/new?${params.toString()}`
  }

  return (
    <Modal open title="Create Purchase Order" onClose={onClose} size="2xl">
      <p className="mb-4 text-sm text-[#666666]">
        Review the products to order. Select which ones to include, enter quantities and unit costs, then click{" "}
        <strong>Proceed to Purchase Order</strong> to go directly to the order form.
      </p>

      {unitsError && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {unitsError}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {drafts.length === 0 ? (
        <p className="rounded-xl border border-[#E6ECE2] bg-[#E6ECE2]/40 px-4 py-6 text-center text-sm text-[#666666]">
          No products to order.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#E6ECE2]">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="bg-[#E6ECE2]/60 text-left text-xs font-semibold text-[#555] uppercase tracking-wide">
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={picked.length === drafts.length && drafts.length > 0}
                    onChange={(e) => {
                      const on = e.target.checked
                      setDrafts((prev) =>
                        prev.map((d) => ({ ...d, selected: on })),
                      )
                      setError("")
                    }}
                    className="accent-[#4F6B4A] w-4 h-4"
                    aria-label="Select all products"
                  />
                </th>
                <th className="px-3 py-3">Product &amp; Brand</th>
                <th className="px-3 py-3">Qty to Order</th>
                <th className="px-3 py-3">Unit Cost (ETB)</th>
                <th className="px-3 py-3">Current Unit</th>
                <th className="px-3 py-3">Unit Conversion</th>
                <th className="px-3 py-3">Cost / Base Unit</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((d, i) => {
                const list = unitsByProduct[d.line.productId]
                const { selected: selUnit, base } = resolveUnitChoice(list, d)
                const hasUnits = !!list && list.length > 0
                // Compute cost per base unit: enteredCost / conversionFactor gives
                // cost per base unit when the user orders in a larger unit.
                const enteredCost = parseFloat(d.unitCost)
                const factor = selUnit?.conversionFactor ?? 1
                const costPerBase =
                  Number.isFinite(enteredCost) && enteredCost > 0 && factor > 0
                    ? enteredCost / factor
                    : null
                return (
                  <tr
                    key={d.line.lineId}
                    className={`border-t border-[#E6ECE2] transition-colors ${
                      i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/15"
                    } ${d.selected ? "" : "opacity-40"}`}
                  >
                    {/* Checkbox */}
                    <td className="px-3 py-3 align-middle">
                      <input
                        type="checkbox"
                        checked={d.selected}
                        onChange={(e) =>
                          update(i, { selected: e.target.checked })
                        }
                        className="accent-[#4F6B4A] w-4 h-4"
                        aria-label={`Select ${d.line.productName}`}
                      />
                    </td>

                    {/* Product name + brand */}
                    <td className="px-3 py-3 align-middle min-w-[180px]">
                      <div className="font-semibold text-[#222]">
                        {d.line.productName}
                      </div>
                      <div className="text-xs text-[#888] mt-0.5">
                        {d.line.productBrand || "—"}
                      </div>
                    </td>

                    {/* Quantity to order */}
                    <td className="px-3 py-3 align-middle">
                      <input
                        id={`order-qty-${i}`}
                        type="number"
                        min={0}
                        step={0.001}
                        value={d.quantity}
                        onChange={(e) => update(i, { quantity: e.target.value })}
                        disabled={!d.selected}
                        className="w-24 rounded-lg border border-[#C6D4BF] px-2.5 py-1.5 text-sm focus:border-[#7A9076] focus:ring-1 focus:ring-[#7A9076]/30 focus:outline-none disabled:bg-[#F3F6F1] disabled:cursor-not-allowed"
                      />
                    </td>

                    {/* Unit cost (per chosen order unit) */}
                    <td className="px-3 py-3 align-middle">
                      <input
                        id={`order-cost-${i}`}
                        type="number"
                        min={0}
                        step={0.01}
                        value={d.unitCost}
                        onChange={(e) => update(i, { unitCost: e.target.value })}
                        disabled={!d.selected}
                        placeholder="0.00"
                        className="w-24 rounded-lg border border-[#C6D4BF] px-2.5 py-1.5 text-sm focus:border-[#7A9076] focus:ring-1 focus:ring-[#7A9076]/30 focus:outline-none disabled:bg-[#F3F6F1] disabled:cursor-not-allowed"
                      />
                    </td>

                    {/* Current unit — always the BASE unit */}
                    <td className="px-3 py-3 align-middle whitespace-nowrap">
                      {unitsLoading && !hasUnits ? (
                        <span className="text-[#bbb] text-xs">Loading…</span>
                      ) : hasUnits && base ? (
                        <span className="inline-flex flex-col">
                          <span className="font-medium text-[#333]">{unitLabel(base)}</span>
                          <span className="text-[10px] text-[#7A9076] font-semibold uppercase tracking-wide">base</span>
                        </span>
                      ) : (
                        <span className="text-[#999]">—</span>
                      )}
                    </td>

                    {/* Unit conversion — dropdown of all available units */}
                    <td className="px-3 py-3 align-middle min-w-[200px]">
                      {hasUnits && base ? (
                        <div className="flex flex-col gap-1">
                          <select
                            value={selUnit?.unitId ?? base.unitId}
                            onChange={(e) => {
                              const newUnitId = e.target.value
                              const newUnit = list.find((u) => u.unitId === newUnitId)
                              const currentFactor = selUnit?.conversionFactor ?? 1
                              const newFactor = newUnit?.conversionFactor ?? 1
                              const currentQty = parseFloat(d.quantity)
                              if (
                                Number.isFinite(currentQty) &&
                                currentFactor > 0 &&
                                newFactor > 0
                              ) {
                                // Convert: base qty = currentQty × currentFactor
                                // New qty in new unit = base qty / newFactor
                                const baseQty = currentQty * currentFactor
                                const newQty = baseQty / newFactor
                                const rounded =
                                  Math.round(newQty * 1000) / 1000
                                update(i, {
                                  unitId: newUnitId,
                                  quantity: String(rounded),
                                })
                              } else {
                                update(i, { unitId: newUnitId })
                              }
                            }}
                            disabled={!d.selected}
                            className="rounded-lg border border-[#C6D4BF] px-2.5 py-1.5 text-sm bg-white focus:border-[#7A9076] focus:outline-none disabled:bg-[#F3F6F1] disabled:cursor-not-allowed"
                          >
                            {list.map((u) => (
                              <option key={u.id} value={u.unitId}>
                                {unitLabel(u)}
                                {u.isBaseUnit ? " (base)" : ` (×${u.conversionFactor})`}
                              </option>
                            ))}
                          </select>
                          <span className="text-[11px] text-[#888]">
                            {selUnit?.isBaseUnit
                              ? "Base unit — no conversion"
                              : `1 ${selUnit?.unit.symbol || selUnit?.unit.name} = ${selUnit?.conversionFactor} ${base.unit.symbol || base.unit.name}`}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[#999] text-xs">
                          {d.line.unitName || "—"}
                        </span>
                      )}
                    </td>

                    {/* Cost per base unit (computed) */}
                    <td className="px-3 py-3 align-middle whitespace-nowrap">
                      {costPerBase !== null ? (
                        <span className="font-semibold text-[#4F6B4A]">
                          {costPerBase.toLocaleString("en-ET", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" ETB"}
                        </span>
                      ) : (
                        <span className="text-[#bbb]">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary row */}
      {picked.length > 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs text-[#666]">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#E6ECE2] px-2.5 py-1 font-semibold text-[#4F6B4A]">
            {picked.length} product{picked.length !== 1 ? "s" : ""} selected
          </span>
          <span>will be added to the purchase order.</span>
        </div>
      )}

      <div className="flex gap-3 justify-end border-t border-[#E6ECE2] pt-4 mt-4">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleCreate} loading={unitsLoading} disabled={picked.length === 0}>
          Proceed to Purchase Order →
        </Button>
      </div>
    </Modal>
  )
}

// ─── New Requirement Modal ───────────────────────────────────────────────────

interface NewLine {
  productId: string

  product: ProductDto | null

  quantity: string
  /** Unit the requested quantity is expressed in; null = product's base unit. */
  unitId: string | null
  /** Resolved display name of the selected unit (for the review screen). */
  unitName: string
  reason: LineReason

  notes: string
}

/**
 * Compact per-line unit picker for the New Requirement form. Loads the
 * product's configured units from its own backend endpoint
 * (`useProductUnits` → GET /inventory/products/{id} → `units`) and reports the
 * chosen unit back to the row. A null unitId means "use the product's base
 * unit" — the payload omits it and the backend defaults to that base unit.
 */
function NewRequirementUnitSelect({
  productId,
  value,
  onUnitChange,
}: {
  productId: string
  value: string | null
  onUnitChange: (unitId: string | null, unitName: string) => void
}) {
  const { units, baseUnit, options, loading, error } = useProductUnits(productId)

  // Base unit is the default until the admin picks another unit.
  const selectedId = value ?? baseUnit?.id ?? ""

  if (!productId) {
    return (
      <div
        className={`${SC} w-40 text-[#999] bg-[#F3F6F1] whitespace-nowrap`}
        aria-disabled
      >
        Select a product first
      </div>
    )
  }

  return (
    <select
      value={selectedId}
      onChange={(e) => {
        const v = e.target.value || null
        const u = units.find((x) => x.unitId === v)
        onUnitChange(v, u?.unit?.name || u?.unit?.symbol || "")
      }}
      className={`${SC} w-40`}
      disabled={loading || !!error}
    >
      {loading && <option value="">Loading units…</option>}
      {error && <option value="">Error loading units</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

function NewRequirementModal({
  open,

  onClose,

  onCreated,
}: {
  open: boolean

  onClose: () => void

  onCreated: () => void
}) {
  const [products, setProducts] = useState<ProductDto[]>([])

  const [requiredBy, setRequiredBy] = useState("")

  const [notes, setNotes] = useState("")

  const [lines, setLines] = useState<NewLine[]>([
    {
      productId: "",
      product: null,
      quantity: "",
      unitId: null,
      unitName: "",
      reason: "Low Stock",
      notes: "",
    },
  ])

  const [error, setError] = useState("")

  const [previewing, setPreviewing] = useState(false)

  const [saving, setSaving] = useState(false)

  const [preview, setPreview] = useState<RequirementPreviewResult | null>(null)

  const [saveError, setSaveError] = useState("")

  useEffect(() => {
    if (!open) return

    listProducts({ limit: 100, isActive: true })

      .then((r) => setProducts(r.data))

      .catch(() => {})
  }, [open])

  function addLine() {
    setLines((l) => [
      ...l,

      {
        productId: "",
        product: null,
        quantity: "",
        unitId: null,
        unitName: "",
        reason: "Low Stock",
        notes: "",
      },
    ])
  }

  function removeLine(i: number) {
    setLines((l) => l.filter((_, idx) => idx !== i))
  }

  function updateLine(
    i: number,
    field: keyof NewLine,
    value: string | ProductDto | null,
  ) {
    setLines((l) =>
      l.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)),
    )
  }

  function buildBody(): CreateRequirementInput {
    return {
      ...(requiredBy
        ? { requiredBy: new Date(`${requiredBy}T00:00:00Z`).toISOString() }
        : {}),

      ...(notes.trim() ? { notes: notes.trim() } : {}),

      lines: lines.map((l) => ({
        productId: l.productId,

        quantityNeeded: parseInt(l.quantity),
        // Omitted for the base unit — the backend defaults to it server-side.
        ...(l.unitId ? { unitId: l.unitId } : {}),
        ...(reasonCode(l.reason) ? { reasonCode: reasonCode(l.reason)! } : {}),

        ...(l.notes.trim() ? { notes: l.notes.trim() } : {}),
      })),
    }
  }

  function validateLines(): string | null {
    if (lines.length === 0) return "Add at least one product."

    for (const l of lines) {
      if (!l.productId) return "Select a product for each row."

      if (!l.quantity || parseInt(l.quantity) <= 0) {
        return "Quantity must be greater than zero."
      }
    }
    // A duplicate is the same product AND the same unit twice in one form. The
    // same product on a different unit is a distinct requirement line, so it is
    // allowed through to the preview (the backend treats each line as its own
    // product+unit pair).
    const seen = new Set<string>()
    for (const l of lines) {
      const key = `${l.productId}::${l.unitId ?? ""}`
      if (seen.has(key)) {
        const dupName = l.product?.name || "This product"
        const dupUnit = l.unitName ? ` with unit ${l.unitName}` : ""
        return `${dupName}${dupUnit} has already been added. Please edit the existing row instead of adding it again.`
      }
      seen.add(key)
    }

    return null
  }

  async function handleReview() {
    const problem = validateLines()

    if (problem) {
      setError(problem)

      return
    }

    setError("")

    setSaveError("")

    setPreviewing(true)

    try {
      const result = await previewRequirement(buildBody())

      setPreview(result)
    } catch (e) {
      if (e instanceof RequirementsApiError && e.status === 403) {
        setError("You do not have permission to create purchase requirements.")
      } else {
        setError(errMessage(e))
      }
    } finally {
      setPreviewing(false)
    }
  }

  function handleBackToForm() {
    if (saving) return

    setPreview(null)

    setSaveError("")
  }

  async function handleConfirm() {
    if (saving) return

    const problem = validateLines()

    if (problem) {
      setError(problem)

      setPreview(null)

      return
    }

    setError("")

    setSaveError("")

    setSaving(true)

    try {
      await createRequirement(buildBody())

      setPreview(null)

      setRequiredBy("")

      setNotes("")

      setLines([
        {
          productId: "",
          product: null,
          quantity: "",
          unitId: null,
          unitName: "",
          reason: "Low Stock",
          notes: "",
        },
      ])

      onCreated()
    } catch (e) {
      if (e instanceof RequirementsApiError && e.status === 403) {
        setSaveError(
          "You do not have permission to create purchase requirements.",
        )
      } else {
        setSaveError(errMessage(e))
      }

      setSaving(false)
    }
  }

  /** Match a preview action to a form line (the backend contract pairs each
   * action with productId + unitId), falling back to productId alone. */
  function actionForLine(l: NewLine): RequirementActionDto | undefined {
    if (!preview) return undefined
    return (
      preview.actions.find(
        (a) =>
          a.productId === l.productId &&
          (a.unitId ?? null) === (l.unitId ?? null),
      ) ?? preview.actions.find((a) => a.productId === l.productId)
    )
  }

  return (
    <Modal
      open={open}
      title={
        preview ? "Review Purchase Requirement" : "Create Purchase Requirement"
      }
      onClose={preview ? handleBackToForm : onClose}
      size="2xl"
    >
      {preview ? (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-[#666666]">
            Review what will happen before anything is saved. The backend
            decides each line.
          </p>
          {saveError && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {saveError}
            </p>
          )}
          <div className="grid sm:grid-cols-2 gap-4">
            <Fw label="Required By">
              <p className="text-sm text-[#333333] py-2.5">
                {requiredBy
                  ? new Date(`${requiredBy}T00:00:00`).toLocaleDateString(
                      undefined,
                      {
                        year: "numeric",

                        month: "long",

                        day: "numeric",
                      },
                    )
                  : "—"}
              </p>
            </Fw>
            <Fw label="Notes">
              <p className="text-sm text-[#333333] py-2.5 break-words">
                {notes.trim() || "—"}
              </p>
            </Fw>
          </div>
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-[#333333]">Products</p>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6ECE2] px-3 py-1 text-xs font-semibold text-[#7A9076]">
                {preview.actions.filter((a) => a.action === "CREATE").length}{" "}
                new{" · "}
                {preview.actions.filter((a) => a.action === "UPDATE").length}{" "}
                update
              </span>
            </div>
            {preview.actions.length === 0 && (
              <p className="text-xs text-[#666666] bg-[#E6ECE2]/60 rounded-lg px-3 py-2 mb-3">
                The server returned no per-line preview decisions. Each product
                will still be processed by the backend when you confirm.
              </p>
            )}
            <div className="flex flex-col gap-3">
              {lines.map((l, i) => (
                <RequirementPreviewCard
                  key={i}
                  productLabel={l.product?.name ?? ""}
                  quantity={parseInt(l.quantity) || 0}
                  unitLabel={l.unitName || undefined}
                  action={actionForLine(l)}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-3 justify-end border-t border-[#E6ECE2] pt-4">
            <Button
              variant="secondary"
              onClick={handleBackToForm}
              disabled={saving}
            >
              Back
            </Button>
            <Button
              onClick={handleConfirm}
              loading={saving}
              disabled={previewing}
            >
              {saving ? "Saving…" : "Create Requirement"}
            </Button>
          </div>
        </div>
      ) : (
        /* ── Stage 1: the form. "Create Requirement" only PREVIEWS. ────── */
        <>
          <div className="flex flex-col gap-5">
            {error && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <div className="grid sm:grid-cols-2 gap-4">
              <Fw label="Required By">
                <DatePicker
                  value={requiredBy}
                  onChange={setRequiredBy}
                  placeholder="Select required-by date..."
                />
              </Fw>
              <Fw label="Notes">
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this purchase requirement..."
                  className={SC}
                />
              </Fw>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-[#333333]">Products</p>
                <button
                  onClick={addLine}
                  className="text-xs font-semibold text-[#7A9076] hover:underline"
                >
                  + Add Row
                </button>
              </div>
              <div className="rounded-xl border border-[#E6ECE2] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#E6ECE2]">
                        {["Product", "Unit", "Qty Needed", "Reason", "Notes", ""].map(
                          (h) => (
                            <th
                              key={h}
                              className="px-3 py-2.5 text-left font-semibold text-[#333333] text-xs"
                            >
                              {h}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line, i) => (
                        <tr
                          key={i}
                          className={
                            i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/20"
                          }
                        >
                          <td className="px-3 py-2 min-w-[300px]">
                            <SearchableSelect
                              value={line.productId || null}
                              onChange={(v) => {
                                const p =
                                  products.find((x) => x.id === v) ?? null
                                updateLine(i, "productId", v)
                                updateLine(i, "product", p)
                                // A new product gets a fresh unit choice
                                // (defaults to its base unit).
                                updateLine(i, "unitId", null)
                                updateLine(i, "unitName", "")
                              }}
                              options={products.map((p) => ({
                                value: p.id,
                                label: p.brand
                                  ? `${p.name} (${p.brand})`
                                  : p.name,
                              }))}
                              placeholder="Select product..."
                              searchPlaceholder="Search products..."
                              emptyMessage="No products found"
                              noResultsMessage="No products matching your search"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <NewRequirementUnitSelect
                              productId={line.productId}
                              value={line.unitId}
                              onUnitChange={(unitId, unitName) => {
                                updateLine(i, "unitId", unitId)
                                updateLine(i, "unitName", unitName)
                              }}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={1}
                              value={line.quantity}
                              onChange={(e) =>
                                updateLine(i, "quantity", e.target.value)
                              }
                              className={`${SC} w-20`}
                              placeholder="0"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={line.reason}
                              onChange={(e) =>
                                updateLine(
                                  i,
                                  "reason",
                                  e.target.value as LineReason,
                                )
                              }
                              className={SC}
                            >
                              <option value="">No reason</option>
                              <option>Low Stock</option>
                              <option>Reorder Alert</option>
                              <option>Manual</option>
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={line.notes}
                              onChange={(e) =>
                                updateLine(i, "notes", e.target.value)
                              }
                              className={SC}
                              placeholder="Optional..."
                            />
                          </td>
                          <td className="px-3 py-2">
                            {lines.length > 1 && (
                              <button
                                onClick={() => removeLine(i)}
                                className="text-red-400 hover:text-red-600 p-1"
                                title="Remove"
                              >
                                <svg
                                  className="h-4 w-4"
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                  aria-hidden
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end border-t border-[#E6ECE2] pt-4">
              <Button
                variant="secondary"
                onClick={onClose}
                disabled={previewing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleReview}
                loading={previewing}
                disabled={saving || previewing}
              >
                {previewing ? "Checking Requirement…" : "Create Requirement"}
              </Button>
            </div>
          </div>
        </>
      )}
    </Modal>
  )
}

// ─── Generate from Reorder Modal ─────────────────────────────────────────────

function GenerateFromReorderModal({
  open,

  onClose,

  onGenerated,
}: {
  open: boolean

  onClose: () => void

  onGenerated: () => void
}) {
  const [loading, setLoading] = useState(false)

  const [suggestions, setSuggestions] = useState<ReorderSuggestion[]>([])

  const [loadError, setLoadError] = useState("")

  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (!open) return

    let cancelled = false

    setLoadError("")

    setSuggestions([])

    setLoading(true)

    getReorderSuggestions({ page: 1, limit: 50 })

      .then((r) => {
        if (cancelled) return

        setSuggestions(
          r.data.map((s) => ({
            productId: s.product.id,

            name: s.product.name,

            suggestedQuantity: s.suggestedQuantity,

            status: "Reorder",

            calculationMethod: s.calculationMethod,

            baseUnit: s.product.baseUnit ?? null,
          })),
        )
      })

      .catch((e) => {
        if (!cancelled) setLoadError(errMessage(e))
      })

      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, retry])

  if (!loading && !loadError) {
    return (
      <GenerateRequirementsModal
        open={open}
        onClose={onClose}
        onGenerate={onGenerated}
        suggestions={suggestions}
      />
    )
  }

  return (
    <Modal
      open={open}
      title="Generate Purchase Requirement"
      onClose={onClose}
      size="sm"
    >
      <p className="text-sm text-[#666666] -mt-2 mb-4">
        Choose the products to include and enter the quantity to request for
        each.
      </p>
      {loadError ? (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">
          {loadError}
        </p>
      ) : (
        <p className="text-sm text-[#999] py-2">Loading reorder suggestions…</p>
      )}
      <div className="flex gap-3 justify-end">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        {loadError && (
          <Button onClick={() => setRetry((n) => n + 1)}>Retry</Button>
        )}
      </div>
    </Modal>
  )
}