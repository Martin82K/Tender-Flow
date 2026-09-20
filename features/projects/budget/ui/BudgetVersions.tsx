import React, { useState } from 'react';
import { FileSpreadsheet, RotateCcw, Trash2 } from 'lucide-react';
import { BudgetPurgeDialog } from './BudgetPurgeDialog';
import { Modal } from '@shared/ui/Modal';
import type { BudgetPermissions, BudgetRevisionSummary, BudgetPurgeJob, BudgetPurgeSelection } from '../api/budgetApi';
import type { BudgetSource } from '../model/types';

interface Props {
  revisions: BudgetRevisionSummary[];
  sources: BudgetSource[];
  permissions: BudgetPermissions;
  readOnly: boolean;
  purgeJobs?: BudgetPurgeJob[];
  onPurge?: (jobId: string, selection: BudgetPurgeSelection) => Promise<void>;
  categoryNames: Map<string, string>;
  onOpen: (id: string) => void;
  onDownload: (source: BudgetSource) => void;
  onConvert: (source: BudgetSource) => void;
  onChange: (id: string, kind: 'revision' | 'source', restore: boolean, version?: number) => Promise<void>;
}
type Target = { kind: 'revision'; value: BudgetRevisionSummary } | { kind: 'source'; value: BudgetSource };

