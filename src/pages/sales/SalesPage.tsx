// ── Dashboard → Sales ─────────────────────────────────────────────────────────
// Transaction management and transaction history for POS sales.
//
// Endpoints used (all through the existing API clients, no second client):
//
//   GET  /pos/sales                 → the list, paginated by the backend
//   GET  /pos/sales/{id}            → full receipt: items, batches, payments
//   POST /pos/sales/{id}/cancel     → DRAFT sales only
//   POST /pos/sales/{id}/payments   → collect an outstanding balance
//   GET  /inventory/locations       → the location filter's options
//
// Deliberately NOT here, because the backend does not support them:
//   • returns / refunds / exchanges / stock restoration (not implemented by the
//     backend for completed sales — a completed sale is terminal)
//   • a CREDIT payment method. A sale is "on credit" when
//     totalAmount > paidAmount; that is a business state, not a payment method.
//   • cost, margin or profit per sale (no endpoint exposes sale cost)
//   • customer or product search — `search` matches the sale/receipt number only.
//   • finance analytics (trends, margins, supplier figures) — those live on the
//     Finance tab, and receivables live on the Credit tab.
//
// Pagination is server-side via `meta`. No sale is ever fetched in bulk to
// filter or count in the browser.

import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardSubNav from "../dashboard/DashboardSubNav";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import Pagination from "../../components/ui/Pagination";
import EmptyState from "../../components/ui/EmptyState";
import SearchInput from "../../components/ui/SearchInput";
import Select from "../../components/ui/Select";
import DatePicker from "../../components/ui/DatePicker";
import { listLocations, type LocationDto } from "../../features/inventory/locationsApi";
import { listSales, type SaleDto } from "../../features/sales/salesApi";
import { fmtMoney, fmtDate } from "../../utils/format";
import SaleDetailModal from "./SaleDetailModal";
import {
  InlineError,
  SaleStatusBadge,
  SkeletonRows,
  dayEndIso,
  dayStartIso,
  errorMessage,
  outstandingFor,
  paymentSummary,
  plural,
  saleMoment,
} from "./saleView";

const PAGE_SIZE = 20;

/** Mirrors the backend's `status` query enum exactly. */
const STATUS_OPTIONS: { value: "" | "DRAFT" | "COMPLETED" | "CANCELLED"; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "COMPLETED", label: "Completed" },
  { value: "DRAFT", label: "Draft" },
  { value: "CANCELLED", label: "Cancelled" },
];

