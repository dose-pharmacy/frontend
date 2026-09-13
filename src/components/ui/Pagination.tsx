interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-[#DBEFF3] px-4 py-3">
      <p className="text-sm text-[#666666]">
        Page <span className="font-medium text-[#333333]">{page}</span> of{" "}
        <span className="font-medium text-[#333333]">{totalPages}</span>
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="rounded-lg border border-[#ABDBE3] px-3 py-1.5 text-sm font-medium text-[#333333] hover:bg-[#DBEFF3] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="rounded-lg border border-[#ABDBE3] px-3 py-1.5 text-sm font-medium text-[#333333] hover:bg-[#DBEFF3] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
