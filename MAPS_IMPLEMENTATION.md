# Maps Integration — Implementation Guide

> Tento soubor slouží jako implementační prompt pro Claude Code.
> Přečti si nejprve PRD_TenderFlow_Mapy_Integrace.docx pro plný kontext.

## Přehled

Integrace Mapy.com REST API do TenderFlow pro geocoding, mapovou vizualizaci a inteligentní doporučování subdodavatelů.

## Prerekvizity

1. API klíč z developer.mapy.com → VITE_MAPY_API_KEY v .env
2. `npm install leaflet @types/leaflet leaflet.markercluster @types/leaflet.markercluster`

---

## Fáze 1: Geocoding & Data Layer

### Krok 1.1: DB migrace

Vytvoř soubor `supabase/migrations/YYYYMMDD_add_geocoding_columns.sql`:

```sql
-- Geocoding columns for subcontractors
ALTER TABLE subcontractors
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMPTZ;

-- Geocoding columns for projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMPTZ;

-- Spatial indexes
CREATE INDEX IF NOT EXISTS idx_subcontractors_geo
  ON subcontractors (latitude, longitude) WHERE latitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_geo
  ON projects (latitude, longitude) WHERE latitude IS NOT NULL;
```

### Krok 1.2: Aktualizace typů

V `types.ts` rozšiř `Subcontractor` a `ProjectDetails`:

```typescript
// Přidej do Subcontractor interface:
latitude?: number;
longitude?: number;
geocodedAt?: string;

// Přidej do ProjectDetails interface:
latitude?: number;
longitude?: number;
geocodedAt?: string;
```

### Krok 1.3: Konfigurace

Vytvoř `config/maps.ts`:

```typescript
export const MAPS_CONFIG = {
  apiBase: import.meta.env.VITE_MAPY_API_BASE || 'https://api.mapy.cz/v1',
  tileUrl: import.meta.env.VITE_MAPY_TILE_URL || 'https://api.mapy.cz/v1/maptiles/basic/256/{z}/{x}/{y}',
  apiKey: import.meta.env.VITE_MAPY_API_KEY || '',

  defaultCenter: [49.8175, 15.4730] as [number, number], // Střed ČR
  defaultZoom: 8,
  projectZoom: 11,

  maxRadius: 150,        // km
  defaultRadius: 50,     // km
  batchSize: 10,
  batchDelay: 1000,      // ms
  suggestDebounce: 300,  // ms
  suggestMinChars: 3,

  cacheGeocodeTTL: 86400000, // 24h
  cacheRouteTTL: 3600000,    // 1h

  rateLimit: 10, // requests/second
  retryAttempts: 3,

  scoring: {
    distanceWeight: 0.40,
    specializationWeight: 0.25,
    regionWeight: 0.15,
    ratingWeight: 0.15,
    statusWeight: 0.05,
  },

  // Barvy pinů dle specializace
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
```

### Krok 1.4: Feature modul — services

Vytvoř `features/maps/` adresář se strukturou:

```
features/maps/
├── index.ts
├── types.ts
├── components/
├── hooks/
├── services/
│   ├── mapyApiService.ts
│   ├── geocodingService.ts
│   └── recommendationEngine.ts
└── utils/
    ├── haversine.ts
    ├── markerColors.ts
    └── geoUtils.ts
```

#### features/maps/types.ts

```typescript
export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface GeocodingResult {
  position: GeoPoint;
  label: string;
  regionCode?: string;
  city?: string;
}

export interface SuggestResult {
  label: string;
  position: GeoPoint;
  city?: string;
  region?: string;
}

export interface RouteResult {
  distance: number;    // meters
  duration: number;    // seconds
  geometry?: [number, number][];
}

export interface MatrixResult {
  durations: number[][];  // seconds
  distances: number[][];  // meters
}

export interface MapMarker {
  id: string;
  position: GeoPoint;
  label: string;
  type: 'subcontractor' | 'project';
  color?: string;
  specialization?: string;
  rating?: number;
  distance?: number;     // km from project
  duration?: number;     // minutes from project
}

export interface RecommendationResult {
  subcontractorId: string;
  company: string;
  score: number;           // 0-100
  distance: number;        // km
  duration: number;        // minutes
  specializationMatch: boolean;
  regionMatch: boolean;
  rating: number;
  position: GeoPoint;
}

export interface GeocodingError {
  code: 'RATE_LIMIT' | 'NOT_FOUND' | 'API_ERROR' | 'NETWORK_ERROR' | 'INVALID_KEY';
  message: string;
}
```

