import type { ReactNode } from "react";

interface PageStepperProps {
  /** Current page — normally `meta.page` from the server. */
  page: number;
  /** Total pages — normally `meta.totalPages` from the server. */
  totalPages: number;
  onPageChange: (page: number) => void;
  /**
   * Optional result summary shown to the left of the control, e.g.
   * "Showing 21-40 of 127 stock records". It is deliberately NOT part of the
   * three-part stepper, which stays exactly: previous, current page, next.
   */
  label?: ReactNode;
}

/**
 * Minimal three-part pagination: previous arrow, current page, next arrow.
 *
 * Unlike `Pagination`, this renders no page-number list and no ellipsis — the
 * middle box is always the page you are on. Paging still happens entirely on the
 * server: the caller requests `page`/`limit` and feeds the response `meta`
 * straight back in.
 */
export default function PageStepper({
  page,
  totalPages,
  onPageChange,
  label,
}: PageStepperProps) {
  const atFirstPage = page <= 1;
  const atLastPage = page >= totalPages;

  const arrowBtn =
    "rounded-lg px-3 py-1.5 text-xs border border-[#C6D4BF] text-[#666666] hover:bg-[#E6ECE2] disabled:opacity-40 disabled:hover:bg-transparent transition-colors";

  return (
    <div className="flex items-center justify-between border-t border-[#E6ECE2] px-4 py-3 gap-3 flex-wrap">
      {label ? <p className="text-sm text-[#666666]">{label}</p> : <span />}

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={atFirstPage}
          aria-label="Previous page"
          className={arrowBtn}
        >
          ←
        </button>

        {/* The current page, boxed. Not a button: there is nothing to click,
            which is why it is a live region so screen readers announce the
            change after Previous/Next. */}
        <span
          aria-current="page"
          aria-live="polite"
          className="min-w-[2.25rem] rounded-lg bg-[#B6C8AF] px-3 py-1.5 text-center text-xs font-medium text-[#333333]"
        >
          {page}
        </span>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={atLastPage}
          aria-label="Next page"
          className={arrowBtn}
        >
          →
        </button>
      </div>
    </div>
  );
}