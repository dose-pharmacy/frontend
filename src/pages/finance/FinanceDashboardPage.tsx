// ── Finance (Dashboard tab) ──────────────────────────────────────────────────
// The whole Finance module is ONE page with TWO sections:
//
//   #finance-overview  GET /finance-reporting/dashboard  (no parameters)
//   #finance-reports   GET /finance-reporting/report    (filterable, period-based)
//
// They used to be two routes with an Overview | Reports tab bar, which meant
// opening Finance always dropped you on Overview and the other half was one click
// away but never visible. They are now stacked on one page: opening Finance shows
// both, and the bar underneath the title scrolls between them.
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
// The two ids below are also the URL fragments, so `/dashboard/finance#finance-reports`
// (and every legacy alias that redirects here) lands on the Reports section.
//
// WHERE THIS SITS IN THE DASHBOARD
//   This is a sibling route of `/dashboard`, not a section of it. The router
//   mounts exactly one of them, so Dashboard Overview content is never on screen
//   alongside Finance, and no Overview component is imported here.
//
//   The SHELL is the part that matters visually, and it is byte-for-byte the
//   shape Overview, Sales, Credit and Narcotics use:
//
//     <div className="flex-1 flex flex-col min-h-0">
//       <div className="border-b … bg-white"><PageHeader …/></div>
//       <DashboardSubNav />
//       <div className="flex-1 overflow-y-auto …">…content…</div>
//     </div>
//
//   i.e. the header, its Refresh button and the tab bar sit OUTSIDE the scroll
//   container and stay pinned while the content scrolls beneath them. Finance
//   previously put them INSIDE the scroller, which made the whole thing behave
//   like a detached standalone page — the tabs scrolled away and disappeared.
//   `FinanceSectionNav` is the one extra bar, and it is pinned too.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import DashboardSubNav from "../dashboard/DashboardSubNav";
import FinanceSectionNav, { type FinanceSectionLink } from "./FinanceSectionNav";
import { FinanceOverviewSection } from "./FinanceOverviewPage";
import { FinanceReportsSection } from "./FinanceReportsPage";

const SECTION_LINKS: FinanceSectionLink[] = [
  { id: "finance-overview", label: "Overview" },
  { id: "finance-reports", label: "Reports" },
];

/**
 * How far down the container a section's top must be before it counts as the
 * current one. Large enough that a short section still becomes active, small
 * enough that the nav does not flip while the heading is still on screen.
 */
const ACTIVE_THRESHOLD_PX = 120;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export default function FinanceDashboardPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState(SECTION_LINKS[0].id);
  /** Bumped by the header Refresh; re-runs both sections' fetches. */
  const [reloadTick, setReloadTick] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  /** Scroll a section to the top of the container (the container, not the window). */
  const scrollToSection = useCallback((id: string, smooth: boolean) => {
    const container = containerRef.current;
    const target = document.getElementById(id);
    if (!container || !target) return;
    const top =
      container.scrollTop +
      target.getBoundingClientRect().top -
      container.getBoundingClientRect().top;
    container.scrollTo({ top: Math.max(0, top), behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto" });
  }, []);

  // A shared link (`/dashboard/finance#reports`) or a restored history entry
  // must open on its section, not at the top of the document.
  const hash = location.hash.replace(/^#/, "");
  useLayoutEffect(() => {
    if (!hash) return;
    scrollToSection(hash, false);
    setActiveId(hash);
  }, [hash, scrollToSection]);

  const handleNavigate = useCallback(
    (id: string) => {
      scrollToSection(id, true);
      setActiveId(id);
      // `replace` so Back returns to wherever the reader came from instead of
      // walking back through every section they jumped to.
      navigate(`${location.pathname}#${id}`, { replace: true });
    },
    [location.pathname, navigate, scrollToSection],
  );

  // Track the section under the top of the container. rAF-throttled so a fast
  // scroll cannot queue a handler per event.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const containerTop = container.getBoundingClientRect().top;
      let current = SECTION_LINKS[0].id;
      for (const { id } of SECTION_LINKS) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top - containerTop <= ACTIVE_THRESHOLD_PX) current = id;
      }
      setActiveId((prev) => (prev === current ? prev : current));
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    container.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      container.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Pinned header, exactly as on every other dashboard tab. */}
      <div className="border-b border-[#E6ECE2] bg-white">
        <PageHeader
          breadcrumb="Dashboard / Finance"
          title="Finance"
          subtitle="Current position and filtered reports, on one page."
          actions={
            /* One Refresh for the page, as on every other tab. It re-runs both
               sections — the snapshot and the report under whatever filters are
               currently applied — by bumping `reloadTick`, which each section
               includes in its own fetch dependencies. */
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

      {/* The Dashboard nav, exactly as every other dashboard module renders it.
          Finance is reached FROM this bar but is its own route and its own page:
          the bar is present so Finance can show as the active tab, and nothing
          else about the Dashboard Overview is mounted here. Overview is not
          active on this route because its NavLink is `end`-matched to
          `/dashboard`. */}
      <DashboardSubNav />

      {/* Finance's own Overview / Reports bar — separate from the Dashboard one
          above, which moves between modules; this one moves within Finance. */}
      <FinanceSectionNav links={SECTION_LINKS} activeId={activeId} onNavigate={handleNavigate} />

      {/* Only the content scrolls, so the header and both navs stay put. */}
      <div ref={containerRef} className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        <FinanceOverviewSection reloadTick={reloadTick} />
        <FinanceReportsSection reloadTick={reloadTick} />
      </div>
    </div>
  );
}
