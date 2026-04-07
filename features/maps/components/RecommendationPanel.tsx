import { useEffect } from 'react';
import type { Subcontractor } from '@/types';
import type { GeoPoint } from '../types';
import { useSubcontractorRecommendations } from '../hooks/useSubcontractorRecommendations';
import { RecommendationCard } from './RecommendationCard';

interface RecommendationPanelProps {
  projectPosition: GeoPoint;
  projectRegion?: string;
  categorySpecializations: string[];
  subcontractors: Subcontractor[];
  existingBidSubIds?: string[];
  onAddBid?: (subcontractorId: string) => void;
  onHighlightMarker?: (subcontractorId: string | null) => void;
}

export function RecommendationPanel({
  projectPosition,
  projectRegion,
  categorySpecializations,
  subcontractors,
  existingBidSubIds,
  onAddBid,
  onHighlightMarker,
}: RecommendationPanelProps) {
  const { recommendations, getRecommendations, isLoading, error } = useSubcontractorRecommendations();

  useEffect(() => {
    if (!projectPosition || categorySpecializations.length === 0) return;
    getRecommendations(
      projectPosition,
      projectRegion,
      categorySpecializations,
      subcontractors,
      existingBidSubIds,
    );
  }, [
    projectPosition,
    projectRegion,
    categorySpecializations,
    subcontractors,
    existingBidSubIds,
    getRecommendations,
  ]);

  const hasNoGps = subcontractors.every(s => s.latitude == null || s.longitude == null);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <span className="material-symbols-outlined text-blue-500">recommend</span>
        <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
          Doporuceni subdodavatele
        </h3>
        {recommendations.length > 0 && (
          <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
            {recommendations.length}
          </span>
        )}
      </div>

      {/* Sort indicator */}
      {recommendations.length > 0 && (
        <div className="px-4 py-1.5 text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
          <span className="material-symbols-outlined text-xs">sort</span>
          dle skore
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-8 text-slate-500 dark:text-slate-400">
            <span className="material-symbols-outlined animate-spin text-2xl mb-2">progress_activity</span>
            <span className="text-sm">Vypocitavam doporuceni...</span>
          </div>
        )}

        {/* Error */}
        {!isLoading && error && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <span className="material-symbols-outlined text-2xl text-red-400 mb-2">error</span>
            <p className="text-sm text-red-500 dark:text-red-400 mb-3">{error.message}</p>
            <button
              onClick={() =>
                getRecommendations(
                  projectPosition,
                  projectRegion,
                  categorySpecializations,
                  subcontractors,
                  existingBidSubIds,
                )
              }
              className="text-xs px-3 py-1.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              Zkusit znovu
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && recommendations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <span className="material-symbols-outlined text-2xl text-slate-400 dark:text-slate-500 mb-2">
              search_off
            </span>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
              Zadna doporuceni
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 max-w-[200px]">
              {hasNoGps
                ? 'Zadny subdodavatel nema geokodovanou adresu.'
                : 'Nebyli nalezeni subdodavatele s odpovidajici specializaci.'}
            </p>
          </div>
        )}

        {/* Recommendation list */}
        {!isLoading && !error && recommendations.map((rec) => (
          <RecommendationCard
            key={rec.subcontractorId}
            recommendation={rec}
            onSelect={onAddBid}
            onHover={onHighlightMarker}
          />
        ))}
      </div>
    </div>
  );
}
