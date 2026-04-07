export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface GeocodingResult {
  lat: number;
  lng: number;
  label: string;
  regionCode?: string;
}

export interface SuggestResult {
  label: string;
  position: GeoPoint;
  locality?: string;
  region?: string;
}

export interface RouteResult {
  distance: number;  // meters
  duration: number;  // seconds
  geometry?: [number, number][];
}

export interface MatrixResult {
  durations: number[][];
  distances: number[][];
}

export interface MapMarker {
  id: string;
  position: GeoPoint;
  label: string;
  type: 'subcontractor' | 'project';
  color?: string;
  specialization?: string[];
  rating?: number;
  status?: string;
}

export interface RecommendationResult {
  subcontractorId: string;
  companyName: string;
  specialization: string[];
  distance: number;       // meters
  duration: number;       // seconds
  score: number;          // 0-100
  scoreBreakdown: {
    distance: number;
    specialization: number;
    region: number;
    rating: number;
    status: number;
  };
  position: GeoPoint;
  rating?: number;
  regions?: string[];
}

export type GeocodingErrorCode = 'RATE_LIMIT' | 'NOT_FOUND' | 'API_ERROR' | 'NETWORK_ERROR' | 'INVALID_KEY';

export class GeocodingError extends Error {
  code: GeocodingErrorCode;
  constructor(message: string, code: GeocodingErrorCode) {
    super(message);
    this.name = 'GeocodingError';
    this.code = code;
  }
}

export interface BulkGeocodeProgress {
  total: number;
  processed: number;
  success: number;
  notFound: number;
  errors: number;
  isRunning: boolean;
}
