import React, { useEffect, useState } from 'react';
import { Modal } from '@shared/ui/Modal';
import { ThemedSelect } from '@shared/ui/ThemedSelect';
import { Button } from '@shared/ui/Button';
import { contractDocumentsApi, downloadDocumentBlob } from './api';
import { exportDocumentDocx, exportDocumentPdf } from './export';
import { documentFileName, freezeDocument, resultLabels, type DocumentLogo, type DocumentVersion, type HandoverFields } from './model';

export const documentInputClass = 'mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950/50 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/40';
const fieldLabels: Partial<Record<keyof HandoverFields, string>> = {
  organizationName: 'Organizace', organizationAddress: 'Adresa organizace', vendorName: 'Subdodavatel', vendorIco: 'IČ subdodavatele', vendorAddress: 'Adresa subdodavatele', contractNumber: 'Číslo smlouvy', projectName: 'Stavba', siteLocation: 'Místo stavby', issuerRepresentative: 'Zástupce organizace', vendorRepresentative: 'Zástupce subdodavatele', scope: 'Předávaný rozsah', actualDate: 'Skutečné datum předání', defects: 'Vady a nedodělky', defectsDeadline: 'Termín odstranění vad', attachments: 'Předané doklady a přílohy',
};
interface Props {
  contractId: string;
  initialFields: HandoverFields;
  logo: DocumentLogo | null;
  existing?: DocumentVersion;
  previewOnly?: boolean;
  vendorContacts?: string[];
  onClose: () => void;
  onSaved: () => Promise<unknown>;
}
export const ProtocolEditor: React.FC<Props> = ({ contractId, initialFields, logo, existing, previewOnly, vendorContacts = [], onClose, onSaved }) => {
  const [fields, setFields] = useState(initialFields);
  const [saved, setSaved] = useState<DocumentVersion | undefined>(existing);
  const [documentId] = useState(() => existing?.document_id || crypto.randomUUID());
  const [preview, setPreview] = useState(Boolean(previewOnly));
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(!existing);
  useEffect(() => {
    if (!preview || !saved) return;
    let active = true; let url: string | undefined;
    setPdfUrl(null);
    exportDocumentPdf(saved.snapshot).then(bytes => {
      if (active) { url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' })); setPdfUrl(url); }
    }).catch(() => { if (active) setError('Náhled PDF nelze načíst. Zkuste export znovu.'); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [preview, saved]);
  const change = <K extends keyof HandoverFields>(key: K, value: HandoverFields[K]) => { setFields(current => ({ ...current, [key]: value })); setDirty(true); };
  const close = () => { if (!busy && (!dirty || window.confirm('Zavřít bez uložení rozpracovaných změn?'))) onClose(); };
  const field = (key: keyof HandoverFields, multiline = false, type = 'text') => (
    <label key={key} className="block min-w-0 text-xs text-slate-600 dark:text-slate-400">
      {fieldLabels[key]}
      {multiline ? <textarea className={documentInputClass + ' resize-y min-h-28'} value={String(fields[key])} maxLength={10000} rows={key === 'defects' ? 5 : 3} onChange={e => change(key, e.target.value as never)} /> : <input list={key === 'vendorRepresentative' ? 'protocol-vendor-contacts' : undefined} className={documentInputClass} type={type} value={String(fields[key])} maxLength={300} onChange={e => change(key, e.target.value as never)} />}
    </label>
  );
  const save = async (showPreview: boolean) => {
    setBusy(true); setError('');
    try {
      if (dirty || !saved) {
        const result = await contractDocumentsApi.save(contractId, documentId, saved?.version || 0, freezeDocument(fields, new Date().toISOString(), (saved?.version || 0) + 1, logo));
        setSaved(result); setDirty(false); await onSaved();
      }
      if (showPreview) setPreview(true); else onClose();
    } catch (e) { setError(e instanceof Error ? e.message : 'Protokol nelze uložit.'); } finally { setBusy(false); }
  };
  const download = async (extension: 'pdf' | 'docx') => {
    if (!saved) return; setBusy(true); setError('');
    try {
      const bytes = extension === 'pdf' ? await exportDocumentPdf(saved.snapshot) : await exportDocumentDocx(saved.snapshot);
      downloadDocumentBlob(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: extension === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), documentFileName(saved.snapshot, extension));
    } catch { setError('Export se nepodařil. Zkuste to znovu.'); } finally { setBusy(false); }
  };
  return <Modal isOpen onClose={close} persistent={busy} size="2xl" title={`Předávací protokol · ${fields.contractNumber || fields.vendorName}`} footer={<div className="flex flex-wrap gap-2 w-full">
    <Button variant="outline" disabled={busy} onClick={close}>Zavřít</Button>
    {!preview && <><Button variant="outline" disabled={busy} onClick={() => void save(false)}>Uložit koncept</Button><Button className="ml-auto" disabled={busy} onClick={() => void save(true)}>{busy ? 'Ukládám…' : 'Pokračovat na náhled'}</Button></>}
    {preview && <>{!previewOnly && <Button variant="outline" disabled={busy} onClick={() => setPreview(false)}>Upravit údaje</Button>}<Button variant="outline" disabled={busy} onClick={() => void download('docx')}>Export DOCX</Button><Button disabled={busy} onClick={() => void download('pdf')}>Export PDF</Button></>}
  </div>}>
    <div className="flex gap-6 text-sm mb-5 text-slate-500"><span className={!preview ? 'text-primary font-semibold' : ''}>1 Údaje protokolu</span><span className={preview ? 'text-primary font-semibold' : ''}>2 Náhled a export</span></div>
    {error && <p role="alert" className="mb-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
    {preview ? <div className="space-y-3"><p className="text-xs text-slate-500">Verze {saved?.version} · Finální PDF nebo upravený DOCX můžete připojit v záložce Dokumenty.</p>{pdfUrl ? <iframe className="w-full h-[65vh] rounded-lg border border-slate-300" title="Náhled předávacího protokolu" src={pdfUrl} /> : <p role="status">Připravuji náhled…</p>}</div> : <fieldset disabled={busy} className="max-w-4xl mx-auto space-y-5">
      <details className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium">{logo && <img src={logo.dataUrl} alt="Logo organizace" className="inline-block h-8 max-w-28 object-contain mr-3 align-middle" />}{fields.vendorName} · {fields.contractNumber || 'Bez čísla'} · {fields.projectName || 'Stavba'} <span className="text-primary ml-2">Upravit údaje</span></summary>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">{!logo && <p className="sm:col-span-2 text-xs text-amber-700 dark:text-amber-400">Logo organizace není nastavené.</p>}{(['organizationName','organizationAddress','vendorName','vendorIco','vendorAddress','contractNumber','projectName','siteLocation'] as const).map(key => field(key))}</div>
      </details>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{field('issuerRepresentative')}{field('vendorRepresentative')}<datalist id="protocol-vendor-contacts">{[...new Set(vendorContacts)].map(name => <option key={name} value={name} />)}</datalist></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><label className="text-xs text-slate-600 dark:text-slate-400">Rozsah předání<ThemedSelect ariaLabel="Rozsah předání" className="mt-1" value={fields.scopeKind} options={[{value:"whole",label:"Celé dílo"},{value:"part",label:"Část díla"}]} onChange={value => change('scopeKind', value as 'whole' | 'part')} /></label>{field('scope')}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{field('actualDate', false, 'date')}<label className="text-xs text-slate-600 dark:text-slate-400">Výsledek převzetí<ThemedSelect ariaLabel="Výsledek převzetí" className="mt-1" value={fields.result} options={Object.entries(resultLabels).map(([value,label]) => ({value,label}))} onChange={value => change('result', value as HandoverFields['result'])} /></label></div>
      {field('defects', true)}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><label className="text-xs text-slate-600 dark:text-slate-400">Místo pro ruční doplnění<ThemedSelect ariaLabel="Místo pro ruční doplnění" className="mt-1" value={String(fields.handwritingLines)} options={[{value:"0",label:"Bez dalších řádků"},{value:"5",label:"5 prázdných řádků"},{value:"10",label:"10 prázdných řádků"}]} onChange={value => change('handwritingLines', Number(value) as 0 | 5 | 10)} /></label>{field('defectsDeadline', false, 'date')}</div>
      {field('attachments', true)}
      <p className="text-xs text-slate-500">Předání a začátek záruky potvrdíte samostatně v záložce Předání a záruka.</p>
    </fieldset>}
  </Modal>;
};
