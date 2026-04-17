import { useMemo, useCallback, useState } from 'react';
import type { Subcontractor } from '@/types';
import { useGeocode } from '../hooks/useGeocode';

interface BulkGeocodePanelProps {
  contacts: Subcontractor[];
  onContactsUpdated?: (updates: Array<{ id: string; latitude: number; longitude: number; geocodedAt: string }>) => void;
}

export function BulkGeocodePanel({
  contacts,
  onContactsUpdated,
}: BulkGeocodePanelProps) {
  const { batchGeocode, cancelBatch, bulkProgress } = useGeocode();
  const [completed, setCompleted] = useState(false);

  const stats = useMemo(() => {
    const total = contacts.length;
    const alreadyGeocoded = contacts.filter(c => c.latitude != null && c.longitude != null).length;
    const missingAddress = contacts.filter(c => !c.address && !c.city).length;
    const readyToGeocode = contacts.filter(
      c => (c.address || c.city) && (c.latitude == null || c.longitude == null)
    ).length;
    return { total, alreadyGeocoded, missingAddress, readyToGeocode };
  }, [contacts]);

  const isRunning = bulkProgress?.isRunning ?? false;
  const progressPercent = bulkProgress
    ? Math.round((bulkProgress.processed / Math.max(bulkProgress.total, 1)) * 100)
    : 0;

  const handleStart = useCallback(async () => {
    setCompleted(false);
    const items = contacts
      .filter(c => (c.address || c.city) && (c.latitude == null || c.longitude == null))
      .map(c => ({
        id: c.id,
        address: c.address,
        city: c.city,
        region: c.region,
      }));

    if (items.length === 0) return;

    const results = await batchGeocode(items);
    setCompleted(true);

    if (onContactsUpdated && results.size > 0) {
      const updates = Array.from(results.entries()).map(([id, geo]) => ({
        id,
        latitude: geo.lat,
        longitude: geo.lng,
        geocodedAt: new Date().toISOString(),
      }));
      onContactsUpdated(updates);
    }
  }, [contacts, batchGeocode, onContactsUpdated]);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30">
          <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">my_location</span>
        </div>
        <div>
          <h3 className="font-semibold text-sm text-slate-900 dark:text-white">
            Hromadne geokodovani
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Prevod adres subdodavatelu na GPS souradnice
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-200 dark:bg-slate-700">
        <StatCell label="Celkem kontaktu" value={stats.total} icon="groups" />
        <StatCell label="Jiz geokodovano" value={stats.alreadyGeocoded} icon="check_circle" color="green" />
        <StatCell label="Chybi adresa" value={stats.missingAddress} icon="location_off" color="amber" />
        <StatCell label="Ke zpracovani" value={stats.readyToGeocode} icon="pending" color="blue" />
      </div>

      {/* Progress / Action */}
      <div className="px-5 py-4 space-y-3">
        {/* Progress bar when running */}
        {isRunning && bulkProgress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>Zpracovavam... {bulkProgress.processed}/{bulkProgress.total}</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <span className="material-symbols-outlined text-xs">check</span>
                {bulkProgress.success} uspesnych
              </span>
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <span className="material-symbols-outlined text-xs">search_off</span>
                {bulkProgress.notFound} nenalezeno
              </span>
              <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                <span className="material-symbols-outlined text-xs">error</span>
                {bulkProgress.errors} chyb
              </span>
            </div>
          </div>
        )}

        {/* Results summary after completion */}
        {completed && !isRunning && bulkProgress && (
          <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-green-600 dark:text-green-400 text-sm">task_alt</span>
              <span className="text-sm font-medium text-green-800 dark:text-green-300">Geokodovani dokonceno</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-green-700 dark:text-green-400">
              <span>{bulkProgress.success} uspesne geokodovano</span>
              {bulkProgress.notFound > 0 && <span>{bulkProgress.notFound} nenalezeno</span>}
              {bulkProgress.errors > 0 && <span>{bulkProgress.errors} chyb</span>}
            </div>
          </div>
        )}

        {/* Info note */}
        <p className="text-xs text-slate-400 dark:text-slate-500 flex items-start gap-1">
          <span className="material-symbols-outlined text-xs mt-0.5 shrink-0">info</span>
          Zpracovani probiha v davkach po 10 zaznamech s respektovanim limitu API.
        </p>

        {/* Buttons */}
        <div className="flex items-center gap-2">
          {!isRunning ? (
            <button
              onClick={handleStart}
              disabled={stats.readyToGeocode === 0}
              className="
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                bg-blue-600 hover:bg-blue-700 text-white
                disabled:bg-slate-300 disabled:dark:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed
              "
            >
              <span className="material-symbols-outlined text-sm">my_location</span>
              Geokodovat vsechny adresy
            </button>
          ) : (
            <button
              onClick={cancelBatch}
              className="
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                bg-red-600 hover:bg-red-700 text-white
              "
            >
              <span className="material-symbols-outlined text-sm">cancel</span>
              Zrusit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Internal stat cell component
function StatCell({
  label,
  value,
  icon,
  color = 'slate',
}: {
  label: string;
  value: number;
  icon: string;
  color?: 'slate' | 'green' | 'amber' | 'blue';
}) {
  const colorClasses: Record<string, string> = {
    slate: 'text-slate-500 dark:text-slate-400',
    green: 'text-green-600 dark:text-green-400',
    amber: 'text-amber-600 dark:text-amber-400',
    blue: 'text-blue-600 dark:text-blue-400',
  };

  return (
    <div className="bg-white dark:bg-slate-800 px-4 py-3 text-center">
      <span className={`material-symbols-outlined text-lg ${colorClasses[color]}`}>{icon}</span>
      <p className="text-lg font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>
    </div>
  );
}
