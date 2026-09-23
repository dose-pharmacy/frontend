import type { ReactNode } from "react";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Left-side label. Defaults to "Page {page} of {totalPages}". */
  label?: ReactNode;
}

function buildItems(page: number, totalPages: number): (number | "…")[] {
  const show = new Set([1, totalPages, page - 1, page, page + 1]);
  const items: (number | "…")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (!show.has(i)) continue;
    if (
      items.length > 0 &&
      typeof items[items.length - 1] === "number" &&
      (items[items.length - 1] as number) !== i - 1
    ) {
      items.push("…");
    }
    items.push(i);
  }
  return items;
}

export default function Pagination({ page, totalPages, onPageChange, label }: PaginationProps) {
  const arrowBtn =
    "rounded-lg px-3 py-1.5 text-xs border border-[#C6D4BF] text-[#666666] hover:bg-[#E6ECE2] disabled:opacity-40 transition-colors";

  return (
    <div className="flex items-center justify-between border-t border-[#E6ECE2] px-4 py-3 gap-3 flex-wrap">
      <p className="text-sm text-[#666666]">
        {label ?? (
          <>
            Page <span className="font-medium text-[#333333]">{page}</span> of{" "}
            <span className="font-medium text-[#333333]">{totalPages}</span>
          </>
        )}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Previous page"
          className={arrowBtn}
        >
          ←
        </button>
        {buildItems(page, totalPages).map((item, idx) =>
          item === "…" ? (
            <span key={`ellipsis-${idx}`} className="px-1 text-xs text-[#666666]">
              …
            </span>
          ) : (
            <button
              key={item}
              onClick={() => onPageChange(item)}
              aria-current={item === page ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                item === page
                  ? "bg-[#B6C8AF] text-[#333333]"
                  : "border border-[#C6D4BF] text-[#666666] hover:bg-[#E6ECE2]"
              }`}
            >
              {item}
            </button>
          ),
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          aria-label="Next page"
          className={arrowBtn}
        >
          →
        </button>
      </div>
    </div>
  );
}