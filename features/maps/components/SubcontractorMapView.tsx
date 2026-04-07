import { useState, useMemo, useCallback } from 'react';
import type { Subcontractor, StatusConfig } from '@/types';
import type { MapMarker } from '../types';
import { getMarkerColor } from '../utils/markerColors';
import { MapView } from './MapView';
import { MapLegend } from './MapLegend';

interface SubcontractorMapViewProps {
  contacts: Subcontractor[];
  statuses: StatusConfig[];
  onContactClick?: (contact: Subcontractor) => void;
}

export function SubcontractorMapView({
  contacts,
  statuses,
  onContactClick,
}: SubcontractorMapViewProps) {
  const [specFilter, setSpecFilter] = useState<string[]>([]);
  const [regionFilter, setRegionFilter] = useState<string>('');
  const [specDropdownOpen, setSpecDropdownOpen] = useState(false);

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

  // Geocoded contacts to markers
  const geocodedContacts = useMemo(() =>
    filteredContacts.filter((c): c is Subcontractor & { latitude: number; longitude: number } =>
      c.latitude != null && c.longitude != null
    ),
  [filteredContacts]);

  const markers = useMemo<MapMarker[]>(() =>
    geocodedContacts.map(c => {
      const statusObj = statuses.find(s => s.id === c.status || s.label === c.status);
      return {
        id: c.id,
        position: { lat: c.latitude, lng: c.longitude },
        label: c.company,
        type: 'subcontractor' as const,
        color: getMarkerColor(c.specialization || []),
        specialization: c.specialization,
        rating: c.vendorRatingAverage,
        status: statusObj?.label || c.status,
      };
    }),
  [geocodedContacts, statuses]);

  const handleMarkerClick = useCallback((id: string) => {
    const contact = contacts.find(c => c.id === id);
    if (contact && onContactClick) onContactClick(contact);
  }, [contacts, onContactClick]);

  const toggleSpec = useCallback((spec: string) => {
    setSpecFilter(prev =>
      prev.includes(spec)
        ? prev.filter(s => s !== spec)
        : [...prev, spec]
    );
  }, []);

  const totalContacts = filteredContacts.length;
  const geocodedCount = geocodedContacts.length;

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        {/* Specialization multi-select */}
        <div className="relative">
          <button
            onClick={() => setSpecDropdownOpen(!specDropdownOpen)}
            className="
              flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border
              border-slate-300 dark:border-slate-600
              bg-white dark:bg-slate-800
              text-slate-700 dark:text-slate-300
              hover:bg-slate-50 dark:hover:bg-slate-700
              transition-colors
            "
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
            <div className="
              absolute top-full left-0 mt-1 z-50 w-56 max-h-60 overflow-y-auto
              bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700
              rounded-lg shadow-lg
            ">
              {allSpecializations.length === 0 ? (
                <div className="px-3 py-2 text-xs text-slate-400">Zadne specializace</div>
              ) : (
                allSpecializations.map(spec => (
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
              {specFilter.length > 0 && (
                <button
                  onClick={() => setSpecFilter([])}
                  className="w-full text-xs px-3 py-1.5 text-blue-600 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700 border-t border-slate-200 dark:border-slate-700"
                >
                  Zrusit filtr
                </button>
              )}
            </div>
          )}
        </div>

        {/* Region select */}
        <select
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          className="
            text-xs px-3 py-1.5 rounded-md border
            border-slate-300 dark:border-slate-600
            bg-white dark:bg-slate-800
            text-slate-700 dark:text-slate-300
          "
        >
          <option value="">Vsechny regiony</option>
          {allRegions.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        {/* Stats */}
        <div className="ml-auto text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">pin_drop</span>
          {geocodedCount} z {totalContacts} kontaktu na mape
        </div>
      </div>

      {/* Close dropdown on outside click */}
      {specDropdownOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setSpecDropdownOpen(false)} />
      )}

      {/* Map or empty state */}
      <div className="flex-1 relative">
        {geocodedCount === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-600 mb-3">
              location_off
            </span>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
              Zadny subdodavatel nema geokodovanou adresu
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs">
              Pro zobrazeni na mape je treba nejprve geokodovat adresy subdodavatelu.
            </p>
          </div>
        ) : (
          <>
            <MapView
              markers={markers}
              onMarkerClick={handleMarkerClick}
              fitBounds
              height="100%"
              className="h-full"
            />
            <div className="absolute bottom-4 left-4 z-20">
              <MapLegend compact />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
