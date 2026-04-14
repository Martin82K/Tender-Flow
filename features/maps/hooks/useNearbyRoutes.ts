import { useEffect, useState, useRef } from 'react';
import { mapyApiService } from '../services/mapyApiService';
import type { GeoPoint } from '../types';

export interface NearbyRouteInfo {
  distance: number;  // meters
  duration: number;  // seconds
}

interface UseNearbyRoutesResult {
  routes: Map<string, NearbyRouteInfo>;
  isLoading: boolean;
  error: Error | null;
}

interface TargetPoint {
  id: string;
  position: GeoPoint;
}

const MATRIX_MAX_POINTS = 100;
const DEBOUNCE_MS = 500;

export function useNearbyRoutes(
  from: GeoPoint | null | undefined,
  targets: TargetPoint[],
  enabled = true,
): UseNearbyRoutesResult {
  const [routes, setRoutes] = useState<Map<string, NearbyRouteInfo>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const lastKeyRef = useRef<string>('');

  const fromKey = from ? `${from.lat.toFixed(5)},${from.lng.toFixed(5)}` : '';
  const idsKey = targets
    .map(t => `${t.id}:${t.position.lat.toFixed(5)},${t.position.lng.toFixed(5)}`)
    .sort()
    .join('|');

  useEffect(() => {
    if (!enabled || !from || targets.length === 0) {
      setRoutes(new Map());
      setError(null);
      setIsLoading(false);
      return;
    }

    const combinedKey = `${fromKey}#${idsKey}`;
    if (combinedKey === lastKeyRef.current) return;

    let cancelled = false;
    const handle = setTimeout(async () => {
      lastKeyRef.current = combinedKey;
      setIsLoading(true);
      setError(null);

      const limited = targets.slice(0, MATRIX_MAX_POINTS);

      try {
        const result = await mapyApiService.matrixRoute(
          [from],
          limited.map(t => t.position),
        );
        if (cancelled) return;

        const next = new Map<string, NearbyRouteInfo>();
        const distances = result.distances?.[0] ?? [];
        const durations = result.durations?.[0] ?? [];
        limited.forEach((t, i) => {
          const d = distances[i];
          const dur = durations[i];
          if (typeof d === 'number' && typeof dur === 'number') {
            next.set(t.id, { distance: d, duration: dur });
          }
        });
        setRoutes(next);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e : new Error(String(e)));
        setRoutes(new Map());
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromKey, idsKey, enabled]);

  return { routes, isLoading, error };
}
