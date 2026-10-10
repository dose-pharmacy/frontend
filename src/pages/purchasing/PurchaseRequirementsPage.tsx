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

// ─── Edit Requirement Modal ──────────────────────────────────────────────────

function EditRequirementModal({
  open,
  req,
  onClose,
  onSave,
}: {
  open: boolean
  req: Requirement
  onClose: () => void
  onSave: (updates: { requiredBy: string; notes: string | null }) => void
}) {
  const [requiredBy, setRequiredBy] = useState(req.requiredBy)
  const [notes, setNotes] = useState(req.notes)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setRequiredBy(req.requiredBy)
      setNotes(req.notes)
    }
  }, [open, req])

  async function handleSave() {
    setLoading(true)
    try {
      onSave({
        requiredBy: requiredBy
          ? new Date(`${requiredBy}T00:00:00Z`).toISOString()
          : req.requiredBy,
        notes: notes || null,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} title="Edit Requirement" onClose={onClose} size="sm">
      <div className="flex flex-col gap-4">
        <Fw label="Required By">
          <DatePicker
            value={requiredBy}
            onChange={setRequiredBy}
            placeholder="Select required-by date..."
          />
        </Fw>
        <Fw label="Notes">
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${SC} resize-none`}
            placeholder="Add notes..."
          />
        </Fw>
        <div className="flex gap-3 justify-end border-t border-[#E6ECE2] pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={loading}>
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Add Product Modal ───────────────────────────────────────────────────────

function AddProductModal({
  open,
  existingProductIds,
  onClose,
  onAdd,
}: {
  open: boolean
  existingProductIds: string[]
  onClose: () => void
  onAdd: (input: CreateRequirementLineInput) => void
}) {
  const productSearch = useSearchableResource(searchProducts, open)
  const [productId, setProductId] = useState("")
  const [unitId, setUnitId] = useState("")
  const [quantity, setQuantity] = useState("")
  const [reason, setReason] = useState<LineReason>("Low Stock")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [unitSearchTerm, setUnitSearchTerm] = useState("")

  const unitProducts = useProductUnits(productId || null)
  const baseUnit = unitProducts.baseUnit

  // Keep the selected product's label in the option list even when the current
  // search results don't include it (server-search results are page-scoped).
  const selectedProductOption: SearchableOption[] =
    productId &&
    !productSearch.options.some((o) => o.value === productId) &&
    unitProducts.product
      ? [
          {
            value: unitProducts.product.id,
            label: unitProducts.product.name,
            sub: unitProducts.product.brand
              ? `${unitProducts.product.sku} · ${unitProducts.product.brand}`
              : unitProducts.product.sku,
          },
        ]
      : []
  const productOptions = [...selectedProductOption, ...productSearch.options]

  const unitOptions = unitProducts.options.filter(
    (o) =>
      !unitSearchTerm ||
      o.label.toLowerCase().includes(unitSearchTerm.toLowerCase()),
  )

  const qty = parseFloat(quantity) || 0
  const productUnit = unitProducts.units.find((u) => u.unitId === unitId)
  const baseQty = toBaseQuantity(qty, productUnit)
  const showPreview =
    !!productId && !!unitId && qty > 0 && baseQty !== null && !!baseUnit

  function resetForm() {
    setProductId("")
    setUnitId("")
    setQuantity("")
    setReason("Low Stock")
    setNotes("")
    setError("")
  }

  async function handleAdd() {
    if (!productId) {
      setError("Please select a product.")
      return
    }
    if (existingProductIds.includes(productId)) {
      setError("This product is already in the requirement.")
      return
    }
    if (!qty || qty <= 0) {
      setError("Quantity must be greater than zero.")
      return
    }
    if (!unitId) {
      setError("Please select a unit.")
      return
    }
    setError("")
    setLoading(true)
    try {
      onAdd({
        productId,
        unitId,
        quantityNeeded: qty,
        reasonCode: reasonCode(reason),
        // Optional note: omit the field entirely when empty — the backend
        // request validator rejects an explicit null ("Note is required").
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      })
      resetForm()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Add Product to Requirement"
      onClose={onClose}
      size="sm"
    >
      <div className="flex flex-col gap-4">
        {error && (
          <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <Fw label="Product">
          <SearchableSelect
            value={productId}
            onChange={(v) => {
              setProductId(v)
              setUnitId("")
            }}
            options={productOptions}
            onSearch={productSearch.setTerm}
            loading={productSearch.loading}
            error={productSearch.error}
            onRetry={productSearch.retry}
            placeholder="Search and select a product..."
            searchPlaceholder="Search by name or SKU..."
            emptyMessage="No products to choose from"
            noResultsMessage="No products matching your search"
          />
        </Fw>
        <Fw label="Unit">
          <SearchableSelect
            value={unitId || null}
            onChange={(v) => setUnitId(v)}
            options={unitOptions}
            onSearch={setUnitSearchTerm}
            loading={unitProducts.loading}
            error={unitProducts.error}
            onRetry={unitProducts.refresh}
            allowClear
            placeholder={
              unitProducts.loading
                ? "Loading units..."
                : productId
                  ? "Select a unit..."
                  : "Select a product first"
            }
            emptyMessage={
              productId
                ? "No units configured for this product"
                : "Select a product first"
            }
          />
        </Fw>
        <Fw label="Quantity Needed">
          <input
            type="number"
            min={1}
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={SC}
            placeholder={`0${baseUnit ? ` ${baseUnit.name ?? ""}` : ""}`}
          />
        </Fw>
        {showPreview && (
          <div className="rounded-xl bg-[#E6ECE2]/50 px-4 py-3 text-sm text-[#333333]">
            {qty} {productUnit?.unit?.name ?? ""} ={" "}
            <span className="font-semibold text-[#7A9076]">
              {baseQty} {baseUnit?.name ?? ""}
            </span>
            <span className="text-[#999] text-xs ml-2">
              (conversion {formatFactor(productUnit?.conversionFactor ?? 1)}×)
            </span>
          </div>
        )}
        <Fw label="Reason">
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as LineReason)}
            className={SC}
          >
            <option>Low Stock</option>
            <option>Reorder Alert</option>
            <option>Manual</option>
          </select>
        </Fw>
        <Fw label="Notes (optional)">
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${SC} resize-none`}
            placeholder="Optional notes..."
          />
        </Fw>
        <div className="flex gap-3 justify-end border-t border-[#E6ECE2] pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAdd} loading={loading}>
            Add Product
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Edit Line Modal ─────────────────────────────────────────────────────────

function EditLineModal({
  open,
  line,
  onClose,
  onSave,
}: {
  open: boolean
  line: RequirementLine | null
  onClose: () => void
  onSave: (updated: RequirementLine) => void
}) {
  const [quantity, setQuantity] = useState(
    line?.quantityNeeded.toString() ?? "",
  )
  const [unitId, setUnitId] = useState(line?.unitId ?? "")
  const [reason, setReason] = useState<LineReason>(line?.reason ?? "Low Stock")
  const [notes, setNotes] = useState(line?.notes ?? "")
  const [loading, setLoading] = useState(false)
  const [unitSearchTerm, setUnitSearchTerm] = useState("")

  const unitProducts = useProductUnits(line?.productId ?? null)
  const baseUnit = unitProducts.baseUnit
  const unitOptions = unitProducts.options.filter(
    (o) =>
      !unitSearchTerm ||
      o.label.toLowerCase().includes(unitSearchTerm.toLowerCase()),
  )

  const qty = parseFloat(quantity) || 0
  const productUnit = unitProducts.units.find((u) => u.unitId === unitId)
  const baseQty = toBaseQuantity(qty, productUnit)
  const showPreview = !!unitId && qty > 0 && baseQty !== null && !!baseUnit

  useEffect(() => {
    if (line) {
      setQuantity(line.quantityNeeded.toString())
      setUnitId(line.unitId ?? "")
      setReason(line.reason)
      setNotes(line.notes)
    }
  }, [line])

  async function handleSave() {
    if (!line) return
    if (!qty || qty <= 0) return
    setLoading(true)
    try {
      onSave({
        ...line,
        quantityNeeded: qty,
        unitId: unitId || null,
        reason,
        notes,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Edit Requirement Item"
      onClose={onClose}
      size="sm"
    >
      <div className="flex flex-col gap-4">
        {line?.product && (
          <div className="rounded-xl bg-[#E6ECE2]/50 px-4 py-3">
            <p className="text-xs text-[#999]">Product</p>
            <p className="text-sm font-bold text-[#333333]">{line.product}</p>
          </div>
        )}
        <Fw label="Unit">
          <SearchableSelect
            value={unitId || null}
            onChange={(v) => setUnitId(v)}
            options={unitOptions}
            onSearch={setUnitSearchTerm}
            loading={unitProducts.loading}
            error={unitProducts.error}
            onRetry={unitProducts.refresh}
            allowClear
            placeholder="Select a unit..."
            emptyMessage={
              unitProducts.loading
                ? "Loading units..."
                : "No units configured for this product"
            }
          />
        </Fw>
        <Fw label="Quantity Needed">
          <input
            type="number"
            min={1}
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={SC}
            placeholder={`0${baseUnit ? ` ${baseUnit.name ?? ""}` : ""}`}
          />
        </Fw>
        {showPreview && (
          <div className="rounded-xl bg-[#E6ECE2]/50 px-4 py-3 text-sm text-[#333333]">
            {qty} {productUnit?.unit?.name ?? ""} ={" "}
            <span className="font-semibold text-[#7A9076]">
              {baseQty} {baseUnit?.name ?? ""}
            </span>
            <span className="text-[#999] text-xs ml-2">
              (conversion {formatFactor(productUnit?.conversionFactor ?? 1)}×)
            </span>
          </div>
        )}
        <Fw label="Reason">
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as LineReason)}
            className={SC}
          >
            <option>Low Stock</option>
            <option>Reorder Alert</option>
            <option>Manual</option>
          </select>
        </Fw>
        <Fw label="Notes">
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${SC} resize-none`}
            placeholder="Optional notes..."
          />
        </Fw>
        <div className="flex gap-3 justify-end border-t border-[#E6ECE2] pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={loading}>
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Confirm Modal ───────────────────────────────────────────────────────────

function ConfirmModal({
  open,
  title,
  message,
  detail,
  confirmLabel,
  confirmClass,
  onClose,
  onConfirm,
  loading,
}: {
  open: boolean
  title: string
  message: string
  detail?: string
  confirmLabel: string
  confirmClass: string
  onClose: () => void
  onConfirm: () => void
  loading?: boolean
}) {
  return (
    <Modal open={open} title={title} onClose={onClose} size="sm">
      <p className="text-sm text-[#666666]">{message}</p>
      {detail && <p className="mt-2 text-xs text-[#999]">{detail}</p>}
      <div className="flex gap-3 justify-end mt-6">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${confirmClass}`}
        >
          {loading ? "..." : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

// ─── Order Preview Modal ─────────────────────────────────────────────────────

function OrderPreviewModal({
  open,
  line,
  preview,
  onClose,
  onCreatePO,
}: {
  open: boolean
  line: RequirementLine | null
  preview: OrderPreviewDto | null
  onClose: () => void
  onCreatePO: (
    quantity: number,
    unitCost: number,
    expectedDeliveryDate: string,
    notes: string,
  ) => void
}) {
  const [quantity, setQuantity] = useState("")
  const [unitCost, setUnitCost] = useState("")
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open && preview) {
      setQuantity(preview.suggestedOrderQuantity.toString())
      setUnitCost("")
      setExpectedDeliveryDate("")
      setNotes("")
      setError("")
    }
  }, [open, preview])

  function handleCreate() {
    if (!line || !preview) return
    if (!quantity || parseFloat(quantity) <= 0) {
      setError("Quantity must be greater than zero.")
      return
    }
    if (parseFloat(quantity) > preview.remainingQuantity) {
      setError(
        `Cannot order more than remaining quantity (${preview.remainingQuantity}).`,
      )
      return
    }
    if (!unitCost || parseFloat(unitCost) < 0) {
      setError("Unit cost must be a valid number.")
      return
    }
    setError("")
    setLoading(true)
    onCreatePO(
      parseFloat(quantity),
      parseFloat(unitCost),
      expectedDeliveryDate,
      notes,
    )
    setLoading(false)
  }

  if (!open || !line || !preview) return null

  return (
    <Modal open={true} title="Order Remaining" onClose={onClose} size="md">
      <div className="flex flex-col gap-4">
        {error && (
          <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="rounded-xl bg-[#E6ECE2]/50 p-4">
          <p className="text-xs font-bold text-[#666666] uppercase tracking-wide mb-3">
            Requirement Line Preview
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[#999]">Product</p>
              <p className="font-semibold text-[#333333]">{line.product}</p>
            </div>
            <div>
              <p className="text-[#999]">SKU</p>
              <p className="font-semibold text-[#333333]">{line.sku || "—"}</p>
            </div>
            <div>
              <p className="text-[#999]">Required</p>
              <p className="font-bold text-[#333333]">
                {preview.requiredQuantity}
              </p>
            </div>
            <div>
              <p className="text-[#999]">Ordered</p>
              <p className="font-bold text-[#333333]">
                {preview.orderedQuantity}
              </p>
            </div>
            <div>
              <p className="text-[#999]">Remaining to Order</p>
              <p className="font-bold text-[#7A9076]">
                {preview.remainingQuantity}
              </p>
            </div>
            <div>
              <p className="text-[#999]">Suggested Order Qty</p>
              <p className="font-bold text-[#7A9076]">
                {preview.suggestedOrderQuantity}
              </p>
            </div>
            <div>
              <p className="text-[#999]">Active POs</p>
              <p className="font-semibold text-[#333333]">
                {preview.activeOrderCount}
              </p>
            </div>
            <div>
              <p className="text-[#999]">Line Status</p>
              <p className="font-semibold text-[#333333]">
                <LineBadge status={preview.lineStatus} />
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#E6ECE2] p-4">
          <p className="text-xs font-bold text-[#666666] uppercase tracking-wide mb-3">
            Create Purchase Order
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <Fw label="Quantity to Order">
              <input
                type="number"
                min={1}
                max={preview.remainingQuantity}
                step="0.001"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={SC}
                placeholder={preview.suggestedOrderQuantity.toString()}
              />
            </Fw>
            <Fw label="Unit Cost (ETB)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className={SC}
                placeholder="0.00"
              />
            </Fw>
            <Fw label="Expected Delivery Date">
              <DatePicker
                value={expectedDeliveryDate}
                onChange={setExpectedDeliveryDate}
                placeholder="Select expected delivery date..."
              />
            </Fw>
            <Fw label="Notes (optional)">
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={`${SC} resize-none`}
                placeholder="Optional notes..."
              />
            </Fw>
          </div>
        </div>

        <div className="flex gap-3 justify-end border-t border-[#E6ECE2] pt-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} loading={loading}>
            Create Purchase Order
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Requirement Order Modal ─────────────────────────────────────────────────

interface OrderDraftLine {
  line: RequirementLine
  selected: boolean
  quantity: string
  unitCost: string
}

function RequirementOrderModal({
  requirement,
  onClose,
}: {
  requirement: Requirement | null
  onClose: () => void
}) {
  const [drafts, setDrafts] = useState<OrderDraftLine[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    if (!requirement) return
    setDrafts(
      requirement.lines
        .filter(
          (l) =>
            l.status !== "CLOSED" &&
            (l.remainingToReceive > 0 || l.quantityRemaining > 0),
        )
        .map((l) => ({
          line: l,
          selected: true,
          quantity: String(
            l.remainingToReceive > 0
              ? l.remainingToReceive
              : l.quantityRemaining,
          ),
          unitCost: "",
        })),
    )
    setError("")
  }, [requirement])

  const req = requirement
  if (!req) return null
  const reference = req.reference

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
    for (const d of picked) {
      const qty = parseFloat(d.quantity)
      const remaining =
        d.line.remainingToReceive > 0
          ? d.line.remainingToReceive
          : d.line.quantityRemaining
      if (!Number.isFinite(qty) || qty <= 0) {
        setError(`Quantity must be greater than zero for ${d.line.product}.`)
        return
      }
      if (qty > remaining) {
        setError(
          `Cannot order more than the remaining quantity for ${d.line.product}.`,
        )
        return
      }
      if (
        d.unitCost === "" ||
        !Number.isFinite(parseFloat(d.unitCost)) ||
        parseFloat(d.unitCost) < 0
      ) {
        setError(`Enter a valid unit cost for ${d.line.product}.`)
        return
      }
    }
    setError("")
    const params = new URLSearchParams()
    for (const d of picked) {
      params.append("requirementLineId", d.line.id)
      params.append("quantity", d.quantity)
      params.append("unitCost", d.unitCost)
      params.append("requirementReference", reference)
      params.append("productName", d.line.product)
      params.append("productSku", d.line.sku)
      if (d.line.unitName) params.append("unitName", d.line.unitName)
    }
    window.location.href = `/purchasing/orders/new?${params.toString()}`
  }

  return (
    <Modal
      open
      title={`Create Purchase Order — ${reference}`}
      onClose={onClose}
      size="xl"
    >
      {error && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <p className="mb-4 text-sm text-[#666666]">
        Select the products under this requirement to order and enter a unit
        cost for each. Quantities are pre-filled with the remaining amount to
        receive.
      </p>

      {drafts.length === 0 ? (
        <p className="rounded-xl border border-[#E6ECE2] bg-[#E6ECE2]/40 px-4 py-6 text-center text-sm text-[#666666]">
          No orderable products remain on this requirement.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#E6ECE2]">
          <table className="w-full min-w-[760px] text-sm">
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
              {drafts.map((d, i) => {
                const remaining =
                  d.line.remainingToReceive > 0
                    ? d.line.remainingToReceive
                    : d.line.quantityRemaining
                return (
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
                        onChange={(e) =>
                          update(i, { selected: e.target.checked })
                        }
                        className="accent-[#4F6B4A] w-4 h-4"
                        aria-label={`Select ${d.line.product}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#333333]">
                        {d.line.product}
                      </div>
                      {d.line.sku && (
                        <div className="text-xs text-[#999] font-mono">
                          {d.line.sku}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-[#333333]">
                      {d.line.quantityNeeded}
                      {d.line.unitName && (
                        <span className="ml-1 text-xs text-[#999]">
                          {d.line.unitName}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-[#666666]">
                      {d.line.quantityOrdered}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[#4F6B4A]">
                      {remaining}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={d.quantity}
                        onChange={(e) =>
                          update(i, { quantity: e.target.value })
                        }
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
                        onChange={(e) =>
                          update(i, { unitCost: e.target.value })
                        }
                        disabled={!d.selected}
                        placeholder="0.00"
                        className="w-28 rounded-lg border border-[#C6D4BF] px-2.5 py-1.5 text-sm focus:border-[#B6C8AF] focus:outline-none disabled:opacity-50"
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

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

// ─── Shared atoms ────────────────────────────────────────────────────────────

const SC =
  "w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm focus:border-[#B6C8AF] focus:outline-none bg-white"

function Fw({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium text-[#333333] block mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}
