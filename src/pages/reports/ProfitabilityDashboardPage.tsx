import { useState, useEffect, useCallback } from "react"
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"
import ReportsSubNav from "./ReportsSubNav"
import PageHeader from "../../components/ui/PageHeader"
import Button from "../../components/ui/Button"
import Pagination from "../../components/ui/Pagination"
import ReportFilterBar from "./ReportFilterBar"
import {
  fmtMoney,
  fmtNumber,
  fmtPercent,
  defaultDateRange,
} from "./reportHelpers"
import { listProductGroups } from "../../features/inventory/productGroupsApi"
import {
  getProfitabilitySummary,
  getProfitability,
  getProfitMarginSummary,
  getProfitMargin,
  ReportsApiError,
  type ProfitabilityGroupBy,
  type ProfitabilitySortBy,
  type ProfitMarginSortBy,
  type SortOrder,
  type ProfitabilityRowDto,
  type ProfitMarginRowDto,
} from "../../features/reports/reportsApi"

const PAGE_SIZE = 20

const GROUP_BY_OPTIONS: { value: ProfitabilityGroupBy, label: string }[] = [
  { value: "BRAND", label: "Brand" },
  { value: "MANUFACTURER", label: "Manufacturer" },
  { value: "PRODUCT_GROUP", label: "Product Group" },
  { value: "PRODUCT", label: "Product" },
]

