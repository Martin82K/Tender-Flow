import React, { useState } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { contractService } from '@/services/contractService';
import type { ContractAmendment } from '@/types';

interface Props {
  contractId: string;
  initial: ContractAmendment | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary';
const labelClass = 'block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1';

export const AmendmentDialog: React.FC<Props> = ({ contractId, initial, onClose, onSaved }) => {
  const isEditing = Boolean(initial?.id);
  const [form, setForm] = useState({
    signedAt: initial?.signedAt?.slice(0, 10) ?? '',
    effectiveFrom: initial?.effectiveFrom?.slice(0, 10) ?? '',
    deltaPrice: initial?.deltaPrice?.toString() ?? '',
    deltaDeadline: initial?.deltaDeadline?.slice(0, 10) ?? '',
    reason: initial?.reason ?? '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const delta = Number.parseFloat(form.deltaPrice.replace(',', '.')) || 0;
      if (isEditing && initial) {
        await contractService.updateAmendment(initial.id, {
          signedAt: form.signedAt || undefined,
          effectiveFrom: form.effectiveFrom || undefined,
          deltaPrice: delta,
          deltaDeadline: form.deltaDeadline || undefined,
          reason: form.reason || undefined,
        });
      } else {
        await contractService.createAmendment({
          contractId,
          signedAt: form.signedAt || undefined,
          effectiveFrom: form.effectiveFrom || undefined,
          deltaPrice: delta,
          deltaDeadline: form.deltaDeadline || undefined,
          reason: form.reason || undefined,
        });
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se uložit dodatek');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={isEditing ? 'Upravit dodatek' : 'Nový dodatek'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-2">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Datum podpisu</label>
            <input
              type="date"
              className={inputClass}
              value={form.signedAt}
              onChange={(e) => setForm((s) => ({ ...s, signedAt: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelClass}>Platnost od</label>
            <input
              type="date"
              className={inputClass}
              value={form.effectiveFrom}
              onChange={(e) => setForm((s) => ({ ...s, effectiveFrom: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelClass}>Změna ceny (+/−)</label>
            <input
              className={inputClass}
              value={form.deltaPrice}
              onChange={(e) => setForm((s) => ({ ...s, deltaPrice: e.target.value }))}
              inputMode="decimal"
              placeholder="0"
            />
          </div>
          <div>
            <label className={labelClass}>Nový termín dokončení</label>
            <input
              type="date"
              className={inputClass}
              value={form.deltaDeadline}
              onChange={(e) => setForm((s) => ({ ...s, deltaDeadline: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <label className={labelClass}>Důvod</label>
          <textarea
            rows={3}
            className={`${inputClass} resize-none`}
            value={form.reason}
            onChange={(e) => setForm((s) => ({ ...s, reason: e.target.value }))}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
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
            {submitting ? 'Ukládám…' : isEditing ? 'Uložit změny' : 'Vytvořit dodatek'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
