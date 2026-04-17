import { invokeAuthedFunction } from '@/services/functionsClient';
import { MAPS_CONFIG } from '@/config/maps';
import type { GeocodingResult, SuggestResult, RouteResult, MatrixResult, GeoPoint } from '../types';
import { GeocodingError } from '../types';

// ---------------------------------------------------------------------------
// Simple LRU Cache (client-side, keeps parsed results)
// ---------------------------------------------------------------------------

class LRUCache<T> {
  private capacity: number;
  private ttl: number;
  private cache = new Map<string, { value: T; expiresAt: number }>();

  constructor(capacity: number, ttl: number) {
    this.capacity = capacity;
    this.ttl = ttl;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, expiresAt: Date.now() + this.ttl });
  }

  clear(): void {
    this.cache.clear();
  }
}

// ---------------------------------------------------------------------------
// Token-bucket rate limiter (client-side throttle)
// ---------------------------------------------------------------------------

class RateLimiter {
  private tokens: number;
  private maxTokens: number;
  private refillRate: number;
  private lastRefill: number;

  constructor(maxPerSecond: number) {
    this.maxTokens = maxPerSecond;
    this.tokens = maxPerSecond;
    this.refillRate = maxPerSecond / 1000;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    const waitMs = Math.ceil((1 - this.tokens) / this.refillRate);
    await new Promise(resolve => setTimeout(resolve, waitMs));
    this.refill();
    this.tokens -= 1;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

// ---------------------------------------------------------------------------
// Proxy response types
// ---------------------------------------------------------------------------

interface ProxyErrorResponse {
  error?: string;
  message?: string;
}

interface TileConfigResponse {
  tileUrl: string;
  darkTileUrl: string;
  layers?: Record<string, string>;
}

export interface TileConfig {
  tileUrl: string;
  darkTileUrl: string;
  layers: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Mapy.com API Service (via Supabase Edge Function proxy)
// ---------------------------------------------------------------------------

class MapyApiService {
  private geocodeCache = new LRUCache<GeocodingResult>(500, MAPS_CONFIG.cacheGeocodeTTL);
  private routeCache = new LRUCache<RouteResult>(200, MAPS_CONFIG.cacheRouteTTL);
  private rateLimiter = new RateLimiter(MAPS_CONFIG.rateLimit);
  private tileUrlCache: TileConfig | null = null;

  // -----------------------------------------------------------------------
  // Core proxy call with rate limiting + retry
  // -----------------------------------------------------------------------

  private async proxyCall<T>(action: string, params: Record<string, string | number>, attempt = 1): Promise<T> {
    await this.rateLimiter.acquire();

    try {
      // Edge function returns Mapy.cz API response directly (or {error} on failure)
      const response = await invokeAuthedFunction<T & ProxyErrorResponse>('maps-proxy', {
        body: {
          action,
          params: Object.fromEntries(
            Object.entries(params).map(([k, v]) => [k, String(v)])
          ),
        },
        timeoutMs: 15_000,
      });

      if ('error' in response && response.error) {
        throw new GeocodingError(String(response.error), 'API_ERROR');
      }

      return response as T;
    } catch (err) {
      if (err instanceof GeocodingError) throw err;

      const message = err instanceof Error ? err.message : String(err);

      if (message.includes('429') || message.toLowerCase().includes('rate limit')) {
        if (attempt < MAPS_CONFIG.retryAttempts) {
          await this.backoff(attempt);
          return this.proxyCall<T>(action, params, attempt + 1);
        }
        throw new GeocodingError('Rate limit exceeded', 'RATE_LIMIT');
      }

      if (message.includes('401') || message.includes('403') || message.includes('Invalid')) {
        throw new GeocodingError('Chyba autorizace mapových služeb', 'INVALID_KEY');
      }

      if (attempt < MAPS_CONFIG.retryAttempts) {
        await this.backoff(attempt);
        return this.proxyCall<T>(action, params, attempt + 1);
      }

      throw new GeocodingError(`Chyba API: ${message}`, 'API_ERROR');
    }
  }

  private async backoff(attempt: number): Promise<void> {
    const delay = Math.min(1000 * 2 ** (attempt - 1), 8000);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // -----------------------------------------------------------------------
  // Tile URL (fetched once from proxy, cached in memory)
  // -----------------------------------------------------------------------

  async getTileConfig(): Promise<TileConfig> {
    if (this.tileUrlCache) return this.tileUrlCache;

    try {
      const response = await invokeAuthedFunction<TileConfigResponse>('maps-proxy', {
        body: { action: 'tile-config', params: {} },
        timeoutMs: 10_000,
      });

      if (response.tileUrl && response.darkTileUrl) {
        this.tileUrlCache = {
          tileUrl: response.tileUrl,
          darkTileUrl: response.darkTileUrl,
          layers: response.layers ?? {
            standard: response.tileUrl,
            outdoor: response.darkTileUrl,
          },
        };
        return this.tileUrlCache;
      }
    } catch (err) {
      console.warn('[MapyApi] Failed to load tile config from proxy:', err);
    }

    // Fallback (no API key in URL - tiles may not work)
    return {
      tileUrl: MAPS_CONFIG.tileUrl,
      darkTileUrl: MAPS_CONFIG.darkTileUrl,
      layers: {
        standard: MAPS_CONFIG.tileUrl,
        outdoor: MAPS_CONFIG.darkTileUrl,
      },
    };
  }

  // -----------------------------------------------------------------------
  // Geocode
  // -----------------------------------------------------------------------

  async geocode(query: string): Promise<GeocodingResult | null> {
    if (!query.trim()) return null;

    const cached = this.geocodeCache.get(`geo:${query}`);
    if (cached) return cached;

    interface GeocodeApiResponse {
      items: Array<{
        position: { lat: number; lon: number };
        name: string;
        label: string;
        regionalStructure?: Array<{ type: string; name: string }>;
      }>;
    }

    const data = await this.proxyCall<GeocodeApiResponse>('geocode', {
      query, lang: 'cs', limit: 1,
    });

    if (!data.items?.length) return null;

    const item = data.items[0];
    const regionEntry = item.regionalStructure?.find(r => r.type === 'regional.region');

    const result: GeocodingResult = {
      lat: item.position.lat,
      lng: item.position.lon,
      label: item.label || item.name,
      regionCode: regionEntry?.name,
    };

    this.geocodeCache.set(`geo:${query}`, result);
    return result;
  }

  // -----------------------------------------------------------------------
  // Reverse geocode
  // -----------------------------------------------------------------------

  async reverseGeocode(point: GeoPoint): Promise<GeocodingResult | null> {
    const cacheKey = `rgeo:${point.lat},${point.lng}`;
    const cached = this.geocodeCache.get(cacheKey);
    if (cached) return cached;

    interface RGeocodeApiResponse {
      items: Array<{
        position: { lat: number; lon: number };
        name: string;
        label: string;
        regionalStructure?: Array<{ type: string; name: string }>;
      }>;
    }

    const data = await this.proxyCall<RGeocodeApiResponse>('rgeocode', {
      lat: point.lat, lon: point.lng, lang: 'cs',
    });

    if (!data.items?.length) return null;

    const item = data.items[0];
    const regionEntry = item.regionalStructure?.find(r => r.type === 'regional.region');

    const result: GeocodingResult = {
      lat: item.position.lat,
      lng: item.position.lon,
      label: item.label || item.name,
      regionCode: regionEntry?.name,
    };

    this.geocodeCache.set(cacheKey, result);
    return result;
  }

  // -----------------------------------------------------------------------
  // Suggest (autocomplete)
  // -----------------------------------------------------------------------

  async suggest(query: string, limit = 5): Promise<SuggestResult[]> {
    if (!query.trim()) return [];

    interface SuggestApiResponse {
      items: Array<{
        label: string;
        position: { lat: number; lon: number };
        locality?: string;
        region?: string;
      }>;
    }

    const data = await this.proxyCall<SuggestApiResponse>('suggest', {
      query, lang: 'cs', limit, type: 'regional.address',
    });

    return (data.items || []).map(item => ({
      label: item.label,
      position: { lat: item.position.lat, lng: item.position.lon },
      locality: item.locality,
      region: item.region,
    }));
  }

  // -----------------------------------------------------------------------
  // Route (point-to-point)
  // -----------------------------------------------------------------------

  async route(start: GeoPoint, end: GeoPoint): Promise<RouteResult | null> {
    const cacheKey = `route:${start.lat},${start.lng}|${end.lat},${end.lng}`;
    const cached = this.routeCache.get(cacheKey);
    if (cached) return cached;

    interface RouteApiResponse {
      length: number;
      duration: number;
      geometry?: { coordinates: [number, number][] };
    }

    const data = await this.proxyCall<RouteApiResponse>('route', {
      start: `${start.lng},${start.lat}`,
      end: `${end.lng},${end.lat}`,
      routeType: 'car_fast',
      lang: 'cs',
    });

    const result: RouteResult = {
      distance: data.length ?? 0,
      duration: data.duration ?? 0,
      geometry: data.geometry?.coordinates,
    };

    this.routeCache.set(cacheKey, result);
    return result;
  }

  // -----------------------------------------------------------------------
  // Matrix routing
  // -----------------------------------------------------------------------

  async matrixRoute(starts: GeoPoint[], ends: GeoPoint[]): Promise<MatrixResult> {
    const startParam = starts.map(p => `${p.lng},${p.lat}`).join('|');
    const endParam = ends.map(p => `${p.lng},${p.lat}`).join('|');

    interface MatrixApiResponse {
      durations: number[][];
      distances: number[][];
    }

    const data = await this.proxyCall<MatrixApiResponse>('matrix', {
      start: startParam,
      end: endParam,
      routeType: 'car_fast',
    });

    return {
      durations: data.durations ?? [],
      distances: data.distances ?? [],
    };
  }

  // -----------------------------------------------------------------------
  // Cache management
  // -----------------------------------------------------------------------

  clearCache(): void {
    this.geocodeCache.clear();
    this.routeCache.clear();
    this.tileUrlCache = null;
  }
}

export const mapyApiService = new MapyApiService();
