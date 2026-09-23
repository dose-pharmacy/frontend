import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router"
import {
  getReorderDashboard,
  getReorderSuggestions,
  ReorderApiError,
  type ReorderDashboardItemDto,
  type ReorderProductDto,
  type ReorderSuggestionDto,
  type ReorderUrgency,
} from "../../features/inventory/reorderApi"
import PageHeader from "../../components/ui/PageHeader"
import Button from "../../components/ui/Button"
import FormError from "../../components/ui/FormError"
import Pagination from "../../components/ui/Pagination"
import GenerateRequirementsModal from "./ReorderReq"

const PAGE_SIZE = 10

export default function ReorderManagementPage() {
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState<ReorderDashboardItemDto[]>([])
  const [suggestions, setSuggestions] = useState<ReorderSuggestionDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showGenerate, setShowGenerate] = useState(false)
  const [page, setPage] = useState(1)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      getReorderDashboard({ page: 1, limit: 100 }),
      getReorderSuggestions({ page: 1, limit: 100 }),
    ])
      .then(([dash, sugg]) => {
        if (cancelled) return
        setDashboard(dash.items)
        setSuggestions(sugg.data)
        setError(null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(
          err instanceof ReorderApiError
            ? err.message
            : "Failed to load reorder data. Please try again.",
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function refresh() {
    setLoading(true)
    Promise.all([
      getReorderDashboard({ page: 1, limit: 100 }),
      getReorderSuggestions({ page: 1, limit: 100 }),
    ])
      .then(([dash, sugg]) => {
        setDashboard(dash.items)
        setSuggestions(sugg.data)
        setError(null)
      })
      .catch((err: unknown) => {
        setError(
          err instanceof ReorderApiError
            ? err.message
            : "Failed to load reorder data. Please try again.",
        )
      })
      .finally(() => setLoading(false))
  }

  const modalSuggestions = suggestions.map((s) => ({
    id: s.product.id,
    name: s.product.name,
    suggestedQty: s.suggestedQuantity,
    status: "Draft",
  }))

  // Merge the low-stock alerts (dashboard) and the reorder suggestions into a
  // single per-product list so both tables can be presented together.
  type MergedReorderRow = {
    product: ReorderProductDto
    currentStock: number
    threshold: number
    averageDailySales: number | null
    leadTimeDays: number
    suggestedQuantity: number
    urgency: ReorderUrgency | null
  }

  const mergedRows = useMemo<MergedReorderRow[]>(() => {
    const byId = new Map<string, MergedReorderRow>()
    for (const d of dashboard) {
      byId.set(d.product.id, {
        product: d.product,
        currentStock: d.currentStock,
        threshold: d.minimumThreshold,
        averageDailySales: null,
        leadTimeDays: d.leadTimeDays,
        suggestedQuantity: d.suggestedQuantity,
        urgency: d.urgency,
      })
    }
    for (const s of suggestions) {
      const existing = byId.get(s.product.id)
      if (existing) {
        existing.averageDailySales = s.averageDailySales
        existing.leadTimeDays = s.leadTimeDays
        existing.suggestedQuantity = s.suggestedQuantity
      } else {
        byId.set(s.product.id, {
          product: s.product,
          currentStock: s.currentStock,
          threshold: s.reorderPoint,
          averageDailySales: s.averageDailySales,
          leadTimeDays: s.leadTimeDays,
          suggestedQuantity: s.suggestedQuantity,
          urgency: null,
        })
      }
    }
    return Array.from(byId.values())
  }, [dashboard, suggestions])

  const totalPages = Math.max(1, Math.ceil(mergedRows.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginatedRows = mergedRows.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  )

  const urgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "CRITICAL":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden />
            Critical
          </span>
        )
      case "HIGH":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700">
            <span
              className="h-1.5 w-1.5 rounded-full bg-orange-500"
              aria-hidden
            />
            High
          </span>
        )
      case "MEDIUM":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
            <span
              className="h-1.5 w-1.5 rounded-full bg-amber-500"
              aria-hidden
            />
            Medium
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6ECE2] px-2.5 py-0.5 text-xs font-medium text-[#7A9076]">
            <span
              className="h-1.5 w-1.5 rounded-full bg-[#B6C8AF]"
              aria-hidden
            />
            Low
          </span>
        )
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <PageHeader
        breadcrumb="Inventory / Reorder"
        title="Reorder"
        subtitle="Review low-stock products and suggested reorder quantities."
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => navigate("/inventory/reorder/configuration")}
            >
              Configure Thresholds
            </Button>
            <Button onClick={() => setShowGenerate(true)}>
              Generate Requirements
            </Button>
          </div>
        }
      />

      <div className="p-6 flex flex-col gap-6">
        {error && <FormError message={error} />}

        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-[#E6ECE2] rounded-xl" />
            ))}
          </div>
        ) : !error ? (
          <>
            {/* Merged low-stock alerts + suggested reorder quantities */}
            <section>
              <div className="bg-[#B6C8AF] px-4 py-2.5 rounded-t-xl flex items-center justify-between">
                <p className="text-sm font-bold text-white">
                  LOW STOCK ALERTS & SUGGESTED QUANTITIES ({mergedRows.length}{" "}
                  item{mergedRows.length !== 1 ? "s" : ""})
                </p>
              </div>
              <div className="bg-white rounded-b-xl border border-t-0 border-[#E6ECE2] overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#E6ECE2]">
                        {[
                          "Product",
                          "Current Stock",
                          "Threshold",
                          "Avg Daily Sales",
                          "Lead Time (days)",
                          "Suggested Qty",
                          "Urgency",
                          "Action",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-4 py-3 text-left font-semibold text-[#333333] whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {mergedRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={8}
                            className="px-4 py-6 text-center text-[#333333]/60"
                          >
                            No low-stock alerts or reorder suggestions right
                            now.
                          </td>
                        </tr>
                      ) : (
                        paginatedRows.map((r, i) => (
                          <tr
                            key={r.product.id}
                            className={
                              i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/30"
                            }
                          >
                            <td className="px-4 py-3 font-medium text-[#333333]">
                              {r.product.name}
                            </td>
                            <td
                              className={`px-4 py-3 font-bold ${
                                r.currentStock <= r.threshold
                                  ? "text-red-600"
                                  : "text-[#333333]"
                              }`}
                            >
                              {r.currentStock}
                            </td>
                            <td className="px-4 py-3 text-[#666666]">
                              {r.threshold}
                            </td>
                            <td className="px-4 py-3 text-[#666666]">
                              {r.averageDailySales === null
                                ? "—"
                                : r.averageDailySales}
                            </td>
                            <td className="px-4 py-3 text-[#666666]">
                              {r.leadTimeDays}
                            </td>
                            <td className="px-4 py-3 font-semibold text-[#7A9076]">
                              {r.suggestedQuantity}
                            </td>
                            <td className="px-4 py-3">
                              {r.urgency ? (
                                urgencyBadge(r.urgency)
                              ) : (
                                <span className="text-xs text-[#999999]">
                                  —
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <Button
                                onClick={() =>
                                  alert(
                                    "Create purchase order — Purchasing module coming soon.",
                                  )
                                }
                              >
                                Order
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {mergedRows.length > 0 && (
                  <Pagination
                    page={safePage}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    label={
                      <>
                        Showing {(safePage - 1) * PAGE_SIZE + 1}–
                        {Math.min(safePage * PAGE_SIZE, mergedRows.length)} of{" "}
                        {mergedRows.length} items
                      </>
                    }
                  />
                )}
              </div>
            </section>
          </>
        ) : null}
      </div>

      <GenerateRequirementsModal
        open={showGenerate}
        onClose={() => setShowGenerate(false)}
        suggestions={modalSuggestions}
        onGenerate={() => refresh()}
      />
    </div>
  )
}
