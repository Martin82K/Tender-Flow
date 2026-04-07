import { useState, useCallback } from 'react';
import { geocodingService } from '../services/geocodingService';
import type { GeocodingResult, BulkGeocodeProgress } from '../types';
import type { Subcontractor, ProjectDetails } from '@/types';

export function useGeocode() {
  const [isLoading, setIsLoading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<BulkGeocodeProgress | null>(null);

  const geocodeSubcontractor = useCallback(async (sub: Subcontractor): Promise<GeocodingResult | null> => {
    setIsLoading(true);
    try {
      return await geocodingService.geocodeSubcontractor(sub);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const geocodeProject = useCallback(async (details: ProjectDetails): Promise<GeocodingResult | null> => {
    setIsLoading(true);
    try {
      return await geocodingService.geocodeProject(details);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const batchGeocode = useCallback(async (
    items: Array<{ id: string; address?: string; city?: string; region?: string }>,
  ): Promise<Map<string, GeocodingResult>> => {
    setBulkProgress({ total: items.length, processed: 0, success: 0, notFound: 0, errors: 0, isRunning: true });
    try {
      return await geocodingService.batchGeocode(items, (progress) => {
        setBulkProgress(progress);
      });
    } finally {
      setBulkProgress(prev => prev ? { ...prev, isRunning: false } : null);
    }
  }, []);

  const cancelBatch = useCallback(() => {
    geocodingService.cancelBatch();
  }, []);

  return { geocodeSubcontractor, geocodeProject, batchGeocode, cancelBatch, isLoading, bulkProgress };
}
