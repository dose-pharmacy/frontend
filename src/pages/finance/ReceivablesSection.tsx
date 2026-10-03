// ── Finance · Receivables ────────────────────────────────────────────────────
// The two balance cards come from the shared `GET /finance-reporting/report`
// response (`collections.customerReceivables` / `collections.customerCollections`).
// The ledger below stays on `GET /financials/credit-sales` — the report carries
// no row-level receivables list, and inventing one is not an option.
//
// This tab deliberately REPORTS only. The Credit module (linked below) owns
// operational debt management and payment collection, so no payment controls,
// no amount entry and no second receipt UI are reproduced here. Every balance
// shown is the backend's `outstandingAmount`; the frontend never sums a page of
// balances into a headline "total owed", because a page is not the whole ledger.
//
// §24: outstanding balances are NOT labelled "overdue" — the API exposes no due
// date and no overdue rule.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Pagination from "../../components/ui/Pagination";
import {
  listCreditSales,
  type CreditPaymentStatus,
  type CreditSaleListItem,
  type CreditStatusFilter,
} from "../../features/credit/creditApi";
import {
  EmptyBlock,
  ErrorBlock,
  FilterSelect,
  KpiCard,
  Panel,
  TableSkeleton,
  dateBounds,
  fmtDate,
  fmtMoney,
  fmtNumber,
  rangeLabel,
  useFinanceFetch,
  type FinanceFilters,
  type FinanceReportState,
} from "./financeView";

const PAGE_SIZE = 20;

const STATUS_OPTIONS: { value: CreditStatusFilter; label: string }[] = [
  { value: "OUTSTANDING", label: "Outstanding" },
  { value: "PARTIALLY_PAID", label: "Partially paid" },
  { value: "PAID", label: "Paid" },
  { value: "ALL", label: "All statuses" },
];

/** `customerName` / `customerPhone` / `saleNumber` are EXACT-match filters, not
 *  substring searches. They are held locally and applied on submit so each
 *  keystroke doesn't fire a request that can only come back empty. */
const DRILL_DEFAULTS = { customerName: "", customerPhone: "", saleNumber: "" };

