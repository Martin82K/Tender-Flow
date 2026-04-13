import { useState, useCallback } from 'react';
import { recommendationEngine } from '../services/recommendationEngine';
import type { GeoPoint, RecommendationResult } from '../types';
import type { Subcontractor } from '@/types';

export function useSubcontractorRecommendations() {
  const [recommendations, setRecommendations] = useState<RecommendationResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const getRecommendations = useCallback(async (
    projectPosition: GeoPoint,
    projectRegion: string | undefined,
    categorySpecializations: string[],
    subcontractors: Subcontractor[],
    existingBidSubIds?: string[],
    topN?: number,
  ): Promise<RecommendationResult[]> => {
    setIsLoading(true);
    setError(null);
    try {
      const results = await recommendationEngine.getRecommendations(
        projectPosition,
        projectRegion,
        categorySpecializations,
        subcontractors,
        existingBidSubIds,
        topN,
      );
      setRecommendations(results);
      return results;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearRecommendations = useCallback(() => {
    setRecommendations([]);
    setError(null);
  }, []);

  return { recommendations, getRecommendations, clearRecommendations, isLoading, error };
}
