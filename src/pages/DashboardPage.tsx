// ── Dashboard → Overview ──────────────────────────────────────────────────────
// A today/current operational snapshot only.
//
// Five questions, five sections:
//   1. TODAY              → today's sales + today's completed transactions
//   2. INVENTORY STATUS   → stock value, low stock, expiring, expired
//   3. PURCHASING         → POs awaiting delivery, unpaid supplier invoices
//   4. TODAY'S SNAPSHOT   → gross / discounts / net
//   5. QUICK ACTIONS      → deep links into the relevant list pages
//
// Deliberately absent: charts, period selectors, historical comparison,
// profitability, payment-method splits and top products. Those live on the
// Sales tab (/dashboard/sales) and the Finance tab (/dashboard/profitability).
//
// Every figure comes from a real response field. Nothing is estimated,
// derived from a formatted string, or replaced with a placeholder number.

import {
  useCallback,
  useEffect,
  useState,
  type DependencyList,
  type ReactNode,
} from "react";
import { Link } from "react-router";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import { fmtMoney, fmtNumber } from "../utils/format";
import {
  getDashboardSummary,
  type DashboardSummary,
} from "../features/dashboard/dashboardApi";
import {
  getSalesSummary,
  type SalesSummaryDto,
} from "../features/reports/reportsApi";
import { listPurchaseOrders } from "../features/purchasing/purchaseOrdersApi";
import {
  listSupplierInvoices,
  type SupplierInvoiceStatus,
} from "../features/purchasing/supplierInvoicesApi";
import DashboardSubNav from "./dashboard/DashboardSubNav";

// ── Pharmacy day boundary ────────────────────────────────────────────────────

/**
 * Africa/Addis_Ababa is a fixed UTC+3 offset with no daylight saving, so the
 * offset is exact for every date.
 *
 * The backend exposes no timezone/setting endpoint, so the day boundary is
 * resolved here and sent as an explicit range. `/financials/reports/sales/summary`
 * filters completed sales by that window, which keeps "today" aligned with the
 * pharmacy's local day instead of the browser's or the server's UTC day.
 */
const PHARMACY_UTC_OFFSET_MINUTES = 180;

function pharmacyDayBounds(reference: Date = new Date()): { dateFrom: string; dateTo: string } {
  const shifted = new Date(reference.getTime() + PHARMACY_UTC_OFFSET_MINUTES * 60_000);
  const start = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), 0, 0, 0, 0);
  return {
    dateFrom: new Date(start).toISOString(),
    // 23:59:59.999 local = the last millisecond of the local day.
    dateTo: new Date(start + 86_399_999).toISOString(),
  };
}

// ── Icons ────────────────────────────────────────────────────────────────────

type IconProps = { className?: string };

function IconMoney({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm2.5 3a1 1 0 100 2h11a1 1 0 100-2h-11zm0 4a1 1 0 100 2h7a1 1 0 100-2h-7z" />
    </svg>
  );
}

function IconReceipt({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm3.7 9.7a1 1 0 00-1.4-1.4L9 10.2 7.7 8.9a1 1 0 00-1.4 1.4l2 2a1 1 0 001.4 0l4-4z" />
    </svg>
  );
}

function IconBox({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path d="M11 17a1 1 0 001.447.894l4-2A1 1 0 0017 15V9.236a1 1 0 00-1.447-.894l-4 2a1 1 0 00-.553.894V17zM15.211 6.276a1 1 0 000-1.788l-4.764-2.382a1 1 0 00-.894 0L4.789 4.488a1 1 0 000 1.788l4.764 2.382a1 1 0 00.894 0l4.764-2.382zM4.447 8.342A1 1 0 003 9.236V15a1 1 0 00.553.894l4 2A1 1 0 009 17v-5.764a1 1 0 00-.553-.894l-4-2z" />
    </svg>
  );
}