export default function SalesPage() {
  // Filter state. `search` is what the API receives; `searchInput` is the raw
  // field and is debounced into it.
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | "DRAFT" | "COMPLETED" | "CANCELLED">("");
  const [locationId, setLocationId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const [sales, setSales] = useState<SaleDto[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [locations, setLocations] = useState<LocationDto[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  // Debounce the sale-number search so typing does not fire a request per key.
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Location options come from the app's locations endpoint — never hardcoded.
  useEffect(() => {
    let active = true;
    listLocations({ limit: 100, isActive: true })
      .then((res) => {
        if (active) setLocations(res.data ?? []);
      })
      .catch(() => {
        /* The filter simply stays as "All locations". */
      });
    return () => {
      active = false;
    };
  }, []);

  // Any filter change returns to page 1 — otherwise a narrowed result set can
  // land on a page that no longer exists.
  useEffect(() => {
    setPage(1);
  }, [search, status, locationId, dateFrom, dateTo]);

  const query = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(status ? { status } : {}),
      ...(locationId ? { locationId } : {}),
      // An empty date removes the parameter entirely rather than sending "".
      ...(dateFrom ? { dateFrom: dayStartIso(dateFrom) } : {}),
      ...(dateTo ? { dateTo: dayEndIso(dateTo) } : {}),
      ...(search ? { search } : {}),
    }),
    [page, status, locationId, dateFrom, dateTo, search],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const res = await listSales(query);
      setSales(res.data ?? []);
      setMeta(res.meta ?? { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
    } catch (e) {
      setListError(errorMessage(e, "Unable to load sales."));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load, reloadTick]);

  const hasFilters = Boolean(search || status || locationId || dateFrom || dateTo);

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setStatus("");
    setLocationId("");
    setDateFrom("");
    setDateTo("");
  }

  // `meta` is the only source of truth for the row range. A backend that omits
  // `limit` (or reports 0) must not produce "Showing 1–0 of N".
  const currentPage = Math.max(1, meta.page);
  const effectiveLimit = meta.limit > 0 ? meta.limit : PAGE_SIZE;
  const firstRow = meta.total === 0 ? 0 : (currentPage - 1) * effectiveLimit + 1;
  const lastRow = Math.min(currentPage * effectiveLimit, meta.total);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="border-b border-[#E6ECE2] bg-white">
        <PageHeader
          breadcrumb="Dashboard"
          title="Sales"
          subtitle="Manage and review POS transactions"
          actions={
            <Button
              variant="secondary"
              onClick={() => setReloadTick((t) => t + 1)}
              disabled={loading}
              loading={loading}
              className="!bg-[#7A9076] !text-white hover:!bg-[#4F6B4A] focus-visible:!ring-[#7A9076]"
            >
              Refresh
            </Button>
          }
        />
      </div>

      <DashboardSubNav />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
        {/* ── Filters ─────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-[#E6ECE2] bg-white p-4 flex flex-col gap-3">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            {/* A wrapping <label> associates with the nested input implicitly, so no
                shared component needs an id prop. */}
            <label className="lg:col-span-1 flex flex-col gap-1.5">
              <span className="text-sm font-medium text-[#333333]">Search</span>
              <SearchInput
                value={searchInput}
                onChange={setSearchInput}
                placeholder="Search sale number..."
              />
              <span className="text-[11px] text-[#999999]">
                Matches the sale / receipt number only.
              </span>
            </label>

            <Select
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.label} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>

            <Select
              label="Location"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              <option value="">All locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>

            <div className="grid grid-cols-2 gap-3 items-end">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#333333]">Date From</label>
                <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="From" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#333333]">Date To</label>
                <DatePicker value={dateTo} onChange={setDateTo} placeholder="To" />
              </div>
            </div>
          </div>

          {hasFilters && (
            <div className="flex items-center justify-between gap-3 border-t border-[#E6ECE2] pt-3">
              <p className="text-xs text-[#666666]">
                {listError
                  ? "Filters are applied on the next successful load."
                  : `${plural(meta.total, "sale")} match the current filters.`}
              </p>
              <Button variant="secondary" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          )}
        </div>

        {/* ── Table ───────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-[#E6ECE2] bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            {loading && sales.length === 0 ? (
              <SkeletonRows rows={8} cols={9} />
            ) : listError && sales.length === 0 ? (
              <InlineError message={listError} onRetry={load} />
            ) : sales.length === 0 ? (
              hasFilters ? (
                <EmptyState
                  title="No matching sales"
                  description="Try changing the search or filters."
                  action={
                    <Button variant="secondary" onClick={clearFilters}>
                      Clear Filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  title="No sales found"
                  description="There are no sales matching the selected filters."
                />
              )
            ) : (
              <table className="w-full text-sm min-w-[1080px]">
                <thead>
                  <tr className="border-b border-[#E6ECE2] text-left">
                    {[
                      { h: "Sale Number", align: "left" as const },
                      { h: "Date", align: "left" as const },
                      { h: "Cashier", align: "left" as const },
                      { h: "Location", align: "left" as const },
                      { h: "Items", align: "right" as const },
                      { h: "Payment", align: "left" as const },
                      { h: "Total", align: "right" as const },
                      { h: "Paid", align: "right" as const },
                      { h: "Outstanding", align: "right" as const },
                      { h: "Status", align: "left" as const },
                      { h: "", align: "right" as const },
                    ].map((col, i) => (
                      <th
                        key={col.h || `act-${i}`}
                        className={`px-4 py-3 font-semibold text-[#666666] whitespace-nowrap ${
                          col.align === "right" ? "text-right" : ""
                        }`}
                      >
                        {col.h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6ECE2]">
                  {sales.map((sale) => {
                    const outstanding = outstandingFor(sale);
                    const isCompleted = sale.status === "COMPLETED";
                    const itemCount = sale.items?.length ?? 0;
                    const moment = saleMoment(sale);
                    return (
                      <tr key={sale.id} className="hover:bg-[#F5F8F2]">
                        <td className="px-4 py-3 font-semibold text-[#333333] whitespace-nowrap">
                          {sale.saleNumber}
                        </td>
                        <td className="px-4 py-3 text-[#666666] whitespace-nowrap">
                          <span className="block">{fmtDate(moment.value)}</span>
                          <span className="block text-[11px] text-[#999999]">{moment.label}</span>
                        </td>
                        <td className="px-4 py-3 text-[#666666] whitespace-nowrap">
                          {sale.cashier?.name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-[#666666] whitespace-nowrap">
                          {sale.location?.name ?? "—"}
                        </td>
                        <td
                          className="px-4 py-3 text-right tabular-nums text-[#666666] whitespace-nowrap"
                          title={
                            itemCount > 0
                              ? plural(itemCount, "item")
                              : "The list response returned no item lines"
                          }
                        >
                          {itemCount > 0 ? itemCount : "—"}
                        </td>
                        <td className="px-4 py-3 text-[#666666] whitespace-nowrap">
                          {paymentSummary(sale.payments)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#333333] whitespace-nowrap">
                          {fmtMoney(sale.totalAmount)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-[#666666] whitespace-nowrap">
                          {fmtMoney(sale.paidAmount)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                          {!isCompleted ? (
                            <span
                              className="text-[#999999]"
                              title="Not applicable to a non-completed sale"
                            >
                              —
                            </span>
                          ) : outstanding > 0 ? (
                            <span className="font-semibold text-amber-700">
                              {fmtMoney(outstanding)}
                            </span>
                          ) : (
                            <span className="text-[#999999]">{fmtMoney(0)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <SaleStatusBadge status={sale.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setDetailId(sale.id)}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[#4F6B4A] border border-[#C6D4BF] hover:bg-[#E6ECE2] transition-colors whitespace-nowrap"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination is driven by the backend's meta, never by row count. */}
          {!loading && sales.length > 0 && (
            <>
              {listError && (
                <p className="mx-4 mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  Could not refresh the list — showing the last loaded page.{" "}
                  <button onClick={load} className="font-semibold underline">
                    Retry
                  </button>
                </p>
              )}
              <Pagination
                page={currentPage}
                totalPages={Math.max(1, meta.totalPages)}
                onPageChange={setPage}
                label={
                  <>
                    Showing <span className="font-medium text-[#333333]">{firstRow}</span>–
                    <span className="font-medium text-[#333333]">{lastRow}</span> of{" "}
                    <span className="font-medium text-[#333333]">{meta.total}</span> sales
                  </>
                }
              />
            </>
          )}
        </div>
      </div>

      {detailId && (
        <SaleDetailModal
          saleId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={() => setReloadTick((t) => t + 1)}
        />
      )}
    </div>
  );
}