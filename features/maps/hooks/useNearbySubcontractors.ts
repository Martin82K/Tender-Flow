import { useMemo } from 'react';
import type { Subcontractor } from '@/types';
import type { GeoPoint, MapMarker } from '../types';
import { haversine } from '../utils/haversine';
import { getMarkerColor } from '../utils/markerColors';

interface NearbySubcontractor extends Subcontractor {
  distanceKm: number;
}

export function useNearbySubcontractors(
  projectPosition: GeoPoint | null,
  subcontractors: Subcontractor[],
  radiusKm: number,
) {
  const nearby = useMemo<NearbySubcontractor[]>(() => {
    if (!projectPosition) return [];
    return subcontractors
      .filter((s): s is Subcontractor & { latitude: number; longitude: number } =>
        s.latitude != null && s.longitude != null
      )
      .map(s => ({
        ...s,
        distanceKm: haversine(projectPosition, { lat: s.latitude, lng: s.longitude }) / 1000,
      }))
      .filter(s => s.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [projectPosition, subcontractors, radiusKm]);

  const markers = useMemo<MapMarker[]>(() =>
    nearby.map(s => ({
      id: s.id,
      position: { lat: s.latitude!, lng: s.longitude! },
      label: s.company,
      type: 'subcontractor' as const,
      color: getMarkerColor(s.specialization),
      specialization: s.specialization,
      rating: s.vendorRatingAverage,
      status: s.status,
    })),
  [nearby]);

  const geocodedCount = useMemo(() =>
    subcontractors.filter(s => s.latitude != null && s.longitude != null).length,
  [subcontractors]);

  return { nearby, markers, geocodedCount, totalCount: subcontractors.length };
}