function IconWarning({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconCalendar({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconTruck({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
      <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1v-1h3.05a2.5 2.5 0 014.9 0H19a1 1 0 001-1v-3.414a1 1 0 00-.293-.707l-2.586-2.586A1 1 0 0016.414 7H15V5a1 1 0 00-1-1H3z" />
    </svg>
  );
}

function IconBill({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconArrow({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden>
      <path
        fillRule="evenodd"
        d="M5.22 14.78a.75.75 0 001.06 0l7.22-7.22v5.69a.75.75 0 001.5 0v-7.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 000 1.5h5.69l-7.22 7.22a.75.75 0 000 1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// ── Section loading ──────────────────────────────────────────────────────────

/**
 * One independently-loaded section. Each card group owns its own request, so a
 * single failing endpoint never blanks the page, and a failed *refresh* keeps
 * the last good figures visible.
 */
function useSection<T>(loader: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loader());
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}

// ── Shared blocks ────────────────────────────────────────────────────────────

const focusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7A9076]/40 focus-visible:ring-offset-1";

const ICON = "h-4 w-4";

const TONE_MONEY = "bg-[#E1EAD9] text-[#4F6B4A]";
const TONE_NEUTRAL = "bg-[#E6ECE2] text-[#4F6B4A]";
const TONE_WARN = "bg-amber-50 text-amber-700";
const TONE_DANGER = "bg-red-50 text-red-700";

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[11px] font-bold text-[#4F6B4A] uppercase tracking-[0.14em]">
      {children}
    </h2>
  );
}

// ── KPI card ─────────────────────────────────────────────────────────────────

/**
 * One metric. Loading, error and "backend does not report this" are three
 * separate states — no placeholder figure is ever shown in place of a real one.
 */
function MetricCard({
  label,
  icon,
  tone,
  hint,
  value,
  unit,
  note,
  loading,
  error,
  onRetry,
}: {
  label: string;
  icon: ReactNode;
  tone: string;
  hint: string;
  /** `null` = the backend does not report this figure. */
  value: string | null;
  unit?: string;
  note?: string;
  loading: boolean;
  error: string | null;
  /** Omitted for cards that never fail (e.g. a figure the API does not report). */
  onRetry?: () => void;
}) {
  const showSkeleton = loading && value === null && !error;

  return (
    <div className="rounded-xl border border-[#E6ECE2] bg-white px-4 py-4 shadow-sm flex flex-col gap-3 min-w-0">
      <div className="flex items-center gap-2.5 min-w-0" title={hint}>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>
          {icon}
        </span>
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#666666] truncate">
          {label}
        </p>
      </div>

      {showSkeleton ? (
        <div className="h-8 w-28 rounded bg-[#E6ECE2]/60 animate-pulse" aria-hidden />
      ) : error && value === null ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-xl font-bold leading-none text-[#999999]">Unavailable</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className={`text-[11px] font-semibold text-[#7A9076] hover:underline self-start ${focusRing}`}
            >
              Retry
            </button>
          )}
        </div>
      ) : (
        <p className="text-2xl font-bold leading-none text-[#333333] tabular-nums truncate">
          {value ?? "—"}
          {unit && (
            <span className="ml-1.5 text-xs font-semibold text-[#666666] tracking-normal">
              {unit}
            </span>
          )}
        </p>
      )}

      <p className="text-[11px] text-[#999999] leading-snug">
        {error && value !== null ? "Refresh failed — showing last loaded value" : note}
      </p>
    </div>
  );
}

// ── Quick actions ────────────────────────────────────────────────────────────

interface QuickAction {
  label: string;
  caption: string;
  icon: ReactNode;
  to: string;
  /** Formatted count shown on the card, or `null` when not yet known. */
  count: string | null;
  loading: boolean;
}

function QuickActionCard({ action }: { action: QuickAction }) {
  return (
    <Link
      to={action.to}
      className={`group bg-white rounded-xl border border-[#C6D4BF] p-4 transition-all hover:border-[#7A9076] hover:bg-[#E6ECE2]/40 flex items-center justify-between gap-3 min-w-0 ${focusRing}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#E6ECE2] text-[#4F6B4A] transition-colors group-hover:bg-[#7A9076] group-hover:text-white">
          {action.icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#333333] truncate">{action.label}</p>
          <p className="text-xs text-[#666666] truncate">
            {action.loading && action.count === null ? "Loading…" : `${action.count ?? "—"} · ${action.caption}`}
          </p>
        </div>
      </div>
      <span className="flex-shrink-0 text-[#7A9076]">
        <IconArrow />
      </span>
    </Link>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  // One boundary per render pass so every "today" figure on the page describes
  // the same local day rather than drifting mid-request. `reloadAll` re-resolves
  // it, so a page left open across midnight rolls over on the next refresh.
  const [today, setToday] = useState(() => pharmacyDayBounds());
  const { dateFrom, dateTo } = today;

  // ── Section 1 + 4: today's sales, and the gross/discount/net snapshot ─────
  // `/financials/reports/sales/summary` counts COMPLETED sales only; DRAFT and
  // CANCELLED are excluded server-side, so no status filter is applied here.
  const sales = useSection<SalesSummaryDto>(
    () => getSalesSummary({ dateFrom, dateTo }),
    [dateFrom, dateTo],
  );

  // ── Section 2: current inventory counts ────────────────────────────────────
  // nearExpiry / expiredBatches already reflect the backend's own expiry-warning
  // threshold, and batch counts exclude rows with no stock on hand. No new
  // threshold is introduced here.
  const inventory = useSection<DashboardSummary>(() => getDashboardSummary(), []);

  // ── Section 3a: purchase orders awaiting delivery ─────────────────────────
  const awaiting = useSection<number>(
    async () => {
      const res = await listPurchaseOrders({ status: "AWAITING_DELIVERY", limit: 1 });
      return res.meta?.total ?? 0;
    },
    [],
  );

  // ── Section 3b: supplier invoices not fully paid ──────────────────────────
  const UNPAID: SupplierInvoiceStatus[] = ["OPEN", "PARTIALLY_PAID"];
  const unpaidInvoices = useSection<number>(
    async () => {
      const results = await Promise.all(
        UNPAID.map((status) => listSupplierInvoices({ status, limit: 1 })),
      );
      return results.reduce((sum, r) => sum + (r.meta?.total ?? 0), 0);
    },
    [],
  );

  const refreshing = sales.loading || inventory.loading || awaiting.loading || unpaidInvoices.loading;

  // Re-resolve the local day first. If the pharmacy day has rolled over the new
  // bounds change `dateFrom`/`dateTo`, which re-runs the sales section on its
  // own; the other sections carry no date so they are refetched directly.
  const reloadAll = () => {
    const next = pharmacyDayBounds();
    const dayRolled = next.dateFrom !== dateFrom || next.dateTo !== dateTo;
    if (dayRolled) setToday(next);
    else void sales.reload();
    void inventory.reload();
    void awaiting.reload();
    void unpaidInvoices.reload();
  };

  const summary = sales.data;

  // ── Section 1 values ───────────────────────────────────────────────────────
  const todaySalesValue =
    typeof summary?.totalSales === "number" ? fmtMoney(summary.totalSales) : null;
  const todayTransactionsValue =
    typeof summary?.transactionCount === "number" ? fmtNumber(summary.transactionCount) : null;

  // ── Section 2 values ───────────────────────────────────────────────────────
  // Stock value is intentionally absent from this list: no inventory-valuation
  // endpoint or response field exists, so the card reports the gap instead of
  // showing a figure in ETB. See the card's note.
  const lowStockValue =
    typeof inventory.data?.lowStock === "number" ? fmtNumber(inventory.data.lowStock) : null;
  const expiringValue =
    typeof inventory.data?.nearExpiry === "number" ? fmtNumber(inventory.data.nearExpiry) : null;
  const expiredValue =
    typeof inventory.data?.expiredBatches === "number"
      ? fmtNumber(inventory.data.expiredBatches)
      : null;

  // ── Section 3 values ───────────────────────────────────────────────────────
  const awaitingValue = awaiting.data !== null ? fmtNumber(awaiting.data) : null;
  const unpaidValue = unpaidInvoices.data !== null ? fmtNumber(unpaidInvoices.data) : null;

  // ── Section 4 rows ─────────────────────────────────────────────────────────
  const snapshotRows: { label: string; value: string | null; note: string }[] = [
    {
      label: "Gross Sales",
      value: typeof summary?.totalSubtotal === "number" ? fmtMoney(summary.totalSubtotal) : null,
      note: "Subtotal before discounts",
    },
    {
      label: "Discounts",
      value: typeof summary?.totalDiscount === "number" ? fmtMoney(summary.totalDiscount) : null,
      note: "Line and bill discounts applied",
    },
    {
      label: "Net Sales",
      value: typeof summary?.totalSales === "number" ? fmtMoney(summary.totalSales) : null,
      note: "Collected revenue after discounts",
    },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="border-b border-[#E6ECE2] bg-white">
        <PageHeader
          breadcrumb="Dashboard"
          title="Dashboard"
          subtitle="Today's operational snapshot — no period filters"
          actions={
            <Button
              variant="secondary"
              onClick={reloadAll}
              disabled={refreshing}
              loading={refreshing}
              className="!bg-[#7A9076] !text-white hover:!bg-[#4F6B4A] focus-visible:!ring-[#7A9076]"
            >
              Refresh
            </Button>
          }
        />
      </div>

      <DashboardSubNav />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        {/* ── 1. TODAY ──────────────────────────────────────────────────── */}
        <section aria-label="Today" className="flex flex-col gap-3">
          <SectionLabel>Today</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MetricCard
              label="Today's Sales"
              icon={<IconMoney className={ICON} />}
              tone={TONE_MONEY}
              hint="Net sales value of completed sales in the pharmacy's local day (Africa/Addis_Ababa)."
              value={todaySalesValue}
              note="Completed sales so far today"
              loading={sales.loading}
              error={sales.error}
              onRetry={sales.reload}
            />
            <MetricCard
              label="Today's Transactions"
              icon={<IconReceipt className={ICON} />}
              tone={TONE_NEUTRAL}
              hint="The backend's own count of completed sales today. Draft and cancelled sales are excluded."
              value={todayTransactionsValue}
              unit={
                summary
                  ? summary.transactionCount === 1
                    ? "sale"
                    : "sales"
                  : undefined
              }
              note="One sale = one transaction"
              loading={sales.loading}
              error={sales.error}
              onRetry={sales.reload}
            />
          </div>
        </section>

        {/* ── 2. INVENTORY STATUS ───────────────────────────────────────── */}
        <section aria-label="Inventory status" className="flex flex-col gap-3">
          <SectionLabel>Inventory Status</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* No data dependency: the backend has no inventory-valuation endpoint, so
                this card reports the gap as a constant rather than borrowing
                another card's loading/error state. */}
            <MetricCard
              label="Current Stock Value"
              icon={<IconMoney className={ICON} />}
              tone={TONE_NEUTRAL}
              hint="Requires an inventory valuation. No endpoint or response field reports an on-hand ETB value."
              value={null}
              note="Not available — no inventory valuation endpoint"
              loading={false}
              error={null}
            />
            <MetricCard
              label="Low Stock"
              icon={<IconWarning className={ICON} />}
              tone={TONE_WARN}
              hint="Products at or below their reorder point."
              value={lowStockValue}
              unit={
                inventory.data
                  ? inventory.data.lowStock === 1
                    ? "product"
                    : "products"
                  : undefined
              }
              note="Products needing replenishment"
              loading={inventory.loading}
              error={inventory.error}
              onRetry={inventory.reload}
            />
            <MetricCard
              label="Expiring Soon"
              icon={<IconCalendar className={ICON} />}
              tone={TONE_WARN}
              hint="Batches inside the backend's expiry-warning window that still hold stock."
              value={expiringValue}
              unit={
                inventory.data
                  ? inventory.data.nearExpiry === 1
                    ? "batch"
                    : "batches"
                  : undefined
              }
              note="Batches approaching expiry"
              loading={inventory.loading}
              error={inventory.error}
              onRetry={inventory.reload}
            />
            <MetricCard
              label="Expired"
              icon={<IconCalendar className={ICON} />}
              tone={TONE_DANGER}
              hint="Batches past their expiry date that still hold stock."
              value={expiredValue}
              unit={
                inventory.data
                  ? inventory.data.expiredBatches === 1
                    ? "batch"
                    : "batches"
                  : undefined
              }
              note="Batches past expiry"
              loading={inventory.loading}
              error={inventory.error}
              onRetry={inventory.reload}
            />
          </div>
        </section>

        {/* ── 3. PURCHASING / RECEIVING ─────────────────────────────────── */}
        <section aria-label="Purchasing and receiving" className="flex flex-col gap-3">
          <SectionLabel>Purchasing / Receiving</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MetricCard
              label="Awaiting Delivery"
              icon={<IconTruck className={ICON} />}
              tone={TONE_NEUTRAL}
              hint="Purchase orders with status AWAITING_DELIVERY."
              value={awaitingValue}
              unit={awaiting.data !== null ? (awaiting.data === 1 ? "PO" : "POs") : undefined}
              note="Purchase orders to chase"
              loading={awaiting.loading}
              error={awaiting.error}
              onRetry={awaiting.reload}
            />
            <MetricCard
              label="Outstanding Supplier Invoices"
              icon={<IconBill className={ICON} />}
              tone={TONE_DANGER}
              hint="Supplier invoices that are OPEN or PARTIALLY_PAID."
              value={unpaidValue}
              unit={
                unpaidInvoices.data !== null
                  ? unpaidInvoices.data === 1
                    ? "invoice"
                    : "invoices"
                  : undefined
              }
              note="Not fully paid"
              loading={unpaidInvoices.loading}
              error={unpaidInvoices.error}
              onRetry={unpaidInvoices.reload}
            />
          </div>
        </section>

        {/* ── 4. TODAY'S SALES SNAPSHOT ──────────────────────────────────── */}
        <section aria-label="Today's sales snapshot" className="flex flex-col gap-3">
          <SectionLabel>Today's Sales Snapshot</SectionLabel>
          <div className="bg-white rounded-xl border border-[#E6ECE2] shadow-sm overflow-hidden">
            {sales.loading && !sales.data ? (
              <div className="px-5 py-4 flex flex-col gap-3" aria-hidden>
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="h-11 rounded-lg bg-[#E6ECE2]/60 animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                {sales.error && (
                  <p className="mx-5 mt-4 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    {sales.data
                      ? "Showing the last loaded figures — the latest refresh failed."
                      : "Today's figures are unavailable."}
                    <button
                      onClick={sales.reload}
                      className={`ml-2 font-semibold underline ${focusRing}`}
                    >
                      Retry
                    </button>
                  </p>
                )}
                <ul className="divide-y divide-[#E6ECE2]">
                  {snapshotRows.map((row) => (
                    <li
                      key={row.label}
                      className="px-5 py-4 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#333333]">{row.label}</p>
                        <p className="text-[11px] text-[#666666]">{row.note}</p>
                      </div>
                      <p className="shrink-0 text-lg font-bold text-[#333333] tabular-nums">
                        {row.value ?? "—"}
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>

        {/* ── 5. QUICK ACTIONS ──────────────────────────────────────────── */}
        <section aria-label="Quick actions" className="flex flex-col gap-3">
          <SectionLabel>Quick Actions</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <QuickActionCard
              action={{
                label: "Low Stock",
                caption: "View products",
                icon: <IconWarning className={ICON} />,
                to: "/inventory/stock",
                count: lowStockValue,
                loading: inventory.loading,
              }}
            />
            <QuickActionCard
              action={{
                label: "Expiring Soon",
                caption: "View batches",
                icon: <IconCalendar className={ICON} />,
                to: "/inventory/batches-expiry",
                count: expiringValue,
                loading: inventory.loading,
              }}
            />
            <QuickActionCard
              action={{
                label: "Awaiting Delivery",
                caption: "View purchase orders",
                icon: <IconTruck className={ICON} />,
                to: "/purchasing/orders",
                count: awaitingValue,
                loading: awaiting.loading,
              }}
            />
            <QuickActionCard
              action={{
                label: "Supplier Bills",
                caption: "View unpaid invoices",
                icon: <IconBill className={ICON} />,
                to: "/purchasing/invoices",
                count: unpaidValue,
                loading: unpaidInvoices.loading,
              }}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
