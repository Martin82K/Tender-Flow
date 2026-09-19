import React, { useState } from 'react';
import { Modal } from '@shared/ui/Modal';
import type { BudgetPurgeJob, BudgetPurgeSelection, BudgetRevisionSummary } from '../api/budgetApi';
import type { BudgetSource } from '../model/types';

interface Props {
  revisions: BudgetRevisionSummary[];
  sources: BudgetSource[];
  allRevisions: BudgetRevisionSummary[];
  pending?: BudgetPurgeJob;
  onClose: () => void;
  onPurge: (jobId: string, selection: BudgetPurgeSelection) => Promise<void>;
}
export function BudgetPurgeDialog({ revisions, sources, allRevisions, pending, onClose, onPurge }: Props) {
  const [jobId] = useState(() => pending?.id ?? crypto.randomUUID());
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const blocked = !pending && sources.some(s => allRevisions.some(r => r.source_id === s.id && !revisions.some(selected => selected.id === r.id)));
  const revisionCount = pending?.revisionCount ?? revisions.length;
  const sourceCount = pending?.sourceCount ?? sources.length;
  const remove = async () => {
    if (busy || blocked || confirmation !== 'SMAZAT') return;
    setBusy(true); setError('');
    try {
      await onPurge(jobId, { revisions: revisions.map(r => ({ id: r.id, version: r.version })), sources: sources.map(s => ({ id: s.id, deleted_at: s.deleted_at! })) });
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Mazání se nepodařilo dokončit.'); }
    finally { setBusy(false); }
  };
  return <Modal isOpen title={pending ? 'Dokončit trvalé mazání' : 'Trvale smazat z koše'} size="md" persistent={busy} showCloseButton={!busy} onClose={() => { if (!busy) onClose(); }}>
    <div className="tf-budget-controls tf-budget-purge-dialog">
      <p><strong>{revisionCount} revizí · {sourceCount} příloh XLSX</strong></p>
      <ul className="tf-budget-purge-list">{revisions.map(r => <li key={r.id}>{r.title}</li>)}{sources.map(s => <li key={s.id}>{s.filename}</li>)}</ul>
      <p>Vybrané revize včetně historie a vybrané soubory budou nevratně smazány. Částky v plánu VŘ, nabídky a smlouvy se nezmění.</p>
      {pending && <p>Operace už byla zahájena. Dokončení bezpečně naváže na předchozí pokus.</p>}
      {blocked ? <p role="alert">Přílohu používá jiná revize. Nejdříve smažte její revize, nebo vysypte celý koš.</p> : <label>Pro potvrzení napište <strong>SMAZAT</strong><input aria-label="Potvrzení trvalého smazání" autoComplete="off" value={confirmation} disabled={busy} onChange={e => setConfirmation(e.target.value)}/></label>}
      {error && <p role="alert" className="tf-budget-error">{error}</p>}
      <div className="tf-budget-toolbar"><button disabled={busy} onClick={onClose}>Zrušit</button><button className="tf-budget-danger" disabled={busy || blocked || confirmation !== 'SMAZAT'} onClick={() => void remove()}>{busy ? 'Mažu…' : 'Trvale smazat'}</button></div>
    </div>
  </Modal>;
}
