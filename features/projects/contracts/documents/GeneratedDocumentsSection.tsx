import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@shared/ui/Button';
import type { ContractWithDetails } from '@/types';
import { contractDocumentsApi, downloadDocumentBlob } from './api';
import { createHandoverDraft, type DocumentLogo, type DocumentVersion, type HandoverFields } from './model';
import { ProtocolEditor } from './ProtocolEditor';
import { formatDate } from '../utils/format';

export const GeneratedDocumentsSection: React.FC<{ contract: ContractWithDetails }> = ({ contract }) => {
  const queryClient = useQueryClient();
  const key = ['contract-document-versions', contract.id];
  const versions = useQuery({ queryKey: key, queryFn: () => contractDocumentsApi.list(contract.id) });
  const files = useQuery({ queryKey: ['contract-document-files', contract.id, versions.data?.map(v => v.id)], queryFn: () => contractDocumentsApi.files((versions.data || []).map(v => v.id)), enabled: Boolean(versions.data) });
  const permission = useQuery({ queryKey: ['contract-document-write', contract.projectId], queryFn: () => contractDocumentsApi.canWrite(contract.projectId) });
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<{ fields: HandoverFields; logo: DocumentLogo | null; existing?: DocumentVersion; previewOnly?: boolean; vendorContacts?: string[] } | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const create = async () => {
    setBusy(true); setError('');
    try {
      const context = await contractDocumentsApi.context(contract.projectId, contract.vendorId);
      setEditor({ fields: { ...createHandoverDraft(contract, context.project, context.organizationName), organizationAddress: context.organizationAddress, vendorAddress: context.vendorAddress }, logo: context.logo, vendorContacts: context.vendorContacts }); setPicker(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Podklady se nepodařilo načíst.'); } finally { setBusy(false); }
  };
  const attach = async (version: DocumentVersion, file?: File) => {
    if (!file) return; setBusy(true); setError('');
    try { await contractDocumentsApi.attach(version, file); await queryClient.invalidateQueries({ queryKey: ['contract-document-files', contract.id] }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Soubor nelze připojit.'); } finally { setBusy(false); }
  };
  const latest = (versions.data || []).filter((v, i, all) => all.findIndex(other => other.document_id === v.document_id) === i);
  return <section className="py-4 border-b border-slate-200 dark:border-slate-800">
    <div className="flex gap-2 items-center justify-between mb-3"><h3 className="text-sm font-semibold">Vytvořené dokumenty</h3><Button size="sm" disabled={!permission.data || busy || versions.isError} onClick={() => setPicker(!picker)}>Vytvořit dokument</Button></div>
    {picker && <div className="mb-4 rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2"><button disabled={busy} type="button" className="block w-full text-left rounded-lg p-3 hover:bg-primary/10 text-sm" onClick={() => void create()}><strong>Předávací protokol</strong><span className="block text-xs text-slate-500">Předání celého díla nebo jeho části · PDF a DOCX</span></button><button disabled className="block w-full text-left rounded-lg p-3 opacity-50 text-sm">Průvodka subdodávky <span className="block text-xs">Připravujeme</span></button></div>}
    {(error || versions.error || files.error || permission.error) && <div role="alert" className="text-sm text-red-600 dark:text-red-400 mb-3">{error || (versions.error || files.error || permission.error)?.message}<button className="ml-2 underline" onClick={() => { setError(''); void refresh(); void files.refetch(); void permission.refetch(); }}>Zkusit znovu</button></div>}
    {(versions.isPending || busy) && <p role="status" className="text-xs text-slate-500 mb-3">{busy ? 'Zpracovávám…' : 'Načítám dokumenty…'}</p>}
    {versions.isSuccess && !latest.length && <p className="text-sm text-slate-500 py-4">K této smlouvě zatím není vytvořen žádný dokument.</p>}
    <div className="space-y-3">{latest.map(version => <article key={version.document_id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
      <div className="flex flex-wrap gap-2 items-center justify-between"><div><h4 className="font-medium text-sm">Předávací protokol · {version.snapshot.fields.scopeKind === 'part' ? 'Část díla' : 'Celé dílo'}</h4><p className="text-xs text-slate-500 mt-1">Verze {version.version} · {formatDate(version.created_at)} · {files.data?.some(f => f.version_id === version.id) ? 'Finální soubor přiložen' : 'Koncept'}</p></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setEditor({ fields: version.snapshot.fields, logo: version.snapshot.logo, existing: version, previewOnly: true })}>Náhled a export</Button>{permission.data && <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditor({ fields: version.snapshot.fields, logo: version.snapshot.logo, existing: version })}>Upravit</Button>}</div></div>
      <details className="mt-3 text-xs text-slate-500"><summary className="cursor-pointer">Verze a připojené soubory</summary><div className="space-y-3 pt-3">{(versions.data || []).filter(v => v.document_id === version.document_id).map(v => <div key={v.id} className="border-t border-slate-200 dark:border-slate-800 pt-2">
        <button className="text-primary hover:underline" onClick={() => setEditor({ fields: v.snapshot.fields, logo: v.snapshot.logo, existing: v, previewOnly: true })}>Verze {v.version} · {formatDate(v.created_at)}</button>
        {(files.data || []).filter(f => f.version_id === v.id).map(f => <button key={f.id} disabled={busy} className="block mt-2 text-left text-primary break-all" onClick={async () => { setBusy(true); setError(''); try { downloadDocumentBlob(await contractDocumentsApi.download(f), f.file_name); } catch { setError('Soubor nelze stáhnout.'); } finally { setBusy(false); } }}>{f.file_name}</button>)}
        {permission.data && <label className="block mt-2">Připojit finální PDF nebo DOCX<input aria-label={`Připojit soubor k verzi ${v.version}`} disabled={busy} type="file" accept=".pdf,.docx" className="block max-w-full mt-1 text-xs" onChange={e => { void attach(v, e.target.files?.[0]); e.target.value = ''; }} /></label>}
      </div>)}</div></details>
    </article>)}</div>
    {editor && <ProtocolEditor contractId={contract.id} initialFields={editor.fields} vendorContacts={editor.vendorContacts} logo={editor.logo} existing={editor.existing} previewOnly={editor.previewOnly} onClose={() => setEditor(null)} onSaved={refresh} />}
  </section>;
};
