import type { Subcontractor } from '@/types';
import { formatDecimal } from '@/utils/formatters';
import { getMarkerColor } from '../utils/markerColors';

interface MapInfoCardProps {
  contact: Subcontractor;
  distanceKm?: number;
  onClose: () => void;
  onAddBid?: () => void;
  canAddBid?: boolean;
  className?: string;
}

export function MapInfoCard({
  contact,
  distanceKm,
  onClose,
  onAddBid,
  canAddBid = false,
  className = '',
}: MapInfoCardProps) {
  const mainColor = getMarkerColor(contact.specialization || []);
  const rating = contact.vendorRatingAverage;
  const stars = rating != null
    ? '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating))
    : null;

  return (
    <div
      className={`w-72 rounded-xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-slate-200/50 dark:border-slate-700/50 shadow-xl overflow-hidden ${className}`}
    >
      {/* Header with color stripe */}
      <div className="h-1.5" style={{ backgroundColor: mainColor }} />

      <div className="p-3">
        {/* Title row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">
            {contact.company}
          </h3>
          <button
            onClick={onClose}
            className="shrink-0 p-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <span className="material-symbols-outlined text-slate-400 text-base">close</span>
          </button>
        </div>

        {/* Specializations */}
        {contact.specialization && contact.specialization.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {contact.specialization.map((spec) => (
              <span
                key={spec}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                style={{
                  backgroundColor: `${getMarkerColor([spec])}20`,
                  color: getMarkerColor([spec]),
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: getMarkerColor([spec]) }}
                />
                {spec}
              </span>
            ))}
          </div>
        )}

        {/* Details grid */}
        <div className="space-y-1.5 text-xs">
          {/* Rating */}
          {stars && (
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-500 text-sm">star</span>
              <span className="text-amber-500">{stars}</span>
              <span className="text-slate-400">
                {formatDecimal(rating!, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </span>
            </div>
          )}

          {/* Distance */}
          {distanceKm != null && (
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <span className="material-symbols-outlined text-sm">straighten</span>
              <span>
                {formatDecimal(distanceKm, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km
              </span>
            </div>
          )}

          {/* Contact info */}
          {contact.contacts && contact.contacts.length > 0 && (
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <span className="material-symbols-outlined text-sm">person</span>
              <span className="truncate">{contact.contacts[0].name}</span>
            </div>
          )}

          {contact.email && (
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <span className="material-symbols-outlined text-sm">mail</span>
              <span className="truncate">{contact.email}</span>
            </div>
          )}

          {contact.phone && (
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <span className="material-symbols-outlined text-sm">phone</span>
              <span>{contact.phone}</span>
            </div>
          )}

          {/* Region */}
          {(contact.region || (contact.regions && contact.regions.length > 0)) && (
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <span className="material-symbols-outlined text-sm">map</span>
              <span className="truncate">
                {contact.regions?.join(', ') || contact.region}
              </span>
            </div>
          )}
        </div>

        {/* Add bid button */}
        {canAddBid && onAddBid && (
          <button
            onClick={onAddBid}
            className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            Přidat do nabídky
          </button>
        )}
      </div>
    </div>
  );
}
