export const MAPS_CONFIG = {
  // Tile URLs are fallbacks only — actual URLs with API key come from maps-proxy Edge Function
  tileUrl: 'https://api.mapy.com/v1/maptiles/basic/256/{z}/{x}/{y}',
  darkTileUrl: 'https://api.mapy.com/v1/maptiles/outdoor/256/{z}/{x}/{y}',
  // API key is stored in Supabase Secrets (MAPY_API_KEY), NOT in client-side env

  defaultCenter: [49.8175, 15.4730] as [number, number], // Střed ČR
  defaultZoom: 8,
  projectZoom: 11,

  maxRadius: 150,
  defaultRadius: 50,
  batchSize: 10,
  batchDelay: 1000,
  suggestDebounce: 300,
  suggestMinChars: 3,

  cacheGeocodeTTL: 86400000, // 24h
  cacheRouteTTL: 3600000,    // 1h

  rateLimit: 10,
  retryAttempts: 3,

  scoring: {
    distanceWeight: 0.40,
    specializationWeight: 0.25,
    regionWeight: 0.15,
    ratingWeight: 0.15,
    statusWeight: 0.05,
  },

  colors: {
    'Elektroinstalace': '#F59E0B',
    'ZTI': '#3B82F6',
    'Vzduchotechnika': '#10B981',
    'Zemní práce': '#8B5CF6',
    'Zateplení': '#EF4444',
    'Střechy': '#EC4899',
    'Podlahy': '#F97316',
    'SDK': '#06B6D4',
    'Malby': '#84CC16',
    'default': '#6B7280',
  } as Record<string, string>,
} as const;
