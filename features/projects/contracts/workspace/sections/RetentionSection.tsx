import React, { useState } from 'react';
import type { ContractWithDetails } from '@/types';
import { contractMutationsApi } from '../../api';
import { computeRetention } from '../../utils/retention';
import { formatDate, formatMoney, formatPercent } from '../../utils/format';

interface Props {
  contract: ContractWithDetails;
  onRefresh: () => Promise<void> | void;
}
// Match contractService.todayIso and the UTC validation in the RPC.
const today = () => new Date().toISOString().slice(0, 10);

export const RetentionSection: React.FC<Props> = ({ contract, onRefresh }) => {
  const breakdown = computeRetention(contract);
  const [confirming, setConfirming] = useState<'short' | 'long' | null>(null);
  const [releaseDate, setReleaseDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const release = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!confirming || saving) return;
    setSaving(true);
    setError('');
    try {
      await contractMutationsApi.releaseRetention(contract.id, confirming, releaseDate);
      setConfirming(null);
      try { await onRefresh(); } catch { setError('Uvolnění je uložené. Obnovte detail pro načtení aktuálních údajů.'); }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uvolnění se nepodařilo uložit. Zkuste to znovu.');
    } finally { setSaving(false); }
  };
  const rows = [
    { kind: 'short' as const, title: 'Krátkodobá pozastávka', action: 'krátkodobou', percent: breakdown.shortPercent, amount: breakdown.shortAmount, explicit: contract.retentionShortAmount, status: contract.retentionShortStatus, expected: contract.retentionShortExpectedOn, legacyDate: contract.retentionShortReleaseOn, accent: 'border-l-blue-500' },
    { kind: 'long' as const, title: 'Dlouhodobá pozastávka', action: 'dlouhodobou', percent: breakdown.longPercent, amount: breakdown.longAmount, explicit: contract.retentionLongAmount, status: contract.retentionLongStatus, expected: contract.retentionLongExpectedOn, legacyDate: contract.retentionLongReleaseOn, accent: 'border-l-purple-500' },
  ];
  return (
    <section id="sec-poz" className="@container py-4 border-b border-dashed border-slate-200 dark:border-slate-800">
      <h3 className="text-[11px] uppercase tracking-widest text-slate-600 dark:text-slate-500 font-bold mb-3">Pozastávky</h3>
      <div className="grid grid-cols-1 @lg:grid-cols-2 gap-3">
        {rows.map(row => {
          const applies = row.amount > 0 || row.percent > 0;
          const released = row.status === 'released';
          const expected = row.expected ?? (!released ? row.legacyDate : undefined);
          return (
            <div key={row.kind} className={`rounded-xl bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 border-l-[3px] ${row.accent} p-4 flex flex-col gap-1.5`}>
              <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 m-0">{row.title}</h4>
              <div className="text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">{formatMoney(row.amount, contract.currency)}</div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                {row.explicit != null ? 'Samostatně zadaná částka' : `${formatPercent(row.percent)} z ceny smlouvy včetně dodatků (${formatMoney(contract.currentTotal, contract.currency)})`}
              </p>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{released ? 'Uvolněno' : applies ? 'Drží se' : 'Neuplatňuje se'}</span>
              {applies || released ? <>
                <div className="flex justify-between gap-2 text-xs text-slate-600 dark:text-slate-400"><span>Očekávané uvolnění</span><strong className="whitespace-nowrap">{formatDate(expected)}</strong></div>
                {released && <div className="flex justify-between gap-2 text-xs text-slate-600 dark:text-slate-400"><span>Skutečné uvolnění</span><strong className="whitespace-nowrap">{formatDate(row.legacyDate)}</strong></div>}
              </> : null}
              {applies && !released && <button type="button" disabled={saving} onClick={() => { setConfirming(row.kind); setReleaseDate(today()); setError(''); }} className="mt-2 w-fit px-3 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-50">Označit {row.action} jako uvolněnou</button>}
            </div>
          );
        })}
      </div>
      {confirming && <form onSubmit={release} className="mt-3 p-3 rounded-lg border border-slate-300 dark:border-slate-700 space-y-2 text-xs text-slate-700 dark:text-slate-300">
        <p>Potvrzujete skutečné uvolnění {confirming === 'short' ? 'krátkodobé' : 'dlouhodobé'} pozastávky. Ověřte splnění podmínek smlouvy; tento záznam neprovádí platbu.</p>
        <label className="flex flex-wrap items-center gap-2">Datum skutečného uvolnění
          <input type="date" required min="1900-01-01" max={today()} value={releaseDate} disabled={saving} onChange={event => setReleaseDate(event.target.value)} className="rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1" />
        </label>
        <div className="flex gap-2"><button type="submit" disabled={saving} className="rounded bg-primary text-white px-3 py-1 disabled:opacity-50">{saving ? 'Ukládám…' : 'Potvrdit uvolnění'}</button><button type="button" disabled={saving} onClick={() => setConfirming(null)} className="px-3 py-1">Zrušit</button></div>
      </form>}
      {error && <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
      <div className="mt-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-950/60 flex justify-between text-xs text-slate-700 dark:text-slate-300"><span>Smluvní pozastávky celkem</span><strong>{formatMoney(breakdown.totalAmount, contract.currency)}</strong></div>
      <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-400">Jde o aktuální smluvní výpočet, nikoli evidenci skutečně zadržené částky z faktur. Prázdná pozastávka se neuplatňuje.</p>
      <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">Fakturace: evidováno {formatMoney(contract.invoicedSum, contract.currency)} · uhrazeno {formatMoney(contract.paidSum, contract.currency)}. Tyto součty nepotvrzují splnění podmínek uvolnění.</p>
    </section>
  );
};
