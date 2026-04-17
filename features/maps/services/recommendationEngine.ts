import { MAPS_CONFIG } from '@/config/maps';
import type { Subcontractor } from '@/types';
import type { GeoPoint, RecommendationResult, MatrixResult } from '../types';
import { haversine } from '../utils/haversine';
import { mapyApiService } from './mapyApiService';

// ---------------------------------------------------------------------------
// Recommendation Engine — scores subcontractors for a project category
// ---------------------------------------------------------------------------

class RecommendationEngine {
  // -----------------------------------------------------------------------
  // Main entry point
  // -----------------------------------------------------------------------

  async getRecommendations(
    projectPosition: GeoPoint,
    projectRegion: string | undefined,
    categorySpecializations: string[],
    subcontractors: Subcontractor[],
    existingBidSubIds?: string[],
    topN?: number,
  ): Promise<RecommendationResult[]> {
    const maxRadiusM = MAPS_CONFIG.maxRadius * 1000;
    const excludeIds = new Set(existingBidSubIds ?? []);

    // 1. Filter subcontractors that have GPS coordinates
    const geoSubs = subcontractors.filter(
      (s): s is Subcontractor & { latitude: number; longitude: number } =>
        s.latitude != null && s.longitude != null,
    );

    // 2. Pre-filter by haversine distance and exclude existing bid subs
    const candidates = geoSubs.filter(s => {
      if (excludeIds.has(s.id)) return false;
      const dist = haversine(projectPosition, { lat: s.latitude, lng: s.longitude });
      return dist <= maxRadiusM;
    });

    if (candidates.length === 0) return [];

    // 3. Get real travel distances/durations via matrix routing
    const subPositions: GeoPoint[] = candidates.map(s => ({ lat: s.latitude, lng: s.longitude }));
    let matrix: MatrixResult | null = null;

    try {
      matrix = await mapyApiService.matrixRoute([projectPosition], subPositions);
    } catch {
      // Fallback: use haversine distances and estimated durations
    }

    // 4. Score each candidate
    const results: RecommendationResult[] = candidates.map((sub, idx) => {
      const subPos: GeoPoint = { lat: sub.latitude, lng: sub.longitude };

      // Distance & duration from matrix or fallback to haversine
      const distance = matrix?.distances?.[0]?.[idx] ?? haversine(projectPosition, subPos);
      const duration = matrix?.durations?.[0]?.[idx] ?? this.estimateDuration(distance);

      const breakdown = {
        distance: this.scoreDistance(distance),
        specialization: this.scoreSpecialization(sub.specialization, categorySpecializations),
        region: this.scoreRegion(sub.regions, projectRegion),
        rating: this.scoreRating(sub.vendorRatingAverage),
        status: this.scoreStatus(sub.status),
      };

      const { scoring } = MAPS_CONFIG;
      const score =
        breakdown.distance * scoring.distanceWeight +
        breakdown.specialization * scoring.specializationWeight +
        breakdown.region * scoring.regionWeight +
        breakdown.rating * scoring.ratingWeight +
        breakdown.status * scoring.statusWeight;

      return {
        subcontractorId: sub.id,
        companyName: sub.company,
        specialization: sub.specialization,
        distance,
        duration,
        score: Math.round(score * 10) / 10,
        scoreBreakdown: breakdown,
        position: subPos,
        rating: sub.vendorRatingAverage,
        regions: sub.regions,
      };
    });

    // 5. Sort by score descending and optionally limit
    results.sort((a, b) => b.score - a.score);
    return topN ? results.slice(0, topN) : results;
  }

  // -----------------------------------------------------------------------
  // Individual scoring functions (each returns 0-100)
  // -----------------------------------------------------------------------

  /** Distance score: inversely proportional — 0 km → 100, maxRadius → 0 */
  private scoreDistance(distanceM: number): number {
    const maxM = MAPS_CONFIG.maxRadius * 1000;
    if (distanceM <= 0) return 100;
    if (distanceM >= maxM) return 0;
    return 100 * (1 - distanceM / maxM);
  }

  /** Specialization match ratio */
  private scoreSpecialization(subSpecs: string[], categorySpecs: string[]): number {
    if (!categorySpecs.length) return 50; // No category specs means neutral
    if (!subSpecs?.length) return 0;

    const subSet = new Set(subSpecs.map(s => s.toLowerCase()));
    const matches = categorySpecs.filter(cs => subSet.has(cs.toLowerCase())).length;
    return (matches / categorySpecs.length) * 100;
  }

  /** Region match bonus */
  private scoreRegion(subRegions?: string[], projectRegion?: string): number {
    if (!projectRegion || !subRegions?.length) return 0;
    const regionLower = projectRegion.toLowerCase();
    const matches = subRegions.some(r => r.toLowerCase() === regionLower);
    return matches ? 100 : 0;
  }

  /** Rating normalized from 0-5 to 0-100 */
  private scoreRating(rating?: number): number {
    if (rating == null || rating <= 0) return 50; // No rating → neutral
    return Math.min(100, (rating / 5) * 100);
  }

  /** Status score — bonus for active, penalty for busy */
  private scoreStatus(status: string): number {
    const normalized = status.toLowerCase();
    if (normalized === 'busy' || normalized === 'zaneprázdněn') return 20;
    if (normalized === 'inactive' || normalized === 'neaktivní') return 10;
    // Default/active statuses get full score
    return 80;
  }

  /** Estimate travel duration from distance (assume ~60 km/h average) */
  private estimateDuration(distanceM: number): number {
    return (distanceM / 1000 / 60) * 3600; // seconds
  }
}

export const recommendationEngine = new RecommendationEngine();
