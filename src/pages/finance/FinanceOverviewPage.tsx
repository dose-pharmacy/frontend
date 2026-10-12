// ── Finance · Overview section ───────────────────────────────────────────────
// The `GET /finance-reporting/dashboard` half of the Finance page, read TWO
// ways that both stay on this one response:
//
//   "Today" — today's trading broken out into four KPI tiles and two
//             label/value lists (sales breakdown, cash movement).
//   "What you owe and are owed" — the outstanding supplier payables against
//             customer receivables, plus the net position between them.
//
// It is a SECTION, not a route: `/dashboard/finance` renders this and the
// Reports section together, so nothing here owns a page shell, a title bar or a
// tab — the parent page provides those. Fetching and rendering are unchanged
// from when this was a standalone page.
//
// The endpoint takes NO parameters: no date range, no location, no product
// group. This section therefore has no filters at all — any control here would
// be one the backend silently ignores.
//
// TWO RULES THAT SHAPE THIS SECTION
//  1. Every figure is the backend's. `todayNetSales` and
//     `todayNetSalesAfterReturns` are displayed as sent; the page never derives
//     `grossSales - discounts` or `netSales - returns`, because the backend
//     already resolved both and re-deriving them would be a second, divergent
//     source of truth.
//  2. The TWO derived money figures — "net cash movement" (collections −
//     payments) and "net position" (receivables − payables) — are computed in
//     the browser, because the dashboard endpoint does not supply them.
//     Everything else is read straight off the response.
//
// "Updated <time>" lives in the PAGE header (which owns the Refresh button),
// fed up as the response's own `asOf` — never the browser clock pretending to
// be the server's.

import { useEffect, useMemo } from "react";
import {
  getFinanceDashboard,
  type FinanceDashboard,
} from "../../features/finance/financeReportingApi";
import {
  BreakdownList,
  CountValue,
  ErrorBanner,
  KpiHero,
  MoneyValue,
  SectionCard,
  StatCard,
  StatCardSkeleton,
} from "./components/primitives";
import { SERIES, TONE_ACCENT, type Tone } from "./components/tokens";
import { allTodayZero } from "./financeCharts";
import { useFinanceFetch } from "./financeView";
import FinanceSectionHeading from "./FinanceSectionHeading";

/** A real zero renders grey; a missing value renders "—" (handled by the value components). */
function isZero(v: number | null | undefined): boolean {
  return typeof v === "number" && Number.isFinite(v) && v === 0;
}

function positionTone(net: number): Tone {
  return net > 0 ? "positive" : net < 0 ? "negative" : "neutral";
}

