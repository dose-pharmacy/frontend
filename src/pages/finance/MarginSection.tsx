// ── Finance · Margins ───────────────────────────────────────────────────────
// GET /financials/reports/profit-margin/summary + GET /financials/reports/profit-margin
//
// Every figure — including the below-target count and both margins — is the
// backend's. The frontend never recomputes a margin or decides for itself that
// a product is "below target"; it only displays what the summary returned.
//
// CONTRACT WARNING: OpenAPI types the table endpoint as the shared
// `GenericListResponse`, whose item schema is an inventory/product object and
// contradicts the endpoint description. The rows below follow the existing
// frontend `ProfitMarginRowDto` typing.

import { useEffect, useState } from "react";
import Pagination from "../../components/ui/Pagination";
import {
  getProfitMargin,
  getProfitMarginSummary,
  type ProfitMarginRowDto,
  type ProfitMarginSortBy,
  type SortOrder,
} from "../../features/reports/reportsApi";
import {
  EmptyBlock,
  ErrorBlock,
  KpiCard,
  Panel,
  SortHeader,
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

export default function MarginSection({
  filters,
  productGroupId,
}: {
  filters: FinanceFilters;
  productGroupId: string;
}) {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<ProfitMarginSortBy>("productName");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  useEffect(() => {
    setPage(1);
  }, [filters.dateFrom, filters.dateTo, productGroupId]);

  const bounds = dateBounds(filters.dateFrom, filters.dateTo);
  const query = { ...bounds, productGroupId: productGroupId || undefined };

  const summary = useFinanceFetch(
    () => getProfitMarginSummary(query),
    [filters.dateFrom, filters.dateTo, productGroupId],
    "Could not load the margin summary.",
  );

  const table = useFinanceFetch(
    () => getProfitMargin({ ...query, page, limit: PAGE_SIZE, sortBy, sortOrder }),
    [filters.dateFrom, filters.dateTo, productGroupId, page, sortBy, sortOrder],
    "Could not load the product margin table.",
  );

  const s = summary.data;
  const rows: ProfitMarginRowDto[] = table.data?.data ?? [];
  const meta = table.data?.meta;

  function applySort(column: ProfitMarginSortBy) {
    const next = nextSort(column, sortBy, sortOrder);
    setSortBy(next.sortBy);
    setSortOrder(next.sortOrder);
    setPage(1);
  }

  const summaryError = summary.error;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Products analysed"
          value={fmtNumber(s?.productCount)}
          loading={summary.loading}
          error={summaryError}
          onRetry={summary.reload}
        />
        <KpiCard
          label="Below target"
          value={fmtNumber(s?.belowTargetCount)}
          tone={(s?.belowTargetCount ?? 0) > 0 ? "negative" : "default"}
          loading={summary.loading}
          error={summaryError}
          onRetry={summary.reload}
          hint="Backend belowTargetCount"
        />
        <KpiCard
          label="Average target margin"
          value={fmtPercent(s?.averageTargetMargin)}
          loading={summary.loading}
          error={summaryError}
          onRetry={summary.reload}
        />
        <KpiCard
          label="Average actual margin"
          value={fmtPercent(s?.averageActualMargin)}
          tone={(s?.averageActualMargin ?? 0) < (s?.averageTargetMargin ?? 0) ? "negative" : "positive"}
          loading={summary.loading}
          error={summaryError}
          onRetry={summary.reload}
        />
      </div>

      <Panel title="Product margins">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-[#E6ECE2]">
              <tr className="text-xs text-[#666666]">
                <SortHeader
                  active={sortBy === "productName"}
                  order={sortOrder}
                  onClick={() => applySort("productName")}
                >
                  Product
                </SortHeader>
                <th className="px-4 py-3 text-left font-semibold text-[#333333]">SKU</th>
                <SortHeader
                  align="right"
                  active={sortBy === "sellingPrice"}
                  order={sortOrder}
                  onClick={() => applySort("sellingPrice")}
                >
                  Selling price
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
                  active={sortBy === "revenue"}
                  order={sortOrder}
                  onClick={() => applySort("revenue")}
                >
                  Revenue
                </SortHeader>
                <SortHeader
                  align="right"
                  active={sortBy === "quantitySold"}
                  order={sortOrder}
                  onClick={() => applySort("quantitySold")}
                >
                  Qty sold
                </SortHeader>
                <SortHeader
                  align="right"
                  active={sortBy === "targetMargin"}
                  order={sortOrder}
                  onClick={() => applySort("targetMargin")}
                >
                  Target margin
                </SortHeader>
                <SortHeader
                  align="right"
                  active={sortBy === "actualMargin"}
                  order={sortOrder}
                  onClick={() => applySort("actualMargin")}
                >
                  Actual margin
                </SortHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6ECE2]">
              {table.loading ? (
                <tr>
                  <td colSpan={8} className="p-0">
                    <TableSkeleton cols={8} />
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => {
                  const belowTarget =
                    typeof row.targetMargin === "number" && typeof row.actualMargin === "number"
                      ? row.actualMargin < row.targetMargin
                      : null;
                  return (
                    <tr
                      key={row.productId ?? `margin-${index}`}
                      className="text-sm text-[#333333] hover:bg-[#F7FAF5]"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{row.productName ?? "—"}</div>
                        {row.productGroupName && (
                          <div className="text-xs text-[#666666]">{row.productGroupName}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#666666]">{row.sku ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmtMoney(row.sellingPrice)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(row.cost)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(row.revenue)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmtNumber(row.quantitySold)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[#666666]">
                        {fmtPercent(row.targetMargin)}
                      </td>
                      <td
                        className={`px-4 py-3 text-right tabular-nums font-medium ${
                          belowTarget === null ? "" : belowTarget ? "text-red-700" : "text-green-700"
                        }`}
                        title={belowTarget === null ? undefined : belowTarget ? "Below target margin" : "At or above target margin"}
                      >
                        {fmtPercent(row.actualMargin)}
                        {belowTarget && (
                          <span className="ml-1.5 text-[10px] font-bold uppercase text-red-700">
                            Below
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {table.error ? (
          <ErrorBlock headline="Margin table unavailable" message={table.error} onRetry={table.reload} />
        ) : (
          !table.loading &&
          rows.length === 0 && <EmptyBlock title="No margin data available." />
        )}

        {!table.loading && !table.error && rows.length > 0 && (
          <Pagination
            page={meta?.page ?? page}
            totalPages={meta?.totalPages ?? 1}
            onPageChange={setPage}
            label={rangeLabel(meta?.page ?? page, meta?.limit ?? PAGE_SIZE, meta?.total ?? 0, "products")}
          />
        )}
      </Panel>
    </div>
  );
}