import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Plus, Save, Trash2, Star } from 'lucide-react';
import { Modal } from '@shared/ui/Modal';
import { budgetApi } from '../api/budgetApi';
import type { ProjectTender } from '../model/tenderImport';
import { tenderNameKey } from '../model/tenderImport';

interface Props { projectId: string; userId?: string; readOnly: boolean; onTemplates: () => void }
export function BudgetTenderCatalog({ projectId, userId, readOnly, onTemplates }: Props) {
  const [tab, setTab] = useState<'project' | 'personal'>('project');
  const [draft, setDraft] = useState<ProjectTender[] | null>(null);
  const [base, setBase] = useState<{ definitions: ProjectTender[]; version: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [defaultPreview, setDefaultPreview] = useState<{ version: number; previousCount: number; definitions: ProjectTender[] } | null>(null);
  const prepareDefault = async () => {
    if (busy || draft || !project.data || !userId) return;
    setBusy(true); setError('');
    try {
      const current = await budgetApi.personalTenders();
      setDefaultPreview({ version: current.version, previousCount: current.definitions.length, definitions: project.data.map(entry => ({ ...entry })) });
    } catch (e) { setError(e instanceof Error ? e.message : 'Výchozí číselník nelze načíst.'); }
    finally { setBusy(false); }
  };
  const setDefault = async () => {
    if (!defaultPreview || busy) return;
    setBusy(true); setError('');
    try {
      const saved = await budgetApi.personalTenders(defaultPreview.definitions, defaultPreview.version);
      cache.setQueryData(['personal-tender-defaults', userId], saved);
      setDefaultPreview(null); setNotice('Číselník byl nastaven jako výchozí pro vaše nové stavby.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Výchozí číselník se nepodařilo uložit.'); }
    finally { setBusy(false); }
  };
  const cache = useQueryClient();
  const project = useQuery({ queryKey: ['budget-project-tenders', projectId, userId], queryFn: () => budgetApi.projectTenders(projectId) });
  const personal = useQuery({ queryKey: ['personal-tender-defaults', userId], queryFn: () => budgetApi.personalTenders(), enabled: tab === 'personal' && !!userId });
  const query = tab === 'project' ? project : personal;
  const definitions = tab === 'project' ? project.data : personal.data?.definitions;
  const entries = draft ?? definitions ?? [];
  const canEdit = tab === 'personal' ? !!userId : !readOnly;
  const update = (next: ProjectTender[]) => {
    if (!base) setBase({ definitions: definitions ?? [], version: personal.data?.version ?? 0 });
    setDraft(next); setNotice('');
  };
  const invalid = entries.some((entry, i) => !entry.title.trim() || entries.slice(0, i).some(other => tenderNameKey(other.title) === tenderNameKey(entry.title) || !!entry.externalCode.trim() && other.externalCode.trim() === entry.externalCode.trim()));
  const move = (index: number, direction: number) => { const next = [...entries]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; update(next); };
  const save = async () => {
    if (busy || !draft || !base || !canEdit || invalid) return;
    setBusy(true); setError('');
    try {
      const normalized = draft.map(entry => ({ ...entry, title: entry.title.trim(), externalCode: entry.externalCode.trim() }));
      let warning: string | undefined;
      if (tab === 'personal') {
        const saved = await budgetApi.personalTenders(normalized, base.version);
        cache.setQueryData(['personal-tender-defaults', userId], saved);
      } else {
        warning = await budgetApi.saveProjectTenders(projectId, base.definitions, normalized);
        await cache.invalidateQueries();
      }
      setDraft(null); setBase(null); setNotice(warning ?? (tab === 'personal' ? 'Výchozí VŘ uložena. Použijí se při vytvoření dalších staveb.' : 'VŘ této stavby byla uložena.'));
    } catch (e) { setError(e instanceof Error ? e.message : 'Číselník se nepodařilo uložit.'); }
    finally { setBusy(false); }
  };
  return <div className="tf-budget-tender-catalog tf-budget-controls">
    <h3>Číselník výběrových řízení</h3>
    <div className="tf-budget-toolbar" role="tablist" aria-label="Číselníky VŘ">
      <button role="tab" aria-selected={tab === 'project'} disabled={busy || draft !== null} onClick={() => { setTab('project'); setError(''); setNotice(''); }}>VŘ této stavby</button>
      <button role="tab" aria-selected={tab === 'personal'} disabled={busy || draft !== null || !userId} onClick={() => { setTab('personal'); setError(''); setNotice(''); }}>Moje výchozí VŘ</button>
    </div>
    {tab === 'personal' && personal.data?.version === 0 && <p role="status">Používáte společný základní číselník Tender Flow. Úpravou a uložením vytvoříte svůj vlastní výchozí seznam.</p>}
    <p>{tab === 'personal' ? 'Tento osobní základ se automaticky zkopíruje do každé nové stavby, kterou vytvoříte. Existující stavby se nezmění. Pořadí platí pro váš výchozí seznam.' : 'Názvy a čísla VŘ této stavby. Položky rozpočtu přiřadíte k VŘ v sekci Položky, jednotlivě i hromadně.'}</p>
    {query.isPending ? <p role="status">Načítání číselníku…</p> : query.error ? <p role="alert">{query.error.message}<button onClick={() => void query.refetch()}>Načíst znovu</button></p> : <>
      <div className="tf-budget-toolbar">
        <button disabled={!canEdit || busy || entries.length >= 500} onClick={() => update([...entries, { id: crypto.randomUUID(), title: '', externalCode: '' }])}><Plus size={16} aria-hidden="true"/>Přidat VŘ</button>
        {tab === 'project' && <button disabled={!userId || busy || draft !== null || !entries.length} onClick={() => void prepareDefault()}><Star size={16} aria-hidden="true"/>Nastavit jako výchozí</button>}
        {tab === 'project' && <button disabled={readOnly || busy || draft !== null} onClick={onTemplates}>Importovat / exportovat vzor</button>}
        <button disabled={!canEdit || !draft || busy || invalid} onClick={() => void save()}><Save size={16} aria-hidden="true"/>{busy ? 'Ukládání…' : 'Uložit číselník'}</button>
        {draft && <button disabled={busy} onClick={() => { setDraft(null); setBase(null); setError(''); void query.refetch(); }}>Zahodit změny</button>}
      </div>
      <div className="tf-budget-catalog-scroll"><table aria-label={tab === 'personal' ? 'Moje výchozí VŘ' : 'VŘ této stavby'}><thead><tr><th>Číslo VŘ</th><th>Název VŘ</th><th>Akce</th></tr></thead><tbody>
        {entries.map((entry, index) => <tr key={entry.id}>
          <td><input aria-label={`Číslo VŘ ${index + 1}`} maxLength={100} value={entry.externalCode} disabled={!canEdit || busy} onChange={e => update(entries.map(row => row.id === entry.id ? { ...row, externalCode: e.target.value } : row))}/></td>
          <td><input aria-label={`Název VŘ ${index + 1}`} maxLength={255} value={entry.title} disabled={!canEdit || busy} onChange={e => update(entries.map(row => row.id === entry.id ? { ...row, title: e.target.value } : row))}/></td>
          <td><div className="tf-budget-toolbar">
            {tab === 'personal' && <><button aria-label={`Posunout VŘ ${index + 1} nahoru`} disabled={busy || index === 0} onClick={() => move(index, -1)}><ArrowUp size={16}/></button><button aria-label={`Posunout VŘ ${index + 1} dolů`} disabled={busy || index === entries.length - 1} onClick={() => move(index, 1)}><ArrowDown size={16}/></button></>}
            {(tab === 'personal' || !project.data?.some(old => old.id === entry.id)) && <button aria-label={`Odstranit VŘ ${index + 1} z číselníku`} disabled={!canEdit || busy} onClick={() => update(entries.filter(row => row.id !== entry.id))}><Trash2 size={16}/></button>}
          </div></td>
        </tr>)}
      </tbody></table></div>
      {!entries.length && <p>Číselník zatím neobsahuje žádná VŘ. Začněte tlačítkem Přidat VŘ.</p>}
      {invalid && <p role="alert">Doplňte názvy a odstraňte duplicitní názvy nebo čísla VŘ.</p>}
    </>}
    {defaultPreview && <Modal isOpen title="Nastavit číselník jako výchozí" persistent={busy} onClose={() => { setDefaultPreview(null); setError(''); }}>
      <div className="tf-budget-controls"><p>Číselník této stavby ({defaultPreview.definitions.length} VŘ) nahradí váš osobní výchozí číselník ({defaultPreview.previousCount} VŘ).</p><p>Použije se pro nově vytvořené stavby. Existující stavby se nezmění.</p><div className="tf-budget-toolbar"><button disabled={busy} onClick={() => { setDefaultPreview(null); setError(''); }}>Zrušit</button><button disabled={busy} onClick={() => void setDefault()}>Potvrdit výchozí číselník</button></div>{error && <p role="alert">{error}</p>}</div>
    </Modal>}
    {error && !defaultPreview && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
  </div>;
}
