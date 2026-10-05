import { useState, useEffect, useCallback } from "react"
import PageHeader from "../../components/ui/PageHeader"
import Modal from "../../components/ui/Modal"
import SearchInput from "../../components/ui/SearchInput"
import Button from "../../components/ui/Button"
import Pagination from "../../components/ui/Pagination"
import DatePicker from "../../components/ui/DatePicker"
import { IconPencil, IconTrash } from "../../components/ui/icons"
import RequirementPreviewCard from "../../components/purchasing/RequirementPreviewCard"
import {
  listRequirements,
  createRequirement,
  previewRequirement,
  getRequirement,
  updateRequirement,
  closeRequirement,
  deleteRequirement,
  addRequirementLine,
  updateRequirementLine,
  removeRequirementLine,
  getOrderPreview,
  RequirementsApiError,
  type RequirementDto,
  type RequirementLineDto,
  type RequirementStatus as RequirementStatusType,
  type OrderPreviewDto,
  type RequirementAllocationDto,
  type CreateRequirementInput,
  type RequirementPreviewResult,
  type RequirementActionDto,
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
import GenerateRequirementsModal, {
  type ReorderSuggestion,
} from "../inventory/ReorderReq"
import SearchableSelect, {
  type SearchableOption,
} from "../../components/ui/SearchableSelect"
import { useSearchableResource } from "../../hooks/useSearchableResource"
import { searchProducts } from "../../features/inventory/searchSelectors"
import { useProductUnits } from "../../features/inventory/useProductUnits"
import {
  toBaseQuantity,
  formatFactor,
} from "../../features/inventory/unitOptions"
import type { CreateRequirementLineInput } from "../../features/purchasing/requirementsApi"

// ─── Types ───────────────────────────────────────────────────────────────────

type RequirementStatus = "OPEN" | "PARTIALLY_FULFILLED" | "FULFILLED" | "CLOSED" | string & {}
type LineStatus = "OPEN" | "PARTIALLY_FULFILLED" | "FULFILLED" | "CLOSED" | string & {}
type LineReason = "Low Stock" | "Reorder Alert" | "Manual" | ""

interface RequirementLine {
  id: string
  productId: string
  product: string
  sku: string
  /** Unit the required quantity is expressed in (null = base unit). */
  unitId: string | null
  /** Display label for the line unit (empty when base unit). */
  unitName: string
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
  /** Purchase order allocations against this requirement line (real supplier/order data). */
  allocations: RequirementAllocationDto[]
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

// ─── API → UI adapters ───────────────────────────────────────────────────────

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
    productId: l.productId,
    product: l.product?.name ?? "Unknown product",
    sku: l.product?.sku ?? "",
    unitId: l.unitId,
    unitName: l.unit?.name ?? "",
    quantityNeeded: l.quantityNeeded,
    quantityOrdered: l.quantityOrdered,
    quantityDelivered: l.quantityDelivered,
    quantityRemaining: l.quantityRemaining,
    remainingToReceive: l.remainingToReceive,
    reason: reasonLabel(l.reasonCode),
    reasonCode: l.reasonCode,
    notes: l.notes ?? "",
    status: l.status,
    activeOrderCount: l.activeOrderCount ?? l.allocations?.length ?? 0,
    hasPo: (l.allocations?.length ?? 0) > 0,
    allocations: l.allocations ?? [],
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  const map: Record<string, string> = {
    OPEN: "bg-[#E6ECE2] text-[#7A9076] border border-[#C6D4BF]",
    PARTIALLY_FULFILLED: "bg-blue-100 text-blue-700",
    FULFILLED: "bg-green-100 text-green-700",
    CLOSED: "bg-gray-100 text-gray-500",
  }
  const labelMap: Record<string, string> = {
    PARTIALLY_FULFILLED: "PARTIALLY FULFILLED",
  }
  return (
    <span
      className={`text-xs font-bold rounded-full px-2.5 py-0.5 ${map[status] ?? map.OPEN}`}
    >
      {labelMap[status] ?? status}
    </span>
  )
}

function LineBadge({ status }: { status: LineStatus }) {
  const map: Record<string, string> = {
    OPEN: "bg-[#E6ECE2] text-[#7A9076] border border-[#C6D4BF]",
    PARTIALLY_FULFILLED: "bg-blue-100 text-blue-700",
    FULFILLED: "bg-green-100 text-green-700",
    CLOSED: "bg-gray-100 text-gray-500",
  }
  const labelMap: Record<string, string> = {
    PARTIALLY_FULFILLED: "PARTIALLY FULFILLED",
  }
  return (
    <span
      className={`text-xs font-bold rounded-full px-2.5 py-0.5 ${map[status] ?? map.OPEN}`}
    >
      {labelMap[status] ?? status}
    </span>
  )
}

// ─── Toast ───────────────────────────────────────────────────────────────────

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
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

// ─── Root page ───────────────────────────────────────────────────────────────

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

// ─── Requirements List Screen ────────────────────────────────────────────────

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
}) {
  const [deleting, setDeleting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Requirement | null>(null)
  const [orderTarget, setOrderTarget] = useState<Requirement | null>(null)

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
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#B6C8AF] text-[#333333] px-3.5 py-2 text-sm font-semibold hover:bg-[#E6ECE2] transition-colors"
            >
              + New Requirement
            </button>
            <button
              onClick={onGenerate}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#C6D4BF] bg-white px-3.5 py-2 text-sm font-medium text-[#333333] hover:bg-[#E6ECE2] transition-colors"
            >
              Generate from Reorder
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <div className="flex-1">
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
                className="text-xs font-semibold text-[#7A9076] hover:underline"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden flex-shrink-0">
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
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => onSelect(r.id)}
                              className="text-xs font-semibold text-[#7A9076] hover:underline whitespace-nowrap"
                            >
                              View →
                            </button>
                            <button
                              onClick={() => onSelect(r.id)}
                              className="p-1.5 rounded-lg text-[#666666] hover:bg-[#E6ECE2] hover:text-[#7A9076] transition-colors"
                              aria-label={`Edit ${r.reference}`}
                              title="Edit requirement"
                            >
                              <IconPencil className="w-4 h-4" />
                            </button>
                            {r.status !== "CLOSED" && (
                              <button
                                onClick={() => setDeleteTarget(r)}
                                className="p-1.5 rounded-lg text-[#666666] hover:bg-red-50 hover:text-red-600 transition-colors"
                                aria-label={`Delete ${r.reference}`}
                                title="Delete requirement"
                              >
                                <IconTrash className="w-4 h-4" />
                              </button>
                            )}
                            {r.lines.length > 0 &&
                              (r.status === "OPEN" ||
                                r.status === "PARTIALLY_FULFILLED") && (
                                <button
                                  onClick={() => setOrderTarget(r)}
                                  className="text-xs font-semibold text-[#7A9076] hover:underline whitespace-nowrap"
                                  aria-label={`Create purchase order for ${r.reference}`}
                                  title="Create purchase order"
                                >
                                  Order
                                </button>
                              )}
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
                label={
                  <>
                    Showing {Math.min((page - 1) * 20 + 1, totalCount)}–
                    {Math.min(page * 20, totalCount)} of {totalCount}{" "}
                    requirements
                  </>
                }
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

      {/* Order: select products + fill unit cost, then create the PO */}
      <RequirementOrderModal
        requirement={orderTarget}
        onClose={() => setOrderTarget(null)}
      />
    </div>
  )
}

