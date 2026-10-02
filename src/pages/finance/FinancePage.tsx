// ── Finance (Dashboard tab) ─────────────────────────────────────────────────
// Financial performance reporting over the real Financial Reports APIs.
//
// Scope boundaries, kept deliberately:
//   • Finance REPORTS. It does not create sales, collect payments, receive
//     stock, or manage inventory. Every operational workflow stays in its own
//     module and is linked to, not copied.
//   • No Payables tab — there is no Supplier Payables endpoint, so none is
//     faked.
//   • No exports, tax/VAT, payroll, bank reconciliation, budgeting or
//     forecasting. None of those endpoints exist.
//   • No figure is computed in the browser. Revenue, cost, profit, margin and
//     every balance are values the backend returned.
//
// All Financial Reports endpoints are ADMIN-only server-side; this UI only
// reflects whatever the backend authorises and surfaces 401/403 through the
// shared error path. Hiding the tab is not the security boundary.

import { useState } from "react";
import DashboardSubNav from "../dashboard/DashboardSubNav";
import PageHeader from "../../components/ui/PageHeader";
import type { ProfitabilityGroupBy } from "../../features/reports/reportsApi";
import {
  FilterBar,
  ProductGroupFilter,
  defaultWindow,
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

/** Tabs whose endpoints actually accept `locationId`. */
const LOCATION_TABS: FinanceTab[] = ["overview", "sales", "receivables"];

/** Tabs whose endpoints accept `productGroupId`. */
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

  const showLocation = LOCATION_TABS.includes(tab);
  const showProductGroup = PRODUCT_GROUP_TABS.includes(tab);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <PageHeader
        breadcrumb="Dashboard / Finance"
        title="Finance"
        subtitle="Sales, profitability, margins and customer receivables."
      />
      <DashboardSubNav />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        <FilterBar
          filters={filters}
          onChange={(next) => setFilters((prev) => ({ ...prev, ...next }))}
          showLocation={showLocation}
        >
          {showProductGroup && (
            <ProductGroupFilter value={productGroupId} onChange={setProductGroupId} />
          )}
        </FilterBar>

        {/* `locationId` is not accepted by the profitability or profit-margin
            endpoints. Say so rather than letting the user assume the location
            they picked still applies on this tab. */}
        {!showLocation && (
          <p className="text-xs text-[#666666] -mt-2">
            Location does not apply to {tab === "profitability" ? "Profitability" : "Margins"} —
            those reports have no location filter.
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

        {tab === "overview" && <OverviewSection filters={filters} />}
        {tab === "sales" && <SalesWorkspace filters={filters} />}
        {tab === "profitability" && (
          <ProfitabilitySection
            filters={filters}
            groupBy={groupBy}
            onGroupByChange={setGroupBy}
            productGroupId={productGroupId}
          />
        )}
        {tab === "margins" && <MarginSection filters={filters} productGroupId={productGroupId} />}
        {tab === "receivables" && <ReceivablesSection filters={filters} />}
      </div>
    </div>
  );
}