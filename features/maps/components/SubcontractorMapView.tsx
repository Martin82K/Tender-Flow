import { useState, useMemo, useCallback, useRef } from 'react';
import type { Subcontractor, StatusConfig } from '@/types';
import type { MapMarker } from '../types';
import { getMarkerColor, buildDynamicColorMap, getDynamicMarkerColor } from '../utils/markerColors';
import { MapView } from './MapView';
import type { MapViewHandle } from './MapView';
import { MapLegend } from './MapLegend';
import { MapInfoCard } from './MapInfoCard';
import { MapControls } from './MapControls';
import { MapLayerSwitcher } from './MapLayerSwitcher';
import { BulkGeocodePanel } from './BulkGeocodePanel';

interface SubcontractorMapViewProps {
  contacts: Subcontractor[];
  statuses: StatusConfig[];
  onContactClick?: (contact: Subcontractor) => void;
  onBulkUpdateContacts?: (contacts: Subcontractor[]) => Promise<void> | void;
}

export function SubcontractorMapView({
  contacts,
  statuses,
  onContactClick,
  onBulkUpdateContacts,
}: SubcontractorMapViewProps) {
  const mapRef = useRef<MapViewHandle>(null);
  const [showGeocodePanel, setShowGeocodePanel] = useState(false);
  const [showRegions, setShowRegions] = useState(false);
  const [activeLayer, setActiveLayer] = useState('standard');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [specFilter, setSpecFilter] = useState<string[]>([]);
  const [regionFilter, setRegionFilter] = useState<string>('');
  const [specDropdownOpen, setSpecDropdownOpen] = useState(false);
  const [companyQuery, setCompanyQuery] = useState('');
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const [specSearch, setSpecSearch] = useState('');
  const [showLabels, setShowLabels] = useState(false);
  const [showLabelSpecialization, setShowLabelSpecialization] = useState(false);
  const [highlightedContact, setHighlightedContact] = useState<Subcontractor | null>(null);

  const handleGeocodesUpdated = useCallback((updates: Array<{ id: string; latitude: number; longitude: number; geocodedAt: string }>) => {
    if (!onBulkUpdateContacts) return;
    const updatedContacts = updates.map(u => {
      const existing = contacts.find(c => c.id === u.id);
      if (!existing) return null;
      return { ...existing, latitude: u.latitude, longitude: u.longitude, geocodedAt: u.geocodedAt };
    }).filter(Boolean) as Subcontractor[];
    if (updatedContacts.length > 0) onBulkUpdateContacts(updatedContacts);
  }, [contacts, onBulkUpdateContacts]);

  // Collect all unique specializations and regions
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

  // Filter contacts
  const filteredContacts = useMemo(() => {
    return contacts.filter(c => {
      if (specFilter.length > 0) {
        if (!c.specialization?.some(s => specFilter.includes(s))) return false;
      }
      if (regionFilter) {
        const matchRegion = c.region === regionFilter || c.regions?.includes(regionFilter);
        if (!matchRegion) return false;
      }
      return true;
    });
  }, [contacts, specFilter, regionFilter]);

  // Geocoded contacts
  const geocodedContacts = useMemo(() =>
    filteredContacts.filter((c): c is Subcontractor & { latitude: number; longitude: number } =>
      c.latitude != null && c.longitude != null
    ),
  [filteredContacts]);

  // Dynamic color map
  const colorMap = useMemo(() => buildDynamicColorMap(specFilter), [specFilter]);

  const markers = useMemo<MapMarker[]>(() =>
    geocodedContacts.map(c => {
      const statusObj = statuses.find(s => s.id === c.status || s.label === c.status);
      return {
        id: c.id,
        position: { lat: c.latitude, lng: c.longitude },
        label: c.company,
        type: 'subcontractor' as const,
        color: specFilter.length > 0
          ? getDynamicMarkerColor(c.specialization || [], colorMap)
          : getMarkerColor(c.specialization || []),
        specialization: c.specialization,
        rating: c.vendorRatingAverage,
        status: statusObj?.label || c.status,
      };
    }),
  [geocodedContacts, statuses, specFilter, colorMap]);

  const handleMarkerClick = useCallback((id: string) => {
    setSelectedContactId(prev => prev === id ? null : id);
    const contact = contacts.find(c => c.id === id);
    if (contact && onContactClick) onContactClick(contact);
  }, [contacts, onContactClick]);

  const selectedContact = useMemo(() =>
    selectedContactId ? contacts.find(c => c.id === selectedContactId) : null,
  [contacts, selectedContactId]);

  // Company search matches — searches across all contacts (not restricted by active filters)
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

  // Filtered specializations based on search (diacritic-insensitive, token-based)
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

  const toggleSpec = useCallback((spec: string) => {
    setSpecFilter(prev =>
      prev.includes(spec) ? prev.filter(s => s !== spec) : [...prev, spec]
    );
  }, []);

  const totalContacts = filteredContacts.length;
  const geocodedCount = geocodedContacts.length;

  return (
    <div className="flex flex-col h-full">
      {/* Top bar with filters + geocode */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0">
        {/* Specialization multi-select */}
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
              {/* Search input */}
              <div className="p-2 border-b border-slate-200 dark:border-slate-700">
                <div className="relative">
                  <span className="material-symbols-outlined text-sm text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">
                    search
                  </span>
                  <input
                    type="text"
                    value={specSearch}
                    onChange={(e) => setSpecSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        if (specSearch) {
                          setSpecSearch('');
                        } else {
                          setSpecDropdownOpen(false);
                        }
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

              {/* List */}
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
                        onChange={() => toggleSpec(spec)}
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

        {/* Company / address search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <span className="material-symbols-outlined text-sm text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
            search
          </span>
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
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleCompanySelect(c);
                      }}
                      className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700 text-xs border-b border-slate-100 dark:border-slate-700/50 last:border-b-0"
                    >
                      <span
                        className={`material-symbols-outlined text-sm mt-0.5 shrink-0 ${
                          hasCoords ? 'text-blue-500' : 'text-slate-300 dark:text-slate-600'
                        }`}
                        title={hasCoords ? 'Na mapě' : 'Bez geokódování'}
                      >
                        {hasCoords ? 'location_on' : 'location_off'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-slate-900 dark:text-white truncate">
                          {c.company}
                        </div>
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

        {/* Stats + geocode */}
        <div className="ml-auto flex items-center gap-3">
          {/* Labels toggle */}
          <button
            type="button"
            role="switch"
            aria-checked={showLabels}
            onClick={() => setShowLabels(prev => !prev)}
            className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer select-none"
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
            className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer select-none"
          >
            <span className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${showLabelSpecialization ? 'bg-blue-500 dark:bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
              <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${showLabelSpecialization ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">category</span>
              Specializace
            </span>
          </button>
          <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">pin_drop</span>
            {geocodedCount} z {totalContacts} na mapě
          </span>
          {onBulkUpdateContacts && (
            <button
              onClick={() => setShowGeocodePanel(!showGeocodePanel)}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">my_location</span>
              Geokódovat
            </button>
          )}
        </div>
      </div>

      {specDropdownOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setSpecDropdownOpen(false)} />
      )}

      {companyDropdownOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setCompanyDropdownOpen(false)} />
      )}

      {showGeocodePanel && (
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <BulkGeocodePanel contacts={contacts} onContactsUpdated={handleGeocodesUpdated} />
        </div>
      )}

      {/* Map area */}
      <div className="flex-1 relative" data-map-root>
        {geocodedCount === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-3">
              location_off
            </span>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
              Žádný subdodavatel nemá geokódovanou adresu
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs mb-3">
              Pro zobrazení na mapě je třeba nejprve geokódovat adresy subdodavatelů.
            </p>
            {onBulkUpdateContacts && !showGeocodePanel && (
              <button
                onClick={() => setShowGeocodePanel(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              >
                <span className="material-symbols-outlined text-sm">my_location</span>
                Geokódovat adresy
              </button>
            )}
          </div>
        ) : (
          <>
            <MapView
              ref={mapRef}
              markers={markers}
              onMarkerClick={handleMarkerClick}
              fitBounds
              height="100%"
              className="h-full"
              showRegions={showRegions}
              activeLayer={activeLayer}
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

            {/* TOP RIGHT: Controls */}
            <div className="absolute top-3 right-3 z-[1000]">
              <MapControls
                onFitBounds={() => mapRef.current?.fitAllBounds()}
                onToggleRegions={() => setShowRegions(prev => !prev)}
                regionsVisible={showRegions}
                onToggleFullscreen={() => mapRef.current?.toggleFullscreen()}
                isFullscreen={mapRef.current?.isFullscreen ?? false}
              />
            </div>

            {/* BOTTOM RIGHT: Layer switcher */}
            <div className="absolute bottom-3 right-16 z-[1000]">
              <MapLayerSwitcher
                activeLayer={activeLayer}
                onLayerChange={setActiveLayer}
              />
            </div>

            {/* BOTTOM LEFT: Legend — only when filters are active */}
            {specFilter.length > 0 && (
              <div className="absolute bottom-3 left-3 z-[1000]">
                <MapLegend
                  compact
                  activeSpecs={specFilter}
                  colorMap={colorMap}
                  counts={Object.fromEntries(
                    specFilter.map(s => [s, geocodedContacts.filter(c => c.specialization?.includes(s)).length])
                  )}
                />
              </div>
            )}

            {/* BOTTOM RIGHT: Info card */}
            {selectedContact && (
              <div className="absolute bottom-3 right-3 z-[1000]">
                <MapInfoCard
                  contact={selectedContact}
                  onClose={() => setSelectedContactId(null)}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
