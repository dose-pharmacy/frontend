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
} from "../../features/purchasing/requirementsApi"

import {
  listProducts,
  type ProductDto,
} from "../../features/inventory/productsApi"

import { getReorderSuggestions } from "../../features/inventory/reorderApi"

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
  id: string

  productName: string

  productSku: string

  unitName: string

  requirementReference: string

  requiredQuantity: number

  orderedQuantity: number

  remainingToOrder: number
}

function toOrderable(line: RequirementLineRow): OrderableLine {
  return {
    id: line.id,

    productName: line.productName,

    productSku: line.productSku,

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
                  placeholder="Search by product, SKU or requirement reference..."
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
                              {line.productSku && (
                                <div className="text-xs text-[#999] font-mono">
                                  {line.productSku}
                                </div>
                              )}
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

// Reuses the original per-requirement Order modal: quantity + unit cost per

// selected line, then hand-off to the existing Create Purchase Order page via

// repeated `requirementLineId` query params — the same multi-line prefill the

// page already parses. All selected lines are placed on ONE purchase order; the

// supplier is chosen on the next step.

interface OrderDraftLine {
  line: OrderableLine

  selected: boolean

  quantity: string

  unitCost: string
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

  useEffect(() => {
    if (!lines) return

    setDrafts(
      lines.map((l) => ({
        line: l,

        selected: true,

        quantity: String(l.remainingToOrder),

        unitCost: "",
      })),
    )

    setError("")
  }, [lines])

  if (!lines) return null

  const picked = drafts.filter((d) => d.selected)

  const distinctRequirements = new Set(
    picked.map((d) => d.line.requirementReference),
  ).size

  function update(index: number, patch: Partial<OrderDraftLine>) {
    setDrafts((prev) =>
      prev.map((d, i) => (i === index ? { ...d, ...patch } : d)),
    )

    setError("")
  }

  function handleCreate() {
    if (drafts.length === 0) {
      setError("There are no orderable lines in the selection.")

      return
    }

    if (picked.length === 0) {
      setError("Select at least one product to order.")

      return
    }

    for (const d of picked) {
      const qty = parseFloat(d.quantity)

      if (!Number.isFinite(qty) || qty <= 0) {
        setError(
          `Quantity must be greater than zero for ${d.line.productName}.`,
        )

        return
      }

      if (qty > d.line.remainingToOrder) {
        setError(
          `Cannot order more than the remaining quantity (${d.line.remainingToOrder}) for ${d.line.productName}.`,
        )

        return
      }

      const cost = parseFloat(d.unitCost)

      if (d.unitCost === "" || !Number.isFinite(cost) || cost <= 0) {
        setError(`Enter a valid unit cost for ${d.line.productName}.`)

        return
      }
    }

    setError("")

    const params = new URLSearchParams()

    for (const d of picked) {
      params.append("requirementLineId", d.line.id)

      params.append("quantity", d.quantity)

      params.append("unitCost", d.unitCost)

      params.append("requirementReference", d.line.requirementReference)

      params.append("productName", d.line.productName)

      params.append("productSku", d.line.productSku)

      if (d.line.unitName) params.append("unitName", d.line.unitName)
    }

    window.location.href = `/purchasing/orders/new?${params.toString()}`
  }

  return (
    <Modal
      open
      title={
        picked.length > 1
          ? "Create Purchase Order — Multiple Products"
          : "Create Purchase Order"
      }
      onClose={onClose}
      size="xl"
    >
      {error && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <p className="mb-4 text-sm text-[#666666]">
        Set the quantity and unit cost for each product. Quantities are
        pre-filled with the remaining amount to order. All selected products are
        placed on a single purchase order — you choose its supplier on the next
        step.
      </p>

      {distinctRequirements > 1 && (
        <p className="mb-4 rounded-xl border border-[#C6D4BF] bg-[#E6ECE2]/50 px-4 py-3 text-xs text-[#333333]">
          This selection spans {distinctRequirements} different requirements.
          They will all be added to one purchase order. Create separate orders
          if they need different suppliers.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-[#E6ECE2]">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="bg-[#E6ECE2]/50 text-left text-xs font-semibold text-[#666666] uppercase">
              <th className="px-4 py-3 w-10">
                <input
                  type="checkbox"
                  checked={drafts.every((d) => d.selected)}
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
              <th className="px-4 py-3 font-semibold text-[#333333]">
                Product
              </th>
              <th className="px-4 py-3 font-semibold text-[#333333]">
                Reference
              </th>
              <th className="px-4 py-3 font-semibold text-[#333333] text-right">
                Required
              </th>
              <th className="px-4 py-3 font-semibold text-[#333333] text-right">
                Ordered
              </th>
              <th className="px-4 py-3 font-semibold text-[#333333] text-right">
                Remaining
              </th>
              <th className="px-4 py-3 font-semibold text-[#333333]">
                Qty to Order
              </th>
              <th className="px-4 py-3 font-semibold text-[#333333]">
                Unit Cost (ETB)
              </th>
            </tr>
          </thead>
          <tbody>
            {drafts.map((d, i) => (
              <tr
                key={d.line.id}
                className={`border-t border-[#E6ECE2] ${
                  i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/20"
                } ${d.selected ? "" : "opacity-50"}`}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={d.selected}
                    onChange={(e) => update(i, { selected: e.target.checked })}
                    className="accent-[#4F6B4A] w-4 h-4"
                    aria-label={`Select ${d.line.productName}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-[#333333]">
                    {d.line.productName}
                  </div>
                  {d.line.productSku && (
                    <div className="text-xs text-[#999] font-mono">
                      {d.line.productSku}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-[#7A9076] font-semibold whitespace-nowrap">
                  {d.line.requirementReference || "—"}
                </td>
                <td className="px-4 py-3 text-right text-[#333333]">
                  {d.line.requiredQuantity}
                  {d.line.unitName && (
                    <span className="ml-1 text-xs text-[#999]">
                      {d.line.unitName}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-[#666666]">
                  {d.line.orderedQuantity}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-[#4F6B4A]">
                  {d.line.remainingToOrder}
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={d.quantity}
                    onChange={(e) => update(i, { quantity: e.target.value })}
                    disabled={!d.selected}
                    className="w-24 rounded-lg border border-[#C6D4BF] px-2.5 py-1.5 text-sm focus:border-[#B6C8AF] focus:outline-none disabled:opacity-50"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={d.unitCost}
                    onChange={(e) => update(i, { unitCost: e.target.value })}
                    disabled={!d.selected}
                    placeholder="0.00"
                    className="w-28 rounded-lg border border-[#C6D4BF] px-2.5 py-1.5 text-sm focus:border-[#B6C8AF] focus:outline-none disabled:opacity-50"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3 justify-end border-t border-[#E6ECE2] pt-4 mt-5">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleCreate}>
          Create Purchase Order ({picked.length})
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

  reason: LineReason

  notes: string
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

    const ids = lines.map((l) => l.productId)

    if (new Set(ids).size !== ids.length) {
      return "Duplicate products are not allowed — each product can appear once. Please edit the existing row instead of adding it again."
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

  function actionForLine(l: NewLine): RequirementActionDto | undefined {
    if (!preview) return undefined

    return preview.actions.find((a) => a.productId === l.productId)
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
                      {["Product", "Qty Needed", "Reason", "Notes", ""].map(
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
                        className={i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/20"}
                      >
                        <td className="px-3 py-2 min-w-[300px]">
                          <SearchableSelect
                            value={line.productId || null}
                            onChange={(v) => {
                              const p = products.find((x) => x.id === v) ?? null

                              updateLine(i, "productId", v)

                              updateLine(i, "product", p)
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
            <Button variant="secondary" onClick={onClose} disabled={previewing}>
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
