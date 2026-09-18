import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ThemedSelect } from '@shared/ui/ThemedSelect';
import { Button } from '@shared/ui/Button';
import { navigate, useLocation } from '@shared/routing/router';
import { buildAppUrl } from '@shared/routing/routeUtils';
import type { UseContractsWithDetailsResult } from '@features/projects/contracts/hooks/useContractsWithDetails';
import { contractDocumentsApi } from '@features/projects/contracts/documents/api';
import { documentKindLabels, type DocumentKind, type DocumentVersion } from '@features/projects/contracts/documents/model';
import { formatDate } from '@features/projects/contracts/utils/format';
import { groupSubcontractorDocuments, latestDocuments } from '../model/subcontractorDocuments';
import { DocumentRecordForm } from './DocumentRecordForm';
import { DocumentDetail } from './DocumentDetail';

const protocolCount = (count: number) => `${count} ${count === 1 ? 'protokol' : count >= 2 && count <= 4 ? 'protokoly' : 'protokolů'}`;
const tabs = [{id:'overview',label:'Přehled'},{id:'protocols',label:'Předávací protokoly'},{id:'other',label:'Ostatní dokumenty'}] as const;
export function SubcontractorDocuments({ projectId, contractsState, readOnly }: { projectId: string; contractsState: UseContractsWithDetailsResult; readOnly: boolean }) {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const view = tabs.find(t => t.id === params.get('documentsView'))?.id || 'overview';
  const documentId = params.get('documentId');
  const contractFilter = params.get('contractId') || '';
  const client = useQueryClient();
  const [groupId, setGroupId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<DocumentKind | ''>('');
  const [form, setForm] = useState<'new' | DocumentVersion | null>(null);
  const [openEditorFor, setOpenEditorFor] = useState<string | null>(null);
  const contracts = contractsState.contracts.filter(c => c.projectId === projectId);
  const ids = contracts.map(c => c.id).sort();
  const versions = useQuery({queryKey:['project-document-versions',projectId,ids], queryFn:() => contractDocumentsApi.projectVersions(ids), enabled:!contractsState.loading && !contractsState.error});
  const permission = useQuery({queryKey:['contract-document-write',projectId],queryFn:() => contractDocumentsApi.canWrite(projectId),enabled:!readOnly});
  const canWrite = !readOnly && permission.data === true && !versions.isError && !contractsState.error;
  const latest = useMemo(() => latestDocuments(versions.data || []), [versions.data]);
  const groups = groupSubcontractorDocuments(contracts, versions.data || []);
  const selected = latest.find(v => v.document_id === documentId);
  const normalized = query.toLocaleLowerCase('cs');
  const visible = latest.filter(v => (!groupId || groups.find(g => g.id === groupId)?.contracts.some(c => c.id === v.contract_id)) && (!contractFilter || v.contract_id === contractFilter) && (!kind || v.snapshot.kind === kind) && [v.snapshot.fields.vendorName,v.snapshot.fields.recordTitle,v.snapshot.fields.contractNumber].join(' ').toLocaleLowerCase('cs').includes(normalized));
  const go = (next: typeof view, id?: string, contractId?: string) => navigate(buildAppUrl('project',{projectId,tab:'documents',documentsSubTab:'subcontractor',documentsView:next,documentId:id,contractId}));
  const refresh = async () => { await client.invalidateQueries({queryKey:['project-document-versions',projectId]}); await client.invalidateQueries({queryKey:['contract-document-versions']}); };
  const loading = contractsState.loading || versions.isPending;
  const error = contractsState.error || versions.error?.message || permission.error?.message;
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-bold">Subdodavatel</h2><p className="mt-1 text-sm text-slate-500">Dokumenty stavby · Předání staveniště a díla</p></div>{canWrite && <Button disabled={loading || !contracts.length} onClick={() => setForm('new')}>Nový záznam</Button>}</div>
    <div role="tablist" aria-label="Dokumenty subdodavatele" className="flex gap-5 overflow-x-auto border-b border-slate-200 dark:border-slate-800">{tabs.map((tab,index) => <button key={tab.id} id={`documents-tab-${tab.id}`} role="tab" aria-selected={view===tab.id} aria-controls="documents-panel" tabIndex={view===tab.id?0:-1} className={`whitespace-nowrap pb-3 text-sm border-b-2 ${view===tab.id?'border-primary text-primary':'border-transparent text-slate-500'}`} onClick={() => {setGroupId(null);go(tab.id);}} onKeyDown={e => { const next=e.key==='ArrowRight'?(index+1)%tabs.length:e.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:e.key==='Home'?0:e.key==='End'?tabs.length-1:null; if(next!==null){e.preventDefault();go(tabs[next].id);document.getElementById(`documents-tab-${tabs[next].id}`)?.focus();} }}>{tab.label}{tab.id==='other' && <span className="ml-2 text-xs">Ve vývoji</span>}</button>)}</div>
    <div role="tabpanel" id="documents-panel" aria-labelledby={`documents-tab-${view}`}>
      {view==='other' ? <DevelopmentPlaceholder title="Ostatní dokumenty" /> : error ? <div role="alert" className="space-y-3"><p className="text-red-600">{error}</p><Button variant="outline" onClick={() => { void contractsState.refresh(); void versions.refetch(); void permission.refetch(); }}>Zkusit znovu</Button></div> : loading ? <p role="status">Načítám dokumenty…</p> : selected ? <DocumentDetail key={selected.document_id} version={selected} vendorId={contracts.find(contract => contract.id === selected.contract_id)?.vendorId} versions={(versions.data || []).filter(v => v.document_id===selected.document_id)} canWrite={canWrite} initialEditor={openEditorFor===selected.document_id} onBack={() => go('protocols')} onEdit={() => setForm(selected)} onRefresh={refresh} /> : documentId ? <p role="alert">Dokument není dostupný na této stavbě. <button className="text-primary" onClick={() => go('protocols')}>Zpět na seznam</button></p> : <div className="space-y-4">
        <div className="flex flex-wrap gap-3">{groupId && <Button size="sm" variant="outline" onClick={() => setGroupId(null)}>Všichni subdodavatelé</Button>}<input type="search" aria-label="Hledat v dokumentech" placeholder="Hledat subdodavatele, smlouvu nebo dokument…" value={query} onChange={e => setQuery(e.target.value)} className="flex-1 min-w-48 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm" />{view==='protocols' && <><ThemedSelect ariaLabel="Typ protokolu" value={kind} onChange={value => setKind(value as DocumentKind | '')} options={[{value:'',label:'Všechny typy'},...Object.entries(documentKindLabels).map(([value,label])=>({value,label}))]} /><ThemedSelect ariaLabel="Smlouva" value={contractFilter} onChange={value => go('protocols',undefined,value)} options={[{value:'',label:'Všechny smlouvy'},...contracts.map(c=>({value:c.id,label:c.vendorName+' · '+(c.contractNumber || c.title)}))]} /></>}</div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800"><table className="w-full text-left text-sm"><thead className="bg-slate-50 dark:bg-slate-900/50 text-xs text-slate-500">{view==='overview' ? <tr>{['Subdodavatel','Smlouvy','Předání staveniště','Předání díla',''].map((t,i) => <th key={i} className="p-4 font-medium">{t}</th>)}</tr> : <tr>{['Dokument','Subdodavatel / smlouva','Typ','Plánované datum','Verze',''].map((t,i) => <th key={i} className="p-4 font-medium">{t}</th>)}</tr>}</thead><tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {view==='overview' ? groups.filter(g => [g.name,...g.contracts.map(c => c.contractNumber)].join(' ').toLocaleLowerCase('cs').includes(normalized)).map(g => <tr key={g.id} className="hover:bg-primary/5"><td className="p-4 font-medium">{g.name}</td><td className="p-4 text-slate-500">{g.contracts.map(c => c.contractNumber || c.title).join(', ')}</td><td className="p-4">{protocolCount(g.documents.filter(d => d.snapshot.kind==='sub_site_handover').length)}</td><td className="p-4">{protocolCount(g.documents.filter(d => d.snapshot.kind==='sub_work_handover').length)}</td><td className="p-4"><Button size="sm" variant="outline" onClick={() => { setGroupId(g.id);setQuery(''); go('protocols'); }}>Zobrazit dokumenty</Button></td></tr>) : visible.map(v => <tr key={v.id} className="hover:bg-primary/5"><td className="p-4 font-medium">{v.snapshot.fields.recordTitle || documentKindLabels[v.snapshot.kind]}</td><td className="p-4">{v.snapshot.fields.vendorName}<span className="block text-xs text-slate-500">{v.snapshot.fields.contractNumber}</span></td><td className="p-4">{documentKindLabels[v.snapshot.kind]}</td><td className="p-4">{v.snapshot.fields.plannedDate ? formatDate(v.snapshot.fields.plannedDate) : '—'}</td><td className="p-4">{v.version}</td><td className="p-4"><Button size="sm" variant="outline" onClick={() => {setOpenEditorFor(null);go('protocols',v.document_id);}}>Otevřít</Button></td></tr>)}
        </tbody></table></div>
        {view==='overview' && !groups.length && <p className="text-sm text-slate-500">Nejprve přidejte subdodavatelskou smlouvu v sekci Smlouvy.</p>}
        {view==='protocols' && !visible.length && <p className="text-sm text-slate-500">Žádné odpovídající protokoly. Vytvořte nový záznam nebo upravte filtry.</p>}
      </div>}
    </div>
    {form && canWrite && <DocumentRecordForm contracts={contracts} initialContractId={contractFilter} existing={form==='new'?undefined:form} onClose={() => setForm(null)} onSaved={async (version,edit) => {await refresh();setForm(null);setOpenEditorFor(edit?version.document_id:null);go('protocols',version.document_id);}} />}
  </div>;
}
export function DevelopmentPlaceholder({ title }: {title: string}) {
  return <section className="rounded-xl border border-slate-200 dark:border-slate-800 p-10 text-center"><span aria-hidden="true" className="material-symbols-outlined text-3xl text-slate-500">construction</span><h2 className="mt-3 text-xl font-semibold">{title}</h2><p className="mt-2 text-sm text-slate-500">Ve vývoji</p></section>;
}