#### features/maps/services/mapyApiService.ts

Implementuj REST API wrapper:

- `geocode(query: string): Promise<GeocodingResult | null>`
  - GET {apiBase}/geocode?query={query}&lang=cs&limit=1&apikey={key}
  - Parsuj response.items[0] → { position: { lat, lon→lng }, label, regionCode }

- `reverseGeocode(lat: number, lng: number): Promise<GeocodingResult | null>`
  - GET {apiBase}/rgeocode?lat={lat}&lon={lng}&lang=cs&apikey={key}

- `suggest(query: string): Promise<SuggestResult[]>`
  - GET {apiBase}/suggest?query={query}&lang=cs&limit=5&type=regional.address&apikey={key}

- `route(from: GeoPoint, to: GeoPoint): Promise<RouteResult>`
  - GET {apiBase}/routing/route?start={lat},{lng}&end={lat},{lng}&routeType=car_fast&apikey={key}

- `matrixRoute(origins: GeoPoint[], destinations: GeoPoint[]): Promise<MatrixResult>`
  - GET {apiBase}/routing/matrix?start={origins pipe-separated}&end={destinations pipe-separated}&routeType=car_fast&apikey={key}
  - Format startu: "lat,lng|lat,lng|..."

Požadavky:
- Rate limiting (token bucket, max 10/s z MAPS_CONFIG.rateLimit)
- Retry s exponential backoff (3 pokusy)
- LRU cache s TTL pro geocoding (24h) a routing (1h)
- Error handling → GeocodingError typ
- Validace API klíče při prvním volání

#### features/maps/services/geocodingService.ts

Vyšší vrstva:
- `geocodeSubcontractor(sub: Subcontractor): Promise<GeoPoint | null>`
  - Fallback řetězec: (address + " " + city) → city → region
  - Uloží výsledek do DB přes service vrstvu

- `geocodeProject(project: ProjectDetails): Promise<GeoPoint | null>`
  - Fallback řetězec: address → location
  - Uloží výsledek do DB

- `batchGeocode(ids: string[], type: 'subcontractor' | 'project', onProgress: (done, total, errors) => void): Promise<void>`
  - Zpracování po dávkách (batchSize), pauza batchDelay mezi dávkami
  - Přeskočí záznamy s geocoded_at (pokud není force=true)

#### features/maps/utils/haversine.ts

```typescript
export function haversineDistance(a: GeoPoint, b: GeoPoint): number {
  // Vrací vzdálenost v km
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sin2Lat = Math.sin(dLat / 2) ** 2;
  const sin2Lng = Math.sin(dLng / 2) ** 2;
  const a2 = sin2Lat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sin2Lng;
  return R * 2 * Math.atan2(Math.sqrt(a2), Math.sqrt(1 - a2));
}
function toRad(deg: number): number { return deg * Math.PI / 180; }
```

### Krok 1.5: Napojení na ARES flow

V `features/contacts/Contacts.tsx` — po úspěšném ARES lookup (findCompanyRegistrationDetails):
1. Pokud se vyplnila adresa + město, zavolej `geocodeSubcontractor()`
2. Ulož lat/lng do stavu kontaktu

V `features/projects/ProjectOverviewNew.tsx` — po uložení "Adresa stavby":
1. Zavolej `geocodeProject()`
2. Ulož lat/lng do project details

### Krok 1.6: Aktualizace service vrstvy

Uprav stávající services pro čtení/zápis lat/lng:
- `services/subcontractorService.ts` — přidej latitude, longitude, geocoded_at do CRUD operací
- `services/projectService.ts` — přidej latitude, longitude, geocoded_at

---

## Fáze 2: Mapová vizualizace

### Krok 2.1: Leaflet setup

Leaflet CSS musí být importován globálně. Přidej do `index.tsx` nebo `app/AppShell.tsx`:

```typescript
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
```

Fix pro Leaflet default marker ikony (známý webpack/vite issue):

```typescript
// features/maps/utils/leafletFix.ts
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});
```

### Krok 2.2: MapView.tsx

