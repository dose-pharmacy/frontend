import { useState, useEffect, useRef, useCallback } from "react"
import { ChevronRight } from "lucide-react"
import PageHeader from "../../components/ui/PageHeader"
import Modal from "../../components/ui/Modal"
import SearchInput from "../../components/ui/SearchInput"
import Button from "../../components/ui/Button"
import Pagination from "../../components/ui/Pagination"
import StatusChip, { type StatusTone } from "../../components/ui/StatusChip"
import {
  listRequirements,
  createRequirement,
  getRequirement,
  updateRequirement,
  closeRequirement,
  deleteRequirement,
  generateRequirementFromReorder,
  addRequirementLine,
  updateRequirementLine,
  removeRequirementLine,
  getOrderPreview,
  RequirementsApiError,
  type RequirementDto,
  type RequirementLineDto,
  type RequirementStatus as RequirementStatusType,
  type OrderPreviewDto,
} from "../../features/purchasing/requirementsApi"
import {
  listSuppliers,
  type SupplierDto,
} from "../../features/purchasing/suppliersApi"
import {
  listProducts,
  type ProductDto,
} from "../../features/inventory/productsApi"
import { getReorderSuggestions } from "../../features/inventory/reorderApi"

// ─── Types ────────────────────────────────────────────────────────────────────

type RequirementStatus = "OPEN" | "PARTIALLY_FULFILLED" | "FULFILLED" | "CLOSED" | string & {}
type LineStatus = "OPEN" | "PARTIALLY_FULFILLED" | "FULFILLED" | "CLOSED" | string & {}
type LineReason = "Low Stock" | "Reorder Alert" | "Manual" | ""

interface RequirementLine {
  id: string
  product: string
  sku: string
  quantityNeeded: number
  quantityOrdered: number
  quantityDelivered: number
  quantityRemaining: number
  remainingToReceive: number
  reason: LineReason
  reasonCode: string | null
  notes: string
  status: LineStatus
  activeOrderCount: number
  /** Set when the line already has purchase orders (blocks edits/removal). */
  hasPo: boolean
  /** Purchase order items linked to this requirement line. */
  purchaseOrderItems?: { purchaseOrderId: string quantityOrdered: number }[]
}

interface Requirement {
  id: string
  reference: string
  requiredBy: string
  notes: string
  status: RequirementStatus
  createdBy: string
  createdDate: string
  lines: RequirementLine[]
}

// ─── API -> UI adapters ───────────────────────────────────────────────────────

function reasonLabel(code: string | null | undefined): LineReason {
  switch (code) {
    case "LOW_STOCK":
      return "Low Stock"
    case "REORDER_ALERT":
      return "Reorder Alert"
    case "MANUAL":
      return "Manual"
    default:
      return ""
  }
}

function reasonCode(reason: LineReason): string | null {
  switch (reason) {
    case "Low Stock":
      return "LOW_STOCK"
    case "Reorder Alert":
      return "REORDER_ALERT"
    case "Manual":
      return "MANUAL"
    default:
      return null
  }
}

function mapLine(l: RequirementLineDto): RequirementLine {
  return {
    id: l.id,
    product: l.product?.name ?? "Unknown product",
    sku: l.product?.sku ?? "",
    quantityNeeded: l.quantityNeeded,
    quantityOrdered: l.quantityOrdered,
    quantityDelivered: l.quantityDelivered,
    quantityRemaining: l.quantityRemaining,
    remainingToReceive: l.remainingToReceive,
    reason: reasonLabel(l.reasonCode),
    reasonCode: l.reasonCode,
    notes: l.notes ?? "",
    status: l.status,
    activeOrderCount: l.activeOrderCount ?? l.purchaseOrderItems?.length ?? 0,
    hasPo: (l.purchaseOrderItems?.length ?? 0) > 0,
    purchaseOrderItems: l.purchaseOrderItems,
  }
}

function mapRequirement(r: RequirementDto): Requirement {
  return {
    id: r.id,
    reference: r.reference,
    requiredBy: r.requiredBy?.slice(0, 10) ?? "",
    notes: r.notes ?? "",
    status: r.status,
    createdBy: r.createdBy?.name ?? "—",
    createdDate: r.createdAt?.slice(0, 10) ?? "",
    lines: (r.lines ?? []).map(mapLine),
  }
}