export function FinanceOverviewSection({
  reloadTick = 0,
  onSnapshot,
}: {
  reloadTick?: number;
  /** Reports the dashboard's own `asOf` up to the page header so it can show "Updated <time>". */
  onSnapshot?: (asOf: string | null) => void;
}) {
  const snapshot = useFinanceFetch<FinanceDashboard>(
    (signal) => getFinanceDashboard(signal),
    // `reloadTick` is the page header's Refresh. The endpoint takes no
    // parameters, so this is the only thing that can re-run the request.
    [reloadTick],
    "Could not load the finance snapshot.",
    { refreshOnFocus: true },
  );

  const d = snapshot.data;

  // The header's "Updated <time>" comes from here — the response's `asOf`,
  // reported up so the page can render it next to its Refresh button.
  useEffect(() => {
    onSnapshot?.(d?.asOf ?? null);
  }, [d?.asOf, onSnapshot]);

  // Every "today" activity figure. Used to decide whether an empty trading day
  // deserves a plain-language note instead of a wall of 0.00 ETB cards.
  const todayZero = useMemo(
    () =>
      allTodayZero([
        d?.todayGrossSales,
        d?.todayDiscounts,
        d?.todayCustomerReturns,
        d?.todayNetSales,
        d?.todayNetSalesAfterReturns,
        d?.todayTransactionCount,
        d?.todayCustomerCollections,
        d?.todaySupplierPayments,
        d?.todaySupplierReturns,
      ]),
    [d],
  );

  // The two derived figures. Both are browser computations over backend fields
  // and are disclosed as such in the "How these numbers are calculated" note.
  const netCash = useMemo(() => {
    const c = d?.todayCustomerCollections;
    const p = d?.todaySupplierPayments;
    if (typeof c !== "number" || typeof p !== "number") return null;
    return c - p;
  }, [d]);

  const netPosition = useMemo(() => {
    const recv = d?.customerReceivables;
    const pay = d?.outstandingSupplierPayables;
    if (typeof recv !== "number" || typeof pay !== "number") return null;
    return recv - pay;
  }, [d]);

  const busy = snapshot.loading || !d;

  return (
    <>
      {/* ── "Today" ── */}
      <section id="finance-overview" aria-labelledby="finance-overview-heading">
        <FinanceSectionHeading
          id="finance-overview-heading"
          title="Today"
          subtitle="Today's trading activity and the company position right now."
        />

        <div className="p-4 sm:p-6 flex flex-col gap-6">
          {/* Failure renders INLINE, inside the normal page flow — never a blank screen. */}
          {snapshot.error ? (
            <>
              <ErrorBanner message={snapshot.error} onRetry={snapshot.reload} />
              {!busy && <TodaySkeleton />}
            </>
          ) : busy ? (
            <TodaySkeleton />
          ) : (
            <>
              {todayZero && (
                /* Slim banner, not a card: a quiet day is fact, not a section. */
                <p className="rounded-xl border border-gray-200 bg-canvas px-4 py-3 text-sm text-text-secondary">
                  No sales recorded yet today. The figures below are the current position and will
                  update as activity is recorded.
                </p>
              )}

              {/* ── Four KPI tiles, two up ── */}
              <div className="grid grid-cols-2 gap-3">
                <KpiHero
                  compact
                  accent
                  tone="positive"
                  icon={<TrendUpIcon />}
                  label="Net sales"
                  hint="After discounts and returns"
                >
                  <MoneyValue
                    value={d?.todayNetSalesAfterReturns}
                    tone="positive"
                    muted={isZero(d?.todayNetSalesAfterReturns)}
                    size="md"
                  />
                </KpiHero>
                <KpiHero
                  compact
                  accent
                  tone="info"
                  icon={<BanknoteIcon />}
                  label="Customer collections"
                  hint="Money received today"
                >
                  <MoneyValue
                    value={d?.todayCustomerCollections}
                    tone="info"
                    muted={isZero(d?.todayCustomerCollections)}
                    size="md"
                  />
                </KpiHero>
                <KpiHero
                  compact
                  accent
                  tone="neutral"
                  icon={<ReceiptIcon />}
                  label="Transactions"
                  hint="Completed sales today"
                >
                  <CountValue
                    value={d?.todayTransactionCount}
                    muted={isZero(d?.todayTransactionCount)}
                    size="md"
                  />
                </KpiHero>
                <KpiHero
                  compact
                  accent
                  tone={netCash !== null ? positionTone(netCash) : "neutral"}
                  icon={<SwapIcon />}
                  label="Net cash movement"
                  hint="Collections minus supplier payments"
                >
                  <MoneyValue
                    value={netCash}
                    tone={netCash !== null ? positionTone(netCash) : "neutral"}
                    muted={netCash === 0}
                    size="md"
                  />
                </KpiHero>
              </div>

              {/* ── Two breakdown panels ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <SectionCard
                  title="Sales breakdown"
                  subtitle="Gross sales reduced by discounts and returns"
                  action={
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-white shadow-xs ${TONE_ACCENT.positive}`}
                      aria-hidden
                    >
                      <TrendUpIcon />
                    </span>
                  }
                  bodyClassName="p-4 sm:p-5"
                >
                  <BreakdownList
                    rows={[
                      { label: "Gross sales", value: d?.todayGrossSales, color: SERIES.grossSales },
                      { label: "Discounts", value: d?.todayDiscounts, color: SERIES.discounts, tone: "negative" },
                      {
                        label: "Customer returns",
                        value: d?.todayCustomerReturns,
                        color: SERIES.customerReturns,
                        tone: "negative",
                      },
                    ]}
                    totalLabel="Net sales"
                    totalValue={d?.todayNetSalesAfterReturns}
                    totalTone="positive"
                  />
                </SectionCard>

                <SectionCard
                  title="Cash movement"
                  subtitle="Money received minus money paid out today"
                  action={
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-white shadow-xs ${TONE_ACCENT.info}`}
                      aria-hidden
                    >
                      <SwapIcon />
                    </span>
                  }
                  bodyClassName="p-4 sm:p-5"
                >
                  <BreakdownList
                    rows={[
                      {
                        label: "Customer collections",
                        value: d?.todayCustomerCollections,
                        color: SERIES.collections,
                        tone: "info",
                      },
                      {
                        label: "Supplier payments",
                        value: d?.todaySupplierPayments,
                        color: SERIES.supplierPayments,
                        tone: "negative",
                      },
                      { label: "Supplier returns", value: d?.todaySupplierReturns, color: SERIES.supplierReturns },
                    ]}
                    totalLabel="Net cash movement"
                    totalValue={netCash}
                    totalTone={netCash !== null ? positionTone(netCash) : "neutral"}
                  />
                </SectionCard>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── "What you owe and are owed" ── */}
      <section id="finance-balances" aria-labelledby="finance-balances-heading">
        <FinanceSectionHeading
          id="finance-balances-heading"
          title="What you owe and are owed"
          subtitle="Current amounts still owed — not today's activity."
          actions={
            d ? (
              <BalancePill payables={d?.outstandingSupplierPayables} receivables={d?.customerReceivables} />
            ) : undefined
          }
        />

        <div className="p-4 sm:p-6">
          {snapshot.error ? (
            <>{!busy && <BalancesSkeleton />}</>
          ) : busy ? (
            <BalancesSkeleton />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <StatCard compact label="Supplier Payables" tone="warning" hint="Amount currently owed to suppliers">
                <MoneyValue value={d?.outstandingSupplierPayables} tone="warning" size="md" />
              </StatCard>
              <StatCard compact label="Customer Receivables" tone="warning" hint="Amount currently owed by customers">
                <MoneyValue value={d?.customerReceivables} tone="warning" size="md" />
              </StatCard>
              <StatCard compact label="Net Position" hint="Receivables minus payables">
                <MoneyValue
                  value={netPosition}
                  tone={netPosition !== null ? positionTone(netPosition) : "neutral"}
                  muted={netPosition === 0}
                  size="md"
                />
              </StatCard>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

/** The who-owes-more pill in the section heading. */
function BalancePill({ payables, receivables }: { payables?: number; receivables?: number }) {
  const p = typeof payables === "number" ? payables : 0;
  const r = typeof receivables === "number" ? receivables : 0;
  const whoOwesMore =
    r > p
      ? { label: "Customers owe us more", cls: "border-green-200 bg-green-50 text-green-700" }
      : p > r
        ? { label: "We owe suppliers more", cls: "border-yellow-200 bg-yellow-50 text-yellow-700" }
        : { label: "Balanced", cls: "border-gray-200 bg-white text-text-secondary" };
  return (
    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${whoOwesMore.cls}`}>
      {whoOwesMore.label}
    </span>
  );
}

// ── Tile glyphs (decorative; the label carries the meaning) ──────────────────

/** Sales trend — an upward line. */
function TrendUpIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 13.5 8 8.5l3 3 6-6" />
      <path d="M13 5.5h4v4" />
    </svg>
  );
}

/** Collections — a banknote. */
function BanknoteIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="5.5" width="15" height="9" rx="2" />
      <circle cx="10" cy="10" r="2" />
    </svg>
  );
}

/** Transactions — a receipt. */
function ReceiptIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 3.5h10v13l-2-1.4-2 1.4-2-1.4-2 1.4z" />
      <path d="M7.5 7.5h5M7.5 10.5h5" />
    </svg>
  );
}

/** Cash movement — money in and out. */
function SwapIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 16.5v-13M6 3.5 3.5 6M6 3.5 8.5 6" />
      <path d="M14 3.5v13M14 16.5l2.5-2.5M14 16.5 11.5 14" />
    </svg>
  );
}

/** Loading state shaped like the "Today" half — tiles and panels, not a spinner. */
function TodaySkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-44 rounded-xl border border-gray-200 bg-white" aria-hidden />
        <div className="h-44 rounded-xl border border-gray-200 bg-white" aria-hidden />
      </div>
      <p className="sr-only" role="status">
        Loading finance snapshot
      </p>
    </>
  );
}

/** Loading state shaped like the "What you owe and are owed" half. */
function BalancesSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <StatCardSkeleton />
      <StatCardSkeleton />
      <StatCardSkeleton />
    </div>
  );
}