export function BudgetVersions({ revisions, sources, permissions, readOnly, categoryNames, onOpen, onDownload, onConvert, onChange, onPurge, purgeJobs = [] }: Props) {
  const [purge, setPurge] = useState<{ revisions: BudgetRevisionSummary[]; sources: BudgetSource[]; pending?: BudgetPurgeJob } | null>(null);
  const canPurge = !!permissions.purge && !readOnly && !!onPurge;
  const [trash, setTrash] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canEdit = permissions.edit && permissions.prices && !readOnly;
  const canChangeRevision = (r: BudgetRevisionSummary) => canEdit && !r.purge_job_id && (r.status !== 'confirmed' || permissions.confirm) && (!r.allocation_count || permissions.allocate);
  const choose = (next: Target) => { setError(''); setTarget(next); };
  const restore = !!target?.value.deleted_at;
  const linked = target?.kind === 'revision' ? target.value.category_ids ?? [] : [];
  const activeReferences = target?.kind === 'source' ? revisions.filter(r => r.source_id === target.value.id && !r.deleted_at) : [];
  const missingSource = target?.kind === 'revision' && restore && sources.some(s => s.id === target.value.source_id && s.deleted_at);
  const blocked = (!restore && activeReferences.length > 0) || missingSource;
  const name = target?.kind === 'revision' ? target.value.title : target?.value.filename;
  const confirm = async () => {
    if (!target || blocked || busy) return;
    setBusy(true); setError('');
    try {
      await onChange(target.value.id, target.kind, restore, target.kind === 'revision' ? target.value.version : undefined);
      setTarget(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'Změnu se nepodařilo uložit.'); }
    finally { setBusy(false); }
  };
  return <div className="tf-budget-versions">
    <div className="tf-budget-toolbar"><h3>{trash ? 'Koš rozpočtu' : 'Importy a verze'}</h3><button aria-pressed={trash} onClick={() => setTrash(!trash)}><Trash2 size={14} aria-hidden="true"/> {trash ? 'Zpět na aktivní' : `Koš (${revisions.filter(r => r.deleted_at).length + sources.filter(s => s.deleted_at).length})`}</button></div>
    {trash && <p className="tf-budget-import-muted">Odstraněné revize a přílohy lze obnovit. Jejich historie i původní soubory zůstávají zachované.</p>}
    {trash && canPurge && <div className="tf-budget-toolbar"><button className="tf-budget-danger" disabled={!!purgeJobs.length || !revisions.some(r=>r.deleted_at) && !sources.some(s=>s.deleted_at)} onClick={()=>setPurge({revisions:revisions.filter(r=>!!r.deleted_at),sources:sources.filter(s=>!!s.deleted_at)})}>Vysypat koš</button>{purgeJobs.map(job=><button key={job.id} onClick={()=>setPurge({revisions:[],sources:[],pending:job})}>Dokončit mazání ({job.revisionCount} revizí, {job.sourceCount} příloh)</button>)}</div>}
    <h3>Verze rozpočtu</h3>
    {!revisions.some(r => !!r.deleted_at === trash) && <p className="tf-budget-import-muted">{trash ? 'V koši nejsou žádné revize.' : 'Zatím žádný převedený rozpočet.'}</p>}
    {revisions.filter(r => !!r.deleted_at === trash).map(r => <div className="tf-budget-version-card" key={r.id}>
      <FileSpreadsheet size={20} aria-hidden="true"/><div className="tf-budget-version-info"><strong>{r.title}</strong><small>{r.status === 'confirmed' ? 'Potvrzený' : 'Pracovní'} · Vytvořeno {new Date(r.created_at).toLocaleString('cs-CZ')}{r.deleted_at?` · V koši od ${new Date(r.deleted_at).toLocaleString('cs-CZ')}`:''}</small></div>
      <button onClick={() => onOpen(r.id)}>{trash ? 'Zobrazit historii' : 'Otevřít'}</button>
      {canChangeRevision(r) && <button aria-label={`${trash ? 'Obnovit' : 'Odstranit'} revizi ${r.title}`} onClick={() => choose({ kind: 'revision', value: r })}>{trash ? <RotateCcw size={14} aria-hidden="true"/> : <Trash2 size={14} aria-hidden="true"/>}{trash ? 'Obnovit' : 'Odstranit'}</button>}
      {trash && canPurge && !r.purge_job_id && <button className="tf-budget-danger" aria-label={`Trvale smazat revizi ${r.title}`} onClick={()=>setPurge({revisions:[r],sources:[]})}>Trvale smazat</button>}
    </div>)}
    <h3>Původní přílohy</h3>
    {!sources.some(s => !!s.deleted_at === trash) && <p className="tf-budget-import-muted">{trash ? 'V koši nejsou žádné přílohy.' : 'Zatím žádné přílohy.'}</p>}
    {sources.filter(s => !!s.deleted_at === trash).map(s => <div className="tf-budget-version-card" key={s.id}>
      <FileSpreadsheet size={20} aria-hidden="true"/><div className="tf-budget-version-info"><strong>{s.filename}</strong><small>Nahráno {new Date(s.created_at).toLocaleString('cs-CZ')}</small><small>{s.first_converted_at?`První převod ${new Date(s.first_converted_at).toLocaleString('cs-CZ')}`:'Zatím nepřevedeno'}{s.last_converted_at&&s.last_converted_at!==s.first_converted_at?` · Poslední převod ${new Date(s.last_converted_at).toLocaleString('cs-CZ')}`:''}</small></div>
      {permissions.prices && <button onClick={() => onDownload(s)}>Stáhnout</button>}
      {canEdit && !trash && <button onClick={() => onConvert(s)}>Převést</button>}
      {canEdit && !s.purge_job_id && <button aria-label={`${trash ? 'Obnovit' : 'Odstranit'} přílohu ${s.filename}`} onClick={() => choose({ kind: 'source', value: s })}>{trash ? <RotateCcw size={14} aria-hidden="true"/> : <Trash2 size={14} aria-hidden="true"/>}{trash ? 'Obnovit' : 'Odstranit'}</button>}
      {trash && canPurge && !s.purge_job_id && <button className="tf-budget-danger" aria-label={`Trvale smazat přílohu ${s.filename}`} onClick={()=>setPurge({revisions:[],sources:[s]})}>Trvale smazat</button>}
    </div>)}
    {purge && onPurge && <BudgetPurgeDialog {...purge} allRevisions={revisions} onClose={()=>setPurge(null)} onPurge={onPurge}/>}
    {target && <Modal isOpen title={restore ? 'Obnovit z koše' : 'Přesunout do koše'} persistent={busy} showCloseButton={!busy} onClose={() => { if (!busy) setTarget(null); }}><div className="tf-budget-controls flex flex-col gap-2">
      <strong className="break-words">{name}</strong>
      <p>{restore ? 'Záznam bude znovu dostupný mezi aktivními rozpočty.' : 'Záznam zmizí z aktivního seznamu. Kdykoliv jej můžete obnovit z koše.'}</p>
      {!!linked.length && <div><p>Vazby na {linked.length} VŘ zůstanou v této revizi:</p><ul>{linked.map(id => <li key={id}>{categoryNames.get(id) || 'Nedostupné VŘ'}</li>)}</ul></div>}
      {target.kind === 'revision' && <p>Částky v plánu VŘ, nabídky ani smlouvy se touto akcí nemění. {target.value.status === 'confirmed' ? 'Revize zůstane potvrzená a její historie bude zachovaná.' : 'Historie úprav zůstane zachovaná.'}</p>}
      {!!activeReferences.length && !restore && <p role="alert">Přílohu používá {activeReferences.length} aktivních revizí. Nejprve je přesuňte do koše.</p>}
      {missingSource && <p role="alert">Nejprve obnovte původní přílohu z koše.</p>}
      {error && <p role="alert" className="tf-budget-error">{error}</p>}
      <div className="tf-budget-toolbar"><button disabled={busy} onClick={() => setTarget(null)}>Zrušit</button><button disabled={busy || !!blocked} onClick={() => void confirm()}>{busy ? 'Ukládání…' : restore ? 'Potvrdit obnovení' : 'Přesunout do koše'}</button></div>
    </div></Modal>}
  </div>;
}
