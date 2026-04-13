import { useState, useCallback } from 'react';
import { mapyApiService } from '../services/mapyApiService';
import type { GeoPoint, MatrixResult } from '../types';

export function useMatrixRouting() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const calculateMatrix = useCallback(async (
    origins: GeoPoint[],
    destinations: GeoPoint[],
  ): Promise<MatrixResult | null> => {
    if (!origins.length || !destinations.length) return null;
    setIsLoading(true);
    setError(null);
    try {
      return await mapyApiService.matrixRoute(origins, destinations);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { calculateMatrix, isLoading, error };
}
