import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ThemedSelect } from '@shared/ui/ThemedSelect';
import { Button } from '@shared/ui/Button';
import type { ContractWithDetails } from '@/types';
import { contractDocumentsApi } from './api';
import { resultLabels, type HandoverEvent, type HandoverResult } from './model';
import { documentInputClass } from './ProtocolEditor';
import { formatDate } from '../utils/format';
import { WarrantySection } from '../workspace/sections/WarrantySection';

export const HandoverSection: React.FC<{ contract: ContractWithDetails; onRefresh: () => Promise<void> | void; warrantyOnly?: boolean }> = ({ contract, onRefresh, warrantyOnly = false }) => {
  const queryClient = useQueryClient();
  const key = ['contract-handover-events', contract.id];
  const events = useQuery({ queryKey: key, queryFn: () => contractDocumentsApi.events(contract.id) });
  const permission = useQuery({ queryKey: ['contract-document-write', contract.projectId], queryFn: () => contractDocumentsApi.canWrite(contract.projectId) });
  const [kind, setKind] = useState<HandoverEvent['kind'] | null>(null);
  const [date, setDate] = useState('');
  const [result, setResult] = useState<HandoverResult>('');
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const displayEvents = (events.data || []).filter(event => !warrantyOnly || event.kind === 'warranty');
  const handover = events.data?.find(e => e.kind === 'handover');
  const confirm = async (event: React.FormEvent) => {
    event.preventDefault(); if (!kind) return; setBusy(true); setError('');
    try {
      await contractDocumentsApi.confirm(contract.id, kind, date, result, source);
      setKind(null); setDate(''); setSource(''); setResult('');
      await queryClient.invalidateQueries({ queryKey: key }); await onRefresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Potvrzení nelze uložit.'); } finally { setBusy(false); }
  };
  return <section className="py-4 space-y-4">
    {!warrantyOnly && <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-sm">Předání díla</h3><p className="text-sm mt-1">{handover ? `${resultLabels[handover.result]} · ${formatDate(handover.effective_date)}` : events.isPending ? 'Načítám…' : 'Předání zatím nepotvrzeno'}</p></div><Button size="sm" variant="outline" disabled={!permission.data || busy || events.isError} onClick={() => { setKind('handover'); setDate(''); setResult(''); setSource(''); }}>Zapsat předání</Button></div>}
    <WarrantySection contract={contract} />
    <Button size="sm" variant="outline" disabled={!permission.data || busy || events.isError} onClick={() => { setKind('warranty'); setDate(''); setSource(''); }}>Potvrdit začátek záruky</Button>
    {(error || events.error || permission.error) && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error || events.error?.message || permission.error?.message}</p>}
    {kind && <form onSubmit={confirm} className="rounded-xl border border-primary/40 p-4"><fieldset disabled={busy} className="space-y-3">
      <h4 className="text-sm font-semibold">{kind === 'handover' ? 'Záznam skutečného předání' : 'Potvrzení začátku záruky'}</h4>
      <label className="block text-xs">{kind === 'handover' ? 'Skutečné datum předání' : 'Začátek záruky'}<input required type="date" min="1900-01-01" max={new Date().toLocaleDateString('en-CA')} value={date} onChange={e => setDate(e.target.value)} className={documentInputClass} /></label>
      {kind === 'handover' && <label className="block text-xs">Výsledek<ThemedSelect ariaLabel="Výsledek" value={result} onChange={value => setResult(value as HandoverResult)} options={Object.entries(resultLabels).map(([value,label]) => ({value,label}))} /></label>}
      <label className="block text-xs">Zdroj potvrzení<textarea required maxLength={2000} rows={2} value={source} onChange={e => setSource(e.target.value)} placeholder="Např. podepsaný protokol PP-008, verze 2, nebo záznam stavbyvedoucího" className={documentInputClass} /></label>
      <p className="text-xs text-slate-500">Záznam uloží datum, autora a zdroj do historie. Pozastávky se uvolňují samostatně.</p>
      <div className="flex gap-2"><Button type="submit" disabled={busy || !source.trim() || !date || (kind === 'handover' && !result)}>{busy ? 'Ukládám…' : 'Potvrdit a uložit'}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => setKind(null)}>Zrušit</Button></div>
    </fieldset></form>}
    {!!displayEvents.length && <details className="text-xs"><summary className="cursor-pointer text-slate-500">Historie potvrzení ({displayEvents.length})</summary><ol className="space-y-3 mt-3">{displayEvents.map(event => <li key={event.id} className="border-l-2 border-slate-300 dark:border-slate-700 pl-3"><strong>{event.kind === 'handover' ? 'Předání díla' : event.kind === 'site_handover' ? 'Předání staveniště' : 'Začátek záruky'} · {formatDate(event.effective_date)}</strong><p className="whitespace-pre-wrap break-words mt-1">{event.source_note}</p><p className="text-slate-500 mt-1">Zapsáno {new Date(event.created_at).toLocaleString('cs-CZ')} · Autor {event.created_by || 'Odstraněný účet'}</p></li>)}</ol></details>}
  </section>;
};