function SortHeader<T extends string>({
  active,
  order,
  onClick,
  align,
  children,
}: {
  active: boolean
  order: SortOrder
  onClick: () => void
  align?: "right"
  children: React.ReactNode
}) {
  return (
    <th
      className={`px-4 py-3 font-semibold text-[#333333] ${
        align === "right" ? "text-right" : ""
      }`}
    >
      <button
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 hover:text-[#7A9076] ${
          align === "right" ? "flex-row-reverse" : ""
        }`}
      >
        {children}
        <span className={active ? "text-[#7A9076]" : "text-[#C6D4BF]"}>
          {active ? (
            order === "asc" ? (
              <ArrowUp className="h-3.5 w-3.5" />
            ) : (
              <ArrowDown className="h-3.5 w-3.5" />
            )
          ) : (
            <ArrowUpDown className="h-3.5 w-3.5" />
          )}
        </span>
      </button>
    </th>
  )
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="h-8 w-8 rounded-full border-4 border-[#E6ECE2] border-t-[#B6C8AF] animate-spin" />
      <p className="text-sm text-[#666666]">{label}</p>
    </div>
  )
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 px-6">
      <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 max-w-md text-center">
        {message}
      </p>
      <Button onClick={onRetry}>Retry</Button>
    </div>
  )
}

// ─── Profitability tab ────────────────────────────────────────────────────────

function ProfitabilitySection({
  productGroups,
}: {
  productGroups: { id: string, name: string }[]
}) {
  const range = defaultDateRange()
  const [dateFrom, setDateFrom] = useState(range.from)
  const [dateTo, setDateTo] = useState(range.to)
  const [groupBy, setGroupBy] = useState<ProfitabilityGroupBy>("BRAND")
  const [productGroupId, setProductGroupId] = useState("")

  const [summary, setSummary] = useState<{
    value: number
    label: string
    kind: "money" | "count" | "percent"
  }[]>([])
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  const [rows, setRows] = useState<ProfitabilityRowDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [sortBy, setSortBy] = useState<ProfitabilitySortBy>("profit")
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc")

  const query = {
    groupBy,
    productGroupId: productGroupId || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  }

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true)
    setSummaryError(null)
    try {
      const s = await getProfitabilitySummary(query)
      setSummary([
        { label: "Revenue", value: s.revenue, kind: "money" },
        { label: "Cost", value: s.cost, kind: "money" },
        { label: "Profit", value: s.profit, kind: "money" },
        { label: "Margin", value: s.margin, kind: "percent" },
        { label: "Quantity Sold", value: s.quantity, kind: "count" },
        { label: "Products", value: s.productCount, kind: "count" },
      ])
    } catch (e) {
      setSummaryError(
        e instanceof ReportsApiError ? e.message : "Failed to load summary.",
      )
    } finally {
      setSummaryLoading(false)
    }
  }, [groupBy, productGroupId, dateFrom, dateTo])

  const loadRows = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getProfitability({
        ...query,
        page,
        limit: PAGE_SIZE,
        sortBy,
        sortOrder,
      })
      setRows(res.data)
      setTotalPages(res.meta.totalPages)
      setTotalCount(res.meta.total)
    } catch (e) {
      setError(
        e instanceof ReportsApiError
          ? e.message
          : "Failed to load profitability.",
      )
    } finally {
      setLoading(false)
    }
  }, [groupBy, productGroupId, dateFrom, dateTo, page, sortBy, sortOrder])

  useEffect(() => {
    loadSummary()
    loadRows()
  }, [loadSummary, loadRows])

  return (
    <div className="flex flex-col gap-5">
      <ReportFilterBar
        dateFrom={dateFrom}
        dateTo={dateTo}
        showLocation={false}
        onDateFromChange={(v) => {
          setDateFrom(v)
          setPage(1)
        }}
        onDateToChange={(v) => {
          setDateTo(v)
          setPage(1)
        }}
        extra={
          <>
            <div className="flex flex-col gap-1.5 flex-1 min-w-[160px]">
              <label className="text-sm font-medium text-[#333333]">
                Group By
              </label>
              <select
                value={groupBy}
                onChange={(e) => {
                  setGroupBy(e.target.value as ProfitabilityGroupBy)
                  setPage(1)
                }}
                className="w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm bg-white focus:border-[#B6C8AF] focus:outline-none transition-all"
              >
                {GROUP_BY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
              <label className="text-sm font-medium text-[#333333]">
                Product Group
              </label>
              <select
                value={productGroupId}
                onChange={(e) => {
                  setProductGroupId(e.target.value)
                  setPage(1)
                }}
                className="w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm bg-white focus:border-[#B6C8AF] focus:outline-none transition-all"
              >
                <option value="">All Product Groups</option>
                {productGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {summaryLoading
          ? Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-[#E6ECE2] p-5"
              >
                <div className="h-3 w-20 rounded bg-[#E6ECE2]/60 animate-pulse" />
                <div className="h-6 w-24 rounded bg-[#E6ECE2]/40 animate-pulse mt-3" />
              </div>
            ))
          : summaryError && !summary.length
            ? null
            : summary.map((s) => (
                <div
                  key={s.label}
                  className="bg-white rounded-xl border border-[#E6ECE2] p-5"
                >
                  <p className="text-xs font-medium text-[#666666]">
                    {s.label}
                  </p>
                  <p className="text-lg font-bold text-[#333333] mt-0.5 leading-tight">
                    {s.kind === "money"
                      ? fmtMoney(s.value)
                      : s.kind === "percent"
                        ? fmtPercent(s.value)
                        : fmtNumber(s.value)}
                  </p>
                </div>
              ))}
      </div>
      {summaryError && !summary.length && (
        <div className="bg-white rounded-xl border border-[#E6ECE2] p-4">
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-center">
            {summaryError}
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden">
        {loading ? (
          <LoadingState
            label={`Loading ${groupBy.replace(/_/g, " ").toLowerCase()} profitability...`}
          />
        ) : error ? (
          <ErrorState message={error} onRetry={loadRows} />
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <p className="font-semibold text-[#333333]">
              No profitability data found
            </p>
            <p className="text-sm text-[#666666]">
              No data matches the selected filters.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#E6ECE2] text-left">
                    <SortHeader<ProfitabilitySortBy>
                      active={sortBy === "value"}
                      order={sortOrder}
                      onClick={() => {
                        setSortBy("value")
                        if (sortBy === "value")
                          setSortOrder((o) => (o === "asc" ? "desc" : "asc"))
                        else {
                          setSortOrder("asc")
                        }
                        setPage(1)
                      }}
                    >
                      {groupBy.replace(/_/g, " ")}
                    </SortHeader>
                    <SortHeader<ProfitabilitySortBy>
                      active={sortBy === "value"}
                      order={sortOrder}
                      align="right"
                      onClick={() => {
                        setSortBy("value")
                        if (sortBy === "value")
                          setSortOrder((o) => (o === "asc" ? "desc" : "asc"))
                        else {
                          setSortOrder("asc")
                        }
                        setPage(1)
                      }}
                    >
                      Value
                    </SortHeader>
                    {([
                      "revenue",
                      "cost",
                      "profit",
                      "quantity",
                      "productCount",
                    ] as ProfitabilitySortBy[]).map((col) => (
                      <SortHeader<ProfitabilitySortBy>
                        key={col}
                        active={sortBy === col}
                        order={sortOrder}
                        align="right"
                        onClick={() => {
                          setSortBy(col)
                          if (sortBy === col)
                            setSortOrder((o) => (o === "asc" ? "desc" : "asc"))
                          else {
                            setSortOrder("asc")
                          }
                          setPage(1)
                        }}
                      >
                        {col === "revenue"
                          ? "Revenue"
                          : col === "cost"
                            ? "Cost"
                            : col === "profit"
                              ? "Profit"
                              : col === "quantity"
                                ? "Qty Sold"
                                : "Products"}
                      </SortHeader>
                    ))}
                    <SortHeader<ProfitabilitySortBy>
                      active={sortBy === "margin"}
                      order={sortOrder}
                      align="right"
                      onClick={() => {
                        setSortBy("margin")
                        if (sortBy === "margin")
                          setSortOrder((o) => (o === "asc" ? "desc" : "asc"))
                        else {
                          setSortOrder("asc")
                        }
                        setPage(1)
                      }}
                    >
                      Margin
                    </SortHeader>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={`${row.dimension}-${i}`}
                      className={`${
                        i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/15"
                      } hover:bg-[#E6ECE2]/30 transition-colors`}
                    >
                      <td className="px-4 py-3 font-semibold text-[#333333]">
                        {row.dimension}
                      </td>
                      <td className="px-4 py-3 text-right text-[#666666]">
                        {String(row.value)}
                      </td>
                      <td className="px-4 py-3 text-right text-[#333333]">
                        {fmtMoney(row.revenue)}
                      </td>
                      <td className="px-4 py-3 text-right text-[#666666]">
                        {fmtMoney(row.cost)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[#333333]">
                        {fmtMoney(row.profit)}
                      </td>
                      <td className="px-4 py-3 text-right text-[#666666]">
                        {fmtNumber(row.quantity)}
                      </td>
                      <td className="px-4 py-3 text-right text-[#666666]">
                        {fmtNumber(row.productCount)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[#7A9076]">
                        {fmtPercent(row.margin)}
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
              pageSize={PAGE_SIZE}
              itemLabel="rows"
            />
          </>
        )}
      </div>
    </div>
  )
}

// ─── Profit Margin tab ────────────────────────────────────────────────────────

function ProfitMarginSection({
  productGroups,
}: {
  productGroups: { id: string, name: string }[]
}) {
  const range = defaultDateRange()
  const [dateFrom, setDateFrom] = useState(range.from)
  const [dateTo, setDateTo] = useState(range.to)
  const [productGroupId, setProductGroupId] = useState("")

  const [summary, setSummary] = useState<{
    value: number
    label: string
    kind: "count" | "percent"
  }[]>([])
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  const [rows, setRows] = useState<ProfitMarginRowDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [sortBy, setSortBy] = useState<ProfitMarginSortBy>("productName")
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc")

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true)
    setSummaryError(null)
    try {
      const s = await getProfitMarginSummary({
        productGroupId: productGroupId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      })
      setSummary([
        { label: "Products", value: s.productCount, kind: "count" },
        { label: "Below Target", value: s.belowTargetCount, kind: "count" },
        {
          label: "Avg Target Margin",
          value: s.averageTargetMargin,
          kind: "percent",
        },
        {
          label: "Avg Actual Margin",
          value: s.averageActualMargin,
          kind: "percent",
        },
      ])
    } catch (e) {
      setSummaryError(
        e instanceof ReportsApiError
          ? e.message
          : "Failed to load profit margin summary.",
      )
    } finally {
      setSummaryLoading(false)
    }
  }, [productGroupId, dateFrom, dateTo])

  const loadRows = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getProfitMargin({
        productGroupId: productGroupId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        limit: PAGE_SIZE,
        sortBy,
        sortOrder,
      })
      setRows(res.data)
      setTotalPages(res.meta.totalPages)
      setTotalCount(res.meta.total)
    } catch (e) {
      setError(
        e instanceof ReportsApiError
          ? e.message
          : "Failed to load profit margins.",
      )
    } finally {
      setLoading(false)
    }
  }, [productGroupId, dateFrom, dateTo, page, sortBy, sortOrder])

  useEffect(() => {
    loadSummary()
    loadRows()
  }, [loadSummary, loadRows])

  return (
    <div className="flex flex-col gap-5">
      <ReportFilterBar
        dateFrom={dateFrom}
        dateTo={dateTo}
        showLocation={false}
        onDateFromChange={(v) => {
          setDateFrom(v)
          setPage(1)
        }}
        onDateToChange={(v) => {
          setDateTo(v)
          setPage(1)
        }}
        extra={
          <div className="flex flex-col gap-1.5 flex-1 min-w-[180px]">
            <label className="text-sm font-medium text-[#333333]">
              Product Group
            </label>
            <select
              value={productGroupId}
              onChange={(e) => {
                setProductGroupId(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-xl border border-[#C6D4BF] px-3.5 py-2.5 text-sm bg-white focus:border-[#B6C8AF] focus:outline-none transition-all"
            >
              <option value="">All Product Groups</option>
              {productGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryLoading
          ? Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-[#E6ECE2] p-5"
              >
                <div className="h-3 w-20 rounded bg-[#E6ECE2]/60 animate-pulse" />
                <div className="h-6 w-24 rounded bg-[#E6ECE2]/40 animate-pulse mt-3" />
              </div>
            ))
          : summaryError && !summary.length
            ? null
            : summary.map((s) => (
                <div
                  key={s.label}
                  className="bg-white rounded-xl border border-[#E6ECE2] p-5"
                >
                  <p className="text-xs font-medium text-[#666666]">
                    {s.label}
                  </p>
                  <p
                    className={`text-lg font-bold mt-0.5 leading-tight ${
                      s.label === "Below Target"
                        ? "text-orange-600"
                        : "text-[#333333]"
                    }`}
                  >
                    {s.kind === "percent"
                      ? fmtPercent(s.value)
                      : fmtNumber(s.value)}
                  </p>
                </div>
              ))}
      </div>
      {summaryError && !summary.length && (
        <div className="bg-white rounded-xl border border-[#E6ECE2] p-4">
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-center">
            {summaryError}
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#E6ECE2] overflow-hidden">
        {loading ? (
          <LoadingState label="Loading profit margins..." />
        ) : error ? (
          <ErrorState message={error} onRetry={loadRows} />
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <p className="font-semibold text-[#333333]">
              No profit margin data found
            </p>
            <p className="text-sm text-[#666666]">
              No data matches the selected filters.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#E6ECE2] text-left">
                    {([
                      ["productName", "Product"],
                      ["actualMargin", "Actual Margin"],
                      ["targetMargin", "Target Margin"],
                    ] as [ProfitMarginSortBy, string][]).map(([col, label]) => (
                      <SortHeader<ProfitMarginSortBy>
                        key={col}
                        active={sortBy === col}
                        order={sortOrder}
                        onClick={() => {
                          setSortBy(col)
                          if (sortBy === col)
                            setSortOrder((o) => (o === "asc" ? "desc" : "asc"))
                          else {
                            setSortOrder("asc")
                          }
                          setPage(1)
                        }}
                      >
                        {label}
                      </SortHeader>
                    ))}
                    <th className="px-4 py-3 font-semibold text-[#333333]">
                      SKU
                    </th>
                    <th className="px-4 py-3 font-semibold text-[#333333]">
                      Group
                    </th>
                    <SortHeader<ProfitMarginSortBy>
                      active={sortBy === "sellingPrice"}
                      order={sortOrder}
                      align="right"
                      onClick={() => {
                        setSortBy("sellingPrice")
                        if (sortBy === "sellingPrice")
                          setSortOrder((o) => (o === "asc" ? "desc" : "asc"))
                        else {
                          setSortOrder("asc")
                        }
                        setPage(1)
                      }}
                    >
                      Sell Price
                    </SortHeader>
                    <th className="px-4 py-3 font-semibold text-[#333333] text-right">
                      Cost
                    </th>
                    {([
                      "revenue",
                      "cost",
                      "quantitySold",
                    ] as ProfitMarginSortBy[])
                      .filter((c) => c !== "sellingPrice")
                      .map((col) => (
                        <SortHeader<ProfitMarginSortBy>
                          key={col}
                          active={sortBy === col}
                          order={sortOrder}
                          align="right"
                          onClick={() => {
                            setSortBy(col)
                            if (sortBy === col)
                              setSortOrder((o) =>
                                o === "asc" ? "desc" : "asc",
                              )
                            else {
                              setSortOrder("asc")
                            }
                            setPage(1)
                          }}
                        >
                          {col === "revenue"
                            ? "Revenue"
                            : col === "cost"
                              ? "Cost"
                              : "Qty Sold"}
                        </SortHeader>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={row.productId}
                      className={`${
                        i % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/15"
                      } hover:bg-[#E6ECE2]/30 transition-colors`}
                    >
                      <td className="px-4 py-3 font-semibold text-[#333333]">
                        {row.productName}
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#7A9076]">
                        {fmtPercent(row.actualMargin)}
                      </td>
                      <td className="px-4 py-3 text-[#666666]">
                        {fmtPercent(row.targetMargin)}
                      </td>
                      <td className="px-4 py-3 text-[#666666]">{row.sku}</td>
                      <td className="px-4 py-3 text-[#666666]">
                        {row.productGroupName}
                      </td>
                      <td className="px-4 py-3 text-right text-[#333333]">
                        {fmtMoney(row.sellingPrice)}
                      </td>
                      <td className="px-4 py-3 text-right text-[#666666]">
                        {fmtMoney(row.costPrice)}
                      </td>
                      <td className="px-4 py-3 text-right text-[#333333]">
                        {fmtMoney(row.revenue)}
                      </td>
                      <td className="px-4 py-3 text-right text-[#666666]">
                        {fmtMoney(row.cost)}
                      </td>
                      <td className="px-4 py-3 text-right text-[#666666]">
                        {fmtNumber(row.quantitySold)}
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
              pageSize={PAGE_SIZE}
              itemLabel="products"
            />
          </>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProfitabilityDashboardPage() {
  const [tab, setTab] = useState<"profitability" | "margin">("profitability")
  const [productGroups, setProductGroups] = useState<{
    id: string
    name: string
  }[]>([])

  useEffect(() => {
    listProductGroups({ limit: 100, isActive: true })
      .then((r) => setProductGroups(r.data))
      .catch(() => setProductGroups([]))
  }, [])

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb="Reports / Profitability"
        title="Profitability"
        subtitle="Profit, margins, and per-product group performance."
      />
      <ReportsSubNav />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        <div className="flex rounded-lg border border-[#C6D4BF] w-fit overflow-hidden">
          <button
            onClick={() => setTab("profitability")}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${
              tab === "profitability"
                ? "bg-[#B6C8AF] text-[#333333]"
                : "bg-white text-[#666666] hover:bg-[#E6ECE2]"
            }`}
          >
            Profitability
          </button>
          <button
            onClick={() => setTab("margin")}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${
              tab === "margin"
                ? "bg-[#B6C8AF] text-[#333333]"
                : "bg-white text-[#666666] hover:bg-[#E6ECE2]"
            }`}
          >
            Profit Margin
          </button>
        </div>

        {tab === "profitability" ? (
          <ProfitabilitySection productGroups={productGroups} />
        ) : (
          <ProfitMarginSection productGroups={productGroups} />
        )}
      </div>
    </div>
  )
}
