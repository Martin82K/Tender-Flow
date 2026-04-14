import { useRef, useEffect, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import { MAPS_CONFIG, MAP_LAYERS } from '@/config/maps';
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
  /** Highlighted location (e.g. search result) — shown as distinctive flag pin with pulsing ring */
  highlightedPin?: {
    lat: number;
    lng: number;
    label?: string;
    specialization?: string[];
    rating?: number;
  } | null;
  /** Disable marker clustering (show each marker individually) */
  disableClustering?: boolean;
  /** Show company labels as tooltips when zoom >= labelZoomThreshold */
  showLabels?: boolean;
  /** Include specialization (subtitle line) in the label tooltip */
  showLabelSpecialization?: boolean;
  /** Zoom level at which permanent labels appear (default 11) */
  labelZoomThreshold?: number;
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

function buildPopupContent(marker: MapMarker): HTMLDivElement {
  const container = document.createElement('div');
  container.style.minWidth = '160px';

  const title = document.createElement('strong');
  title.style.fontSize = '14px';
  title.style.color = '#1E293B';
  title.textContent = marker.label;
  container.appendChild(title);

  if (marker.specialization?.length) {
    const specialization = document.createElement('div');
    specialization.style.marginTop = '4px';
    specialization.style.fontSize = '12px';
    specialization.style.color = '#475569';
    specialization.style.fontWeight = '500';
    specialization.textContent = marker.specialization.join(', ');
    container.appendChild(specialization);
  }

  if (marker.rating != null) {
    const rating = document.createElement('div');
    rating.style.marginTop = '4px';
    rating.style.fontSize = '13px';
    rating.style.color = '#F59E0B';

    const stars = '★'.repeat(Math.round(marker.rating)) + '☆'.repeat(5 - Math.round(marker.rating));
    rating.append(document.createTextNode(`${stars} `));

    const value = document.createElement('span');
    value.style.color = '#6B7280';
    value.textContent = marker.rating.toFixed(1);
    rating.appendChild(value);
    container.appendChild(rating);
  }

  return container;
}

function createHighlightIcon(
  label?: string,
  specialization?: string[],
  rating?: number,
): L.DivIcon {
  const escape = (s: string) => s.replace(/[<>&"]/g, '');
  const safeLabel = label ? escape(label) : '';
  const specText = specialization && specialization.length > 0
    ? escape(specialization.slice(0, 3).join(', ') + (specialization.length > 3 ? '…' : ''))
    : '';
  const ratingHtml = rating != null && rating > 0
    ? `<span style="display:inline-flex;align-items:center;gap:2px;margin-left:6px;padding:1px 5px;border-radius:10px;background:rgba(251,191,36,0.95);color:#78350F;font-weight:700;">
        <span style="font-size:10px;line-height:1;">★</span>
        <span style="font-size:9px;line-height:1;">${rating.toFixed(1)}</span>
       </span>`
    : '';
  const cardHtml = (safeLabel || specText)
    ? `<div style="position:absolute;left:50%;top:48px;transform:translateX(-50%);background:#EF4444;color:white;padding:4px 8px;border-radius:6px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.3);font-family:system-ui,sans-serif;max-width:240px;">
        ${safeLabel ? `<div style="display:flex;align-items:center;font-size:11px;font-weight:700;line-height:1.2;"><span style="overflow:hidden;text-overflow:ellipsis;">${safeLabel}</span>${ratingHtml}</div>` : ''}
        ${specText ? `<div style="font-size:10px;font-weight:500;line-height:1.2;opacity:0.92;margin-top:2px;overflow:hidden;text-overflow:ellipsis;">${specText}</div>` : ''}
      </div>`
    : '';
  return L.divIcon({
    className: 'highlight-map-marker',
    html: `
      <div style="position:relative;width:44px;height:56px;pointer-events:none;">
        <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:72px;height:72px;border-radius:50%;background:rgba(239,68,68,0.25);animation:tfPulse 1.6s ease-out infinite;"></div>
        <div style="position:absolute;left:50%;top:0;transform:translateX(-50%);width:44px;height:44px;border-radius:50% 50% 50% 0;transform-origin:center;background:#EF4444;border:3px solid #FFFFFF;box-shadow:0 4px 12px rgba(0,0,0,0.35);transform:translateX(-50%) rotate(-45deg);display:flex;align-items:center;justify-content:center;">
          <span class="material-symbols-outlined" style="color:white;font-size:22px;transform:rotate(45deg);">push_pin</span>
        </div>
        ${cardHtml}
      </div>
      <style>
        @keyframes tfPulse {
          0% { transform: translate(-50%,-50%) scale(0.6); opacity: 0.9; }
          100% { transform: translate(-50%,-50%) scale(1.6); opacity: 0; }
        }
      </style>
    `,
    iconSize: [44, 56],
    iconAnchor: [22, 44],
  });
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
    highlightedPin,
    disableClustering = false,
    showLabels = false,
    showLabelSpecialization = false,
    labelZoomThreshold = 11,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.MarkerClusterGroup | L.LayerGroup | null>(null);
  const projectLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const regionsLayerRef = useRef<L.LayerGroup | null>(null);
  const radiusCircleRef = useRef<L.Circle | null>(null);
  const highlightLayerRef = useRef<L.LayerGroup | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const tileConfigRef = useRef<TileConfig | null>(null);

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

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
        keepBuffer: 6,
        updateWhenIdle: true,
        updateWhenZooming: false,
        crossOrigin: 'anonymous',
      }).addTo(map);
      tileLayerRef.current = tile;
    }).catch(() => {
      if (cancelled) return;
      const tile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        keepBuffer: 6,
        updateWhenIdle: true,
        updateWhenZooming: false,
        crossOrigin: 'anonymous',
      }).addTo(map);
      tileLayerRef.current = tile;
    });

    const markersLayer = disableClustering
      ? L.layerGroup()
      : L.markerClusterGroup({
          maxClusterRadius: 50,
          spiderfyOnMaxZoom: true,
          showCoverageOnHover: false,
        });
    map.addLayer(markersLayer);
    markersLayerRef.current = markersLayer;

    const projectLayer = L.layerGroup().addTo(map);
    projectLayerRef.current = projectLayer;

    const regionsLayer = L.layerGroup();
    regionsLayerRef.current = regionsLayer;

    const highlightLayer = L.layerGroup().addTo(map);
    highlightLayerRef.current = highlightLayer;

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
      highlightLayerRef.current = null;
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
    const anyLabel = showLabels || showLabelSpecialization;
    const isPermanent = anyLabel && (mapRef.current?.getZoom() ?? 0) >= labelZoomThreshold;
    const escape = (s: string) => s.replace(/[<>&"]/g, '');
    subMarkers.forEach((m) => {
      const icon = createMarkerIcon(m.color || '#6B7280');
      const leafletMarker = L.marker([m.position.lat, m.position.lng], { icon });
      leafletMarker.bindPopup(buildPopupContent(m));
      if (anyLabel) {
        const ratingHtml = showLabels && m.rating != null && m.rating > 0
          ? `<span style="color:#F59E0B;margin-left:4px;">★${m.rating.toFixed(1)}</span>`
          : '';
        const nameHtml = showLabels
          ? `<div style="font-weight:600;">${escape(m.label || '')}${ratingHtml}</div>`
          : '';
        const specHtml = showLabelSpecialization && m.specialization && m.specialization.length > 0
          ? `<div style="font-size:10px;font-weight:500;opacity:0.85;">${escape(m.specialization.slice(0, 3).join(', ') + (m.specialization.length > 3 ? '…' : ''))}</div>`
          : '';
        if (nameHtml || specHtml) {
          leafletMarker.bindTooltip(
            `${nameHtml}${specHtml}`,
            {
              permanent: isPermanent,
              direction: 'top',
              offset: [0, -14],
              className: 'tf-marker-label',
              opacity: 1,
            },
          );
        }
      }
      if (onMarkerClick) {
        leafletMarker.on('click', () => onMarkerClick(m.id));
      }
      markersLayerRef.current!.addLayer(leafletMarker);
    });
  }, [markers, isReady, onMarkerClick, showLabels, showLabelSpecialization, labelZoomThreshold]);

  // -----------------------------------------------------------------------
  // Toggle permanent labels on zoom
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!mapRef.current || !isReady || (!showLabels && !showLabelSpecialization)) return;
    const map = mapRef.current;

    const rebind = () => {
      const layer = markersLayerRef.current;
      if (!layer) return;
      const isPermanent = map.getZoom() >= labelZoomThreshold;
      layer.eachLayer((l) => {
        const marker = l as L.Marker;
        const tooltip = marker.getTooltip?.();
        if (!tooltip) return;
        if (tooltip.options.permanent !== isPermanent) {
          const content = tooltip.getContent();
          marker.unbindTooltip();
          marker.bindTooltip(content as string, {
            permanent: isPermanent,
            direction: 'top',
            offset: [0, -14],
            className: 'tf-marker-label',
            opacity: 1,
          });
        }
      });
    };

    map.on('zoomend', rebind);
    rebind();
    return () => { map.off('zoomend', rebind); };
  }, [isReady, showLabels, showLabelSpecialization, labelZoomThreshold, markers]);

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
          color: '#1E40AF',
          fillColor: '#1E3A8A',
          fillOpacity: 0.10,
          weight: 2.5,
          opacity: 0.7,
          dashArray: '8, 6',
          interactive: false,
        },
      ).addTo(mapRef.current);
      radiusCircleRef.current = circle;
    }
  }, [radiusKm, projectPin, isReady]);

  // -----------------------------------------------------------------------
  // Highlight pin (e.g. from company search)
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!highlightLayerRef.current || !isReady) return;
    highlightLayerRef.current.clearLayers();
    if (highlightedPin) {
      const marker = L.marker(
        [highlightedPin.lat, highlightedPin.lng],
        {
          icon: createHighlightIcon(highlightedPin.label, highlightedPin.specialization, highlightedPin.rating),
          interactive: false,
          zIndexOffset: 1000,
        },
      );
      highlightLayerRef.current.addLayer(marker);
    }
  }, [highlightedPin, isReady]);

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
      <style>{`
        .leaflet-tooltip.tf-marker-label {
          background: rgba(255,255,255,0.95);
          color: #0F172A;
          border: 1px solid rgba(15,23,42,0.12);
          border-radius: 6px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
          font-size: 11px;
          font-weight: 600;
          padding: 2px 6px;
          white-space: nowrap;
        }
        .leaflet-tooltip.tf-marker-label::before { display: none; }
        .dark .leaflet-tooltip.tf-marker-label {
          background: rgba(30,41,59,0.95);
          color: #F8FAFC;
          border-color: rgba(148,163,184,0.25);
        }
      `}</style>
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
