import React, { useState } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { StarRating } from '@/shared/ui/StarRating';
import { contractService } from '@/services/contractService';
import { useAuth } from '@/context/AuthContext';
import type { ContractWithDetails } from '@/types';

interface Props {
  contract: ContractWithDetails;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

const labelClass = 'block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1';
const inputClass =
  'w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary';

export const VendorRatingDialog: React.FC<Props> = ({ contract, onClose, onSaved }) => {
  const { user } = useAuth();
  const [rating, setRating] = useState<number>(contract.vendorRating ?? 0);
  const [note, setNote] = useState<string>(contract.vendorRatingNote ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await contractService.updateContract(contract.id, {
        vendorRating: rating > 0 ? rating : null,
        vendorRatingNote: note.trim() || null,
        vendorRatingAt: rating > 0 ? new Date().toISOString() : null,
        vendorRatingBy: rating > 0 ? user?.id ?? null : null,
      });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se uložit hodnocení.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await contractService.updateContract(contract.id, {
        vendorRating: null,
        vendorRatingNote: null,
        vendorRatingAt: null,
        vendorRatingBy: null,
      });
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se smazat hodnocení.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Hodnocení dodavatele — ${contract.vendorName}`} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-2">
            {error}
          </div>
        )}
        <div>
          <label className={labelClass}>Hvězdy (0–5)</label>
          <div className="flex items-center gap-3">
            <StarRating value={rating} onChange={setRating} allowClear size="md" />
            <span className="text-sm text-slate-500 tabular-nums">
              {rating > 0 ? `${rating} / 5` : 'Bez hodnocení'}
            </span>
          </div>
        </div>
        <div>
          <label className={labelClass}>Poznámka</label>
          <textarea
            rows={4}
            className={`${inputClass} resize-none`}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Kvalita, dodržení termínů, komunikace, závady v záruce…"
          />
        </div>
        {contract.vendorRatingAt && (
          <p className="text-[11px] text-slate-500">
            Poslední úprava: {new Date(contract.vendorRatingAt).toLocaleString('cs-CZ')}
          </p>
        )}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={handleClear}
            disabled={submitting || (contract.vendorRating == null && !contract.vendorRatingNote)}
            className="px-3 py-2 text-xs rounded-lg text-red-500 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Smazat hodnocení
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Zrušit
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-primary/40 text-primary hover:bg-primary/10 hover:border-primary transition disabled:opacity-50"
            >
              {submitting ? 'Ukládám…' : 'Uložit'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
