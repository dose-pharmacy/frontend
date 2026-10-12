// ── Finance (Dashboard tab) ──────────────────────────────────────────────────
// The whole Finance module is ONE page stacked top-to-bottom as:
//
//   "Today"          GET /finance-reporting/dashboard  (no parameters)
//   "What you owe and are owed"   (same response — receivables vs payables)
//   "Reports"        GET /finance-reporting/report    (filterable, period-based)
//
// The "Today" and "What you owe and are owed" halves are the same dashboard
// fetch read two ways; "Reports" is the separate filterable endpoint.
//
// WHAT DID NOT CHANGE
//   • Both sections fetch independently, exactly as before — separate endpoints,
//     separate `useFinanceFetch` state, separate loading skeletons and separate
//     inline error banners with Retry. A failure in one section never blanks or
//     blocks the other.
//   • Every figure is still read straight off its response. Nothing is merged,
//     summed across the two halves, or derived between them.
//   • The Reports filter state (draft vs applied), validation, Reset and sticky
//     filter bar are untouched.
//
// The old in-page "Overview | Reports" nav bar is gone: the sections are short
// enough that one page reads as one document, and the Reports half still keeps
// `id="finance-reports"` so `/dashboard/finance#finance-reports` (and every
// legacy alias that redirects here) lands on it.
//
// The header's "Updated <time>" pill is fed UP from the Overview section, which
// owns the dashboard fetch: the section reports the response's own `asOf` (an
// instant, so it renders in the reader's local time) as soon as a snapshot
// arrives. The page never reads the browser clock pretending to be the
// server's, and no fetch moves house.
//
// WHERE THIS SITS IN THE DASHBOARD
//   This is a sibling route of `/dashboard`, not a section of it. The router
//   mounts exactly one of them, so Dashboard Overview content is never on screen
//   alongside Finance, and no Overview component is imported here.
//
//   The SHELL is byte-for-byte the shape Overview, Sales, Credit and Narcotics
//   use:
//
//     <div className="flex-1 flex flex-col min-h-0">
//       <div className="border-b … bg-white"><PageHeader …/></div>
//       <DashboardSubNav />
//       <div className="flex-1 overflow-y-auto …">…content…</div>
//     </div>
//
//   i.e. the header and its Refresh button sit OUTSIDE the scroll container and
//   stay pinned while the content scrolls beneath them.

import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import DashboardSubNav from "../dashboard/DashboardSubNav";
import { FinanceOverviewSection } from "./FinanceOverviewPage";
import { FinanceReportsSection } from "./FinanceReportsPage";
import { fmtDateTime } from "../../utils/format";

export default function FinanceDashboardPage() {
  /** Bumped by the header Refresh; re-runs both sections' fetches. */
  const [reloadTick, setReloadTick] = useState(0);
  /** The dashboard snapshot's own `asOf`, reported up by the Overview section. */
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const location = useLocation();

  const handleSnapshot = useCallback((asOf: string | null) => {
    setUpdatedAt(asOf);
  }, []);

  // Legacy aliases redirect to `/dashboard/finance#finance-reports`; without the
  // old section nav there is no click target to scroll for it, so honour a
  // restored-history entry or a shared link by scrolling the Reports section
  // into view once.
  useEffect(() => {
    if (location.hash !== "#finance-reports") return;
    document.getElementById("finance-reports")?.scrollIntoView({ block: "start" });
  }, [location.hash]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Pinned header, exactly as on every other dashboard tab. */}
      <div className="border-b border-[#E6ECE2] bg-white">
        <PageHeader
          breadcrumb="Dashboard / Finance"
          title="Finance"
          subtitle="Current position and filtered reports, on one page."
          actions={
            <>
              {/* Fed up from the Overview section — the server's `asOf`, never
                  the browser clock. Hidden until the first snapshot arrives. */}
              {updatedAt && (
                <span className="rounded-full border border-gray-200 bg-canvas px-3 py-1.5 text-xs text-text-secondary whitespace-nowrap">
                  Updated {fmtDateTime(updatedAt)}
                </span>
              )}
              {/* One Refresh for the page, as on every other tab. It re-runs both
                 sections — the snapshot and the report under whatever filters are
                 currently applied — by bumping `reloadTick`, which each section
                 includes in its own fetch dependencies. */}
              <Button
                variant="secondary"
                onClick={() => setReloadTick((t) => t + 1)}
                className="!bg-[#7A9076] !text-white hover:!bg-[#4F6B4A] focus-visible:!ring-[#7A9076]"
              >
                Refresh
              </Button>
            </>
          }
        />
      </div>

      {/* The Dashboard nav, exactly as every other dashboard module renders it.
          Finance is reached FROM this bar but is its own route and its own page:
          the bar is present so Finance can show as the active tab, and nothing
          else about the Dashboard Overview is mounted here. Overview is not
          active on this route because its NavLink is `end`-matched to
          `/dashboard`. */}
      <DashboardSubNav />

      {/* Only the content scrolls, so the header and the dashboard bar stay put. */}
      <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        <FinanceOverviewSection reloadTick={reloadTick} onSnapshot={handleSnapshot} />
        <FinanceReportsSection reloadTick={reloadTick} />
      </div>
    </div>
  );
}