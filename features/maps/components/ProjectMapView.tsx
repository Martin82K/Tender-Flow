import { useState, useMemo, useCallback } from 'react';
import type { Subcontractor, ProjectDetails, StatusConfig } from '@/types';
import { FEATURES } from '@/config/features';
import { RequireFeature } from '@/shared/routing/RequireFeature';
import type { GeoPoint, MapMarker } from '../types';
import { useNearbySubcontractors } from '../hooks/useNearbySubcontractors';
import { MapView } from './MapView';
import { MapLegend } from './MapLegend';
import { RadiusSlider } from './RadiusSlider';
import { RecommendationPanel } from './RecommendationPanel';

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
  const [radiusKm, setRadiusKm] = useState(30);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [highlightedSubId, setHighlightedSubId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  const projectPosition: GeoPoint | null = useMemo(() => {
    if (projectDetails.latitude != null && projectDetails.longitude != null) {
      return { lat: projectDetails.latitude, lng: projectDetails.longitude };
    }
    return null;
  }, [projectDetails.latitude, projectDetails.longitude]);

  const { nearby, markers, geocodedCount, totalCount } = useNearbySubcontractors(
    projectPosition,
    contacts,
    radiusKm,
  );

  // Project pin marker
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

  // Selected subcontractor data
  const selectedSub = useMemo(() =>
    nearby.find(s => s.id === selectedSubId),
  [nearby, selectedSubId]);

  const selectedSubPosition: GeoPoint | undefined = useMemo(() => {
    if (!selectedSub || selectedSub.latitude == null || selectedSub.longitude == null) return undefined;
    return { lat: selectedSub.latitude, lng: selectedSub.longitude };
  }, [selectedSub]);

  // Highlighted markers (visual feedback)
  const displayMarkers = useMemo(() =>
    markers.map(m => ({
      ...m,
      color: m.id === highlightedSubId || m.id === selectedSubId
        ? '#3B82F6'
        : m.color,
    })),
  [markers, highlightedSubId, selectedSubId]);

  // Category handling
  const categories = projectDetails.categories || [];
  const selectedCategory = categories.find(c => c.id === selectedCategoryId);
  const categorySpecs = useMemo(() => {
    if (!selectedCategory) return [];
    // Use description or title as specialization hint
    return [selectedCategory.title];
  }, [selectedCategory]);

  // Existing bid subcontractor IDs for the selected category
  const existingBidSubIds = useMemo(() => {
    if (!selectedCategoryId || !projectDetails.bids) return [];
    const bids = projectDetails.bids[selectedCategoryId] || [];
    return bids.map(b => b.subcontractorId).filter(Boolean) as string[];
  }, [selectedCategoryId, projectDetails.bids]);

  const handleSubClick = useCallback((id: string) => {
    setSelectedSubId(prev => prev === id ? null : id);
  }, []);

  const handleAddBid = useCallback((subcontractorId: string) => {
    if (selectedCategoryId && onAddBid) {
      onAddBid(selectedCategoryId, subcontractorId);
    }
  }, [selectedCategoryId, onAddBid]);

  const hasProjectAddress = projectPosition != null;

  return (
    <div className="flex flex-col lg:flex-row h-full">
      {/* Map area */}
      <div className="flex-1 relative min-h-[300px] lg:min-h-0">
        {/* Warning: no geocoded address */}
        {!hasProjectAddress && (
          <div className="absolute top-3 left-3 right-3 z-20 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs">
            <span className="material-symbols-outlined text-sm">warning</span>
            <span className="flex-1">Stavba nema presnou adresu. Nastavte adresu projektu pro zobrazeni na mape.</span>
            {onUpdateDetails && (
              <button
                onClick={() => {/* Parent should handle navigation to address setting */}}
                className="shrink-0 px-2 py-1 rounded bg-amber-200 dark:bg-amber-800 hover:bg-amber-300 dark:hover:bg-amber-700 text-amber-900 dark:text-amber-200 transition-colors"
              >
                Nastavit
              </button>
            )}
          </div>
        )}

        <MapView
          markers={displayMarkers}
          projectPin={projectPin || undefined}
          onMarkerClick={handleSubClick}
          fitBounds={hasProjectAddress}
          height="100%"
          className="h-full"
          showRoute={!!(selectedSubId && projectPosition && selectedSubPosition)}
          routeFrom={projectPosition || undefined}
          routeTo={selectedSubPosition}
        />

        {/* Map legend */}
        <div className="absolute bottom-4 left-4 z-20">
          <MapLegend compact />
        </div>

        {/* Radius slider */}
        {hasProjectAddress && (
          <div className="absolute top-3 right-3 z-20 w-48">
            <RadiusSlider
              value={radiusKm}
              onChange={setRadiusKm}
              min={5}
              max={100}
            />
          </div>
        )}
      </div>

      {/* Side panel */}
      <div className="w-full lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-col max-h-[50vh] lg:max-h-full overflow-hidden">
        {/* Category filter */}
        {categories.length > 0 && (
          <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700">
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="
                w-full text-xs px-3 py-1.5 rounded-md border
                border-slate-300 dark:border-slate-600
                bg-white dark:bg-slate-800
                text-slate-700 dark:text-slate-300
              "
            >
              <option value="">Vsechny kategorie</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.title}</option>
              ))}
            </select>
          </div>
        )}

        {/* Stats */}
        <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">groups</span>
          {nearby.length} subdodavatelu v okruhu {radiusKm} km
          <span className="text-slate-300 dark:text-slate-600">|</span>
          {geocodedCount}/{totalCount} geokodovano
        </div>

        {/* Nearby list or recommendations */}
        <div className="flex-1 overflow-y-auto">
          {/* Recommendations for selected category */}
          {selectedCategoryId && projectPosition && (
            <RequireFeature feature={FEATURES.MAPS_RECOMMENDATIONS} fallback={null}>
              <div className="border-b border-slate-200 dark:border-slate-700">
                <RecommendationPanel
                  projectPosition={projectPosition}
                  projectRegion={projectDetails.address}
                  categorySpecializations={categorySpecs}
                  subcontractors={contacts}
                  existingBidSubIds={existingBidSubIds}
                  onAddBid={handleAddBid}
                  onHighlightMarker={setHighlightedSubId}
                />
              </div>
            </RequireFeature>
          )}

          {/* Nearby subcontractor list */}
          <div className="px-4 py-2">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Blizci subdodavatele
            </h3>
            {nearby.length === 0 ? (
              <p className="text-xs text-slate-400 dark:text-slate-500 py-4 text-center">
                {hasProjectAddress
                  ? 'V danem okruhu nebyli nalezeni zadni subdodavatele.'
                  : 'Nastavte adresu projektu pro vyhledani subdodavatelu.'}
              </p>
            ) : (
              <div className="space-y-1">
                {nearby.map(sub => (
                  <button
                    key={sub.id}
                    onClick={() => handleSubClick(sub.id)}
                    onMouseEnter={() => setHighlightedSubId(sub.id)}
                    onMouseLeave={() => setHighlightedSubId(null)}
                    className={`
                      w-full text-left px-3 py-2 rounded-lg transition-colors text-xs
                      hover:bg-slate-50 dark:hover:bg-slate-800
                      ${selectedSubId === sub.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-300 dark:ring-blue-700'
                        : ''
                      }
                    `}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-medium text-slate-900 dark:text-white truncate">
                        {sub.company}
                      </span>
                      <span className="text-slate-400 dark:text-slate-500 shrink-0 ml-2">
                        {sub.distanceKm.toFixed(1)} km
                      </span>
                    </div>
                    {sub.specialization?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {sub.specialization.slice(0, 3).map(s => (
                          <span
                            key={s}
                            className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[10px]"
                          >
                            {s}
                          </span>
                        ))}
                        {sub.specialization.length > 3 && (
                          <span className="text-[10px] text-slate-400">+{sub.specialization.length - 3}</span>
                        )}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
