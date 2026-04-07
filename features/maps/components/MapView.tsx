import { useRef, useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import { MAPS_CONFIG } from '@/config/maps';
import { useTheme } from '@/hooks/useTheme';
import { mapyApiService } from '../services/mapyApiService';
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
}

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

export function MapView({
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
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.MarkerClusterGroup | null>(null);
  const projectLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [isReady, setIsReady] = useState(false);
  const tileConfigRef = useRef<{ tileUrl: string; darkTileUrl: string } | null>(null);

  const { theme } = useTheme();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    const mapCenter = center ?? MAPS_CONFIG.defaultCenter;
    const mapZoom = zoom ?? MAPS_CONFIG.defaultZoom;

    const map = L.map(containerRef.current, {
      center: mapCenter,
      zoom: mapZoom,
      zoomControl: true,
      attributionControl: true,
    });

    // Load tile config from proxy (API key stays server-side)
    mapyApiService.getTileConfig().then((config) => {
      if (cancelled) return;
      tileConfigRef.current = config;
      const url = isDark ? config.darkTileUrl : config.tileUrl;
      const tile = L.tileLayer(url, {
        attribution: '© Seznam.cz, a.s.',
        maxZoom: 19,
      }).addTo(map);
      tileLayerRef.current = tile;
    }).catch(() => {
      // Fallback: tiles without API key (may show watermark)
      if (cancelled) return;
      const tile = L.tileLayer(MAPS_CONFIG.tileUrl, {
        attribution: '© Seznam.cz, a.s.',
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
      setIsReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Switch tiles on theme change
  useEffect(() => {
    if (!mapRef.current || !tileLayerRef.current || !tileConfigRef.current) return;
    const url = isDark ? tileConfigRef.current.darkTileUrl : tileConfigRef.current.tileUrl;
    tileLayerRef.current.setUrl(url);
  }, [isDark]);

  // Update center/zoom
  useEffect(() => {
    if (!mapRef.current || !isReady) return;
    if (center) mapRef.current.setView(center, zoom ?? mapRef.current.getZoom());
  }, [center, zoom, isReady]);

  // Update subcontractor markers
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

  // Update project pin
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

  // Fit bounds
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

  // Route polyline
  useEffect(() => {
    if (!mapRef.current || !isReady) return;

    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }

    if (showRoute && routeFrom && routeTo) {
      const polyline = L.polyline(
        [
          [routeFrom.lat, routeFrom.lng],
          [routeTo.lat, routeTo.lng],
        ],
        { color: '#3B82F6', weight: 4, opacity: 0.7, dashArray: '8, 8' }
      ).addTo(mapRef.current);
      routeLayerRef.current = polyline;
    }
  }, [showRoute, routeFrom, routeTo, isReady]);

  return (
    <div className={`relative ${className}`} style={{ height }}>
      {!isReady && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded-xl">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <span className="material-symbols-outlined animate-spin">progress_activity</span>
            <span>Načítání mapy…</span>
          </div>
        </div>
      )}
      <div ref={containerRef} className="h-full w-full rounded-xl overflow-hidden" />
    </div>
  );
}
