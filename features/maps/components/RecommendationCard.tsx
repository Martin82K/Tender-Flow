import React, { useCallback } from 'react';
import type { RecommendationResult } from '../types';

interface RecommendationCardProps {
  recommendation: RecommendationResult;
  onSelect?: (subcontractorId: string) => void;
  onHover?: (subcontractorId: string | null) => void;
  isHighlighted?: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 70) return 'bg-green-500';
  if (score >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
}

function getScoreGradient(score: number): string {
  if (score >= 70) return 'from-green-500 to-green-400';
  if (score >= 40) return 'from-yellow-500 to-yellow-400';
  return 'from-red-500 to-red-400';
}

export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendation,
  onSelect,
  onHover,
  isHighlighted = false,
}) => {
  const { subcontractorId, companyName, specialization, distance, duration, score, rating } = recommendation;

  const distanceKm = (distance / 1000).toFixed(1);
  const durationMin = Math.round(duration / 60);

  const handleMouseEnter = useCallback(() => {
    onHover?.(subcontractorId);
  }, [onHover, subcontractorId]);

  const handleMouseLeave = useCallback(() => {
    onHover?.(null);
  }, [onHover]);

  const handleSelect = useCallback(() => {
    onSelect?.(subcontractorId);
  }, [onSelect, subcontractorId]);

  const stars = rating != null ? Math.round(rating) : 0;
  const starsFull = Math.min(stars, 5);

  return (
    <div
      className={`
        rounded-lg border p-3 transition-all cursor-pointer
        bg-white dark:bg-slate-800
        border-slate-200 dark:border-slate-700
        hover:shadow-md dark:hover:shadow-slate-900/50
        ${isHighlighted ? 'ring-2 ring-blue-500 dark:ring-blue-400 shadow-md' : ''}
      `}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate flex-1">
          {companyName}
        </h4>
        {/* Score badge */}
        <span className={`
          text-xs font-semibold px-1.5 py-0.5 rounded text-white shrink-0
          ${getScoreColor(score)}
        `}>
          {score}
        </span>
      </div>

      {/* Specializations */}
      {specialization.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {specialization.map((spec) => (
            <span
              key={spec}
              className="text-xs px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
            >
              {spec}
            </span>
          ))}
        </div>
      )}

      {/* Travel info */}
      <div className="flex items-center gap-3 mb-2 text-xs text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">schedule</span>
          {durationMin} min
        </span>
        <span className="flex items-center gap-1">
          <span className="material-symbols-outlined text-sm">straighten</span>
          {distanceKm} km
        </span>
      </div>

      {/* Rating */}
      {rating != null && (
        <div className="flex items-center gap-1 mb-2 text-xs">
          <span className="text-amber-400">
            {'★'.repeat(starsFull)}{'☆'.repeat(5 - starsFull)}
          </span>
          <span className="text-slate-500 dark:text-slate-400">{rating.toFixed(1)}</span>
        </div>
      )}

      {/* Score bar */}
      <div className="mb-3">
        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${getScoreGradient(score)} transition-all`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      {/* Action */}
      {onSelect && (
        <button
          onClick={handleSelect}
          className="
            w-full text-xs font-medium py-1.5 px-3 rounded-md transition-colors
            bg-blue-600 hover:bg-blue-700 text-white
            dark:bg-blue-500 dark:hover:bg-blue-600
          "
        >
          <span className="flex items-center justify-center gap-1">
            <span className="material-symbols-outlined text-sm">add</span>
            Pridat do nabidky
          </span>
        </button>
      )}
    </div>
  );
}
