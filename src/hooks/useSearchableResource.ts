import { useCallback, useEffect, useRef, useState } from "react";
import type { SearchableOption } from "../components/ui/SearchableSelect";

export interface SearchableResourceResult {
  items: SearchableOption[];
  hasMore: boolean;
}

export interface SearchableResourceFetcher {
  (term: string, page: number): Promise<SearchableResourceResult>;
}

export interface SearchResourceState {
  term: string;
  setTerm: (term: string) => void;
  options: SearchableOption[];
  loading: boolean;
  error: string | null;
  retry: () => void;
  hasMore: boolean;
  loadMore: () => void;
  /** Force a reload of the current term (e.g. after a mutation). */
  refresh: () => void;
}

const DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

export function useSearchableResource(fetcher: SearchableResourceFetcher, enabled = true): SearchResourceState {
  const [term, setTermState] = useState("");
  const [options, setOptions] = useState<SearchableOption[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const requestSeq = useRef(0);
  const latestTermRef = useRef("");
  const debounceTimer = useRef<number | null>(null);

  const run = useCallback(async (searchTerm: string, pageToLoad: number) => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current(searchTerm, pageToLoad);
      if (seq !== requestSeq.current) return;
      setOptions((prev) => (pageToLoad === 1 ? result.items : [...prev, ...result.items]));
      setPage(pageToLoad);
      setTotalPages(result.hasMore ? pageToLoad + 1 : pageToLoad);
      latestTermRef.current = searchTerm;
    } catch (e) {
      if (seq !== requestSeq.current) return;
      setError(e instanceof Error ? e.message : "Failed to load options");
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => {
      setPage(1);
      run(term, 1);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    };
  }, [term, enabled, run]);

  const setTerm = useCallback((next: string) => setTermState(next), []);

  const loadMore = useCallback(() => {
    if (loading || page >= totalPages) return;
    run(latestTermRef.current, page + 1);
  }, [loading, page, totalPages, run]);

  const retry = useCallback(() => {
    run(latestTermRef.current, 1);
  }, [run]);

  const refresh = useCallback(() => {
    run(latestTermRef.current, 1);
  }, [run]);

  return { term, setTerm, options, loading, error, retry, hasMore: page < totalPages, loadMore, refresh };
}

export { PAGE_SIZE };