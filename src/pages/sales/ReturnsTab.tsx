// ── Sales → Returns tab ──────────────────────────────────────────────────────
// The customer-return register: what has been returned, when, from which sale,
// how much was refunded and whether the stock went back on the shelf.
//
//   GET /pos/returns  → paginated rows + `summary.refundAmount`
//   GET /pos/returns/{id} → the row's detail view
//
// Two things are deliberately absent:
//
//   • A search box. The endpoint publishes no `search` parameter, so a search
//     box here could only ever filter the current page and would look like a
//     server-side search that does not exist. The supported filters are the only
//     ones offered.
//   • A client-side refund total. The one figure on this page comes from the
//     response's own `summary`, and it covers the whole filtered set rather than
//     the rows currently visible.
//
// Pagination is server-side via `meta`; no return is ever fetched in bulk to
// count or total in the browser.

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "../../components/ui/Button";
import Pagination from "../../components/ui/Pagination";
import EmptyState from "../../components/ui/EmptyState";
import Select from "../../components/ui/Select";
import DatePicker from "../../components/ui/DatePicker";
import { listLocations, type LocationDto } from "../../features/inventory/locationsApi";
import {
  listReturns,
  type RefundMethod,
  type SaleReturn,
} from "../../features/sales/returnsApi";
import { fmtDate, fmtDateTime, fmtMoney } from "../../utils/format";
import {
  InlineError,
  SkeletonRows,
  dayEndIso,
  dayStartIso,
  errorMessage,
  paymentMethodLabel,
  plural,
} from "./saleView";
import {
  REFUND_METHOD_FILTERS,
  RESTOCK_FILTERS,
  ReturnItemCount,
  RestockBadge,
} from "./returnsView";
import ReturnDetailModal from "./ReturnDetailModal";

const PAGE_SIZE = 20;

interface Props {
  /** Bumped by the page header's Refresh button. */
  reloadTick: number;
}

