import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ThemedSelect } from '@shared/ui/ThemedSelect';
import { Button } from '@shared/ui/Button';
import { Modal } from '@shared/ui/Modal';
import { contractDocumentsApi, downloadDocumentBlob } from '@features/projects/contracts/documents/api';
import { documentKindLabels, resultLabels, type DocumentVersion, type HandoverResult } from '@features/projects/contracts/documents/model';
import { documentInputClass, ProtocolEditor } from '@features/projects/contracts/documents/ProtocolEditor';
import { formatDate } from '@features/projects/contracts/utils/format';

export function DocumentDetail({ version, versions, vendorId, canWrite, onBack, onEdit, onRefresh, initialEditor = false }: {
  version: DocumentVersion; versions: DocumentVersion[]; vendorId?: string; canWrite: boolean; initialEditor?: boolean;
  onBack: () => void; onEdit: () => void; onRefresh: () => Promise<unknown>;
}) {
  const client = useQueryClient();
  const [editor, setEditor] = useState<{ version: DocumentVersion; readonly: boolean } | null>(initialEditor ? { version, readonly: false } : null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [date, setDate] = useState('');
  const [result, setResult] = useState<HandoverResult>('');
  const [source, setSource] = useState('');
  const files = useQuery({ queryKey: ['contract-document-files', version.contract_id, versions.map(v => v.id)], queryFn: () => contractDocumentsApi.files(versions.map(v => v.id)) });
  const events = useQuery({ queryKey: ['contract-handover-events', version.contract_id], queryFn: () => contractDocumentsApi.events(version.contract_id) });
  const contacts = useQuery({ queryKey: ['document-vendor-contacts', vendorId], queryFn: () => contractDocumentsApi.contacts(vendorId!), enabled: Boolean(vendorId && editor && !editor.readonly && canWrite) });
  const currentEvent = events.data?.find(e => e.document_version_id === version.id);
  const history = events.data?.filter(e => versions.some(v => v.id === e.document_version_id)) || [];
  const legacy = events.data?.filter(e => !e.document_version_id && e.kind === 'handover') || [];
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Akci nelze dokončit.'); } finally { setBusy(false); }
  };
  const fields = version.snapshot.fields;
  return <div className="space-y-5">
    <Button variant="outline" size="sm" onClick={onBack}>Zpět na protokoly</Button>
    <div className="flex flex-wrap justify-between gap-3"><div><p className="text-xs text-slate-500">{documentKindLabels[version.snapshot.kind]} · Verze {version.version}</p><h3 className="text-xl font-semibold mt-1">{fields.recordTitle || documentKindLabels[version.snapshot.kind]}</h3><p className="text-sm text-slate-500 mt-1">{fields.vendorName} · {fields.contractNumber || 'Bez čísla smlouvy'}</p></div><div className="flex flex-wrap gap-2 items-start"><Button size="sm" variant="outline" onClick={() => setEditor({version, readonly:true})}>Náhled a export</Button>{canWrite && <><Button size="sm" variant="outline" onClick={onEdit}>Upravit záznam</Button><Button size="sm" onClick={() => setEditor({version, readonly:false})}>Otevřít editor</Button></>}</div></div>
    {(error || files.error || events.error) && <p role="alert" className="text-red-600 dark:text-red-400">{error || files.error?.message || events.error?.message}</p>}
    <div className="grid gap-4 md:grid-cols-3"><div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4"><p className="text-xs text-slate-500">Plánované datum</p><p className="mt-2 text-sm">{fields.plannedDate ? formatDate(fields.plannedDate) : 'Neuvedeno'}</p></div><div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4"><p className="text-xs text-slate-500">Dokument</p><p className="mt-2 text-sm">{files.isPending ? 'Načítám…' : files.isError ? 'Nelze načíst' : files.data?.some(f => f.version_id === version.id) ? 'Soubor připojen' : 'Koncept · bez přílohy'}</p></div><div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4"><p className="text-xs text-slate-500">Skutečné předání této verze</p><p className="mt-2 text-sm">{events.isPending ? 'Načítám…' : events.isError ? 'Nelze načíst' : currentEvent ? `${resultLabels[currentEvent.result]} · ${formatDate(currentEvent.effective_date)}` : 'Nepotvrzeno'}</p></div></div>
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-3"><h4 className="text-sm font-semibold">Rozsah a poznámka</h4><p className="text-sm whitespace-pre-wrap break-words">{fields.scope || 'Rozsah neuveden'}</p>{fields.note && <p className="text-sm whitespace-pre-wrap break-words text-slate-500">{fields.note}</p>}</section>
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-3"><h4 className="text-sm font-semibold">Soubory a historie verzí</h4><p className="text-xs text-slate-500">Připojení souboru samo o sobě nepotvrzuje předání. PDF nebo DOCX, nejvýše 20 MB.</p>
      {canWrite && <label className="block text-sm">Připojit soubor k aktuální verzi<input type="file" accept=".pdf,.docx" disabled={busy || files.isError} className="block mt-2 max-w-full text-sm" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void run(async () => { await contractDocumentsApi.attach(version, file); await client.invalidateQueries({queryKey:['contract-document-files',version.contract_id]}); }); }} /></label>}
      {[...versions].sort((a,b) => b.version-a.version).map(v => <div key={v.id} className="border-t border-slate-200 dark:border-slate-800 pt-3"><button className="text-sm text-primary hover:underline" onClick={() => setEditor({version:v,readonly:true})}>Verze {v.version} · {formatDate(v.created_at)}{v.id === version.id ? ' · aktuální' : ''}</button>{files.data?.filter(f => f.version_id === v.id).map(file => <button key={file.id} disabled={busy} className="block text-sm text-primary mt-2 break-all text-left" onClick={() => void run(async () => downloadDocumentBlob(await contractDocumentsApi.download(file), file.file_name))}>{file.file_name}</button>)}</div>)}
    </section>
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 p-5 space-y-3"><h4 className="text-sm font-semibold">Skutečné předání</h4><p className="text-sm text-slate-500">Potvrzení se uloží k této verzi do historie. Začátek záruky a uvolnění pozastávek se řeší samostatně ve smlouvě.</p>{canWrite && <Button size="sm" disabled={events.isPending || events.isError || busy} onClick={() => { setDate(''); setResult(''); setSource(''); setConfirm(true); }}>Zapsat skutečné předání</Button>}
      {history.map(e => <div key={e.id} className="text-sm border-t border-slate-200 dark:border-slate-800 pt-3"><strong>{resultLabels[e.result]} · {formatDate(e.effective_date)} · verze {versions.find(v => v.id === e.document_version_id)?.version}</strong><p className="whitespace-pre-wrap break-words">{e.source_note}</p><p className="text-xs text-slate-500">Zapsáno {new Date(e.created_at).toLocaleString('cs-CZ')} · Autor {e.created_by || 'Odstraněný účet'}</p></div>)}
      {!!legacy.length && <details className="text-xs text-slate-500"><summary>Starší záznamy smlouvy bez vazby na konkrétní protokol ({legacy.length})</summary>{legacy.map(e => <p key={e.id} className="mt-2 whitespace-pre-wrap">{formatDate(e.effective_date)} · {resultLabels[e.result]} · {e.source_note}</p>)}</details>}
    </section>
    {editor && <ProtocolEditor key={editor.version.id} contractId={version.contract_id} existing={editor.version} initialFields={editor.version.snapshot.fields} vendorContacts={contacts.data} contactsError={contacts.error ? 'Kontakty se nepodařilo načíst. Zástupce můžete vyplnit ručně.' : undefined} logo={editor.version.snapshot.logo} previewOnly={editor.readonly || !canWrite} onClose={() => setEditor(null)} onSaved={onRefresh} />}
    {confirm && canWrite && <Modal isOpen persistent={busy} onClose={() => { if (!busy) setConfirm(false); }} title="Zapsat skutečné předání" size="lg"><form onSubmit={e => { e.preventDefault(); void run(async () => { await contractDocumentsApi.confirmDocument(version.id,date,result,source); await client.invalidateQueries({queryKey:['contract-handover-events',version.contract_id]}); setConfirm(false); }); }}><fieldset disabled={busy} className="space-y-4">
      <p className="text-sm">{documentKindLabels[version.snapshot.kind]} · verze {version.version}. Záznam zůstane v historii.</p>{error && <p role="alert" className="text-red-600">{error}</p>}
      <label className="block text-sm">Skutečné datum předání<input required type="date" min="1900-01-01" max={new Date().toLocaleDateString('en-CA')} value={date} onChange={e => setDate(e.target.value)} className={documentInputClass} /></label>
      <label className="block text-sm">Výsledek<ThemedSelect ariaLabel="Výsledek" disabled={busy} value={result} onChange={value => setResult(value as HandoverResult)} className="mt-1" options={Object.entries(resultLabels).map(([value,label])=>({value,label}))} /></label>
      <label className="block text-sm">Zdroj potvrzení<textarea required maxLength={2000} value={source} onChange={e => setSource(e.target.value)} className={documentInputClass} placeholder="Podepsaný protokol nebo záznam stavbyvedoucího" /></label>
      <div className="flex gap-2 justify-end"><Button type="button" variant="outline" onClick={() => setConfirm(false)}>Zrušit</Button><Button type="submit" disabled={busy || !date || !result || !source.trim()}>{busy ? 'Ukládám…' : 'Potvrdit a uložit'}</Button></div>
    </fieldset></form></Modal>}
  </div>;
}
