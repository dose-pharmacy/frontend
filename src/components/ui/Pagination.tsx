interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  total?: number
  pageSize?: number
  itemLabel?: string
}

export default function Pagination({
  page,
  totalPages,
  onPageChange,
  total,
  pageSize = 10,
  itemLabel,
}: PaginationProps) {
  if (totalPages <= 1) return null

  const start = total !== undefined && total > 0 ? (page - 1) * pageSize + 1 : 0
  const end = Math.min(page * pageSize, total ?? totalPages)
  const label = itemLabel ? ` ${itemLabel}` : ""

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E6ECE2] px-4 py-3">
      <p className="text-xs text-[#666666]">
        {total !== undefined ? (
          <>
            Showing <span className="font-medium text-[#333333]">{start}</span>–
            <span className="font-medium text-[#333333]">{end}</span> of{" "}
            <span className="font-medium text-[#333333]">{total}</span>
            {label}
          </>
        ) : (
          <>
            Page <span className="font-medium text-[#333333]">{page}</span> of{" "}
            <span className="font-medium text-[#333333]">{totalPages}</span>
          </>
        )}
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="rounded-lg border border-[#C6D4BF] px-3 py-1.5 text-sm font-medium text-[#333333] hover:bg-[#E6ECE2] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="rounded-lg border border-[#C6D4BF] px-3 py-1.5 text-sm font-medium text-[#333333] hover:bg-[#E6ECE2] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  )
}