function errMessage(e: unknown): string {
  return e instanceof RequirementsApiError
    ? e.message
    : "Something went wrong. Please try again."
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

const PAGE_SIZE = 50

function ReqBadge({ status }: { status: RequirementStatus }) {
  const map: Record<string, StatusTone> = {
    OPEN: "sage",
    PARTIALLY_FULFILLED: "blue",
    FULFILLED: "green",
    CLOSED: "gray",
  }
  const labelMap: Record<string, string> = {
    PARTIALLY_FULFILLED: "PARTIALLY FULFILLED",
  }
  return (
    <StatusChip
      label={labelMap[status] ?? status}
      tone={map[status] ?? map.OPEN}
    />
  )
}

function LineBadge({ status }: { status: LineStatus }) {
  const map: Record<string, StatusTone> = {
    OPEN: "sage",
    PARTIALLY_FULFILLED: "blue",
    FULFILLED: "green",
    CLOSED: "gray",
  }
  const labelMap: Record<string, string> = {
    PARTIALLY_FULFILLED: "PARTIALLY FULFILLED",
  }
  return (
    <StatusChip
      label={labelMap[status] ?? status}
      tone={map[status] ?? map.OPEN}
    />
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onDone }: { message: string onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-[#333333] px-5 py-3.5 text-sm text-white shadow-xl animate-in fade-in slide-in-from-bottom-4">
      <svg
        className="h-4 w-4 shrink-0 text-[#7A9076]"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
          clipRule="evenodd"
        />
      </svg>
      {message}
    </div>
  )
}

// ─── OverflowMenu ─────────────────────────────────────────────────────────────

function OverflowMenu({
  items,
}: {
  items: { label: string danger?: boolean onClick: () => void }[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [])
  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-lg text-[#666666] hover:bg-[#E6ECE2] transition-colors"
        aria-label="More actions"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-44 rounded-xl border border-[#E6ECE2] bg-white shadow-xl py-1">
          {items.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                setOpen(false)
                item.onClick()
              }}
              className={`w-full text-left px-4 py-2 text-sm transition-colors hover:bg-[#E6ECE2]/60 ${
                item.danger ? "text-red-600" : "text-[#333333]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Root page ────────────────────────────────────────────────────────────────

export default function PurchaseRequirementsPage() {
  const [reqs, setReqs] = useState<Requirement[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [detailId, setDetailId] = useState<string | null>(null)
  const [toast, setToast] = useState("")
  const [newOpen, setNewOpen] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [summary, setSummary] = useState({
    open: 0,
    partiallyFulfilled: 0,
    fulfilled: 0,
    closed: 0,
    total: 0,
  })

  function showToast(msg: string) {
    setToast(msg)
  }
  const reload = useCallback(() => setRefreshTick((t) => t + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError("")
    const params: any = { page, limit: 20 }
    if (search) params.search = search
    if (statusFilter) params.status = statusFilter
    listRequirements(params)
      .then((result) => {
        if (cancelled) return
        setReqs(result.data.map(mapRequirement))
        setTotalPages(result.meta.totalPages)
        setTotalCount(result.meta.total)
        // Calculate summary from current page data (approximation) - in a real app you'd fetch summary separately
        const counts = {
          open: 0,
          partiallyFulfilled: 0,
          fulfilled: 0,
          closed: 0,
          total: result.meta.total,
        }
        result.data.forEach((r) => {
          if (r.status === "OPEN") counts.open++
          else if (r.status === "PARTIALLY_FULFILLED")
            counts.partiallyFulfilled++
          else if (r.status === "FULFILLED") counts.fulfilled++
          else if (r.status === "CLOSED") counts.closed++
        })
        setSummary(counts)
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
  }, [refreshTick, page, search, statusFilter])

  const detail = reqs.find((r) => r.id === detailId) ?? null

  if (detail) {
    return (
      <>
        <RequirementDetailScreen
          req={detail}
          onBack={() => setDetailId(null)}
          onChanged={reload}
          onToast={showToast}
        />
        {toast && <Toast message={toast} onDone={() => setToast("")} />}
      </>
    )
  }

  return (
    <>
      <RequirementsListScreen
        reqs={reqs}
        loading={loading}
        loadError={loadError}
        onRetry={reload}
        onSelect={(id) => setDetailId(id)}
        onNewReq={() => setNewOpen(true)}
        onGenerate={() => setGenerateOpen(true)}
        onToast={showToast}
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        page={page}
        setPage={setPage}
        totalPages={totalPages}
        totalCount={totalCount}
        summary={summary}
      />
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
      {toast && <Toast message={toast} onDone={() => setToast("")} />}
    </>
  )
}

// ─── Requirements List Screen ─────────────────────────────────────────────────

function RequirementsListScreen({
  reqs,
  loading,
  loadError,
  onRetry,
  onSelect,
  onNewReq,
  onGenerate,
  onToast,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  page,
  setPage,
  totalPages,
  totalCount,
  summary,
}: {
  reqs: Requirement[]
  loading: boolean
  loadError: string
  onRetry: () => void
  onSelect: (id: string) => void
  onNewReq: () => void
  onGenerate: () => void
  onToast: (msg: string) => void
  search: string
  setSearch: (v: string) => void
  statusFilter: string
  setStatusFilter: (v: string) => void
  page: number
  setPage: (v: number) => void
  totalPages: number
  totalCount: number
  summary: {
    open: number
    partiallyFulfilled: number
    fulfilled: number
    closed: number
    total: number
  }
}) {
  const [deleting, setDeleting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Requirement | null>(null)

  const paginated = reqs

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteRequirement(deleteTarget.id)
      setDeleteTarget(null)
      onToast("Requirement deleted successfully.")
      onRetry()
    } catch (e) {
      setDeleteTarget(null)
      onToast(errMessage(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb="Purchasing / Requirements"
        title="Purchase Requirements"
        subtitle="Manage products that need to be purchased and prepare them for supplier ordering."
        actions={
          <div className="flex gap-2">
            <button
              onClick={onNewReq}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white text-[#7A9076] px-3.5 py-2 text-sm font-semibold hover:bg-[#E6ECE2] transition-colors"
            >
              + New Requirement
            </button>
            <button
              onClick={onGenerate}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#C6D4BF] bg-white px-3.5 py-2 text-sm font-semibold text-[#7A9076] hover:bg-[#E6ECE2] transition-colors"
            >
              Generate from Reorder
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1 min-w-[200px]">
              <SearchInput
                value={search}
                onChange={(v) => {
                  setSearch(v)
                  setPage(1)
                }}
                placeholder="Search requirements..."
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="sm:w-48 rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm focus:border-[#B6C8AF] focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option>OPEN</option>
              <option>PARTIALLY_FULFILLED</option>
              <option>FULFILLED</option>
              <option>CLOSED</option>
            </select>
            {(search || statusFilter) && (
              <button
                onClick={() => {
                  setSearch("")
                  setStatusFilter("")
                  setPage(1)
                }}
                className="text-xs font-semibold text-[#7A9076] hover:underline whitespace-nowrap"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {([
            [
              "Open Requirements",
              summary.open,
              "text-[#7A9076]",
              "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
            ],
            [
              "Partially Fulfilled",
              summary.partiallyFulfilled,
              "text-blue-600",
              "M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0zM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632z",
            ],
            [
              "Fulfilled Requirements",
              summary.fulfilled,
              "text-green-600",
              "M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25-2.25v6.75a2.25 2.25 0 0 0 2.25 2.25z",
            ],
            [
              "Closed Requirements",
              summary.closed,
              "text-gray-500",
              "M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25-2.25v6.75a2.25 2.25 0 0 0-2.25-2.25z",
            ],
            [
              "Total Requirements",
              summary.total,
              "text-[#333333]",
              "M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0-1.125.504-1.125 1.125V11.25a9 9 0 0 0-9-9z",
            ],
          ] as [string, number, string, string][]).map(
            ([label, value, accent, iconPath]) => (
              <div
                key={label}
                className="bg-white rounded-xl border border-[#E6ECE2] p-4 flex items-center gap-3"
              >
                <div
                  className={`h-10 w-10 rounded-xl bg-[#E6ECE2] flex items-center justify-center shrink-0 ${accent}`}
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d={iconPath}
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-[#666666]">{label}</p>
                  <p className={`text-2xl font-bold ${accent}`}>{value}</p>
                </div>
              </div>
            ),
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3 animate-pulse">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 rounded-lg bg-[#E6ECE2]" />
              ))}
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 px-6 text-center">
              <p className="text-sm font-semibold text-red-600">{loadError}</p>
              <Button variant="secondary" onClick={onRetry}>
                Try Again
              </Button>
            </div>
          ) : reqs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="h-16 w-16 rounded-2xl bg-[#E6ECE2] flex items-center justify-center">
                <svg
                  className="h-8 w-8 text-[#7A9076]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9z"
                  />
                </svg>
              </div>
              <div className="text-center">
                <p className="font-semibold text-[#333333]">
                  No purchase requirements yet
                </p>
                <p className="text-sm text-[#666666] mt-1">
                  Create a requirement manually or generate one from reorder
                  suggestions.
                </p>
              </div>
              <div className="flex gap-2 mt-2">
                <Button onClick={onNewReq}>+ New Requirement</Button>
                <Button variant="secondary" onClick={onGenerate}>
                  Generate from Reorder
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#E6ECE2] text-left">
                      {[
                        "Reference",
                        "Required By",
                        "Items",
                        "Status",
                        "Created By",
                        "Created Date",
                        "Actions",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 font-semibold text-[#333333]"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((r, i) => (
                      <tr
                        key={r.id}
                        className={`hover:bg-[#E6ECE2]/30 transition-colors ${
                          i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/15"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <button
                            onClick={() => onSelect(r.id)}
                            className="font-semibold text-[#7A9076] hover:underline"
                          >
                            {r.reference}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-[#666666] whitespace-nowrap">
                          {fmtDate(r.requiredBy)}
                        </td>
                        <td className="px-4 py-3 text-[#666666]">
                          {r.lines.length} item{r.lines.length !== 1 ? "s" : ""}
                        </td>
                        <td className="px-4 py-3">
                          <ReqBadge status={r.status} />
                        </td>
                        <td className="px-4 py-3 text-[#666666]">
                          {r.createdBy}
                        </td>
                        <td className="px-4 py-3 text-[#666666] whitespace-nowrap">
                          {fmtDate(r.createdDate)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => onSelect(r.id)}
                              className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#7A9076] hover:underline whitespace-nowrap"
                            >
                              View <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                            <OverflowMenu
                              items={[
                                {
                                  label: "View",
                                  onClick: () => onSelect(r.id),
                                },
                                {
                                  label: "Edit",
                                  onClick: () => onSelect(r.id),
                                },
                                ...(r.status !== "CLOSED"
                                  ? [
                                      {
                                        label: "Delete",
                                        danger: true,
                                        onClick: () => setDeleteTarget(r),
                                      },
                                    ]
                                  : []),
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                total={totalCount}
                pageSize={20}
                itemLabel="requirements"
              />
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Requirement?"
        message={`Delete ${deleteTarget?.reference}?`}
        detail="This action cannot be undone. Requirements that already have purchase orders cannot be deleted."
        confirmLabel="Delete"
        confirmClass="bg-red-600 hover:bg-red-700 text-white"
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={deleting}
      />
    </div>
  )
}

// ─── Requirement Detail Screen ────────────────────────────────────────────────

function RequirementDetailScreen({
  req,
  onBack,
  onChanged,
  onToast,
}: {
  req: Requirement
  onBack: () => void
  onChanged: () => void
  onToast: (msg: string) => void
}) {
  const [editOpen, setEditOpen] = useState(false)
  const [addProductOpen, setAddProductOpen] = useState(false)
  const [editLine, setEditLine] = useState<RequirementLine | null>(null)

  const [deleteLine, setDeleteLine] = useState<RequirementLine | null>(null)
  const [closeOpen, setCloseOpen] = useState(false)
  const [apiError, setApiError] = useState("")
  const [busy, setBusy] = useState(false)

  const isReadOnly = req.status === "CLOSED"

  async function runAction(action: () => Promise<unknown>, toastMsg: string) {
    setApiError("")
    setBusy(true)
    try {
      await action()
      onToast(toastMsg)
      onChanged()
    } catch (e) {
      setApiError(errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  function updateLine(updated: RequirementLine) {
    setEditLine(null)
    void runAction(
      () =>
        updateRequirementLine(updated.id, {
          quantityNeeded: updated.quantityNeeded,
          reasonCode: reasonCode(updated.reason),
          notes: updated.notes || null,
        }),
      "Requirement item updated.",
    )
  }
  function removeLine(line: RequirementLine) {
    setDeleteLine(null)
    void runAction(
      () => removeRequirementLine(line.id),
      "Item removed from requirement.",
    )
  }
  function closeReq() {
    setCloseOpen(false)
    void runAction(
      () => closeRequirement(req.id),
      "Requirement closed successfully.",
    )
  }

  const [orderPreviewOpen, setOrderPreviewOpen] = useState<{
    line: RequirementLine
    preview: OrderPreviewDto
  } | null>(null)

  async function handleOrderRemaining(line: RequirementLine) {
    setApiError("")
    setBusy(true)
    try {
      const preview = await getOrderPreview(line.id)
      setOrderPreviewOpen({ line, preview })
    } catch (e) {
      setApiError(errMessage(e))
    } finally {
      setBusy(false)
    }
  }

  function navigateToCreatePO(
    line: RequirementLine,
    quantity: number,
    unitCost: number,
    expectedDeliveryDate: string,
    notes: string,
  ) {
    const params = new URLSearchParams()
    params.set("requirementLineId", line.id)
    params.set("quantity", quantity.toString())
    params.set("unitCost", unitCost.toString())
    if (expectedDeliveryDate)
      params.set("expectedDeliveryDate", expectedDeliveryDate)
    if (notes) params.set("notes", notes)
    params.set("requirementReference", req.reference)
    params.set("productName", line.product)
    params.set("productSku", line.sku)
    window.location.href = `/purchasing/orders/new?${params.toString()}`
  }

  const reqStatus: RequirementStatus = req.status

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div
        className="px-6 pt-5 pb-4"
        style={{
          background: "linear-gradient(135deg, #B6C8AF 0%, #7A9076 100%)",
        }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-[#333333]/80 hover:text-[#333333] transition-colors mb-3"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
              clipRule="evenodd"
            />
          </svg>
          Requirements
        </button>
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <p className="text-xs text-[#333333]/60 font-medium mb-0.5 tracking-wide">
              Purchase Requirement
            </p>
            <h1 className="text-xl font-bold text-[#333333]">
              {req.reference}
            </h1>
          </div>
          <ReqBadge status={reqStatus} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        {apiError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
            <span>{apiError}</span>
            <button
              onClick={() => setApiError("")}
              className="text-red-500 hover:text-red-700 text-xs font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Section 1: Requirement Information */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#E6ECE2] flex items-center justify-between">
            <p className="text-xs font-bold text-[#666666] uppercase tracking-wide">
              Requirement Information
            </p>
            {!isReadOnly && (
              <div className="flex gap-3">
                <button
                  onClick={() => setEditOpen(true)}
                  className="text-xs font-semibold text-[#7A9076] hover:underline"
                >
                  Edit Requirement
                </button>
                <button
                  onClick={() => setCloseOpen(true)}
                  className="text-xs font-semibold text-orange-500 hover:underline"
                >
                  Close Requirement
                </button>
              </div>
            )}
          </div>
          <div className="px-5 py-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {([
              ["Reference", req.reference],
              ["Required By", fmtDate(req.requiredBy)],
              ["Created By", req.createdBy],
              ["Created Date", fmtDate(req.createdDate)],
              ["Status", reqStatus],
              ["Notes", req.notes || "—"],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-[#999] mb-0.5">{label}</p>
                {label === "Status" ? (
                  <ReqBadge status={value as RequirementStatus} />
                ) : (
                  <p className="text-sm font-semibold text-[#333333]">
                    {value}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: Requirement Items */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#E6ECE2] flex items-center justify-between">
            <p className="text-xs font-bold text-[#666666] uppercase tracking-wide">
              Requirement Items{" "}
              <span className="text-[#7A9076] ml-1">({req.lines.length})</span>
            </p>
            {!isReadOnly && (
              <button
                onClick={() => setAddProductOpen(true)}
                className="text-xs font-semibold text-[#7A9076] hover:underline"
              >
                + Add Product
              </button>
            )}
          </div>
          {req.lines.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-[#999]">
              No products added. Click "+ Add Product" to begin.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#E6ECE2]/50 text-left">
                    <th className="px-4 py-3 font-semibold text-[#333333]">
                      Product
                    </th>
                    <th className="px-4 py-3 font-semibold text-[#333333]">
                      SKU
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
                    <th className="px-4 py-3 font-semibold text-[#333333] text-right hidden sm:table-cell">
                      Delivered
                    </th>
                    <th className="px-4 py-3 font-semibold text-[#333333] text-right hidden md:table-cell">
                      Rem. to Receive
                    </th>
                    <th className="px-4 py-3 font-semibold text-[#333333]">
                      Status
                    </th>
                    <th className="px-4 py-3 font-semibold text-[#333333] hidden lg:table-cell">
                      Reason
                    </th>
                    {!isReadOnly && (
                      <th className="px-4 py-3 font-semibold text-[#333333]">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {req.lines.map((line, idx) => (
                    <tr
                      key={line.id}
                      className={idx % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/20"}
                    >
                      <td className="px-4 py-3 font-medium text-[#333333]">
                        {line.product}
                        {line.hasPo && (
                          <span className="ml-2 align-middle inline-block">
                            <StatusChip label="PO Linked" tone="blue" />
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#666666] font-mono text-xs">
                        {line.sku || "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[#333333]">
                        {line.quantityNeeded}
                      </td>
                      <td className="px-4 py-3 text-right text-[#333333]">
                        {line.quantityOrdered}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-[#7A9076]">
                        {line.quantityRemaining}
                      </td>
                      <td className="px-4 py-3 text-right text-[#666666] hidden sm:table-cell">
                        {line.quantityDelivered}
                      </td>
                      <td className="px-4 py-3 text-right text-[#666666] hidden md:table-cell">
                        {line.remainingToReceive}
                      </td>
                      <td className="px-4 py-3">
                        <LineBadge status={line.status} />
                      </td>
                      <td className="px-4 py-3 text-[#666666] hidden lg:table-cell">
                        {line.reason || "—"}
                      </td>
                      {!isReadOnly && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <OverflowMenu
                              items={[
                                {
                                  label: "Edit",
                                  onClick: () => setEditLine(line),
                                },
                                ...(line.quantityRemaining > 0
                                  ? [
                                      {
                                        label: "Order Remaining",
                                        onClick: () =>
                                          handleOrderRemaining(line),
                                      },
                                    ]
                                  : [
                                      { label: "Fulfilled", onClick: () => {} },
                                    ]),
                                ...(line.hasPo
                                  ? []
                                  : [
                                      {
                                        label: "Remove",
                                        danger: true,
                                        onClick: () => setDeleteLine(line),
                                      },
                                    ]),
                              ]}
                            />
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {isReadOnly && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 text-sm font-medium text-gray-500">
            This requirement is <strong>CLOSED</strong> and cannot be modified.
          </div>
        )}

        {/* Section 3: Purchase Order History */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden">
          <div className="px-5 py-3 border-b border-[#E6ECE2] flex items-center justify-between">
            <p className="text-xs font-bold text-[#666666] uppercase tracking-wide">
              Purchase Order History
            </p>
          </div>
          <div className="p-5">
            {(() => {
              const allAllocations = req.lines.flatMap((line) =>
                (line.purchaseOrderItems ?? []).map((poItem) => ({
                  poNumber: poItem.purchaseOrderId,
                  supplier: "—",
                  status: "ACTIVE",
                  allocatedQuantity: poItem.quantityOrdered,
                  orderedQuantity: poItem.quantityOrdered,
                  receivedQuantity: 0,
                  unitCost: 0,
                  active: true,
                  created: "",
                  lineProduct: line.product,
                  lineSku: line.sku,
                })),
              )
              if (allAllocations.length === 0) {
                return (
                  <p className="text-sm text-[#999] text-center py-4">
                    No purchase orders linked to this requirement.
                  </p>
                )
              }
              return (
                <div className="space-y-3">
                  {allAllocations.map((alloc, idx) => (
                    <div
                      key={`${alloc.poNumber}-${idx}`}
                      className="rounded-lg border border-[#E6ECE2] p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-[#333333]">
                            {alloc.poNumber}
                          </span>
                          <StatusChip
                            label={alloc.active ? "ACTIVE" : "CANCELLED"}
                            tone={alloc.active ? "blue" : "red"}
                          />
                        </div>
                        <span className="text-xs text-[#999]">
                          {alloc.lineProduct} ({alloc.lineSku})
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-[#999]">Allocated</p>
                          <p className="font-semibold text-[#333333]">
                            {alloc.allocatedQuantity}
                          </p>
                        </div>
                        <div>
                          <p className="text-[#999]">Ordered</p>
                          <p className="font-semibold text-[#333333]">
                            {alloc.orderedQuantity}
                          </p>
                        </div>
                        <div>
                          <p className="text-[#999]">Received</p>
                          <p className="font-semibold text-[#333333]">
                            {alloc.receivedQuantity}
                          </p>
                        </div>
                        <div>
                          <p className="text-[#999]">Unit Cost</p>
                          <p className="font-semibold text-[#333333]">
                            {alloc.unitCost.toFixed(2)} ETB
                          </p>
                        </div>
                      </div>
                      {!alloc.active && (
                        <p className="mt-2 text-xs text-red-600 font-medium">
                          CANCELLED — Released allocation:{" "}
                          {alloc.allocatedQuantity}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        </div>
      </div>

      {/* Modals */}
      <EditRequirementModal
        open={editOpen}
        req={req}
        onClose={() => setEditOpen(false)}
        onSave={(updates) => {
          setEditOpen(false)
          void runAction(
            () => updateRequirement(req.id, updates),
            "Requirement updated successfully.",
          )
        }}
      />
      <AddProductModal
        open={addProductOpen}
        existingProductIds={[]}
        onClose={() => setAddProductOpen(false)}
        onAdd={(input) => {
          setAddProductOpen(false)
          void runAction(
            () => addRequirementLine(req.id, input),
            "Product added to requirement.",
          )
        }}
      />
      <EditLineModal
        open={!!editLine}
        line={editLine}
        onClose={() => setEditLine(null)}
        onSave={updateLine}
      />

      <ConfirmModal
        open={!!deleteLine}
        title="Remove Requirement Item?"
        message={`Remove ${deleteLine?.product} from ${req.reference}?`}
        detail="This action cannot be undone."
        confirmLabel="Remove"
        confirmClass="bg-red-600 hover:bg-red-700 text-white"
        onClose={() => setDeleteLine(null)}
        onConfirm={() => deleteLine && removeLine(deleteLine)}
        loading={busy}
      />
      <ConfirmModal
        open={closeOpen}
        title="Close Requirement?"
        message={`Are you sure you want to close ${req.reference}?`}
        detail="Closed requirements cannot be modified. All lines will be marked CLOSED."
        confirmLabel="Close Requirement"
        confirmClass="bg-orange-600 hover:bg-orange-700 text-white"
        onClose={() => setCloseOpen(false)}
        onConfirm={closeReq}
        loading={busy}
      />
      <OrderPreviewModal
        open={!!orderPreviewOpen}
        line={orderPreviewOpen?.line ?? null}
        preview={orderPreviewOpen?.preview ?? null}
        onClose={() => setOrderPreviewOpen(null)}
        onCreatePO={(quantity, unitCost, expectedDeliveryDate, notes) => {
          setOrderPreviewOpen(null)
          navigateToCreatePO(
            orderPreviewOpen!.line,
            quantity,
            unitCost,
            expectedDeliveryDate,
            notes,
          )
        }}
      />
    </div>
  )
}

// ─── New Requirement Modal ────────────────────────────────────────────────────

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
  const [loading, setLoading] = useState(false)

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

  async function handleCreate() {
    if (lines.length === 0) {
      setError("Add at least one product.")
      return
    }
    for (const l of lines) {
      if (!l.productId) {
        setError("Select a product for each row.")
        return
      }
      if (!l.quantity || parseInt(l.quantity) <= 0) {
        setError("Quantity must be greater than zero.")
        return
      }
    }
    const ids = lines.map((l) => l.productId)
    if (new Set(ids).size !== ids.length) {
      setError("Duplicate products are not allowed.")
      return
    }
    setError("")
    setLoading(true)
    try {
      // POST /requirements — requiredBy and notes are optional; per-line
      // reasonCode/notes are omitted (never sent as null) to satisfy the
      // backend's request validator.
      await createRequirement({
        ...(requiredBy
          ? { requiredBy: new Date(`${requiredBy}T00:00:00Z`).toISOString() }
          : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        lines: lines.map((l) => ({
          productId: l.productId,
          quantityNeeded: parseInt(l.quantity),
          ...(reasonCode(l.reason)
            ? { reasonCode: reasonCode(l.reason)! }
            : {}),
          ...(l.notes.trim() ? { notes: l.notes.trim() } : {}),
        })),
      } as Parameters<typeof createRequirement>[0])
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
      setError(errMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Create Purchase Requirement"
      onClose={onClose}
      size="lg"
    >
      <div className="flex flex-col gap-5">
        {error && (
          <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div className="grid sm:grid-cols-2 gap-4">
          <Fw label="Required By">
            <input
              type="date"
              value={requiredBy}
              onChange={(e) => setRequiredBy(e.target.value)}
              className={SC}
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
                      <td className="px-3 py-2">
                        <select
                          value={line.productId}
                          onChange={(e) => {
                            const p =
                              products.find((x) => x.id === e.target.value) ??
                              null
                            updateLine(i, "productId", e.target.value)
                            updateLine(i, "product", p)
                          }}
                          className={SC}
                        >
                          <option value="">Select product...</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
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
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreate} loading={loading}>
            Create Requirement
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Generate from Reorder Modal ──────────────────────────────────────────────

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
  const [suggestions, setSuggestions] = useState<{
    product: { id: string name: string sku: string }
    suggestedQuantity: number
  }[]>([])
  const [loadError, setLoadError] = useState("")
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoadError("")
    setSuggestions([])
    setShowConfirm(false)
    getReorderSuggestions({ page: 1, limit: 50 })
      .then((r) =>
        setSuggestions(
          r.data.map((s) => ({
            product: s.product,
            suggestedQuantity: s.suggestedQuantity,
          })),
        ),
      )
      .catch((e) => setLoadError(errMessage(e)))
  }, [open])

  async function handleGenerate() {
    setLoading(true)
    try {
      await generateRequirementFromReorder()
      onGenerated()
    } catch (e) {
      setLoadError(errMessage(e))
    } finally {
      setLoading(false)
    }
  }

  if (showConfirm) {
    return (
      <Modal
        open={true}
        title="Generate Purchase Requirement"
        onClose={() => {
          setShowConfirm(false)
          onClose()
        }}
        size="sm"
      >
        <p className="text-sm text-[#666666] mb-4">
          This will create a requirement from currently available reorder
          suggestions.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setShowConfirm(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setShowConfirm(false)
              handleGenerate()
            }}
            loading={loading}
            disabled={suggestions.length === 0 && !loadError}
          >
            Generate
          </Button>
        </div>
      </Modal>
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
        The system will create a purchase requirement from the current reorder
        suggestions.
      </p>
      {loadError && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">
          {loadError}
        </p>
      )}
      <div className="rounded-xl border border-[#E6ECE2] p-4 mb-5 max-h-64 overflow-y-auto">
        <p className="text-xs font-bold text-[#666666] uppercase tracking-wide mb-3">
          Products to Purchase
        </p>
        {suggestions.length === 0 ? (
          <p className="text-sm text-[#999] py-2">
            {loadError ? "—" : "No reorder suggestions available."}
          </p>
        ) : (
          <ul className="space-y-2">
            {suggestions.map((s) => (
              <li
                key={s.product.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-[#333333] font-medium">
                  {s.product.name}
                </span>
                <span className="font-bold text-[#7A9076]">
                  {s.suggestedQuantity}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="rounded-lg bg-[#E6ECE2]/60 px-4 py-2.5 mb-5 text-sm font-semibold text-[#333333]">
        {suggestions.length} products require purchasing
      </div>
      <div className="flex gap-3 justify-end">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={() => setShowConfirm(true)}
          loading={loading}
          disabled={suggestions.length === 0 && !loadError}
        >
          Generate Requirement
        </Button>
      </div>
    </Modal>
  )
}

// ─── Edit Requirement Modal ───────────────────────────────────────────────────

function EditRequirementModal({
  open,
  req,
  onClose,
  onSave,
}: {
  open: boolean
  req: Requirement
  onClose: () => void
  onSave: (updates: { requiredBy: string notes: string | null }) => void
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
          <input
            type="date"
            value={requiredBy}
            onChange={(e) => setRequiredBy(e.target.value)}
            className={SC}
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

// ─── Add Product Modal ────────────────────────────────────────────────────────

function AddProductModal({
  open,
  existingProductIds,
  onClose,
  onAdd,
}: {
  open: boolean
  existingProductIds: string[]
  onClose: () => void
  onAdd: (input: {
    productId: string
    quantityNeeded: number
    reasonCode: string | null
    notes: string | null
  }) => void
}) {
  const [products, setProducts] = useState<ProductDto[]>([])
  const [productId, setProductId] = useState("")
  const [quantity, setQuantity] = useState("")
  const [reason, setReason] = useState<LineReason>("Low Stock")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    listProducts({ limit: 200, isActive: true })
      .then((r) => setProducts(r.data))
      .catch(() => {})
  }, [open])

  async function handleAdd() {
    if (!productId) {
      setError("Please select a product.")
      return
    }
    if (!quantity || parseInt(quantity) <= 0) {
      setError("Quantity must be greater than zero.")
      return
    }
    if (existingProductIds.includes(productId)) {
      setError("This product is already in the requirement.")
      return
    }
    setError("")
    setLoading(true)
    try {
      onAdd({
        productId,
        quantityNeeded: parseInt(quantity),
        reasonCode: reasonCode(reason),
        notes: notes || null,
      })
      setProductId("")
      setQuantity("")
      setReason("Low Stock")
      setNotes("")
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
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className={SC}
          >
            <option value="">Select product...</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Fw>
        <Fw label="Quantity Needed">
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={SC}
            placeholder="0"
          />
        </Fw>
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

// ─── Edit Line Modal ──────────────────────────────────────────────────────────

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
  const [reason, setReason] = useState<LineReason>(line?.reason ?? "Low Stock")
  const [notes, setNotes] = useState(line?.notes ?? "")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (line) {
      setQuantity(line.quantityNeeded.toString())
      setReason(line.reason)
      setNotes(line.notes)
    }
  }, [line])

  async function handleSave() {
    if (!line) return
    setLoading(true)
    try {
      onSave({
        ...line,
        quantityNeeded: parseInt(quantity) || line.quantityNeeded,
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
        <Fw label="Quantity Needed">
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={SC}
          />
        </Fw>
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

// ─── Confirm Modal ────────────────────────────────────────────────────────────

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

// ─── Order Preview Modal ──────────────────────────────────────────────────────

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
              <input
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                className={SC}
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

// ─── Shared atoms ─────────────────────────────────────────────────────────────

const SC =
  "w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm focus:border-[#B6C8AF] focus:outline-none bg-white"

function Fw({ label, children }: { label: string children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium text-[#333333] block mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}
