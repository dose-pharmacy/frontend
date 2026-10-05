// ── Loading skeletons ────────────────────────────────────────────────────────
// The purchasing pages used to swap their whole table for a centred spinner and
// a "Loading …" line. That made the page visibly collapse to a short strip and
// then re-lay-out when the data arrived. A skeleton occupies the same boxes the
// real content will fill, so the page holds its shape while loading.
//
// This is the app's existing placeholder look — `animate-pulse` over the
// `#E6ECE2` palette, the same treatment already used by DashboardPage,
// DashboardCard and the Finance sections — pulled into one place so the pages
// no longer re-implement it.
//
// ACCESSIBILITY
//   The visible "Loading …" text used to double as the announcement, so removing
//   it would leave assistive tech with nothing. Every skeleton therefore takes a
//   `status` string, rendered visually hidden via `SkeletonStatus`, and the
//   decorative bars are `aria-hidden`.

import type { ReactNode } from "react";

/**
 * One shimmer bar. Colour is fixed; pass `className` for size and position.
 */
export function SkeletonBar({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`rounded bg-[#E6ECE2] animate-pulse ${className}`} />;
}

/**
 * Visually hidden "please wait" message. Renders nothing visible, so it never
 * shifts the layout, but screen readers announce it when it appears.
 */
export function SkeletonStatus({ children }: { children: ReactNode }) {
  return (
    <span role="status" aria-live="polite" className="sr-only">
      {children}
    </span>
  );
}

// Widths for body cells, chosen by column position so the rows do not read like
// a ruler. Deterministic (no `Math.random`) so markup is identical every render.
const CELL_WIDTHS = ["w-full", "w-11/12", "w-4/5", "w-full", "w-3/4", "w-10/12"] as const;

// The header row is already tinted `#E6ECE2`, so its bars need a darker step to
// stay visible at all.
const HEADER_BAR = "bg-[#C6D4BF]";

/**
 * A table-shaped skeleton: a tinted header row plus `rows` body rows, one column
 * per entry in `columns`.
 *
 * Pass the SAME array the real `<thead>` renders so the shimmer lines up with the
 * columns that arrive and the two can never drift apart. Header bar widths are
 * derived from the label length, which keeps the look proportional to the real
 * headings without hard-coding a width per column.
 */
export function TableSkeleton({
  columns,
  rows = 8,
  minWidth,
  status,
}: {
  columns: readonly string[];
  rows?: number;
  /** Same constraint as the real table, e.g. `"min-w-[880px]"`. */
  minWidth?: string;
  /** Visually hidden loading message, e.g. "Loading purchase orders". */
  status?: string;
}) {
  return (
    <>
      <div className="overflow-x-auto">
        <table className={`w-full text-sm${minWidth ? ` ${minWidth}` : ""}`}>
          <thead>
            <tr className="bg-[#E6ECE2]">
              {columns.map((label) => (
                <th key={label} className="px-4 py-3">
                  <div
                    aria-hidden
                    className={`h-2.5 rounded ${HEADER_BAR} animate-pulse`}
                    style={{ width: `${Math.min(100, 18 + label.length * 4)}%` }}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, row) => (
              // Row banding matches the real tables so the shimmer reads as the
              // same table rather than a different one.
              <tr key={row} className={row % 2 === 0 ? "bg-white" : "bg-[#E6ECE2]/15"}>
                {columns.map((label, col) => (
                  <td key={label} className="px-4 py-3">
                    <SkeletonBar
                      className={`h-3 ${CELL_WIDTHS[(row * 3 + col * 5) % CELL_WIDTHS.length]}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {status ? <SkeletonStatus>{status}</SkeletonStatus> : null}
    </>
  );
}