import { MAPS_CONFIG } from '@/config/maps';
import type { Subcontractor, ProjectDetails } from '@/types';
import type { GeocodingResult, BulkGeocodeProgress } from '../types';
import { mapyApiService } from './mapyApiService';

// ---------------------------------------------------------------------------
// Geocoding Service — higher-level geocoding with fallback chains
// ---------------------------------------------------------------------------

class GeocodingService {
  private batchCancelled = false;
  // -----------------------------------------------------------------------
  // Geocode a subcontractor with fallback chain
  // -----------------------------------------------------------------------

  async geocodeSubcontractor(sub: Subcontractor): Promise<GeocodingResult | null> {
    // Already geocoded — skip
    if (sub.latitude != null && sub.longitude != null) {
      return { lat: sub.latitude, lng: sub.longitude, label: sub.address || sub.city || sub.company };
    }

    // Fallback chain: address+city → city+region → city
    const queries: string[] = [];

    if (sub.address && sub.city) {
      queries.push(`${sub.address}, ${sub.city}`);
    }
    if (sub.city && sub.region) {
      queries.push(`${sub.city}, ${sub.region}`);
    }
    if (sub.city) {
      queries.push(sub.city);
    }

    for (const query of queries) {
      try {
        const result = await mapyApiService.geocode(query);
        if (result) return result;
      } catch {
        // Continue to next fallback
      }
    }

    return null;
  }

  // -----------------------------------------------------------------------
  // Geocode a project with fallback chain
  // -----------------------------------------------------------------------

  async geocodeProject(details: ProjectDetails): Promise<GeocodingResult | null> {
    // Already geocoded
    if (details.latitude != null && details.longitude != null) {
      return { lat: details.latitude, lng: details.longitude, label: details.address || details.location };
    }

    // Fallback chain: address → location
    const queries: string[] = [];

    if (details.address) {
      queries.push(details.address);
    }
    if (details.location) {
      queries.push(details.location);
    }

    for (const query of queries) {
      try {
        const result = await mapyApiService.geocode(query);
        if (result) return result;
      } catch {
        // Continue to next fallback
      }
    }

    return null;
  }

  // -----------------------------------------------------------------------
  // Batch geocode with progress reporting
  // -----------------------------------------------------------------------

  async batchGeocode(
    items: Array<{ id: string; address?: string; city?: string; region?: string }>,
    onProgress?: (progress: BulkGeocodeProgress) => void,
  ): Promise<Map<string, GeocodingResult>> {
    const results = new Map<string, GeocodingResult>();
    const progress: BulkGeocodeProgress = {
      total: items.length,
      processed: 0,
      success: 0,
      notFound: 0,
      errors: 0,
      isRunning: true,
    };

    const { batchSize, batchDelay } = MAPS_CONFIG;
    this.batchCancelled = false;

    for (let i = 0; i < items.length; i += batchSize) {
      if (this.batchCancelled) break;

      const batch = items.slice(i, i + batchSize);

      const batchPromises = batch.map(async (item) => {
        // Build fallback query chain
        const queries: string[] = [];
        if (item.address && item.city) queries.push(`${item.address}, ${item.city}`);
        if (item.city && item.region) queries.push(`${item.city}, ${item.region}`);
        if (item.city) queries.push(item.city);
        if (item.address) queries.push(item.address);

        for (const query of queries) {
          try {
            const result = await mapyApiService.geocode(query);
            if (result) {
              results.set(item.id, result);
              progress.success++;
              progress.processed++;
              onProgress?.({ ...progress });
              return;
            }
          } catch {
            // Try next query in fallback chain
          }
        }

        // None of the queries succeeded
        if (results.has(item.id)) return;
        progress.notFound++;
        progress.processed++;
        onProgress?.({ ...progress });
      });

      await Promise.all(batchPromises);

      // Delay between batches (skip delay after the last batch)
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, batchDelay));
      }
    }

    progress.isRunning = false;
    onProgress?.({ ...progress });
    return results;
  }

  // -----------------------------------------------------------------------
  // Cancel ongoing batch geocoding
  // -----------------------------------------------------------------------

  cancelBatch(): void {
    this.batchCancelled = true;
  }
}

export const geocodingService = new GeocodingService();
