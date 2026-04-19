import React, { useState } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { NumericInput } from '@/shared/ui/NumericInput';
import { MarkdownDocumentPanel } from '@/shared/contracts/MarkdownDocumentPanel';
import { contractService } from '@/services/contractService';
import type {
  Contract,
  ContractRetentionStatus,
  ContractStatus,
  ContractWithDetails,
} from '@/types';

interface Props {
  projectId: string;
  contract?: ContractWithDetails | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary';
const numericInputClass =
  'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/20 focus:border-primary';
const labelClass = 'block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1';

const toUndef = (v: number | null): number | undefined =>
  v === null || !Number.isFinite(v) ? undefined : v;

export const ContractEditDialog: React.FC<Props> = ({
  projectId,
  contract,
  onClose,
  onSaved,
}) => {
  const isEditing = Boolean(contract?.id);

  const [form, setForm] = useState({
    title: contract?.title ?? '',
    contractNumber: contract?.contractNumber ?? '',
    vendorName: contract?.vendorName ?? '',
    vendorIco: contract?.vendorIco ?? '',
    status: (contract?.status ?? 'draft') as ContractStatus,
    signedAt: contract?.signedAt?.slice(0, 10) ?? '',
    currency: contract?.currency ?? 'CZK',
    basePrice: (contract?.basePrice ?? null) as number | null,
    retentionShortPercent: (contract?.retentionShortPercent ?? null) as number | null,
    retentionShortAmount: (contract?.retentionShortAmount ?? null) as number | null,
    retentionShortReleaseOn: contract?.retentionShortReleaseOn?.slice(0, 10) ?? '',
    retentionShortStatus: (contract?.retentionShortStatus ?? 'held') as ContractRetentionStatus,
    retentionLongPercent: (contract?.retentionLongPercent ?? null) as number | null,
    retentionLongAmount: (contract?.retentionLongAmount ?? null) as number | null,
    retentionLongReleaseOn: contract?.retentionLongReleaseOn?.slice(0, 10) ?? '',
    retentionLongStatus: (contract?.retentionLongStatus ?? 'held') as ContractRetentionStatus,
    siteSetupPercent: (contract?.siteSetupPercent ?? null) as number | null,
    warrantyMonths: (contract?.warrantyMonths ?? null) as number | null,
    paymentTerms: contract?.paymentTerms ?? '',
    scopeSummary: contract?.scopeSummary ?? '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = <K extends keyof typeof form>(key: K, value: typeof form[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.vendorName.trim()) {
      setError('Název smlouvy a dodavatel jsou povinní.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        projectId,
        vendorName: form.vendorName,
        vendorIco: form.vendorIco.trim() || undefined,
        title: form.title,
        contractNumber: form.contractNumber || undefined,
        status: form.status,
        signedAt: form.signedAt || undefined,
        currency: form.currency,
        basePrice: toUndef(form.basePrice) ?? 0,
        retentionShortPercent: toUndef(form.retentionShortPercent),
        retentionShortAmount: toUndef(form.retentionShortAmount),
        retentionShortReleaseOn: form.retentionShortReleaseOn || undefined,
        retentionShortStatus: form.retentionShortStatus,
        retentionLongPercent: toUndef(form.retentionLongPercent),
        retentionLongAmount: toUndef(form.retentionLongAmount),
        retentionLongReleaseOn: form.retentionLongReleaseOn || undefined,
        retentionLongStatus: form.retentionLongStatus,
        siteSetupPercent: toUndef(form.siteSetupPercent),
        warrantyMonths:
          form.warrantyMonths !== null && Number.isFinite(form.warrantyMonths)
            ? Math.round(form.warrantyMonths)
            : undefined,
        paymentTerms: form.paymentTerms || undefined,
        scopeSummary: form.scopeSummary || undefined,
        source: 'manual' as const,
      } satisfies Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>;

      if (isEditing && contract) {
        await contractService.updateContract(contract.id, payload);
      } else {
        await contractService.createContract(payload);
      }
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se uložit smlouvu');
    } finally {
      setSubmitting(false);
    }
  };

  const showOcrPanel = isEditing && contract;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isEditing ? 'Upravit smlouvu' : 'Nová smlouva'}
      size={showOcrPanel ? 'full' : '2xl'}
    >
      <div
        className={
          showOcrPanel
            ? 'grid grid-cols-1 lg:grid-cols-2 gap-5 h-[78vh]'
            : ''
        }
      >
        {showOcrPanel && (
          <div className="min-h-0 overflow-hidden">
            <MarkdownDocumentPanel
              entityType="contract"
              entityId={contract.id}
              entityLabel={contract.title || contract.vendorName || 'Smlouva'}
              editable={false}
              fitParent
              enableSearch
            />
          </div>
        )}
        <div className={showOcrPanel ? 'overflow-y-auto pr-1' : ''}>
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3 py-2">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Název smlouvy *</label>
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Číslo smlouvy</label>
            <input
              className={inputClass}
              value={form.contractNumber}
              onChange={(e) => handleChange('contractNumber', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Dodavatel *</label>
            <input
              className={inputClass}
              value={form.vendorName}
              onChange={(e) => handleChange('vendorName', e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass}>IČ</label>
            <input
              className={inputClass}
              value={form.vendorIco}
              onChange={(e) => handleChange('vendorIco', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Stav</label>
            <select
              className={inputClass}
              value={form.status}
              onChange={(e) => handleChange('status', e.target.value as ContractStatus)}
            >
              <option value="draft">Rozpracováno</option>
              <option value="active">Aktivní</option>
              <option value="closed">Uzavřeno</option>
              <option value="cancelled">Zrušeno</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Datum podpisu</label>
            <input
              type="date"
              className={inputClass}
              value={form.signedAt}
              onChange={(e) => handleChange('signedAt', e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Cena díla (bez DPH)</label>
            <NumericInput
              value={form.basePrice}
              onChange={(v) => handleChange('basePrice', v)}
              allowNegative={false}
              maxFractionDigits={2}
              className={numericInputClass}
              suffix={form.currency}
            />
          </div>
          <div>
            <label className={labelClass}>Měna</label>
            <select
              className={inputClass}
              value={form.currency}
              onChange={(e) => handleChange('currency', e.target.value)}
            >
              <option value="CZK">CZK</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Zařízení staveniště (%)</label>
            <NumericInput
              value={form.siteSetupPercent}
              onChange={(v) => handleChange('siteSetupPercent', v)}
              allowNegative={false}
              maxFractionDigits={2}
              className={numericInputClass}
              suffix="%"
            />
          </div>
        </div>

        <fieldset className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <legend className="px-2 text-xs uppercase tracking-wider text-slate-500">
            Pozastávky — samostatná pole
          </legend>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border-l-[3px] border-l-blue-500 bg-slate-50 dark:bg-slate-900/40 p-3 space-y-2">
              <div className="text-xs font-semibold text-blue-500">
                Krátkodobá — do převzetí
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelClass}>%</label>
                  <NumericInput
                    value={form.retentionShortPercent}
                    onChange={(v) => handleChange('retentionShortPercent', v)}
                    allowNegative={false}
                    maxFractionDigits={2}
                    className={numericInputClass}
                    placeholder="7"
                    suffix="%"
                  />
                </div>
                <div>
                  <label className={labelClass}>Částka</label>
                  <NumericInput
                    value={form.retentionShortAmount}
                    onChange={(v) => handleChange('retentionShortAmount', v)}
                    allowNegative={false}
                    maxFractionDigits={2}
                    className={numericInputClass}
                    placeholder="vypočítá se"
                    suffix={form.currency}
                  />
                </div>
                <div>
                  <label className={labelClass}>Uvolnění</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={form.retentionShortReleaseOn}
                    onChange={(e) => handleChange('retentionShortReleaseOn', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Stav</label>
                  <select
                    className={inputClass}
                    value={form.retentionShortStatus}
                    onChange={(e) =>
                      handleChange('retentionShortStatus', e.target.value as ContractRetentionStatus)
                    }
                  >
                    <option value="held">Drží se</option>
                    <option value="released">Uvolněno</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-lg border-l-[3px] border-l-purple-500 bg-slate-50 dark:bg-slate-900/40 p-3 space-y-2">
              <div className="text-xs font-semibold text-purple-500">
                Dlouhodobá — do konce záruky
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelClass}>%</label>
                  <NumericInput
                    value={form.retentionLongPercent}
                    onChange={(v) => handleChange('retentionLongPercent', v)}
                    allowNegative={false}
                    maxFractionDigits={2}
                    className={numericInputClass}
                    placeholder="3"
                    suffix="%"
                  />
                </div>
                <div>
                  <label className={labelClass}>Částka</label>
                  <NumericInput
                    value={form.retentionLongAmount}
                    onChange={(v) => handleChange('retentionLongAmount', v)}
                    allowNegative={false}
                    maxFractionDigits={2}
                    className={numericInputClass}
                    placeholder="vypočítá se"
                    suffix={form.currency}
                  />
                </div>
                <div>
                  <label className={labelClass}>Uvolnění</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={form.retentionLongReleaseOn}
                    onChange={(e) => handleChange('retentionLongReleaseOn', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Stav</label>
                  <select
                    className={inputClass}
                    value={form.retentionLongStatus}
                    onChange={(e) =>
                      handleChange('retentionLongStatus', e.target.value as ContractRetentionStatus)
                    }
                  >
                    <option value="held">Drží se</option>
                    <option value="released">Uvolněno</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-500">
            Hodnoty se ukládají samostatně, nesčítají se. Dlouhodobá drží až do konce záruční doby.
          </p>
        </fieldset>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Záruční doba (měsíce)</label>
            <NumericInput
              value={form.warrantyMonths}
              onChange={(v) => handleChange('warrantyMonths', v)}
              allowNegative={false}
              maxFractionDigits={0}
              className={numericInputClass}
              suffix="měs."
            />
          </div>
          <div>
            <label className={labelClass}>Splatnost</label>
            <input
              className={inputClass}
              value={form.paymentTerms}
              onChange={(e) => handleChange('paymentTerms', e.target.value)}
              placeholder="30 dní od doručení faktury"
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Předmět díla</label>
          <textarea
            className={`${inputClass} resize-none`}
            rows={3}
            value={form.scopeSummary}
            onChange={(e) => handleChange('scopeSummary', e.target.value)}
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
            {submitting ? 'Ukládám…' : isEditing ? 'Uložit změny' : 'Vytvořit smlouvu'}
          </button>
        </div>
      </form>
        </div>
      </div>
    </Modal>
  );
};