Reusable mapová komponenta (features/maps/components/MapView.tsx):

Použij `useRef` pro Leaflet map instanci, `useEffect` pro inicializaci a cleanup.

Props viz PRD sekce 4.1.

Důležité:
- Tile layer z MAPS_CONFIG.tileUrl s apikey parametrem
- Attribution: "© Seznam.cz, a.s."
- fitBounds automaticky na všechny markery pokud props.fitBounds
- Custom marker ikony (SVG) s barvou dle specializace
- Popup na klik: název firmy, specializace, hodnocení, vzdálenost
- Dark mode: přepni tile URL na dark variantu (useTheme hook)

### Krok 2.3: SubcontractorMapView.tsx

Celá obrazovka mapy v záložce Kontakty:
- Toggle tlačítko seznam/mapa v horní liště (vedle stávajících tlačítek)
- MarkerCluster pro mnoho kontaktů
- Filtry sdílené s tabulkovým pohledem (specializace, kraj, status)
- Legenda barev v rohu
- Klik na pin → otevře detail kontaktu (stávající modal)

### Krok 2.4: ProjectMapView.tsx

Nový tab "Mapa" v projektu (přidej do ProjectTab type v types.ts):

```typescript
export type ProjectTab = "overview" | "tender-plan" | "pipeline" | "schedule" | "documents" | "contracts" | "map";
```

Registruj nový tab v navigaci (config/navigation.ts nebo kde se definují taby).
Lazy-load komponentu.

Vlastnosti:
- Pin stavby (speciální ikona — jeřáb/stavba SVG)
- Radius slider (10–150 km)
- Subdodavatelé v okruhu
- Panel vpravo se seznamem seřazeným dle vzdálenosti
- Klik na subdodavatele → zvýrazní + zobrazí trasu

### Krok 2.5: AddressInput.tsx

Nahraď stávající text inputy pro adresy:
- Suggest API s debounce 300ms
- Dropdown s návrhy
- Při výběru: vyplní address, city, lat, lng
- Fallback na manuální zadání
- Použij ve: Contacts.tsx (adresa firmy), ProjectOverviewNew.tsx (adresa stavby)

---

## Fáze 3: Doporučování

### Krok 3.1: recommendationEngine.ts

```typescript
export function calculateScore(params: {
  duration: number;          // seconds from Matrix API
  maxDuration: number;       // max in current batch
  specializationMatch: boolean;
  regionMatch: boolean;
  rating: number;            // 0-5
  statusAvailable: boolean;
  weights: typeof MAPS_CONFIG.scoring;
}): number {
  const { duration, maxDuration, specializationMatch, regionMatch, rating, statusAvailable, weights } = params;

  // Distance score: inverted normalization (closer = higher)
  const distanceScore = maxDuration > 0 ? (1 - duration / maxDuration) * 100 : 50;

  // Specialization: binary
  const specScore = specializationMatch ? 100 : 0;

  // Region: binary
  const regionScore = regionMatch ? 100 : 0;

  // Rating: normalize 0-5 → 0-100
  const ratingScore = (rating / 5) * 100;

  // Status: bonus/penalty
  const statusScore = statusAvailable ? 100 : 20;

  return Math.round(
    distanceScore * weights.distanceWeight +
    specScore * weights.specializationWeight +
    regionScore * weights.regionWeight +
    ratingScore * weights.ratingWeight +
    statusScore * weights.statusWeight
  );
}
```

### Krok 3.2: useSubcontractorRecommendations.ts

Hook pro doporučení:

```typescript
export function useSubcontractorRecommendations(
  projectId: string,
  categoryId?: string,
  options?: { radius?: number; limit?: number }
) {
  // 1. Načti GPS stavby
  // 2. Načti všechny subdodavatele s GPS
  // 3. Prefiltrace: specializace (pokud categoryId), haversine < maxRadius
  // 4. Matrix Routing API (batch po 10 subdodavatelích)
  // 5. Scoring
  // 6. Seřaď dle score, vrať top N
  // Return: { recommendations: RecommendationResult[], isLoading, error }
}
```

### Krok 3.3: RecommendationPanel.tsx

