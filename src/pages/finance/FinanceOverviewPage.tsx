// ── Finance · Overview section ───────────────────────────────────────────────
// The `GET /finance-reporting/dashboard` half of the Finance page. It is a
// SECTION, not a route: `/dashboard/finance` renders this and the Reports
// section together, so nothing here owns a page shell, a title bar or a tab —
// the parent page provides those. Fetching, filtering and rendering are
// unchanged from when this was a standalone page.
//
// The endpoint takes NO parameters: no date range, no location, no product
// group. This section therefore has no filters at all — any control here would be
// one the backend silently ignores.
//
// TWO RULES THAT SHAPE THIS SECTION
//  1. Every figure is the backend's. `todayNetSales` and
//     `todayNetSalesAfterReturns` are displayed as sent; the page never derives
//     `grossSales - discounts` or `netSales - returns`, because the backend
//     already resolved both and re-deriving them would be a second, divergent
//     source of truth.
//  2. The ONE derived money figure — "net cash movement" — is labelled as
//     computed in the browser, because the dashboard endpoint does not supply
//     it. Everything else is read straight off the response.
//
// "Last updated" is the response's own `asOf` (an instant, so it renders in the
// reader's local time), never the browser clock pretending to be the server's.

import { useMemo } from "react";
import {
  getFinanceDashboard,
  type FinanceDashboard,
} from "../../features/finance/financeReportingApi";
import { fmtDateTime } from "../../utils/format";
import {
  CashMovementBar,
  OutstandingRatioBar,
  SalesWaterfallBar,
} from "./components/OverviewBars";
import {
  CountValue,
  ErrorBanner,
  KpiHero,
  MoneyValue,
  SectionCard,
  StatCard,
  StatCardSkeleton,
} from "./components/primitives";
import { CARD, GRID, TONE_BORDER, TONE_SURFACE, TEXT } from "./components/tokens";
import { allTodayZero } from "./financeCharts";
import { useFinanceFetch } from "./financeView";
import FinanceSectionHeading from "./FinanceSectionHeading";

