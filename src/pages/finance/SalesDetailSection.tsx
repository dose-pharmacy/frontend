// ── Finance · Sales detail ───────────────────────────────────────────────────
// GET /financials/reports/sales/detail — the sale-LINE drill-down behind the
// Sales tab, with sale / product / location / cashier context on every row.
//
// CONTRACT WARNING: OpenAPI types this endpoint as the shared
// `GenericListResponse`, whose item schema is an inventory/product object and
// contradicts the endpoint description ("paginated sale lines (SaleItem) … with
// sale, product, unit, location and cashier context"). The contract does not
// expose the line's own money/quantity fields, so this table renders the sale
// and product context it does have and reads amounts from the parent sale.
// Nothing is invented to fill the gap.

import { useEffect, useState } from "react";
import Pagination from "../../components/ui/Pagination";
import SearchInput from "../../components/ui/SearchInput";
import SearchableSelect from "../../components/ui/SearchableSelect";
import type { SearchableOption } from "../../components/ui/SearchableSelect";
import { useSearchableResource } from "../../hooks/useSearchableResource";
import { searchProducts } from "../../features/inventory/searchSelectors";
import {
  getSalesDetail,
  type SalesDetailLineDto,
  type SalesDetailSortBy,
  type SortOrder,
} from "../../features/reports/reportsApi";
import SaleDetailModal from "../sales/SaleDetailModal";
import {
  EmptyBlock,
  ErrorBlock,
  Panel,
  SortHeader,
  SubFilters,
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

export default function SalesDetailSection({
  filters,
}: {
  filters: FinanceFilters;
}) {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SalesDetailSortBy>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [saleId, setSaleId] = useState("");
  const [productId, setProductId] = useState("");
  const [openSaleId, setOpenSaleId] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [filters.dateFrom, filters.dateTo, filters.locationId, saleId, productId]);

  const productSearch = useSearchableResource(searchProducts, true);
  const selectedProduct =
    productSearch.options.find((o) => o.value === productId) ?? null;
  const productOptions: SearchableOption[] = selectedProduct
    ? [selectedProduct, ...productSearch.options]
    : productSearch.options;

  const bounds = dateBounds(filters.dateFrom, filters.dateTo);

  const detail = useFinanceFetch(
    () =>
      getSalesDetail({
        ...bounds,
        locationId: filters.locationId || undefined,
        saleId: saleId || undefined,
        productId: productId || undefined,
        page,
        limit: PAGE_SIZE,
        sortBy,
        sortOrder,
      }),
    [filters.dateFrom, filters.dateTo, filters.locationId, saleId, productId, page, sortBy, sortOrder],
    "Could not load the sale lines.",
  );

  const rows: SalesDetailLineDto[] = detail.data?.data ?? [];
  const meta = detail.data?.meta;

  function applySort(column: SalesDetailSortBy) {
    const next = nextSort(column, sortBy, sortOrder);
    setSortBy(next.sortBy);
    setSortOrder(next.sortOrder);
    setPage(1);
  }

  const activeDrills = [saleId, productId].some(Boolean);

  return (
    <div className="flex flex-col gap-5">
      <SubFilters>
        <div className="flex flex-col gap-1.5 flex-1 min-w-[170px]">
          <label className="text-sm font-medium text-[#333333]">Sale ID</label>
          <SearchInput
            value={saleId}
            onChange={setSaleId}
            placeholder="Filter by sale ID"
          />
        </div>
        <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
          <label className="text-sm font-medium text-[#333333]">Product</label>
          <SearchableSelect
            value={productId || null}
            onChange={setProductId}
            options={productOptions}
            onSearch={productSearch.setTerm}
            loading={productSearch.loading}
            error={productSearch.error}
            onRetry={productSearch.retry}
            allowClear
            placeholder="All products"
            searchPlaceholder="Search products..."
            emptyMessage="No products found"
            noResultsMessage="No products matching your search"
          />
        </div>
        {activeDrills && (
          <button
            type="button"
            onClick={() => {
              setSaleId("");
              setProductId("");
            }}
            className="rounded-lg border border-[#C6D4BF] px-4 py-2 text-sm font-semibold text-[#666666] hover:bg-[#E6ECE2] transition-colors"
          >
            Clear drill-down
          </button>
        )}
      </SubFilters>

      <Panel title="Sale lines">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-[#E6ECE2]">
              <tr className="text-xs text-[#666666]">
                <th className="px-4 py-3 text-left font-semibold text-[#333333]">Sale #</th>
                <SortHeader
                  active={sortBy === "createdAt"}
                  order={sortOrder}
                  onClick={() => applySort("createdAt")}
                  title="Sale date"
                >
                  Date
                </SortHeader>
                <th className="px-4 py-3 text-left font-semibold text-[#333333]">Product</th>
                <th className="px-4 py-3 text-left font-semibold text-[#333333]">SKU</th>
                <th className="px-4 py-3 text-left font-semibold text-[#333333]">Location</th>
                <th className="px-4 py-3 text-left font-semibold text-[#333333]">Cashier</th>
                <SortHeader
                  align="right"
                  active={sortBy === "lineTotal"}
                  order={sortOrder}
                  onClick={() => applySort("lineTotal")}
                >
                  Line total
                </SortHeader>
                <SortHeader
                  align="right"
                  active={sortBy === "baseQuantity"}
                  order={sortOrder}
                  onClick={() => applySort("baseQuantity")}
                >
                  Base qty
                </SortHeader>
                <th className="px-4 py-3 text-right font-semibold text-[#333333]">Sale total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6ECE2]">
              {detail.loading ? (
                <tr>
                  <td colSpan={9} className="p-0">
                    <TableSkeleton cols={8} />
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={`${row.sale?.id ?? "row"}-${row.product?.id ?? index}`} className="text-sm text-[#333333] hover:bg-[#F7FAF5]">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={!row.sale?.id}
                        onClick={() => row.sale?.id && setOpenSaleId(row.sale.id)}
                        className="font-medium text-[#4F6B4A] hover:underline disabled:text-[#333333] disabled:hover:no-underline disabled:cursor-default"
                      >
                        {row.sale?.saleNumber ?? "—"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-[#666666]">{fmtDateTime(row.sale?.createdAt)}</td>
                    <td className="px-4 py-3">{row.product?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-[#666666]">{row.product?.sku ?? "—"}</td>
                    <td className="px-4 py-3">{row.location?.name ?? "—"}</td>
                    <td className="px-4 py-3">{row.cashier?.name ?? "—"}</td>
                    {/* The line's own amount and base quantity are not part of the
                        published contract; the sale's totals are shown instead of
                        inventing line-level numbers. */}
                    <td className="px-4 py-3 text-right text-[#999999]">—</td>
                    <td className="px-4 py-3 text-right text-[#999999]">—</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {fmtMoney(row.sale?.totalAmount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {detail.error ? (
          <ErrorBlock headline="Sale lines unavailable" message={detail.error} onRetry={detail.reload} />
        ) : (
          !detail.loading &&
          rows.length === 0 && (
            <EmptyBlock
              title="No sale lines found for the selected filters."
              description="Try widening the date range or clearing the drill-down filters."
            />
          )
        )}

        {!detail.loading && !detail.error && rows.length > 0 && (
          <Pagination
            page={meta?.page ?? page}
            totalPages={meta?.totalPages ?? 1}
            onPageChange={setPage}
            label={rangeLabel(meta?.page ?? page, meta?.limit ?? PAGE_SIZE, meta?.total ?? 0, "lines")}
          />
        )}

        <p className="px-5 py-3 border-t border-[#E6ECE2] text-xs text-[#666666]">
          Sale date is sorted by <span className="font-medium">createdAt</span>. Line total and base
          quantity sort server-side, but the values themselves are not published in the endpoint
          contract yet — the sale total is shown instead of guessed line figures.
        </p>
      </Panel>

      {openSaleId && (
        <SaleDetailModal
          saleId={openSaleId}
          onClose={() => setOpenSaleId(null)}
          onChanged={detail.reload}
        />
      )}
    </div>
  );
}