export default function ReturnsTab({ reloadTick }: Props) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [locationId, setLocationId] = useState("");
  const [refundMethod, setRefundMethod] = useState<"" | RefundMethod>("");
  const [restock, setRestock] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(1);

  const [returns, setReturns] = useState<SaleReturn[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
  const [totalRefunded, setTotalRefunded] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [locations, setLocations] = useState<LocationDto[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);

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
  }, [dateFrom, dateTo, locationId, refundMethod, restock]);

  const query = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(locationId ? { locationId } : {}),
      ...(refundMethod ? { refundMethod } : {}),
      ...(restock ? { restock } : {}),
      // An empty date removes the parameter entirely rather than sending "".
      ...(dateFrom ? { dateFrom: dayStartIso(dateFrom) } : {}),
      ...(dateTo ? { dateTo: dayEndIso(dateTo) } : {}),
    }),
    [page, dateFrom, dateTo, locationId, refundMethod, restock],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const res = await listReturns(query);
      setReturns(res.data ?? []);
      setMeta(res.meta ?? { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 });
      setTotalRefunded(res.summary?.refundAmount ?? null);
    } catch (e) {
      setListError(errorMessage(e, "Unable to load returns."));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load, reloadTick]);

  const hasFilters = Boolean(dateFrom || dateTo || locationId || refundMethod || restock);

  function clearFilters() {
    setDateFrom("");
    setDateTo("");
    setLocationId("");
    setRefundMethod("");
    setRestock("");
  }

  // `meta` is the only source of truth for the row range. A backend that omits
  // `limit` (or reports 0) must not produce "Showing 1–0 of N".
  const currentPage = Math.max(1, meta.page);
  const effectiveLimit = meta.limit > 0 ? meta.limit : PAGE_SIZE;
  const firstRow = meta.total === 0 ? 0 : (currentPage - 1) * effectiveLimit + 1;
  const lastRow = Math.min(currentPage * effectiveLimit, meta.total);

  return (
    <div className="flex flex-col gap-4">
      {/* ── Summary ── */}
      <div className="rounded-xl bg-[#E6ECE2] p-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[#666666]">
            Total Refunds
          </p>
          <p className="text-2xl font-bold text-[#333333] leading-tight mt-0.5">
            {totalRefunded == null ? "—" : fmtMoney(totalRefunded)}
          </p>
        </div>
        <p className="text-[11px] text-[#666666] max-w-xs">
          {totalRefunded == null
            ? "The API returned no summary for the current filters."
            : "Server total for the current filters — not the sum of the rows below."}
        </p>
      </div>

      {/* ── Filters ── */}
      <div className="rounded-xl border border-[#E6ECE2] bg-white p-4 flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          <div className="lg:col-span-2 grid grid-cols-2 gap-3 items-end">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#333333]">Date From</label>
              <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="From" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[#333333]">Date To</label>
              <DatePicker value={dateTo} onChange={setDateTo} placeholder="To" />
            </div>
          </div>

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

          <Select
            label="Refund Method"
            value={refundMethod}
            onChange={(e) => setRefundMethod(e.target.value as "" | RefundMethod)}
          >
            {REFUND_METHOD_FILTERS.map((o) => (
              <option key={o.label} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>

          <Select
            label="Restocked"
            value={restock}
            onChange={(e) => setRestock(e.target.value as "" | "true" | "false")}
          >
            {RESTOCK_FILTERS.map((o) => (
              <option key={o.label} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

        {hasFilters && (
          <div className="flex items-center justify-between gap-3 border-t border-[#E6ECE2] pt-3">
            <p className="text-xs text-[#666666]">
              {listError
                ? "Filters are applied on the next successful load."
                : `${plural(meta.total, "return")} match the current filters.`}
            </p>
            <Button variant="secondary" onClick={clearFilters}>
              Clear Filters
            </Button>
          </div>
        )}
      </div>

      {/* ── Table ── */}
      <div className="rounded-xl border border-[#E6ECE2] bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {loading && returns.length === 0 ? (
            <SkeletonRows rows={8} cols={8} />
          ) : listError && returns.length === 0 ? (
            <InlineError message={listError} onRetry={load} />
          ) : returns.length === 0 ? (
            hasFilters ? (
              <EmptyState
                title="No matching returns"
                description="Try changing the filters."
                action={
                  <Button variant="secondary" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title="No returns found"
                description="There are no customer returns matching the selected filters."
              />
            )
          ) : (
            <table className="w-full text-sm min-w-[1020px]">
              <thead>
                <tr className="border-b border-[#E6ECE2] text-left">
                  {[
                    { h: "Return Number", align: "left" as const },
                    { h: "Original Sale", align: "left" as const },
                    { h: "Date", align: "left" as const },
                    { h: "Location", align: "left" as const },
                    { h: "Items", align: "right" as const },
                    { h: "Refund", align: "right" as const },
                    { h: "Refund Method", align: "left" as const },
                    { h: "Restocked", align: "left" as const },
                    { h: "Created By", align: "left" as const },
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
                {returns.map((r) => (
                  <tr key={r.id} className="hover:bg-[#F5F8F2]">
                    <td className="px-4 py-3 font-semibold text-[#333333] whitespace-nowrap">
                      {r.returnNumber}
                    </td>
                    <td className="px-4 py-3 text-[#666666] whitespace-nowrap">
                      {r.sale?.saleNumber ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-[#666666] whitespace-nowrap">
                      <span className="block">{fmtDate(r.createdAt)}</span>
                      <span className="block text-[11px] text-[#999999]">
                        {fmtDateTime(r.createdAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#666666] whitespace-nowrap">
                      {r.location?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[#666666] whitespace-nowrap">
                      <ReturnItemCount items={r.items} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#333333] whitespace-nowrap">
                      {fmtMoney(r.refundAmount)}
                    </td>
                    <td className="px-4 py-3 text-[#666666] whitespace-nowrap">
                      {paymentMethodLabel(r.refundMethod)}
                    </td>
                    <td className="px-4 py-3">
                      <RestockBadge items={r.items} />
                    </td>
                    <td className="px-4 py-3 text-[#666666] whitespace-nowrap">
                      {r.createdBy?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setDetailId(r.id)}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-[#4F6B4A] border border-[#C6D4BF] hover:bg-[#E6ECE2] transition-colors whitespace-nowrap"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination is driven by the backend's meta, never by row count. */}
        {!loading && returns.length > 0 && (
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
                  <span className="font-medium text-[#333333]">{meta.total}</span> returns
                </>
              }
            />
          </>
        )}
      </div>

      {detailId && <ReturnDetailModal returnId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}
