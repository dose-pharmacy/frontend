// ── Dashboard → Sales ─────────────────────────────────────────────────────────
// Two views of the same module, chosen by the tab bar under the dashboard
// navigation. Returns live HERE rather than as a top-level sidebar module,
// because a customer return can only be created against an existing completed
// sale — the register and the transaction list are two sides of one flow.
//
//   Transactions  GET /pos/sales                 (see TransactionsTab)
//                 GET /pos/sales/{id}
//                 POST /pos/sales/{id}/payments   collect an outstanding balance
//                 POST /pos/sales/{id}/cancel     DRAFT sales only
//                 GET  /pos/sales/{id}/returns    return eligibility
//                 POST /pos/sales/{id}/returns    create the return
//
//   Returns       GET /pos/returns                the return register
//                 GET /pos/returns/{id}           one return
//
// No new route, endpoint or top-level module was introduced for this.
//
// Deliberately NOT here, because the backend does not support them:
//   • a CREDIT payment method. A sale is "on credit" when
//     totalAmount > paidAmount; that is a business state, not a payment method.
//   • cost, margin or profit per sale (no endpoint exposes sale cost)
//   • customer or product search — `search` matches the sale/receipt number only,
//     and /pos/returns publishes no search parameter at all.
//   • choosing a return location — stock is always restored to the ORIGINAL sale
//     location, so there is nothing to choose.
//   • finance analytics (trends, margins, supplier figures) — those live on the
//     Finance tab, and receivables live on the Credit tab.

import { useState } from "react";
import DashboardSubNav from "../dashboard/DashboardSubNav";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import TransactionsTab from "./TransactionsTab";
import ReturnsTab from "./ReturnsTab";

type SalesTab = "transactions" | "returns";

const TABS: { id: SalesTab; label: string; title: string; subtitle: string }[] = [
  {
    id: "transactions",
    label: "Transactions",
    title: "Sales",
    subtitle: "Manage and review POS transactions",
  },
  {
    id: "returns",
    label: "Returns",
    title: "Returns",
    subtitle: "Manage and review customer product returns",
  },
];

export default function SalesPage() {
  const [tab, setTab] = useState<SalesTab>("transactions");
  const [reloadTick, setReloadTick] = useState(0);
  const active = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="border-b border-[#E6ECE2] bg-white">
        <PageHeader
          breadcrumb="Dashboard"
          title={active.title}
          subtitle={active.subtitle}
          actions={
            /* Each tab owns its own loading state and renders its own skeleton, so
               this button only signals a refetch — it cannot reflect that state. */
            <Button
              variant="secondary"
              onClick={() => setReloadTick((t) => t + 1)}
              className="!bg-[#7A9076] !text-white hover:!bg-[#4F6B4A] focus-visible:!ring-[#7A9076]"
            >
              Refresh
            </Button>
          }
        />
      </div>

      <DashboardSubNav />

      {/* Sales-internal tabs. Distinct from DashboardSubNav above, which moves
          between dashboard modules. */}
      <nav
        className="bg-white border-b border-[#E6ECE2] px-4 sm:px-6 flex items-center gap-1 overflow-x-auto"
        aria-label="Sales views"
      >
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            aria-current={id === tab ? "page" : undefined}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7A9076]/40 ${
              id === tab
                ? "border-[#7A9076] text-[#4F6B4A]"
                : "border-transparent text-[#666666] hover:text-[#333333] hover:border-[#C6D4BF]"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === "transactions" ? (
          <TransactionsTab reloadTick={reloadTick} />
        ) : (
          <ReturnsTab reloadTick={reloadTick} />
        )}
      </div>
    </div>
  );
}
