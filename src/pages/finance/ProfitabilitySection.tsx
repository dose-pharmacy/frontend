// ── Finance · Profitability ─────────────────────────────────────────────────
// GET /financials/reports/profitability/summary + GET /financials/reports/profitability
//
// The summary and the table are driven by ONE filter state (groupBy + product
// group + date range) so the headline margin always describes the rows beneath
// it (§19). Revenue, cost, profit and margin are the backend's authoritative
// figures — nothing here recomputes profit or derives COGS.
//
// CONTRACT WARNING: OpenAPI types the table endpoint as the shared
// `GenericListResponse`, whose item schema is an inventory/product object and
// contradicts the endpoint description ("groups valid sales by brand,
// manufacturer, product group or product, with batch-level COGS"). The rows
// below follow the existing frontend `ProfitabilityRowDto` typing.

import { useEffect, useState } from "react";
import Pagination from "../../components/ui/Pagination";
import {
  getProfitability,
  getProfitabilitySummary,
  type ProfitabilityGroupBy,
  type ProfitabilityRowDto,
  type ProfitabilitySortBy,
  type SortOrder,
} from "../../features/reports/reportsApi";
import {
  EmptyBlock,
  ErrorBlock,
  FilterSelect,
  KpiCard,
  Panel,
  SortHeader,
  SubFilters,
  TableSkeleton,
  dateBounds,
  fmtMoney,
  fmtNumber,
  fmtPercent,
  nextSort,
  rangeLabel,
  useFinanceFetch,
  type FinanceFilters,
} from "./financeView";

const PAGE_SIZE = 20;

const GROUP_BY_OPTIONS: { value: ProfitabilityGroupBy; label: string }[] = [
  { value: "PRODUCT", label: "Product" },
  { value: "PRODUCT_GROUP", label: "Product group" },
  { value: "BRAND", label: "Brand" },
  { value: "MANUFACTURER", label: "Manufacturer" },
];