export function FinanceOverviewSection() {
  const snapshot = useFinanceFetch<FinanceDashboard>(
    (signal) => getFinanceDashboard(signal),
    [],
    "Could not load the finance snapshot.",
    { refreshOnFocus: true },
  );

  const d = snapshot.data;

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

  const loading = snapshot.loading;
  const busy = loading || !d;

  return (
    <section id="finance-overview" aria-labelledby="finance-overview-heading">
      <FinanceSectionHeading
        id="finance-overview-heading"
        title="Overview"
        subtitle="The whole-company position right now — today's trading, plus receivables and payables."
        actions={
          <div className="flex items-center gap-2">
            {d?.asOf && (
              <span className="rounded-full border border-gray-200 bg-canvas px-3 py-1.5 text-xs text-text-secondary whitespace-nowrap">
                Last updated {fmtDateTime(d.asOf)}
              </span>
            )}
            <button
              type="button"
              onClick={snapshot.reload}
              disabled={loading}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-text-primary hover:border-gray-300 hover:bg-canvas disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-mid"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        }
      />

      <div className="p-4 sm:p-6 flex flex-col gap-6">
        {/* Failure renders INLINE, inside the normal page flow — never a blank screen. */}
        {snapshot.error ? (
          <>
            <ErrorBanner message={snapshot.error} onRetry={snapshot.reload} />
            {!busy && <OverviewSkeleton />}
          </>
        ) : busy ? (
          <OverviewSkeleton />
        ) : (
          <>
            {todayZero && (
              <p className="rounded-xl border border-gray-200 bg-canvas px-4 py-3 text-sm text-text-secondary">
                No sales recorded yet today. The figures below are the current position and will
                update as activity is recorded.
              </p>
            )}

            {/* ── Hero row ── */}
            <div className={GRID}>
              <div className="lg:col-span-3">
                {loading ? (
                  <StatCardSkeleton />
                ) : (
                  <KpiHero label="Net Sales Today" tone="positive" hint="After discounts">
                    <MoneyValue value={d?.todayNetSales} tone="positive" size="lg" />
                  </KpiHero>
                )}
              </div>
              <div className="lg:col-span-3">
                {loading ? (
                  <StatCardSkeleton />
                ) : (
                  <KpiHero label="Net Sales After Returns" tone="positive" hint="After discounts and returns">
                    <MoneyValue value={d?.todayNetSalesAfterReturns} tone="positive" size="lg" />
                  </KpiHero>
                )}
              </div>
              <div className="lg:col-span-3">
                {loading ? (
                  <StatCardSkeleton />
                ) : (
                  <KpiHero label="Customer Collections" tone="positive" hint="Money received today">
                    <MoneyValue value={d?.todayCustomerCollections} tone="positive" size="lg" />
                  </KpiHero>
                )}
              </div>
              <div className="lg:col-span-3">
                {loading ? (
                  <StatCardSkeleton />
                ) : (
                  <KpiHero label="Transactions" tone="neutral" hint="Completed sales today">
                    <CountValue value={d?.todayTransactionCount} size="lg" />
                  </KpiHero>
                )}
              </div>
            </div>

            {/* ── Today's sales waterfall ── */}
            <SectionCard
              title="Today's Sales"
              subtitle="Gross sales reduced by discounts and returns"
              bodyClassName="p-4 flex flex-col gap-4"
            >
              {loading ? (
                <div className="h-24 w-full rounded-lg bg-gray-100 animate-pulse" aria-hidden />
              ) : (
                <>
                  <SalesWaterfallBar
                    grossSales={d?.todayGrossSales}
                    discounts={d?.todayDiscounts}
                    customerReturns={d?.todayCustomerReturns}
                    netSalesAfterReturns={d?.todayNetSalesAfterReturns}
                  />
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard label="Gross Sales">
                      <MoneyValue value={d?.todayGrossSales} size="sm" />
                    </StatCard>
                    <StatCard label="Discounts" tone="negative">
                      <MoneyValue value={d?.todayDiscounts} tone="negative" size="sm" />
                    </StatCard>
                    <StatCard label="Customer Returns" tone="negative">
                      <MoneyValue value={d?.todayCustomerReturns} tone="negative" size="sm" />
                    </StatCard>
                    <StatCard label="Net Sales After Returns" tone="positive">
                      <MoneyValue value={d?.todayNetSalesAfterReturns} tone="positive" size="sm" />
                    </StatCard>
                  </div>
                </>
              )}
            </SectionCard>

            {/* ── Cash movement ── */}
            <SectionCard
              title="Cash Movement Today"
              subtitle="Money in versus money out"
              bodyClassName="p-4 flex flex-col gap-4"
            >
              {loading ? (
                <div className="h-20 w-full rounded-lg bg-gray-100 animate-pulse" aria-hidden />
              ) : (
                <CashMovementBar
                  collections={d?.todayCustomerCollections}
                  payments={d?.todaySupplierPayments}
                  returns={d?.todaySupplierReturns}
                />
              )}
            </SectionCard>

            {/* ── Outstanding balances ── */}
            <div className={`${CARD} ${TONE_SURFACE.warning} ${TONE_BORDER.warning} overflow-hidden`}>
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-yellow-200 px-4 py-3">
                <div>
                  <h3 className={TEXT.sectionTitle}>Outstanding Balances</h3>
                  <p className={`${TEXT.hint} mt-0.5`}>
                    Current amounts still owed — these are not today's activity.
                  </p>
                </div>
                <span className="rounded-full border border-yellow-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-yellow-700">
                  Company-wide
                </span>
              </header>
              <div className="p-4 flex flex-col gap-4">
                {loading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <StatCardSkeleton />
                    <StatCardSkeleton />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <StatCard label="Supplier Payables" tone="warning" hint="Amount currently owed to suppliers">
                        <MoneyValue value={d?.outstandingSupplierPayables} tone="warning" size="lg" />
                      </StatCard>
                      <StatCard label="Customer Receivables" tone="warning" hint="Amount currently owed by customers">
                        <MoneyValue value={d?.customerReceivables} tone="warning" size="lg" />
                      </StatCard>
                    </div>
                    <OutstandingRatioBar
                      payables={d?.outstandingSupplierPayables}
                      receivables={d?.customerReceivables}
                    />
                  </>
                )}
              </div>
            </div>

            {/* ── Explanatory note ── */}
            <p className={`${TEXT.hint} max-w-3xl`}>
              This snapshot is company-wide and unfiltered, matching the endpoint, which accepts no
              date, location or product-group parameters. Figures reflect the current UTC day. For a
              filtered, period-based breakdown of sales, purchasing, profitability, collections and
              inventory value, see the Reports section below.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

/** Loading state shaped like the finished page — cards, not a spinner. */
function OverviewSkeleton() {
  return (
    <>
      <div className={GRID}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="lg:col-span-3">
            <StatCardSkeleton />
          </div>
        ))}
      </div>
      <div className={GRID}>
        <div className="lg:col-span-12 h-40 rounded-xl border border-gray-200 bg-white" aria-hidden />
      </div>
      <p className="sr-only" role="status">
        Loading finance snapshot
      </p>
    </>
  );
}