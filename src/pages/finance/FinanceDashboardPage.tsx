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
// The two ids below are also the URL fragments, so `/dashboard/finance#reports`
// (and every legacy alias that redirects here) lands on the Reports section.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import PageHeader from "../../components/ui/PageHeader";
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
    <div ref={containerRef} className="flex-1 overflow-y-auto min-h-0 flex flex-col">
      <PageHeader
        breadcrumb="Finance"
        title="Finance"
        subtitle="Current position and filtered reports, on one page."
      />
      <FinanceSectionNav links={SECTION_LINKS} activeId={activeId} onNavigate={handleNavigate} />

      <FinanceOverviewSection />
      <FinanceReportsSection />
    </div>
  );
}
