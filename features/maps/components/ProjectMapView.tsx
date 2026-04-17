import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { Subcontractor, ProjectDetails, StatusConfig } from '@/types';
import type { GeoPoint, MapMarker } from '../types';
import { useNearbySubcontractors } from '../hooks/useNearbySubcontractors';
import { useGeocode } from '../hooks/useGeocode';
import { useRoute } from '../hooks/useRoute';
import { useNearbyRoutes } from '../hooks/useNearbyRoutes';
import { MapView } from './MapView';
import type { MapViewHandle } from './MapView';
import { MapLegend } from './MapLegend';
import { MapInfoCard } from './MapInfoCard';
import { MapControls } from './MapControls';
import { MapLayerSwitcher } from './MapLayerSwitcher';
import { MapNearbyPanel } from './MapNearbyPanel';
import { MapRoutePanel } from './MapRoutePanel';
import { useFeatures } from '@/context/FeatureContext';
import { FEATURES } from '@/config/features';
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
  const [showLabels, setShowLabels] = useState(false);
  const [showLabelSpecialization, setShowLabelSpecialization] = useState(false);
  const [specDropdownOpen, setSpecDropdownOpen] = useState(false);
  const [specSearch, setSpecSearch] = useState('');
  const [companyQuery, setCompanyQuery] = useState('');
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const [highlightedContact, setHighlightedContact] = useState<Subcontractor | null>(null);

  const { geocodeProject } = useGeocode();
  const { hasFeature } = useFeatures();
  const canUseRouting = hasFeature(FEATURES.MAPS_ROUTING);
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

  const routeEnabled = canUseRouting && !!projectPosition && !!selectedSubPosition;
  const { route, isLoading: routeLoading, error: routeError } = useRoute(
    routeEnabled ? projectPosition : null,
    routeEnabled ? selectedSubPosition : null,
    routeEnabled,
  );

  const nearbyRouteTargets = useMemo(
    () =>
      nearby
        .filter(s => s.latitude != null && s.longitude != null)
        .map(s => ({ id: s.id, position: { lat: s.latitude!, lng: s.longitude! } })),
    [nearby],
  );
  const { routes: nearbyRoutes, isLoading: nearbyRoutesLoading } = useNearbyRoutes(
    canUseRouting ? projectPosition : null,
    nearbyRouteTargets,
    canUseRouting,
  );

  const handleSubClick = useCallback((id: string) => {
    setSelectedSubId(prev => prev === id ? null : id);
  }, []);

  const handleSpecToggle = useCallback((spec: string) => {
    setSpecFilter(prev =>
      prev.includes(spec) ? prev.filter(s => s !== spec) : [...prev, spec]
    );
  }, []);

  // Diacritic-insensitive specialization filter for search-in-dropdown
  const filteredSpecializations = useMemo(() => {
    const q = specSearch.trim();
    if (!q) return allSpecializations;
    const normalize = (s: string) =>
      s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const tokens = normalize(q).split(/[\s.,;]+/).filter(Boolean);
    if (tokens.length === 0) return allSpecializations;
    return allSpecializations.filter(spec => {
      const n = normalize(spec);
      return tokens.every(t => n.includes(t));
    });
  }, [allSpecializations, specSearch]);

  // Company search — searches across all contacts regardless of filters
  const companyMatches = useMemo(() => {
    const q = companyQuery.trim().toLowerCase();
    if (q.length < 2) return [] as Subcontractor[];
    return contacts
      .filter(c => {
        const haystack = [
          c.company,
          c.ico,
          c.address,
          c.city,
          c.region,
          ...(c.regions ?? []),
          ...(c.specialization ?? []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 8);
  }, [contacts, companyQuery]);

  const handleCompanySelect = useCallback((contact: Subcontractor) => {
    setCompanyDropdownOpen(false);
    setCompanyQuery(contact.company);
    if (contact.latitude != null && contact.longitude != null) {
      setHighlightedContact(contact);
      mapRef.current?.flyTo(contact.latitude, contact.longitude, 13);
    } else {
      setHighlightedContact(null);
    }
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
    <div className="flex flex-col h-full" data-map-root>
      {/* Top bar with filters */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0 relative z-[1002]">
        {/* Specialization multi-select with search */}
        <div className="relative">
          <button
            onClick={() => setSpecDropdownOpen(!specDropdownOpen)}
            className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">filter_list</span>
            Specializace
            {specFilter.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                {specFilter.length}
              </span>
            )}
          </button>
          {specDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden flex flex-col">
              <div className="p-2 border-b border-slate-200 dark:border-slate-700">
                <div className="relative">
                  <span className="material-symbols-outlined text-sm text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">search</span>
                  <input
                    type="text"
                    value={specSearch}
                    onChange={(e) => setSpecSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        if (specSearch) setSpecSearch(''); else setSpecDropdownOpen(false);
                      }
                    }}
                    autoFocus
                    placeholder="Hledat specializaci…"
                    className="w-full text-xs pl-7 pr-7 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                  />
                  {specSearch && (
                    <button
                      onClick={() => setSpecSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      aria-label="Vymazat"
                    >
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  )}
                </div>
              </div>
              <div className="max-h-60 overflow-y-auto">
                {allSpecializations.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-400">Žádné specializace</div>
                ) : filteredSpecializations.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-400">Žádné výsledky</div>
                ) : (
                  filteredSpecializations.map(spec => (
                    <label
                      key={spec}
                      className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer text-xs text-slate-700 dark:text-slate-300"
                    >
                      <input
                        type="checkbox"
                        checked={specFilter.includes(spec)}
                        onChange={() => handleSpecToggle(spec)}
                        className="rounded border-slate-300 dark:border-slate-600"
                      />
                      {spec}
                    </label>
                  ))
                )}
              </div>
              {specFilter.length > 0 && (
                <button
                  onClick={() => setSpecFilter([])}
                  className="w-full text-xs px-3 py-1.5 text-blue-600 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700 border-t border-slate-200 dark:border-slate-700"
                >
                  Zrušit filtr ({specFilter.length})
                </button>
              )}
            </div>
          )}
        </div>

        {/* Region select */}
        <select
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          className="text-xs px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
        >
          <option value="">Všechny regiony</option>
          {allRegions.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        {/* Labels toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={showLabels}
          onClick={() => setShowLabels(prev => !prev)}
          className="ml-auto flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer select-none order-last"
        >
          <span className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${showLabels ? 'bg-blue-500 dark:bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${showLabels ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
          </span>
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">label</span>
            Názvy firem
          </span>
        </button>
        <button
          type="button"
          role="switch"
          aria-checked={showLabelSpecialization}
          onClick={() => setShowLabelSpecialization(prev => !prev)}
          className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer select-none order-last"
        >
          <span className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${showLabelSpecialization ? 'bg-blue-500 dark:bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${showLabelSpecialization ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
          </span>
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">category</span>
            Specializace
          </span>
        </button>

        {/* Company / address search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <span className="material-symbols-outlined text-sm text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">search</span>
          <input
            type="text"
            value={companyQuery}
            onChange={(e) => {
              setCompanyQuery(e.target.value);
              setCompanyDropdownOpen(e.target.value.trim().length >= 2);
            }}
            onFocus={() => {
              if (companyQuery.trim().length >= 2) setCompanyDropdownOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && companyMatches.length > 0) {
                e.preventDefault();
                handleCompanySelect(companyMatches[0]);
              } else if (e.key === 'Escape') {
                setCompanyDropdownOpen(false);
              }
            }}
            placeholder="Hledat firmu, IČO, město…"
            className="w-full text-xs pl-8 pr-7 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
          />
          {companyQuery && (
            <button
              onClick={() => {
                setCompanyQuery('');
                setCompanyDropdownOpen(false);
                setHighlightedContact(null);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              aria-label="Vymazat"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          )}
          {companyDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 max-h-72 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
              {companyMatches.length === 0 ? (
                <div className="px-3 py-2 text-xs text-slate-400">Žádné výsledky</div>
              ) : (
                companyMatches.map(c => {
                  const hasCoords = c.latitude != null && c.longitude != null;
                  return (
                    <button
                      key={c.id}
                      onMouseDown={(e) => { e.preventDefault(); handleCompanySelect(c); }}
                      className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 text-xs border-b border-slate-100 dark:border-slate-700/50 last:border-b-0"
                    >
                      <span
                        className={`material-symbols-outlined text-sm mt-0.5 shrink-0 ${hasCoords ? 'text-blue-500' : 'text-slate-300 dark:text-slate-600'}`}
                        title={hasCoords ? 'Na mapě' : 'Bez geokódování'}
                      >
                        {hasCoords ? 'location_on' : 'location_off'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-slate-900 dark:text-white truncate">{c.company}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {[c.city, c.region, c.ico].filter(Boolean).join(' · ')}
                        </div>
                        {c.specialization && c.specialization.length > 0 && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                            {c.specialization.join(', ')}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {specDropdownOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setSpecDropdownOpen(false)} />
      )}
      {companyDropdownOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setCompanyDropdownOpen(false)} />
      )}

      <div className="relative flex-1">
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
        routeGeometry={route?.geometry}
        showRegions={showRegions}
        activeLayer={activeLayer}
        radiusKm={hasCoordinates ? radiusKm : undefined}
        disableClustering
        showLabels={showLabels}
        showLabelSpecialization={showLabelSpecialization}
        labelZoomThreshold={0}
        highlightedPin={
          highlightedContact && highlightedContact.latitude != null && highlightedContact.longitude != null
            ? {
                lat: highlightedContact.latitude,
                lng: highlightedContact.longitude,
                label: highlightedContact.company,
                specialization: highlightedContact.specialization,
                rating: highlightedContact.vendorRatingAverage,
              }
            : null
        }
      />

      {/* ============ OVERLAY SYSTEM ============ */}

      {/* TOP LEFT: Radius + stats card */}
      <div className="absolute top-3 left-3 z-[1000] flex flex-col gap-2">
        <div className="rounded-xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 shadow-lg px-3 py-2.5 w-56">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">radar</span>
              Vzdálenost
            </span>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 tabular-nums bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
              {radiusKm} km
            </span>
          </div>
          <input
            type="range"
            min={5}
            max={200}
            step={5}
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-slate-200 dark:bg-slate-600 accent-blue-500"
          />
          <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-xs text-blue-500">visibility</span>
              <span className="font-semibold text-slate-900 dark:text-white">{nearby.length}</span> viditelných
            </span>
            <span className="text-slate-400 dark:text-slate-500">{geocodedCount}/{totalCount}</span>
          </div>
        </div>
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
          routeByContactId={nearbyRoutes}
          routesLoading={nearbyRoutesLoading}
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

      {/* BOTTOM RIGHT: Info card + route panel (when selected) */}
      {selectedContact && (
        <div className="absolute bottom-3 right-3 z-[1000] flex flex-col items-end gap-2">
          {canUseRouting && selectedSubPosition && projectPosition && (
            <MapRoutePanel
              distanceMeters={route?.distance}
              durationSeconds={route?.duration}
              isLoading={routeLoading}
              error={routeError ? 'Trasu se nepodařilo načíst' : null}
              targetLabel={selectedContact.company}
            />
          )}
          <MapInfoCard
            contact={selectedContact}
            distanceKm={selectedSub?.distanceKm}
            onClose={() => setSelectedSubId(null)}
          />
        </div>
      )}
      </div>
    </div>
  );
}
