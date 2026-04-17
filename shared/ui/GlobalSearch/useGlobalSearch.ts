import { useEffect, useMemo, useState } from "react";
import { buildSearchIndex, searchAll, MIN_QUERY_LENGTH } from "./searchEngine";
import type { SearchInputSources, SearchResultGroup } from "./types";

interface UseGlobalSearchResult {
  results: SearchResultGroup[];
  /** Flat list of results in display order for keyboard navigation */
  flatResults: SearchResultGroup["items"];
  isSearching: boolean;
  hasQuery: boolean;
  isQueryTooShort: boolean;
  totalProjectCount: number;
  loadedProjectDetailsCount: number;
}

const DEBOUNCE_MS = 120;

export const useGlobalSearch = (
  query: string,
  sources: SearchInputSources,
): UseGlobalSearchResult => {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  const index = useMemo(() => buildSearchIndex(sources), [sources]);

  const results = useMemo(
    () => searchAll(debouncedQuery, index),
    [debouncedQuery, index],
  );

  const flatResults = useMemo(
    () => results.flatMap((g) => g.items),
    [results],
  );

  const trimmed = query.trim();
  const hasQuery = trimmed.length > 0;
  const isQueryTooShort = hasQuery && trimmed.length < MIN_QUERY_LENGTH;

  return {
    results,
    flatResults,
    isSearching: debouncedQuery !== query,
    hasQuery,
    isQueryTooShort,
    totalProjectCount: index.totalProjectCount,
    loadedProjectDetailsCount: index.loadedProjectDetailsCount,
  };
};
