import { useState, useEffect, useRef, useCallback } from 'react';
import { mapyApiService } from '../services/mapyApiService';
import { MAPS_CONFIG } from '@/config/maps';
import type { SuggestResult } from '../types';

export function useAddressSuggest(query: string) {
  const [suggestions, setSuggestions] = useState<SuggestResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query || query.length < MAPS_CONFIG.suggestMinChars) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await mapyApiService.suggest(query);
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, MAPS_CONFIG.suggestDebounce);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const clear = useCallback(() => setSuggestions([]), []);

  return { suggestions, isLoading, clear };
}
