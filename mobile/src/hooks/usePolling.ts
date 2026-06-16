import { useState, useEffect, useCallback, useRef } from 'react';

export function usePolling(callback: () => Promise<void>, intervalMs: number, enabled = true) {
  const savedCallback = useRef(callback);
  const [isPolling, setIsPolling] = useState(true);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled || !isPolling) return;

    const id = setInterval(() => savedCallback.current(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled, isPolling]);

  return { pause: () => setIsPolling(false), resume: () => setIsPolling(true) };
}

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export function usePaginatedList<T>(
  fetchFn: (params: { page: number; limit: number; search?: string }) => Promise<{ items: T[]; total: number }>,
  limit = 20
) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async (p?: number, s?: string) => {
    const currentPage = p || page;
    const currentSearch = s !== undefined ? s : search;
    setLoading(true);
    try {
      const result = await fetchFn({ page: currentPage, limit, search: currentSearch });
      setItems(result.items);
      setTotal(result.total);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [page, search, fetchFn, limit]);

  const refresh = useCallback(() => load(1), [load]);
  const loadMore = useCallback(() => {
    if (items.length < total) {
      setPage((p) => {
        const next = p + 1;
        load(next);
        return next;
      });
    }
  }, [items.length, total, load]);

  useEffect(() => { load(1); }, []);

  return { items, total, page, loading, search, setSearch, refresh, loadMore, load };
}
