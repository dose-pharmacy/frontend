import { useEffect, useMemo, useState } from "react";

export interface Pagination<T> {
  page: number;
  setPage: (page: number) => void;
  totalPages: number;
  pageItems: T[];
}

/**
 * Client-side pagination helper for table/list data.
 * Automatically clamps the current page when the item count shrinks.
 */
export function usePagination<T>(items: T[], pageSize = 10): Pagination<T> {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  );

  return { page, setPage, totalPages, pageItems };
}
