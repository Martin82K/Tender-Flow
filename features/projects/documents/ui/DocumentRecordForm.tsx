import React, { useState } from 'react';
import type { ContractWithDetails } from '@/types';
import { ThemedSelect } from '@shared/ui/ThemedSelect';
import { Button } from '@shared/ui/Button';
import { Modal } from '@shared/ui/Modal';
import { contractDocumentsApi } from '@features/projects/contracts/documents/api';
import { documentInputClass } from '@features/projects/contracts/documents/ProtocolEditor';
import { createHandoverDraft, documentKindLabels, freezeDocument, type DocumentKind, type DocumentVersion } from '@features/projects/contracts/documents/model';

export function DocumentRecordForm({ contracts, existing, initialContractId, onClose, onSaved }: {
  contracts: ContractWithDetails[]; existing?: DocumentVersion; initialContractId?: string;
  onClose: () => void; onSaved: (version: DocumentVersion, edit: boolean) => Promise<void>;
}) {
  const [contractId, setContractId] = useState(existing?.contract_id || contracts.find(contract => contract.id === initialContractId)?.id || contracts[0]?.id || '');
  const [kind, setKind] = useState<DocumentKind>(existing?.snapshot.kind || 'sub_site_handover');
  const [title, setTitle] = useState(existing?.snapshot.fields.recordTitle || '');
  const [date, setDate] = useState(existing?.snapshot.fields.plannedDate || '');
  const [scope, setScope] = useState(existing?.snapshot.fields.scope || '');
  const [note, setNote] = useState(existing?.snapshot.fields.note || '');
  const [method, setMethod] = useState<'editor' | 'file'>('editor');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [documentId] = useState(() => existing?.document_id || crypto.randomUUID());
  const close = () => { if (!busy && (!dirty || window.confirm('Zavřít bez uložení změn?'))) onClose(); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const contract = contracts.find(item => item.id === contractId);
    if (!contract) { setError('Vyberte dostupnou subdodavatelskou smlouvu.'); return; }
    setBusy(true); setError('');
    try {
      const context = existing ? null : await contractDocumentsApi.context(contract.projectId, contract.vendorId);
      const fields = existing?.snapshot.fields || { ...createHandoverDraft(contract, context!.project, context!.organizationName), organizationAddress: context!.organizationAddress, vendorAddress: context!.vendorAddress };
      const version = await contractDocumentsApi.save(contractId, documentId, existing?.version || 0, freezeDocument({ ...fields, recordTitle: title.trim(), plannedDate: date, scope: scope.trim() || fields.scope, note }, new Date().toISOString(), (existing?.version || 0) + 1, existing?.snapshot.logo || context?.logo || null, kind));
      setDirty(false); await onSaved(version, !existing && method === 'editor');
    } catch (e) { setError(e instanceof Error ? e.message : 'Záznam nelze uložit.'); } finally { setBusy(false); }
  };
  return <Modal isOpen onClose={close} persistent={busy} size="xl" title={existing ? 'Upravit záznam' : 'Nový předávací protokol'}>
    <form onSubmit={save} onChange={() => setDirty(true)}><fieldset disabled={busy} className="space-y-4">
      {error && <p role="alert" className="text-red-600">{error}</p>}
      <label className="block text-sm">Subdodavatel a smlouva<ThemedSelect ariaLabel="Subdodavatel a smlouva" disabled={!!existing || busy} value={contractId} onChange={value => {setContractId(value);setDirty(true);}} className="mt-1" options={contracts.map(c => ({value:c.id,label:c.vendorName+' · '+(c.contractNumber || c.title)}))} /></label>
      <label className="block text-sm">Typ protokolu<ThemedSelect ariaLabel="Typ protokolu" disabled={!!existing || busy} value={kind} onChange={value => {setKind(value as DocumentKind);setDirty(true);}} className="mt-1" options={Object.entries(documentKindLabels).map(([value,label])=>({value,label}))} /></label>
      <label className="block text-sm">Název záznamu<input required maxLength={300} value={title} onChange={e => setTitle(e.target.value)} placeholder={documentKindLabels[kind]} className={documentInputClass} /></label>
      <label className="block text-sm">Plánované datum<input type="date" value={date} onChange={e => setDate(e.target.value)} className={documentInputClass} /></label>
      <label className="block text-sm">Předávaný rozsah<textarea rows={3} maxLength={10000} value={scope} onChange={e => setScope(e.target.value)} className={documentInputClass} /></label>
      <label className="block text-sm">Interní poznámka<textarea rows={2} maxLength={10000} value={note} onChange={e => setNote(e.target.value)} className={documentInputClass} /></label>
      {!existing && <fieldset className="space-y-2"><legend className="text-sm mb-2">Dokument</legend><label className="block text-sm"><input type="radio" name="preparation" checked={method === 'editor'} onChange={() => setMethod('editor')} /> Vytvořit v editoru</label><label className="block text-sm"><input type="radio" name="preparation" checked={method === 'file'} onChange={() => setMethod('file')} /> Připojit PDF nebo DOCX po uložení</label></fieldset>}
      <p className="text-xs text-slate-500">Uložení záznamu nepotvrzuje skutečné předání ani začátek záruky. Úpravy vytvoří novou verzi; původní soubory zůstanou v historii.</p>
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={close}>Zrušit</Button><Button type="submit" disabled={busy || !contractId || !title.trim()}>{busy ? 'Ukládám…' : existing ? 'Uložit změny' : method === 'editor' ? 'Uložit a otevřít editor' : 'Uložit záznam'}</Button></div>
    </fieldset></form>
  </Modal>;
}
