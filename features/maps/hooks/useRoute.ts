import { useEffect, useState } from 'react';
import { mapyApiService } from '../services/mapyApiService';
import type { GeoPoint, RouteResult } from '../types';

interface UseRouteResult {
  route: RouteResult | null;
  isLoading: boolean;
  error: Error | null;
}

export function useRoute(
  from: GeoPoint | null | undefined,
  to: GeoPoint | null | undefined,
  enabled = true,
): UseRouteResult {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fromKey = from ? `${from.lat},${from.lng}` : '';
  const toKey = to ? `${to.lat},${to.lng}` : '';

  useEffect(() => {
    if (!enabled || !from || !to) {
      setRoute(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    mapyApiService
      .route(from, to)
      .then((result) => {
        if (cancelled) return;
        setRoute(result);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e : new Error(String(e)));
        setRoute(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromKey, toKey, enabled]);

  return { route, isLoading, error };
}