// ─── Requirement Detail Screen ───────────────────────────────────────────────

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
          unitId: updated.unitId ?? undefined,
          reasonCode: reasonCode(updated.reason),
          // Optional note: omit when empty (never send null) to satisfy the
          // backend's request validator.
          ...(updated.notes?.trim() ? { notes: updated.notes.trim() } : {}),
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
    if (line.unitName) params.set("unitName", line.unitName)
    window.location.href = `/purchasing/orders/new?${params.toString()}`
  }

  const reqStatus: RequirementStatus = req.status

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div
        className="px-6 pt-5 pb-4"
        style={{
          background: "linear-gradient(135deg, #4F6B4A 0%, #3B4F35 100%)",
        }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-white/80 hover:text-white transition-colors mb-3"
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
            <p className="text-xs text-white/60 font-medium mb-0.5 tracking-wide">
              Purchase Requirement
            </p>
            <h1 className="text-xl font-bold text-white">{req.reference}</h1>
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
        <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden flex-shrink-0">
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
        <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden flex-shrink-0">
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
                          <span className="ml-2 text-[10px] font-bold text-blue-600 bg-blue-50 rounded-full px-1.5 py-0.5 align-middle">
                            PO LINKED
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#666666] font-mono text-xs">
                        {line.sku || "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-[#333333]">
                        {line.quantityNeeded}
                        {line.unitName && (
                          <span className="ml-1 text-xs font-normal text-[#999]">
                            {line.unitName}
                          </span>
                        )}
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
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setEditLine(line)}
                              className="p-1.5 rounded-lg text-[#666666] hover:bg-[#E6ECE2] hover:text-[#7A9076] transition-colors"
                              aria-label={`Edit ${line.product}`}
                              title="Edit line"
                            >
                              <IconPencil className="w-4 h-4" />
                            </button>
                            {line.quantityRemaining > 0 ? (
                              <button
                                onClick={() => handleOrderRemaining(line)}
                                className="text-xs font-semibold text-[#7A9076] hover:underline whitespace-nowrap"
                              >
                                Order Remaining
                              </button>
                            ) : (
                              <span className="text-xs font-medium text-[#999] whitespace-nowrap">
                                Fulfilled
                              </span>
                            )}
                            {!line.hasPo && (
                              <button
                                onClick={() => setDeleteLine(line)}
                                className="p-1.5 rounded-lg text-[#666666] hover:bg-red-50 hover:text-red-600 transition-colors"
                                aria-label={`Remove ${line.product}`}
                                title="Remove line"
                              >
                                <IconTrash className="w-4 h-4" />
                              </button>
                            )}
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
        <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden flex-shrink-0">
          <div className="px-5 py-3 border-b border-[#E6ECE2] flex items-center justify-between">
            <p className="text-xs font-bold text-[#666666] uppercase tracking-wide">
              Purchase Order History
            </p>
          </div>
          <div className="p-5">
            {(() => {
              const allAllocations = req.lines.flatMap((line) =>
                (line.allocations ?? []).map((alloc) => ({
                  poNumber: alloc.purchaseOrderNumber,
                  poId: alloc.purchaseOrderId,
                  supplier: alloc.supplier?.name ?? "—",
                  status: alloc.purchaseOrderStatus ?? "ACTIVE",
                  allocatedQuantity: alloc.quantityAllocated,
                  orderedQuantity: alloc.quantityOrdered,
                  receivedQuantity: alloc.quantityReceived,
                  unitCost: alloc.unitCost,
                  active: alloc.active,
                  created: alloc.createdAt,
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
                          <span
                            className={`text-xs font-medium px-2 py-1 rounded-full ${
                              alloc.active
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {alloc.status}
                          </span>
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
                            {(alloc.unitCost ?? 0).toFixed(2)} ETB
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-[#666666]">
                        <span>Supplier: {alloc.supplier}</span>
                        <span>{fmtDate(alloc.created)}</span>
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
  // ── Two-stage create flow ──────────────────────────────────────────────
  // Stage 1 (form):    "Create Requirement" → POST /requirements/preview only.
  // Stage 2 (review):  "Create Requirement" → POST /requirements (the real save).
  // Nothing is ever saved before the admin has seen the backend's decisions.
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

  /** Build the POST body from the live form values (shared by preview + save). */
  function buildBody(): CreateRequirementInput {
    // requiredBy and notes are optional; per-line reasonCode/notes are omitted
    // (never sent as null) to satisfy the backend's request validator.
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

  /**
   * Frontend validation only. This is intentionally NOT the backend's
   * duplicate-OPEN-requirement rule — the same product appearing twice in one
   * form is rejected here, while "product already has an OPEN requirement" is
   * resolved by the backend preview (→ UPDATE).
   */
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

  /**
   * Stage 1 — POST /requirements/preview. This NEVER saves: the backend only
   * reports, per product+unit, whether the real POST would CREATE a new
   * requirement or UPDATE the existing open one.
   */
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

  /** Back from the review screen — keep every entered value, no save request. */
  function handleBackToForm() {
    if (saving) return
    setPreview(null)
    setSaveError("")
  }

  /**
   * Stage 2 — the admin confirmed the review: POST /requirements with the
   * ORIGINAL form payload (never the preview response).
   */
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

  /** Match a preview action to a form line (per the backend contract's
   * productId + unitId pair), falling back to productId alone. */
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
        /* ── Stage 2: review the backend's CREATE / UPDATE decisions ──────
           Nothing is saved yet — the admin must confirm below. */
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
                      { year: "numeric", month: "long", day: "numeric" },
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
                new
                {" · "}
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

/**
 * Loads the current reorder suggestions, then hands them to the shared
 * Generate-from-Reorder modal, which owns product selection, quantities,
 * validation and the create request.
 *
 * WHY THE SUGGESTIONS ARE FETCHED HERE: `GET /inventory/reorder/suggestions`
 * returns the product, its base unit and the backend's suggested quantity. The
 * quantity is shown as read-only context only — the pharmacist types what to
 * request.
 *
 * WHY THIS DOESN'T CALL `/requirements/generate-from-reorder`: that endpoint
 * accepts no body at all (no requestBody, no query parameters in the published
 * OpenAPI), so it can only ever create a requirement from EVERY current
 * suggestion. Honouring a per-product selection and quantity requires
 * `POST /requirements`, which the shared modal already calls with just the
 * ticked rows.
 */
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
  /** Bumped by Retry to re-run the suggestions fetch. */
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
            // `productId` (not the name) is the row identity: two suggestions
            // can share a product name, and the create request must send the
            // real backend id.
            productId: s.product.id,
            name: s.product.name,
            suggestedQuantity: s.suggestedQuantity,
            status: "Reorder",
            calculationMethod: s.calculationMethod,
            // The product's own base unit, exactly as the reorder endpoint
            // reported it. The modal shows it beside the quantity and omits
            // `unitId` from the request, which makes the backend default the
            // created line to this same base unit.
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

  // The shared modal owns everything from here: checkboxes, quantities,
  // validation, the create request and the success view.
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

  // Loading and failure are handled here, because they happen before the shared
  // modal has anything to render.
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
            sub: unitProducts.product.sku,
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
