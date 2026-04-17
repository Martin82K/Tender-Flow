import type { GeoPoint } from '../types';

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

/** Calculate bounding box that contains all points */
export function getBoundingBox(points: GeoPoint[]): BoundingBox | null {
  if (!points.length) return null;
  return {
    north: Math.max(...points.map(p => p.lat)),
    south: Math.min(...points.map(p => p.lat)),
    east: Math.max(...points.map(p => p.lng)),
    west: Math.min(...points.map(p => p.lng)),
  };
}

/** Expand bounding box by a padding in km */
export function expandBounds(box: BoundingBox, paddingKm: number): BoundingBox {
  const latDelta = paddingKm / 111.32;
  const lngDelta = paddingKm / (111.32 * Math.cos((box.north + box.south) / 2 * Math.PI / 180));
  return {
    north: box.north + latDelta,
    south: box.south - latDelta,
    east: box.east + lngDelta,
    west: box.west - lngDelta,
  };
}

/** Check if a point is within a bounding box */
export function isPointInBounds(point: GeoPoint, box: BoundingBox): boolean {
  return point.lat >= box.south && point.lat <= box.north &&
         point.lng >= box.west && point.lng <= box.east;
}

/** Convert km to approximate degrees latitude */
export function kmToLatDeg(km: number): number {
  return km / 111.32;
}