export default function ReceivablesSection({
  filters,
  report,
}: {
  filters: FinanceFilters;
  report: FinanceReportState;
}) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<CreditStatusFilter>("OUTSTANDING");
  const [drill, setDrill] = useState(DRILL_DEFAULTS);
  const [applied, setApplied] = useState(DRILL_DEFAULTS);

  useEffect(() => {
    setPage(1);
  }, [filters.dateFrom, filters.dateTo, filters.locationId, status, applied]);

  const bounds = dateBounds(filters.dateFrom, filters.dateTo);

  const receivables = useFinanceFetch(
    () =>
      listCreditSales({
        ...bounds,
        locationId: filters.locationId || undefined,
        status,
        customerName: applied.customerName || undefined,
        customerPhone: applied.customerPhone || undefined,
        saleNumber: applied.saleNumber || undefined,
        page,
        limit: PAGE_SIZE,
      }),
    [filters.dateFrom, filters.dateTo, filters.locationId, status, applied, page],
    "Could not load customer receivables.",
  );

  const rows: CreditSaleListItem[] = receivables.data?.data ?? [];
  const meta = receivables.data?.meta;

  function applyDrill(update: () => void) {
    update();
    setPage(1);
  }

  function changeStatus(next: CreditStatusFilter) {
    setStatus(next);
    setPage(1);
  }

  const drillActive = Boolean(applied.customerName || applied.customerPhone || applied.saleNumber);

  // Report-sourced balances. `collections` is the section that owns customer
  // debt, so these are read from there rather than from the sales figures — a
  // receivable is never a sales value.
  const collections = report.data?.collections;

  return (
    <div className="flex flex-col gap-5">
      {/* Whole-scope balances for the selected window. These are the backend's
          own totals, NOT a sum of the ledger page below — a page is not the
          whole ledger, so the two are deliberately never reconciled on screen. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Customer receivables"
          value={fmtMoney(collections?.customerReceivables)}
          loading={report.loading}
          error={report.error}
          onRetry={report.reload}
          hint="Outstanding balance"
        />
        <KpiCard
          label="Customer collections"
          value={fmtMoney(collections?.customerCollections)}
          loading={report.loading}
          error={report.error}
          onRetry={report.reload}
          hint="Collected in the period"
        />
      </div>

      <Panel
        title="Customer receivables"
        action={
          <Link
            to="/dashboard/credit"
            className="text-xs font-semibold text-[#4F6B4A] hover:underline"
          >
            Manage payments in Credit →
          </Link>
        }
      >
        <form
          className="flex flex-wrap items-end gap-3 border-b border-[#E6ECE2] px-5 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            applyDrill(() => setApplied(drill));
          }}
        >
          <FilterSelect label="Status" value={status} onChange={(v) => changeStatus(v as CreditStatusFilter)}>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </FilterSelect>
          <TextFilter
            label="Customer name"
            value={drill.customerName}
            onChange={(v) => setDrill((d) => ({ ...d, customerName: v }))}
            placeholder="Exact name"
          />
          <TextFilter
            label="Customer phone"
            value={drill.customerPhone}
            onChange={(v) => setDrill((d) => ({ ...d, customerPhone: v }))}
            placeholder="Exact phone"
          />
          <TextFilter
            label="Sale number"
            value={drill.saleNumber}
            onChange={(v) => setDrill((d) => ({ ...d, saleNumber: v }))}
            placeholder="Exact sale number"
          />
          <button
            type="submit"
            className="rounded-lg bg-[#4F6B4A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3F5739] transition-colors"
          >
            Apply
          </button>
          {drillActive && (
            <button
              type="button"
              onClick={() => applyDrill(() => {
                setDrill(DRILL_DEFAULTS);
                setApplied(DRILL_DEFAULTS);
              })}
              className="rounded-lg border border-[#C6D4BF] px-4 py-2 text-sm font-semibold text-[#666666] hover:bg-[#E6ECE2] transition-colors"
            >
              Clear
            </button>
          )}
        </form>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-[#E6ECE2]">
              <tr className="text-xs text-[#666666]">
                <th className="px-4 py-3 text-left font-semibold text-[#333333]">Customer</th>
                <th className="px-4 py-3 text-left font-semibold text-[#333333]">Sale #</th>
                <th className="px-4 py-3 text-left font-semibold text-[#333333]">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-[#333333]">Location</th>
                <th className="px-4 py-3 text-right font-semibold text-[#333333]">Total</th>
                <th className="px-4 py-3 text-right font-semibold text-[#333333]">Paid</th>
                <th className="px-4 py-3 text-right font-semibold text-[#333333]">Outstanding</th>
                <th className="px-4 py-3 text-left font-semibold text-[#333333]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6ECE2]">
              {receivables.loading ? (
                <tr>
                  <td colSpan={8} className="p-0">
                    <TableSkeleton cols={8} />
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="text-sm text-[#333333] hover:bg-[#F7FAF5]">
                    <td className="px-4 py-3">
                      <div className="font-medium">{row.customerName ?? "—"}</div>
                      {row.customerPhone && (
                        <div className="text-xs text-[#666666]">{row.customerPhone}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">{row.saleNumber}</td>
                    <td className="px-4 py-3 text-[#666666]">{fmtDate(row.saleDate)}</td>
                    <td className="px-4 py-3">{row.location?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(row.totalAmount)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmtMoney(row.paidAmount)}</td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums font-medium ${
                        row.outstandingAmount > 0 ? "text-red-700" : "text-green-700"
                      }`}
                    >
                      {fmtMoney(row.outstandingAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.paymentStatus} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {receivables.error ? (
          <ErrorBlock
            headline="Receivables unavailable"
            message={receivables.error}
            onRetry={receivables.reload}
          />
        ) : (
          !receivables.loading &&
          rows.length === 0 && (
            <EmptyBlock
              title="No customer receivables found."
              description="Nothing matches the selected status, date range and filters."
            />
          )
        )}

        {!receivables.loading && !receivables.error && rows.length > 0 && (
          <Pagination
            page={meta?.page ?? page}
            totalPages={meta?.totalPages ?? 1}
            onPageChange={setPage}
            label={rangeLabel(meta?.page ?? page, meta?.limit ?? PAGE_SIZE, meta?.total ?? 0, "receivables")}
          />
        )}

        <p className="px-5 py-3 border-t border-[#E6ECE2] text-xs text-[#666666]">
          {meta ? (
            <>
              <span className="font-medium text-[#333333]">
                {fmtNumber(meta.total)} receivables
              </span>{" "}
              match the current filters in total. Balances are never described as overdue — the API
              provides no due date. Record a payment from the Credit module.
            </>
          ) : (
            "Record a payment from the Credit module."
          )}
        </p>
      </Panel>
    </div>
  );
}

function TextFilter({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 flex-1 min-w-[150px]">
      <label className="text-sm font-medium text-[#333333]">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-lg border border-[#C6D4BF] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#4F6B4A]"
      />
    </div>
  );
}

/** Colours the three REAL backend statuses. An unknown value still renders. */
function StatusBadge({ status }: { status: CreditPaymentStatus | string }) {
  const style =
    status === "PAID"
      ? "bg-green-50 text-green-700 border-green-100"
      : status === "PARTIALLY_PAID"
        ? "bg-amber-50 text-amber-700 border-amber-100"
        : status === "OUTSTANDING"
          ? "bg-red-50 text-red-700 border-red-100"
          : "bg-[#E6ECE2] text-[#666666] border-[#E6ECE2]";
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-1 text-[11px] font-semibold ${style}`}
      title={status}
    >
      {status.replace(/_/g, " ").toLowerCase()}
    </span>
  );
}