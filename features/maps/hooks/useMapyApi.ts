import { useState, useCallback } from 'react';
import { mapyApiService } from '../services/mapyApiService';
import type { GeocodingResult, SuggestResult, RouteResult, GeoPoint } from '../types';

export function useMapyApi() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const geocode = useCallback(async (query: string): Promise<GeocodingResult | null> => {
    setIsLoading(true);
    setError(null);
    try {
      return await mapyApiService.geocode(query);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const suggest = useCallback(async (query: string): Promise<SuggestResult[]> => {
    try {
      return await mapyApiService.suggest(query);
    } catch {
      return [];
    }
  }, []);

  const route = useCallback(async (from: GeoPoint, to: GeoPoint): Promise<RouteResult | null> => {
    setIsLoading(true);
    setError(null);
    try {
      return await mapyApiService.route(from, to);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { geocode, suggest, route, isLoading, error };
}