export default function ProfitabilitySection({
  filters,
  groupBy,
  onGroupByChange,
  productGroupId,
}: {
  filters: FinanceFilters;
  groupBy: ProfitabilityGroupBy;
  onGroupByChange: (groupBy: ProfitabilityGroupBy) => void;
  productGroupId: string;
}) {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<ProfitabilitySortBy>("profit");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  useEffect(() => {
    setPage(1);
  }, [filters.dateFrom, filters.dateTo, groupBy, productGroupId]);

  const bounds = dateBounds(filters.dateFrom, filters.dateTo);

  // `manufacturerId` is accepted by this endpoint but there is no manufacturer
  // endpoint in the API, so no manufacturer filter control is offered — an
  // invented dropdown would send an id the user could not have chosen.
  const query = {
    ...bounds,
    groupBy,
    productGroupId: productGroupId || undefined,
  };

  const summary = useFinanceFetch(
    () => getProfitabilitySummary(query),
    [filters.dateFrom, filters.dateTo, groupBy, productGroupId],
    "Could not load the profitability summary.",
  );

  const table = useFinanceFetch(
    () => getProfitability({ ...query, page, limit: PAGE_SIZE, sortBy, sortOrder }),
    [filters.dateFrom, filters.dateTo, groupBy, productGroupId, page, sortBy, sortOrder],
    "Could not load the profitability table.",
  );

  const s = summary.data;
  const rows: ProfitabilityRowDto[] = table.data?.data ?? [];
  const meta = table.data?.meta;

  function applySort(column: ProfitabilitySortBy) {
    const next = nextSort(column, sortBy, sortOrder);
    setSortBy(next.sortBy);
    setSortOrder(next.sortOrder);
    setPage(1);
  }

  function changeGroup(next: ProfitabilityGroupBy) {
    onGroupByChange(next);
    setPage(1);
  }

  const summaryError = summary.error;

  return (
    <div className="flex flex-col gap-5">
      <SubFilters>
        <FilterSelect
          label="Group by"
          value={groupBy}
          onChange={(v) => changeGroup(v as ProfitabilityGroupBy)}
        >
          {GROUP_BY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </FilterSelect>
        {/* The product group filter itself lives in the page-level filter bar so
            it persists when switching to the Margins tab, which shares it. */}
      </SubFilters>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
        <KpiCard label="Revenue" value={fmtMoney(s?.revenue)} loading={summary.loading} error={summaryError}
          onRetry={summary.reload} />
        <KpiCard label="Cost / COGS" value={fmtMoney(s?.cost)} loading={summary.loading} error={summaryError}
          onRetry={summary.reload} />
        <KpiCard
          label="Profit"
          value={fmtMoney(s?.profit)}
          tone={(s?.profit ?? 0) < 0 ? "negative" : "positive"}
          loading={summary.loading}
          error={summaryError}
          onRetry={summary.reload}
        />
        <KpiCard
          label="Margin"
          value={fmtPercent(s?.margin)}
          tone={(s?.margin ?? 0) < 0 ? "negative" : "positive"}
          loading={summary.loading}
          error={summaryError}
          onRetry={summary.reload}
        />
        <KpiCard
          label="Quantity"
          value={fmtNumber(s?.quantity)}
          loading={summary.loading}
          error={summaryError}
          onRetry={summary.reload}
          hint="Units sold"
        />
        <KpiCard
          label="Product count"
          value={fmtNumber(s?.productCount)}
          loading={summary.loading}
          error={summaryError}
          onRetry={summary.reload}
        />
      </div>

      <Panel title={`Profitability by ${groupLabel(groupBy).toLowerCase()}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-[#E6ECE2]">
              <tr className="text-xs text-[#666666]">
                <th className="px-4 py-3 text-left font-semibold text-[#333333]">
                  {groupLabel(groupBy)}
                </th>
                <SortHeader
                  align="right"
                  active={sortBy === "revenue"}
                  order={sortOrder}
                  onClick={() => applySort("revenue")}
                >
                  Revenue
                </SortHeader>
                <SortHeader
                  align="right"
                  active={sortBy === "cost"}
                  order={sortOrder}
                  onClick={() => applySort("cost")}
                >
                  Cost
                </SortHeader>
                <SortHeader
                  align="right"
                  active={sortBy === "profit"}
                  order={sortOrder}
                  onClick={() => applySort("profit")}
                >
                  Profit
                </SortHeader>
                <SortHeader
                  align="right"
                  active={sortBy === "margin"}
                  order={sortOrder}
                  onClick={() => applySort("margin")}
                >
                  Margin
                </SortHeader>
                <SortHeader
                  align="right"
                  active={sortBy === "quantity"}
                  order={sortOrder}
                  onClick={() => applySort("quantity")}
                >
                  Quantity
                </SortHeader>
                <SortHeader
                  align="right"
                  active={sortBy === "productCount"}
                  order={sortOrder}
                  onClick={() => applySort("productCount")}
                >
                  Products
                </SortHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6ECE2]">
              {table.loading ? (
                <tr>
                  <td colSpan={7} className="p-0">
                    <TableSkeleton cols={7} />
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={`${row.dimension ?? "row"}-${String(row.value)}-${index}`} className="text-sm text-[#333333] hover:bg-[#F7FAF5]">
                    <td className="px-4 py-3 font-medium">{label(row)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(row.revenue)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(row.cost)}</td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums font-medium ${
                        (row.profit ?? 0) < 0 ? "text-red-700" : "text-green-700"
                      }`}
                    >
                      {fmtMoney(row.profit)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums ${
                        (row.margin ?? 0) < 0 ? "text-red-700" : ""
                      }`}
                    >
                      {fmtPercent(row.margin)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtNumber(row.quantity)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtNumber(row.productCount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {table.error ? (
          <ErrorBlock headline="Profitability table unavailable" message={table.error} onRetry={table.reload} />
        ) : (
          !table.loading &&
          rows.length === 0 && (
            <EmptyBlock
              title="No profitability data available for the selected filters."
              description="Try widening the date range or clearing the product group filter."
            />
          )
        )}

        {!table.loading && !table.error && rows.length > 0 && (
          <Pagination
            page={meta?.page ?? page}
            totalPages={meta?.totalPages ?? 1}
            onPageChange={setPage}
            label={rangeLabel(meta?.page ?? page, meta?.limit ?? PAGE_SIZE, meta?.total ?? 0, "rows")}
          />
        )}
      </Panel>
    </div>
  );
}

function groupLabel(groupBy: ProfitabilityGroupBy): string {
  return GROUP_BY_OPTIONS.find((o) => o.value === groupBy)?.label ?? "Product";
}

/** The row's own display label: the backend names the column, the cell is the value. */
function label(row: ProfitabilityRowDto): string {
  if (typeof row.value === "string" && row.value) return row.value;
  if (typeof row.value === "number") return row.value.toLocaleString("en-ET");
  return row.dimension ?? "—";
}