Panel s kartami doporučení:
- Zobrazí se v ProjectMapView (panel vpravo)
- Každá karta: firma, specializace badge, čas dojezdu, hvězdičky, score bar
- Hover → zvýrazní pin na mapě
- Tlačítko "Přidat do nabídky" → otevře CreateBid modal
- Loading state: skeleton karty
- Empty state: "Žádní subdodavatelé v okruhu" + CTA zvětšit radius

### Krok 3.4: Pipeline inline widget

V pipeline komponentě (pod každou DemandCategory):
- Rozbalovací sekce "N doporučení subdodavatelé poblíž"
- Mini karty s quick action "Oslovit"
- Pouze pokud má stavba GPS souřadnice

---

## Feature Flags

Přidej do `config/features.ts`:

```typescript
MODULE_MAPS: 'module_maps',
MAPS_RECOMMENDATIONS: 'maps_recommendations',
MAPS_ROUTING: 'maps_routing',
MAPS_BULK_GEOCODE: 'maps_bulk_geocode',
```

Přidej do `config/subscriptionTiers.ts` tier mapping:
- starter+: MODULE_MAPS
- pro+: MAPS_RECOMMENDATIONS, MAPS_ROUTING, MAPS_BULK_GEOCODE

---

## Testy

Všechny testy do `tests/maps/`. Použij Vitest + jsdom + MSW pro mock API.

### Povinné testy:

1. **haversine.test.ts** — Praha–Brno (~185km), stejný bod (0), malé vzdálenosti
2. **recommendationEngine.test.ts** — scoring s různými vahami, edge cases (0 rating, no GPS)
3. **mapyApiService.test.ts** — success, 429 rate limit, timeout, invalid key, cache hit
4. **geocodingService.test.ts** — single, batch, fallback řetězec, skip already geocoded
5. **MapView.test.tsx** — render, markers, click events, fitBounds
6. **AddressInput.test.tsx** — suggest call, debounce, selection, fallback
7. **RecommendationPanel.test.tsx** — render cards, sort by score, empty/loading/error states

### MSW mock setup:

```typescript
// tests/maps/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const mapyHandlers = [
  http.get('https://api.mapy.cz/v1/geocode', ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('query');
    // Return mock geocoding response
    return HttpResponse.json({
      items: [{ position: { lat: 49.1951, lon: 16.6068 }, name: query, label: query }]
    });
  }),
  // ... similar for suggest, route, matrix
];
```

---

## Checklist implementace

- [ ] DB migrace (lat/lng/geocoded_at na subcontractors + projects)
- [ ] types.ts rozšíření
- [ ] config/maps.ts
- [ ] features/maps/types.ts
- [ ] features/maps/utils/haversine.ts
- [ ] features/maps/services/mapyApiService.ts
- [ ] features/maps/services/geocodingService.ts
- [ ] features/maps/services/recommendationEngine.ts
- [ ] features/maps/hooks/useGeocode.ts
- [ ] features/maps/hooks/useMapyApi.ts
- [ ] features/maps/hooks/useAddressSuggest.ts
- [ ] features/maps/hooks/useMatrixRouting.ts
- [ ] features/maps/hooks/useSubcontractorRecommendations.ts
- [ ] features/maps/hooks/useNearbySubcontractors.ts
- [ ] features/maps/components/MapView.tsx
- [ ] features/maps/components/SubcontractorMapView.tsx
- [ ] features/maps/components/ProjectMapView.tsx
- [ ] features/maps/components/RecommendationPanel.tsx
- [ ] features/maps/components/RecommendationCard.tsx
- [ ] features/maps/components/AddressInput.tsx
- [ ] features/maps/components/MapLegend.tsx
- [ ] features/maps/components/RadiusSlider.tsx
- [ ] features/maps/components/BulkGeocodePanel.tsx
- [ ] Leaflet setup (CSS, icon fix)
- [ ] Napojení na ARES flow v Contacts.tsx
- [ ] Napojení na ProjectOverviewNew.tsx
- [ ] Nový tab "map" v ProjectTab type
- [ ] Feature flags v config/features.ts
- [ ] Subscription tier mapping
- [ ] Pipeline inline doporučení widget
- [ ] Aktualizace services (subcontractor + project CRUD pro lat/lng)
- [ ] Testy: haversine, scoring, API service, geocoding, komponenty
- [ ] Boundary check: npm run check:boundaries
- [ ] Legacy freeze check: npm run check:legacy-structure
- [ ] Build check: npm run build
