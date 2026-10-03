// ── Finance (Dashboard tab) ─────────────────────────────────────────────────
// Financial performance reporting over the Finance Reporting API.
//
// DATA SOURCE: `GET /finance-reporting/report` is the PRIMARY source for this
// page. It is fetched ONCE here and handed to every tab, so switching tabs
// never refetches and two tabs can never disagree about the same figure. The
// report already embeds its own `trends` block, so the dedicated
// `/finance-reporting/trends` endpoint is deliberately not called (§16).
//
// ROW-LEVEL TABLES: `/report` is aggregate-only. It returns no sale ledger, no
// sale lines, no per-product profitability/margin rows and no receivables list,
// so those tables keep calling the endpoints that actually serve them rather
// than being fed invented rows (§20). Only the Top-products table and these
// row-level tables still touch `/financials/reports/*`; every KPI, total, trend
// and payment figure comes from `/report`.
//
// Scope boundaries, kept deliberately:
//   • Finance REPORTING. It does not create sales, collect payments, receive
//     stock, or manage inventory. Every operational workflow stays in its own
//     module and is linked to, not copied.
//   • No exports, tax/VAT, payroll, bank reconciliation, budgeting or
//     forecasting. None of those endpoints exist.
//   • No figure is computed in the browser. Revenue, cost, profit, margin and
//     every balance are values the backend returned.
//
// All Finance Reporting endpoints are ADMIN-only server-side; this UI only
// reflects whatever the backend authorises and surfaces 401/403 through the
// shared error path. Hiding the tab is not the security boundary.

import { useState } from "react";
import DashboardSubNav from "../dashboard/DashboardSubNav";
import PageHeader from "../../components/ui/PageHeader";
import type { ProfitabilityGroupBy } from "../../features/reports/reportsApi";
import {
  getFinanceReport,
  type FinanceGranularity,
  type FinanceReport,
} from "../../features/finance/financeReportingApi";
import {
  FilterBar,
  ProductGroupFilter,
  defaultWindow,
  utcDayStart,
  utcDayEnd,
  useFinanceFetch,
  type FinanceFilters,
} from "./financeView";
import OverviewSection from "./OverviewSection";
import SalesWorkspace from "./SalesWorkspace";
import ProfitabilitySection from "./ProfitabilitySection";
import MarginSection from "./MarginSection";
import ReceivablesSection from "./ReceivablesSection";

type FinanceTab = "overview" | "sales" | "profitability" | "margins" | "receivables";

const TABS: { key: FinanceTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "sales", label: "Sales" },
  { key: "profitability", label: "Profitability" },
  { key: "margins", label: "Margins" },
  { key: "receivables", label: "Receivables" },
];

/** Tabs that surface a product-group control. */
const PRODUCT_GROUP_TABS: FinanceTab[] = ["profitability", "margins"];

export default function FinancePage() {
  const range = defaultWindow();
  const [tab, setTab] = useState<FinanceTab>("overview");

  // Filter state is held here, not inside the sections, so switching tabs keeps
  // the chosen window (and the product group) instead of resetting it.
  const [filters, setFilters] = useState<FinanceFilters>({
    dateFrom: range.from,
    dateTo: range.to,
    locationId: "",
  });
  const [productGroupId, setProductGroupId] = useState("");
  const [groupBy, setGroupBy] = useState<ProfitabilityGroupBy>("PRODUCT");

  // Trend bucket width. Lifted out of the Overview section because it is a QUERY
  // parameter of the shared report, not purely a chart setting — every tab reads
  // the same request. `DAY` matches the Daily/Monthly/Annual control's default.
  const [granularity, setGranularity] = useState<FinanceGranularity>("DAY");

  const showProductGroup = PRODUCT_GROUP_TABS.includes(tab);

  /**
   * `productGroupId` is only SENT on the tabs that display the control.
   *
   * `/report` accepts the parameter on every tab, so forwarding a value the user
   * set on Margins to a tab with no visible product-group control would quietly
   * filter that tab's figures — a filter the user cannot see or clear. Scoping the
   * parameter to the tabs that show it keeps the control and its effect together.
   */
  const effectiveProductGroupId = showProductGroup ? productGroupId : "";

  // `/report` documents `from` as an INCLUSIVE UTC start-of-day and `to` as an
  // INCLUSIVE UTC end-of-day, so the picker days are expanded against UTC — not
  // the browser's local timezone, which would shift the window by the offset.
  // Both bounds are omitted when the user has not chosen a day, letting the
  // backend apply its own defaults.
  const report = useFinanceFetch<FinanceReport>(
    () =>
      getFinanceReport({
        from: filters.dateFrom ? utcDayStart(filters.dateFrom) : undefined,
        to: filters.dateTo ? utcDayEnd(filters.dateTo) : undefined,
        locationId: filters.locationId || undefined,
        productGroupId: effectiveProductGroupId || undefined,
        granularity,
      }),
    [filters.dateFrom, filters.dateTo, filters.locationId, effectiveProductGroupId, granularity],
    "Could not load the finance report.",
  );

  /**
   * `/report` honours `locationId` on every tab, but the per-product tables on
   * Profitability and Margins still come from the older endpoints, which have no
   * location filter. The cards above them ARE location-filtered and the rows
   * beneath are not, so that is stated rather than left to be discovered.
   */
  const tableIgnoresLocation = tab === "profitability" || tab === "margins";

  return (
    <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
      <PageHeader
        breadcrumb="Dashboard / Finance"
        title="Finance"
        subtitle="Sales, profitability, margins and customer receivables."
      />
      <DashboardSubNav />

      <div className="p-6 flex flex-col gap-6">
        {/* `/finance-reporting/report` accepts `locationId` on every tab, so the
            control is always shown — the previous per-tab hiding existed only
            because the older profitability endpoints had no location filter. */}
        <FilterBar
          filters={filters}
          onChange={(next) => setFilters((prev) => ({ ...prev, ...next }))}
          showLocation
        >
          {showProductGroup && (
            <ProductGroupFilter value={productGroupId} onChange={setProductGroupId} />
          )}
        </FilterBar>

        {tableIgnoresLocation && (
          <p className="text-xs text-[#666666] -mt-2">
            The cards above are filtered by location; the table below is not — that report has no
            location filter.
          </p>
        )}

        <div className="flex rounded-lg border border-[#C6D4BF] w-fit overflow-hidden">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-semibold transition-colors ${
                tab === t.key
                  ? "bg-[#B6C8AF] text-[#333333]"
                  : "bg-white text-[#666666] hover:bg-[#E6ECE2]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <OverviewSection
            filters={filters}
            report={report}
            granularity={granularity}
            onGranularityChange={setGranularity}
          />
        )}
        {tab === "sales" && <SalesWorkspace filters={filters} />}
        {tab === "profitability" && (
          <ProfitabilitySection
            filters={filters}
            report={report}
            groupBy={groupBy}
            onGroupByChange={setGroupBy}
            productGroupId={productGroupId}
          />
        )}
        {tab === "margins" && (
          <MarginSection filters={filters} report={report} productGroupId={productGroupId} />
        )}
        {tab === "receivables" && (
          <ReceivablesSection filters={filters} report={report} />
        )}
      </div>
    </div>
  );
}