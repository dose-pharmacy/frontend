import { useState, useEffect, useCallback } from "react"
import { ArrowUp, ArrowDown, ArrowUpDown, ChevronRight } from "lucide-react"
import ReportsSubNav from "./ReportsSubNav"
import PageHeader from "../../components/ui/PageHeader"
import Button from "../../components/ui/Button"
import Modal from "../../components/ui/Modal"
import Pagination from "../../components/ui/Pagination"
import ReportFilterBar from "./ReportFilterBar"
import {
  fmtMoney,
  fmtNumber,
  fmtDateTime,
  defaultDateRange,
} from "./reportHelpers"
import { listLocations } from "../../features/inventory/locationsApi"
import {
  getSalesReport,
  getSalesDetail,
  ReportsApiError,
  type SalesReportSortBy,
  type SortOrder,
  type SalesDetailLineDto,
} from "../../features/reports/reportsApi"
import type { SaleDto } from "../../features/sales/salesApi"

const PAGE_SIZE = 20

const SORT_COLUMNS: { key: SalesReportSortBy, label: string, align?: "right" }[] =
  [
    { key: "saleNumber", label: "Sale #" },
    { key: "createdAt", label: "Date" },
    { key: "totalAmount", label: "Total", align: "right" },
    { key: "paidAmount", label: "Paid", align: "right" },
  ]

function SortIndicator({
  active,
  order,
}: {
  active: boolean
  order: SortOrder
}) {
  if (!active)
    return (
      <span className="text-[#C6D4BF]">
        <ArrowUpDown className="h-3.5 w-3.5" />
      </span>
    )
  return (
    <span className="text-[#7A9076]">
      {order === "asc" ? (
        <ArrowUp className="h-3.5 w-3.5" />
      ) : (
        <ArrowDown className="h-3.5 w-3.5" />
      )}
    </span>
  )
}

