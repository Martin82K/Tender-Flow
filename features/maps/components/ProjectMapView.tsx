import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { Subcontractor, ProjectDetails, StatusConfig } from '@/types';
import type { GeoPoint, MapMarker } from '../types';
import { useNearbySubcontractors } from '../hooks/useNearbySubcontractors';
import { useGeocode } from '../hooks/useGeocode';
import { MapView } from './MapView';
import type { MapViewHandle } from './MapView';
import { MapLegend } from './MapLegend';
import { MapSearchOverlay } from './MapSearchOverlay';
import { MapInfoCard } from './MapInfoCard';
import { MapControls } from './MapControls';
import { MapLayerSwitcher } from './MapLayerSwitcher';
import { MapFilterPanel } from './MapFilterPanel';
import { MapNearbyPanel } from './MapNearbyPanel';
import { buildDynamicColorMap, getDynamicMarkerColor } from '../utils/markerColors';

interface ProjectMapViewProps {
  projectId: string;
  projectDetails: ProjectDetails;
  contacts: Subcontractor[];
  statuses?: StatusConfig[];
  onUpdateDetails?: (updates: Partial<ProjectDetails>) => void;
  onAddBid?: (categoryId: string, subcontractorId: string) => void;
}

export function ProjectMapView({
  projectId,
  projectDetails,
  contacts,
  statuses = [],
  onUpdateDetails,
  onAddBid,
}: ProjectMapViewProps) {
  const mapRef = useRef<MapViewHandle>(null);
  const [radiusKm, setRadiusKm] = useState(50);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [highlightedSubId, setHighlightedSubId] = useState<string | null>(null);
  const [showRegions, setShowRegions] = useState(false);
  const [activeLayer, setActiveLayer] = useState('standard');
  const [specFilter, setSpecFilter] = useState<string[]>([]);
  const [regionFilter, setRegionFilter] = useState('');

  const { geocodeProject } = useGeocode();
  const geocodeAttemptedRef = useRef<string | null>(null);

  const projectPosition: GeoPoint | null = useMemo(() => {
    if (projectDetails.latitude != null && projectDetails.longitude != null) {
      return { lat: projectDetails.latitude, lng: projectDetails.longitude };
    }
    return null;
  }, [projectDetails.latitude, projectDetails.longitude]);

  // Auto-geocode project address when it has address/location but no coordinates
  useEffect(() => {
    const addressKey = `${projectDetails.address || ''}|${projectDetails.location || ''}`;
    if (
      projectPosition == null &&
      (projectDetails.address || projectDetails.location) &&
      onUpdateDetails &&
      geocodeAttemptedRef.current !== addressKey
    ) {
      geocodeAttemptedRef.current = addressKey;
      let cancelled = false;
      geocodeProject(projectDetails).then(result => {
        if (cancelled || !result) return;
        onUpdateDetails({
          latitude: result.lat,
          longitude: result.lng,
          geocodedAt: new Date().toISOString(),
        });
      });
      return () => { cancelled = true; };
    }
  }, [projectDetails.address, projectDetails.location, projectPosition, onUpdateDetails, geocodeProject]);

  const { nearby: allNearby, geocodedCount, totalCount } = useNearbySubcontractors(
    projectPosition,
    contacts,
    radiusKm,
  );

  // Apply filters
  const nearby = useMemo(() => {
    return allNearby.filter(sub => {
      if (specFilter.length > 0) {
        if (!sub.specialization?.some(s => specFilter.includes(s))) return false;
      }
      if (regionFilter) {
        if (sub.region !== regionFilter && !sub.regions?.includes(regionFilter)) return false;
      }
      return true;
    });
  }, [allNearby, specFilter, regionFilter]);

  // All specializations & regions from contacts
  const allSpecializations = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach(c => c.specialization?.forEach(s => set.add(s)));
    return Array.from(set).sort();
  }, [contacts]);

  const allRegions = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach(c => {
      if (c.region) set.add(c.region);
      c.regions?.forEach(r => set.add(r));
    });
    return Array.from(set).sort();
  }, [contacts]);

  // Specialization counts for visible markers
  const specializationCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    nearby.forEach(sub => {
      sub.specialization?.forEach((s: string) => {
        counts[s] = (counts[s] || 0) + 1;
      });
    });
    return counts;
  }, [nearby]);

  // Dynamic color map — each selected specialization gets a unique color
  const colorMap = useMemo(() => buildDynamicColorMap(specFilter), [specFilter]);

  // Build markers with dynamic colors
  const markers = useMemo<MapMarker[]>(() =>
    nearby.map(s => ({
      id: s.id,
      position: { lat: s.latitude!, lng: s.longitude! },
      label: s.company,
      type: 'subcontractor' as const,
      color: s.id === highlightedSubId || s.id === selectedSubId
        ? '#3B82F6'
        : specFilter.length > 0
          ? getDynamicMarkerColor(s.specialization || [], colorMap)
          : undefined,
      specialization: s.specialization,
      rating: s.vendorRatingAverage,
      status: s.status,
    })),
  [nearby, highlightedSubId, selectedSubId, specFilter, colorMap]);

  // Project pin
  const projectPin: MapMarker | null = useMemo(() => {
    if (!projectPosition) return null;
    return {
      id: projectId,
      position: projectPosition,
      label: projectDetails.title,
      type: 'project' as const,
      color: '#EF4444',
    };
  }, [projectPosition, projectId, projectDetails.title]);

  // Selected sub data
  const selectedSub = useMemo(() =>
    nearby.find(s => s.id === selectedSubId),
  [nearby, selectedSubId]);

  const selectedSubPosition: GeoPoint | undefined = useMemo(() => {
    if (!selectedSub || selectedSub.latitude == null || selectedSub.longitude == null) return undefined;
    return { lat: selectedSub.latitude, lng: selectedSub.longitude };
  }, [selectedSub]);

  const selectedContact = useMemo(() =>
    selectedSubId ? contacts.find(c => c.id === selectedSubId) : null,
  [contacts, selectedSubId]);

  const handleSubClick = useCallback((id: string) => {
    setSelectedSubId(prev => prev === id ? null : id);
  }, []);

  const handleSpecToggle = useCallback((spec: string) => {
    setSpecFilter(prev =>
      prev.includes(spec) ? prev.filter(s => s !== spec) : [...prev, spec]
    );
  }, []);

  const hasCoordinates = projectPosition != null;
  const hasTextAddress = !!(projectDetails.address || projectDetails.location);
  const [showAddressInput, setShowAddressInput] = useState(false);
  const [addressInput, setAddressInput] = useState(projectDetails.address || projectDetails.location || '');
  const [isGeocoding, setIsGeocoding] = useState(false);

  const handleSetAddress = useCallback(async () => {
    if (!onUpdateDetails) return;
    const addr = addressInput.trim() || projectDetails.address || projectDetails.location || '';
    if (!addr) return;
    setIsGeocoding(true);
    try {
      const result = await geocodeProject({ ...projectDetails, address: addr, latitude: undefined, longitude: undefined } as ProjectDetails);
      const updates: Partial<ProjectDetails> = {};
      // Only update address field if user typed something new
      if (addressInput.trim() && addressInput.trim() !== projectDetails.address) {
        updates.address = addressInput.trim();
      }
      if (result) {
        updates.latitude = result.lat;
        updates.longitude = result.lng;
        updates.geocodedAt = new Date().toISOString();
      }
      if (Object.keys(updates).length > 0) {
        onUpdateDetails(updates);
      }
      setShowAddressInput(false);
    } finally {
      setIsGeocoding(false);
    }
  }, [addressInput, onUpdateDetails, geocodeProject, projectDetails]);

  return (
    <div className="relative h-full" data-map-root>
      {/* Warning: no coordinates — either missing address or needs geocoding */}
      {!hasCoordinates && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1001] flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50/95 dark:bg-amber-900/80 backdrop-blur-sm border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs shadow-lg max-w-lg">
          <span className="material-symbols-outlined text-base shrink-0">warning</span>
          {!showAddressInput ? (
            <>
              <span>
                {hasTextAddress
                  ? `Adresa „${projectDetails.address || projectDetails.location}" nebyla dosud geokódována.`
                  : 'Stavba nemá přesnou adresu. Nastavte ji pro zobrazení subdodavatelů na mapě.'}
              </span>
              {onUpdateDetails && hasTextAddress && (
                <button
                  onClick={handleSetAddress}
                  disabled={isGeocoding}
                  className="shrink-0 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50"
                >
                  {isGeocoding ? 'Geokóduji...' : 'Geokódovat'}
                </button>
              )}
              {onUpdateDetails && !hasTextAddress && (
                <button
                  onClick={() => setShowAddressInput(true)}
                  className="shrink-0 px-3 py-1 rounded-lg bg-amber-200 dark:bg-amber-800 hover:bg-amber-300 dark:hover:bg-amber-700 text-amber-900 dark:text-amber-200 font-medium transition-colors"
                >
                  Nastavit
                </button>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSetAddress()}
                placeholder="Zadejte adresu stavby..."
                autoFocus
                className="px-2 py-1 rounded-md text-xs bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-slate-900 dark:text-white w-64 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
              <button
                onClick={handleSetAddress}
                disabled={!addressInput.trim() || isGeocoding}
                className="shrink-0 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs transition-colors disabled:opacity-50"
              >
                {isGeocoding ? 'Hledám...' : 'Uložit'}
              </button>
              <button
                onClick={() => setShowAddressInput(false)}
                className="shrink-0 px-2 py-1 rounded-lg text-amber-800 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800 text-xs transition-colors"
              >
                Zrušit
              </button>
            </div>
          )}
        </div>
      )}

      {/* Full-bleed map */}
      <MapView
        ref={mapRef}
        markers={markers}
        projectPin={projectPin || undefined}
        onMarkerClick={handleSubClick}
        fitBounds={hasCoordinates}
        height="100%"
        className="h-full"
        showRoute={!!(selectedSubId && projectPosition && selectedSubPosition)}
        routeFrom={projectPosition || undefined}
        routeTo={selectedSubPosition}
        showRegions={showRegions}
        activeLayer={activeLayer}
        radiusKm={hasCoordinates ? radiusKm : undefined}
      />

      {/* ============ OVERLAY SYSTEM ============ */}

      {/* TOP LEFT: Search */}
      <div className="absolute top-3 left-3 z-[1000]">
        <MapSearchOverlay
          onFlyTo={(lat, lng, zoom) => mapRef.current?.flyTo(lat, lng, zoom)}
        />
      </div>

      {/* LEFT: Filter panel (below search) */}
      <div className="absolute top-16 left-3 z-[1000]">
        <MapFilterPanel
          specializations={allSpecializations}
          activeSpecs={specFilter}
          onSpecToggle={handleSpecToggle}
          onSpecsClear={() => setSpecFilter([])}
          onSpecsSelectAll={() => setSpecFilter([...allSpecializations])}
          colorMap={colorMap}
          regions={allRegions}
          activeRegion={regionFilter}
          onRegionChange={setRegionFilter}
          radiusKm={radiusKm}
          onRadiusChange={setRadiusKm}
          totalCount={totalCount}
          geocodedCount={geocodedCount}
          visibleCount={nearby.length}
        />
      </div>

      {/* TOP RIGHT: Controls only */}
      <div className="absolute top-3 right-3 z-[1000]">
        <MapControls
          onFitBounds={() => mapRef.current?.fitAllBounds()}
          onToggleRegions={() => setShowRegions(prev => !prev)}
          regionsVisible={showRegions}
          onToggleFullscreen={() => mapRef.current?.toggleFullscreen()}
          isFullscreen={mapRef.current?.isFullscreen ?? false}
        />
      </div>

      {/* RIGHT: Nearby panel (below controls) */}
      <div className="absolute top-40 right-3 z-[1000]">
        <MapNearbyPanel
          nearby={nearby}
          selectedId={selectedSubId}
          onSelect={handleSubClick}
          onHover={setHighlightedSubId}
          radiusKm={radiusKm}
        />
      </div>

      {/* BOTTOM RIGHT: Layer switcher (above zoom controls) */}
      <div className="absolute bottom-3 right-16 z-[1000]">
        <MapLayerSwitcher
          activeLayer={activeLayer}
          onLayerChange={setActiveLayer}
        />
      </div>

      {/* BOTTOM LEFT: Legend — only when specialization filters are active */}
      {specFilter.length > 0 && (
        <div className="absolute bottom-3 left-3 z-[1000]">
          <MapLegend compact activeSpecs={specFilter} colorMap={colorMap} counts={specializationCounts} />
        </div>
      )}

      {/* BOTTOM RIGHT: Info card (when selected) */}
      {selectedContact && (
        <div className="absolute bottom-3 right-3 z-[1000]">
          <MapInfoCard
            contact={selectedContact}
            distanceKm={selectedSub?.distanceKm}
            onClose={() => setSelectedSubId(null)}
          />
        </div>
      )}
    </div>
  );
}
