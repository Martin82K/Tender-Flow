import { useRef, useEffect, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import { MAPS_CONFIG, MAP_LAYERS } from '@/config/maps';
import { useTheme } from '@/hooks/useTheme';
import { mapyApiService } from '../services/mapyApiService';
import type { TileConfig } from '../services/mapyApiService';
import { CZECH_REGIONS } from '../utils/czechRegions';
import type { MapMarker, GeoPoint } from '../types';

interface MapViewProps {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  projectPin?: MapMarker;
  onMarkerClick?: (id: string) => void;
  onMapClick?: (lat: number, lng: number) => void;
  height?: string;
  fitBounds?: boolean;
  showRoute?: boolean;
  routeFrom?: GeoPoint;
  routeTo?: GeoPoint;
  className?: string;
  showRegions?: boolean;
  /** Active map layer id from MAP_LAYERS */
  activeLayer?: string;
  /** Radius circle around project pin (km) */
  radiusKm?: number;
}

export interface MapViewHandle {
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  fitAllBounds: () => void;
  toggleFullscreen: () => void;
  isFullscreen: boolean;
}

// ---------------------------------------------------------------------------
// Marker helpers
// ---------------------------------------------------------------------------

function createMarkerIcon(color: string, isProject = false): L.DivIcon {
  const size = isProject ? 40 : 28;
  return L.divIcon({
    className: 'custom-map-marker',
    html: `<div style="background:${color};width:${size}px;height:${size}px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
      ${isProject ? '<span class="material-symbols-outlined" style="color:white;font-size:20px;">construction</span>' : ''}
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function buildPopupContent(marker: MapMarker): string {
  let html = `<div style="min-width:160px;">`;
  html += `<strong style="font-size:14px;">${marker.label}</strong>`;
  if (marker.specialization?.length) {
    html += `<div style="margin-top:4px;font-size:12px;color:#6B7280;">${marker.specialization.join(', ')}</div>`;
  }
  if (marker.rating != null) {
    const stars = '★'.repeat(Math.round(marker.rating)) + '☆'.repeat(5 - Math.round(marker.rating));
    html += `<div style="margin-top:4px;font-size:13px;color:#F59E0B;">${stars} <span style="color:#6B7280;">${marker.rating.toFixed(1)}</span></div>`;
  }
  html += `</div>`;
  return html;
}

function createRegionLabelIcon(name: string): L.DivIcon {
  return L.divIcon({
    className: 'region-label-marker',
    html: `<div style="
      font-size:11px;font-weight:600;color:rgba(100,116,139,0.7);
      text-shadow:0 1px 2px rgba(255,255,255,0.8);
      white-space:nowrap;pointer-events:none;
      font-family:system-ui,sans-serif;letter-spacing:0.05em;
      text-transform:uppercase;
    ">${name}</div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

// ---------------------------------------------------------------------------
// MapView Component
// ---------------------------------------------------------------------------

export const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView(
  {
    center,
    zoom,
    markers = [],
    projectPin,
    onMarkerClick,
    onMapClick,
    height = '400px',
    fitBounds = false,
    showRoute = false,
    routeFrom,
    routeTo,
    className = '',
    showRegions = false,
    activeLayer = 'standard',
    radiusKm,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.MarkerClusterGroup | null>(null);
  const projectLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const regionsLayerRef = useRef<L.LayerGroup | null>(null);
  const radiusCircleRef = useRef<L.Circle | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const tileConfigRef = useRef<TileConfig | null>(null);

  const { theme } = useTheme();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  const getLayerUrl = useCallback(
    (layerId: string): string | null => {
      const config = tileConfigRef.current;
      if (!config) return null;
      // Use layers map from proxy when available
      if (config.layers[layerId]) return config.layers[layerId];
      // Fallback: derive URL from base
      const layerDef = MAP_LAYERS.find(l => l.id === layerId);
      if (!layerDef) return config.tileUrl;
      return config.tileUrl.replace('/basic/', `/${layerDef.urlKey}/`);
    },
    [],
  );

  const fitAllBoundsHelper = useCallback(() => {
    if (!mapRef.current) return;
    const allPoints: [number, number][] = [];
    markers.forEach((m) => allPoints.push([m.position.lat, m.position.lng]));
    if (projectPin) allPoints.push([projectPin.position.lat, projectPin.position.lng]);
    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      mapRef.current.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [markers, projectPin]);

  // -----------------------------------------------------------------------
  // Imperative handle
  // -----------------------------------------------------------------------

  useImperativeHandle(
    ref,
    () => ({
      flyTo: (lat: number, lng: number, z?: number) => {
        mapRef.current?.flyTo([lat, lng], z ?? 14, { duration: 1 });
      },
      fitAllBounds: fitAllBoundsHelper,
      toggleFullscreen: () => {
        const el = containerRef.current?.closest('[data-map-root]') as HTMLElement | null;
        if (!el) return;
        if (!document.fullscreenElement) {
          el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
        } else {
          document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
        }
      },
      isFullscreen,
    }),
    [fitAllBoundsHelper, isFullscreen],
  );

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // -----------------------------------------------------------------------
  // Init map
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    const mapCenter = center ?? MAPS_CONFIG.defaultCenter;
    const mapZoom = zoom ?? MAPS_CONFIG.defaultZoom;

    const map = L.map(containerRef.current, {
      center: mapCenter,
      zoom: mapZoom,
      maxZoom: 19,
      zoomControl: false, // We use custom controls
      attributionControl: true,
    });

    // Add zoom control at bottom-right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapyApiService.getTileConfig().then((config) => {
      if (cancelled) return;
      tileConfigRef.current = config;
      const url = config.layers[activeLayer] ?? (isDark ? config.darkTileUrl : config.tileUrl);
      const tile = L.tileLayer(url, {
        attribution: '© Seznam.cz, a.s.',
        maxZoom: 19,
      }).addTo(map);
      tileLayerRef.current = tile;
    }).catch(() => {
      if (cancelled) return;
      const tile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);
      tileLayerRef.current = tile;
    });

    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
    });
    map.addLayer(clusterGroup);
    markersLayerRef.current = clusterGroup;

    const projectLayer = L.layerGroup().addTo(map);
    projectLayerRef.current = projectLayer;

    const regionsLayer = L.layerGroup();
    regionsLayerRef.current = regionsLayer;

    if (onMapClick) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });
    }

    mapRef.current = map;
    setIsReady(true);

    return () => {
      cancelled = true;
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
      projectLayerRef.current = null;
      tileLayerRef.current = null;
      routeLayerRef.current = null;
      regionsLayerRef.current = null;
      radiusCircleRef.current = null;
      setIsReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------------------------------------------------
  // Layer switching
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current || !isReady) return;
    const url = getLayerUrl(activeLayer);
    if (url) tileLayerRef.current.setUrl(url);
  }, [activeLayer, isReady, getLayerUrl]);

  // Also handle dark mode fallback for standard layer
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current || !tileConfigRef.current || !isReady) return;
    if (activeLayer === 'standard') {
      const url = isDark
        ? (tileConfigRef.current.layers.outdoor ?? tileConfigRef.current.darkTileUrl)
        : (tileConfigRef.current.layers.standard ?? tileConfigRef.current.tileUrl);
      tileLayerRef.current.setUrl(url);
    }
  }, [isDark, activeLayer, isReady]);

  // -----------------------------------------------------------------------
  // Center/zoom
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!mapRef.current || !isReady) return;
    if (center) mapRef.current.setView(center, zoom ?? mapRef.current.getZoom());
  }, [center, zoom, isReady]);

  // -----------------------------------------------------------------------
  // Subcontractor markers
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!markersLayerRef.current || !isReady) return;
    markersLayerRef.current.clearLayers();

    const subMarkers = markers.filter((m) => m.type === 'subcontractor');
    subMarkers.forEach((m) => {
      const icon = createMarkerIcon(m.color || '#6B7280');
      const leafletMarker = L.marker([m.position.lat, m.position.lng], { icon });
      leafletMarker.bindPopup(buildPopupContent(m));
      if (onMarkerClick) {
        leafletMarker.on('click', () => onMarkerClick(m.id));
      }
      markersLayerRef.current!.addLayer(leafletMarker);
    });
  }, [markers, isReady, onMarkerClick]);

  // -----------------------------------------------------------------------
  // Project pin
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!projectLayerRef.current || !isReady) return;
    projectLayerRef.current.clearLayers();

    if (projectPin) {
      const icon = createMarkerIcon(projectPin.color || '#EF4444', true);
      const leafletMarker = L.marker([projectPin.position.lat, projectPin.position.lng], { icon });
      leafletMarker.bindPopup(buildPopupContent(projectPin));
      if (onMarkerClick) {
        leafletMarker.on('click', () => onMarkerClick(projectPin.id));
      }
      projectLayerRef.current.addLayer(leafletMarker);
    }
  }, [projectPin, isReady, onMarkerClick]);

  // -----------------------------------------------------------------------
  // Fit bounds
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!mapRef.current || !isReady || !fitBounds) return;
    const allPoints: [number, number][] = [];
    markers.forEach((m) => allPoints.push([m.position.lat, m.position.lng]));
    if (projectPin) allPoints.push([projectPin.position.lat, projectPin.position.lng]);
    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      mapRef.current.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [markers, projectPin, fitBounds, isReady]);

  // -----------------------------------------------------------------------
  // Route polyline
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!mapRef.current || !isReady) return;
    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }
    if (showRoute && routeFrom && routeTo) {
      const polyline = L.polyline(
        [[routeFrom.lat, routeFrom.lng], [routeTo.lat, routeTo.lng]],
        { color: '#3B82F6', weight: 4, opacity: 0.7, dashArray: '8, 8' },
      ).addTo(mapRef.current);
      routeLayerRef.current = polyline;
    }
  }, [showRoute, routeFrom, routeTo, isReady]);

  // -----------------------------------------------------------------------
  // Radius circle
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!mapRef.current || !isReady) return;
    if (radiusCircleRef.current) {
      radiusCircleRef.current.remove();
      radiusCircleRef.current = null;
    }
    if (radiusKm && projectPin) {
      const circle = L.circle(
        [projectPin.position.lat, projectPin.position.lng],
        {
          radius: radiusKm * 1000,
          color: '#3B82F6',
          fillColor: '#3B82F6',
          fillOpacity: 0.06,
          weight: 2,
          opacity: 0.4,
          dashArray: '6, 6',
          interactive: false,
        },
      ).addTo(mapRef.current);
      radiusCircleRef.current = circle;
    }
  }, [radiusKm, projectPin, isReady]);

  // -----------------------------------------------------------------------
  // Region boundaries
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!mapRef.current || !regionsLayerRef.current || !isReady) return;
    regionsLayerRef.current.clearLayers();

    if (showRegions) {
      regionsLayerRef.current.addTo(mapRef.current);
      CZECH_REGIONS.forEach((region) => {
        const polygon = L.polygon(region.boundary, {
          color: isDark ? 'rgba(148,163,184,0.4)' : 'rgba(100,116,139,0.3)',
          fillColor: isDark ? 'rgba(148,163,184,0.05)' : 'rgba(100,116,139,0.04)',
          weight: 1.5,
          dashArray: '4, 4',
          interactive: false,
        });
        regionsLayerRef.current!.addLayer(polygon);

        const labelIcon = createRegionLabelIcon(region.name);
        const labelMarker = L.marker(region.center, { icon: labelIcon, interactive: false });
        regionsLayerRef.current!.addLayer(labelMarker);
      });
    } else {
      mapRef.current.removeLayer(regionsLayerRef.current);
    }
  }, [showRegions, isReady, isDark]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className={`relative ${className}`} style={{ height }}>
      {!isReady && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-xl">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <span className="material-symbols-outlined animate-spin">progress_activity</span>
            <span>Načítání mapy…</span>
          </div>
        </div>
      )}
      <div ref={containerRef} className="h-full w-full rounded-xl overflow-hidden" style={{ isolation: 'isolate' }} />
    </div>
  );
});