export default function SalesReportPage() {
  const range = defaultDateRange()
  const [dateFrom, setDateFrom] = useState(range.from)
  const [dateTo, setDateTo] = useState(range.to)
  const [locationId, setLocationId] = useState("")
  const [locations, setLocations] = useState<{ id: string, name: string }[]>([])
  const [locationsLoading, setLocationsLoading] = useState(true)

  const [sales, setSales] = useState<SaleDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const [sortBy, setSortBy] = useState<SalesReportSortBy>("createdAt")
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc")

  useEffect(() => {
    listLocations({ limit: 100, isActive: true })
      .then((r) => setLocations(r.data))
      .catch(() => setLocations([]))
      .finally(() => setLocationsLoading(false))
  }, [])

  const loadSales = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getSalesReport({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        locationId: locationId || undefined,
        page,
        limit: PAGE_SIZE,
        sortBy,
        sortOrder,
      })
      setSales(res.data)
      setTotalPages(res.meta.totalPages)
      setTotalCount(res.meta.total)
    } catch (e) {
      setError(
        e instanceof ReportsApiError
          ? e.message
          : "Failed to load sales report.",
      )
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, locationId, page, sortBy, sortOrder])

  useEffect(() => {
    loadSales()
  }, [loadSales])

  function toggleSort(col: SalesReportSortBy) {
    if (sortBy === col) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(col)
      setSortOrder("asc")
    }
    setPage(1)
  }

  // ── Sale detail drill-down ──────────────────────────────────────────────────

  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailLines, setDetailLines] = useState<SalesDetailLineDto[]>([])

  async function openDetail(sale: SaleDto) {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailError(null)
    setDetailLines([])
    try {
      const res = await getSalesDetail({ saleId: sale.id, page: 1, limit: 100 })
      setDetailLines(res.data)
    } catch (e) {
      setDetailError(
        e instanceof ReportsApiError
          ? e.message
          : "Failed to load sale detail.",
      )
    } finally {
      setDetailLoading(false)
    }
  }

  function closeDetail() {
    setDetailOpen(false)
    setDetailLines([])
    setDetailError(null)
  }

  const detailSale = detailLines[0]?.sale ?? null
  const detailLocation = detailLines[0]?.location ?? null
  const detailCashier = detailLines[0]?.cashier ?? null

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb="Reports / Sales"
        title="Sales Report"
        subtitle="Completed sales transactions for the selected period."
      />
      <ReportsSubNav />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        <ReportFilterBar
          dateFrom={dateFrom}
          dateTo={dateTo}
          locationId={locationId}
          locations={locations}
          locationsLoading={locationsLoading}
          onDateFromChange={(v) => {
            setDateFrom(v)
            setPage(1)
          }}
          onDateToChange={(v) => {
            setDateTo(v)
            setPage(1)
          }}
          onLocationChange={(v) => {
            setLocationId(v)
            setPage(1)
          }}
        />

        <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="h-8 w-8 rounded-full border-4 border-[#E6ECE2] border-t-[#B6C8AF] animate-spin" />
              <p className="text-sm text-[#666666]">Loading sales report...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 px-6">
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 max-w-md text-center">
                {error}
              </p>
              <Button onClick={loadSales}>Retry</Button>
            </div>
          ) : sales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <p className="font-semibold text-[#333333]">No sales found</p>
              <p className="text-sm text-[#666666]">
                No transactions match the selected period and filters.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#E6ECE2] text-left">
                      {[
                        ...SORT_COLUMNS.map((col) => (
                          <th key={col.key} className={`px-4 py-3 font-semibold text-[#333333] ${col.align === "right" ? "text-right" : ""}`}>
                            <button onClick={() => toggleSort(col.key)} className={`inline-flex items-center gap-1.5 hover:text-[#49B0C1] ${col.align === "right" ? "flex-row-reverse" : ""}`}>
                              {col.label} <SortIndicator active={sortBy === col.key} order={sortOrder} />
                            </button>
                          </th>
                        )),
                        <th
                          key="location"
                          className="px-4 py-3 font-semibold text-[#333333]"
                        >
                          Location
                        </th>,
                        <th
                          key="cashier"
                          className="px-4 py-3 font-semibold text-[#333333]"
                        >
                          Cashier
                        </th>,
                        <th
                          key="items"
                          className="px-4 py-3 font-semibold text-[#333333] text-right"
                        >
                          Items
                        </th>,
                        <th
                          key="discount"
                          className="px-4 py-3 font-semibold text-[#333333] text-right"
                        >
                          Discount
                        </th>,
                        <th
                          key="action"
                          className="px-4 py-3 font-semibold text-[#333333] text-right"
                        >
                          Actions
                        </th>,
                      ]}
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((sale, i) => (
                      <tr key={sale.id} className={`hover:bg-[#DBEFF3]/30 transition-colors cursor-pointer ${i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/15"}`} onClick={() => openDetail(sale)}>
                        <td className="px-4 py-3 font-semibold text-[#49B0C1] whitespace-nowrap">{sale.saleNumber}</td>
                        <td className="px-4 py-3 text-[#666666] whitespace-nowrap">{fmtDateTime(sale.completedAt ?? sale.createdAt)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-[#333333]">{fmtMoney(sale.totalAmount)}</td>
                        <td className="px-4 py-3 text-right text-[#666666]">{fmtMoney(sale.paidAmount)}</td>
                        <td className="px-4 py-3 text-[#666666]">{sale.location?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-[#666666]">{sale.cashier?.name ?? "—"}</td>
                        <td className="px-4 py-3 text-right text-[#666666]">{sale.items ? fmtNumber(sale.items.length) : "—"}</td>
                        <td className="px-4 py-3 text-right text-[#666666]">{fmtMoney(sale.totalDiscount)}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={(e) => { e.stopPropagation(); openDetail(sale); }} className="text-xs font-semibold text-[#49B0C1] hover:underline whitespace-nowrap">Detail →</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-5 py-3 border-t border-[#DBEFF3] flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs text-[#666666]">
                  Showing {totalCount === 0 ? 0 : Math.min((page - 1) * PAGE_SIZE + 1, totalCount)}–{Math.min(page * PAGE_SIZE, totalCount)} of {fmtNumber(totalCount)} sales
                </p>
                <div className="flex gap-1">
                  <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg px-3 py-1.5 text-xs border border-[#ABDBE3] text-[#666666] hover:bg-[#DBEFF3] disabled:opacity-40 transition-colors">←</button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button key={p} onClick={() => setPage(p)} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${p === page ? "bg-[#49B0C1] text-white" : "border border-[#ABDBE3] text-[#666666] hover:bg-[#DBEFF3]"}`}>{p}</button>
                  ))}
                  <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg px-3 py-1.5 text-xs border border-[#ABDBE3] text-[#666666] hover:bg-[#DBEFF3] disabled:opacity-40 transition-colors">→</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Sale detail modal */}
      <Modal
        open={detailOpen}
        title={detailSale ? `Sale ${detailSale.saleNumber}` : "Sale Detail"}
        onClose={closeDetail}
        size="lg"
      >
        {detailLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="h-8 w-8 rounded-full border-4 border-[#E6ECE2] border-t-[#B6C8AF] animate-spin" />
            <p className="text-sm text-[#666666]">Loading sale detail...</p>
          </div>
        ) : detailError ? (
          <div className="flex flex-col items-center justify-center py-10 gap-4">
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-center">
              {detailError}
            </p>
            <Button variant="secondary" onClick={closeDetail}>
              Close
            </Button>
          </div>
        ) : detailSale ? (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                [
                  "Date",
                  fmtDateTime(detailSale.completedAt ?? detailSale.createdAt),
                ],
                ["Location", detailLocation?.name ?? "—"],
                ["Cashier", detailCashier?.name ?? "—"],
                ["Total", fmtMoney(detailSale.totalAmount)],
                [
                  "Paid",
                  detailSale.paidAmount != null
                    ? fmtMoney(detailSale.paidAmount)
                    : "—",
                ],
                [
                  "Subtotal",
                  detailSale.subtotal != null
                    ? fmtMoney(detailSale.subtotal)
                    : "—",
                ],
                ["Status", detailSale.status ?? "—"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-[#DBEFF3]/40 border border-[#DBEFF3] px-4 py-3">
                  <p className="text-xs text-[#666666]">{label}</p>
                  <p className="text-sm font-semibold text-[#333333] mt-0.5">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <div>
              <h3 className="text-sm font-bold text-[#333333] mb-2">
                Products
              </h3>
              {detailLines.length === 0 ? (
                <p className="text-sm text-[#666666]">
                  No line items recorded for this sale.
                </p>
              ) : (
                <div className="rounded-xl border border-[#E6ECE2] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#DBEFF3] text-left">
                        <th className="px-4 py-2.5 font-semibold text-[#333333]">Product</th>
                        <th className="px-4 py-2.5 font-semibold text-[#333333]">SKU</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailLines.map((line, i) => (
                        <tr key={`${line.product?.id ?? i}-${i}`} className={i % 2 === 0 ? "bg-white" : "bg-[#DBEFF3]/15"}>
                          <td className="px-4 py-2.5 text-[#333333]">{line.product?.name ?? "—"}</td>
                          <td className="px-4 py-2.5 text-[#666666]">{line.product?.sku ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button variant="secondary" onClick={closeDetail}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[#666666] py-8 text-center">
            No detail available for this sale.
          </p>
        )}
      </Modal>
    </div>
  )
}
