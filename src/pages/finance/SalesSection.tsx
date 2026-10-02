// ── Finance · Sales ─────────────────────────────────────────────────────────
// GET /financials/reports/sales — the completed-transaction ledger for the
// selected window. Reporting and drill-down only: nothing here creates, edits or
// collects against a sale. Opening a row hands off to the EXISTING Sale detail
// modal, so there is exactly one receipt UI in the app.
//
// CONTRACT WARNING: OpenAPI types this endpoint as the shared
// `GenericListResponse`, whose item schema is an inventory/product object and
// contradicts the endpoint description. The rows below follow the existing
// frontend `SaleDto` typing (and the description). See reportsApi.ts.

import { useEffect, useState } from "react";
import Pagination from "../../components/ui/Pagination";
import { getSalesReport, type SalesReportSortBy, type SortOrder } from "../../features/reports/reportsApi";
// `getSalesReport` is typed `ReportPaginatedResult<SaleDto>`; SaleDto is owned by
// the sales module, so it is imported from there rather than re-exported here.
import type { SaleDto } from "../../features/sales/salesApi";
import SaleDetailModal from "../sales/SaleDetailModal";
import {
  EmptyBlock,
  ErrorBlock,
  Panel,
  SortHeader,
  TableSkeleton,
  dateBounds,
  fmtDateTime,
  fmtMoney,
  nextSort,
  rangeLabel,
  useFinanceFetch,
  type FinanceFilters,
} from "./financeView";

const PAGE_SIZE = 20;

export default function SalesSection({ filters }: { filters: FinanceFilters }) {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SalesReportSortBy>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [openSaleId, setOpenSaleId] = useState<string | null>(null);

  // The filter bar lives on the page, above the tabs — so a date or location
  // change arrives as new props. Drop back to page 1 rather than staying on a
  // page that may no longer exist in the narrower result set.
  useEffect(() => {
    setPage(1);
  }, [filters.dateFrom, filters.dateTo, filters.locationId]);

  const bounds = dateBounds(filters.dateFrom, filters.dateTo);

  const sales = useFinanceFetch(
    () =>
      getSalesReport({
        ...bounds,
        locationId: filters.locationId || undefined,
        page,
        limit: PAGE_SIZE,
        sortBy,
        sortOrder,
      }),
    [filters.dateFrom, filters.dateTo, filters.locationId, page, sortBy, sortOrder],
    "Could not load the sales report.",
  );

  const rows: SaleDto[] = sales.data?.data ?? [];
  const meta = sales.data?.meta;

  function applySort(column: SalesReportSortBy) {
    const next = nextSort(column, sortBy, sortOrder);
    setSortBy(next.sortBy);
    setSortOrder(next.sortOrder);
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-5">
      <Panel title="Completed sales">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-[#E6ECE2]">
              <tr className="text-xs text-[#666666]">
                <SortHeader
                  active={sortBy === "saleNumber"}
                  order={sortOrder}
                  onClick={() => applySort("saleNumber")}
                >
                  Sale #
                </SortHeader>
                <SortHeader
                  active={sortBy === "createdAt"}
                  order={sortOrder}
                  onClick={() => applySort("createdAt")}
                >
                  Date
                </SortHeader>
                <th className="px-4 py-3 text-left font-semibold text-[#333333]">Location</th>
                <th className="px-4 py-3 text-left font-semibold text-[#333333]">Cashier</th>
                <SortHeader
                  align="right"
                  active={sortBy === "totalAmount"}
                  order={sortOrder}
                  onClick={() => applySort("totalAmount")}
                >
                  Total
                </SortHeader>
                <SortHeader
                  align="right"
                  active={sortBy === "paidAmount"}
                  order={sortOrder}
                  onClick={() => applySort("paidAmount")}
                >
                  Paid
                </SortHeader>
                <SortHeader
                  align="right"
                  active={false}
                  order={sortOrder}
                  onClick={() => {
                    /* derived from the two server-sorted columns above */
                  }}
                  title="Outstanding is derived from the returned total and paid amounts — it is not a backend sort key"
                  sortable={false}
                >
                  Outstanding
                </SortHeader>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6ECE2]">
              {sales.loading ? (
                <tr>
                  <td colSpan={8} className="p-0">
                    <TableSkeleton cols={7} />
                  </td>
                </tr>
              ) : (
                rows.map((sale) => {
                  const outstanding =
                    typeof sale.totalAmount === "number" && typeof sale.paidAmount === "number"
                      ? sale.totalAmount - sale.paidAmount
                      : null;
                  return (
                    <tr key={sale.id} className="text-sm text-[#333333] hover:bg-[#F7FAF5]">
                      <td className="px-4 py-3 font-medium">{sale.saleNumber}</td>
                      <td className="px-4 py-3 text-[#666666]">{fmtDateTime(sale.createdAt)}</td>
                      <td className="px-4 py-3">{sale.location?.name ?? "—"}</td>
                      <td className="px-4 py-3">{sale.cashier?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(sale.totalAmount)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(sale.paidAmount)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {outstanding === null ? (
                          "—"
                        ) : outstanding > 0 ? (
                          <span className="text-red-700 font-medium">{fmtMoney(outstanding)}</span>
                        ) : (
                          <span className="text-green-700">Settled</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setOpenSaleId(sale.id)}
                          className="text-xs font-semibold text-[#4F6B4A] hover:underline"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {sales.error ? (
          <ErrorBlock headline="Sales report unavailable" message={sales.error} onRetry={sales.reload} />
        ) : (
          !sales.loading &&
          rows.length === 0 && (
            <EmptyBlock
              title="No sales found for the selected period."
              description="Try widening the date range or clearing the filters."
            />
          )
        )}

        {!sales.loading && !sales.error && rows.length > 0 && (
          <Pagination
            page={meta?.page ?? page}
            totalPages={meta?.totalPages ?? 1}
            onPageChange={setPage}
            label={rangeLabel(meta?.page ?? page, meta?.limit ?? PAGE_SIZE, meta?.total ?? 0, "sales")}
          />
        )}
      </Panel>

      {openSaleId && (
        <SaleDetailModal
          saleId={openSaleId}
          onClose={() => setOpenSaleId(null)}
          onChanged={sales.reload}
        />
      )}
    </div>
  );
}