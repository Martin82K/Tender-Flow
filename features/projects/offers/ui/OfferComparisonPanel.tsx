import { ThemedNativeSelect } from '@shared/ui/ThemedNativeSelect';
import { budgetApi } from '@features/projects/budget/api/budgetApi';
import type { BudgetRevisionSummary } from '@features/projects/budget/api/budgetApi';
import { comparisonBudgetSource } from '../model/budgetSource';
import { exportComparisonPdf, exportComparisonXlsx } from '../api/comparisonExport';
import { useEffect, useRef, useState } from 'react';
import { matchOfferItems, compareOffer } from '@shared/offers/comparison.js';
import { pickFile, readFile } from '@infra/files/fileSystemService';
import { isDesktop } from '@infra/platform/platformAdapter';
import { extractPdfOffer, reviewSuggestion, suggestOfferMatches } from '../api/offerAssist';
import type { AiSuggestion } from '../api/offerAssist';
import { comparisonApi } from '../api/comparisonApi';
import { readOfferWorkbook, extractOfferItems } from '../model/offerWorkbook';
import type { OfferColumn, OfferWorkbook } from '../model/offerWorkbook';
import type { ComparisonDocument, ComparisonSource, SavedComparison } from '../model/types';
const labels: Record<OfferColumn, string> = { code: 'Kód', description: 'Popis', unit: 'MJ', quantity: 'Množství', unitPrice: 'Jednotková cena', total: 'Celkem', group: 'Objekt / oddíl', note: 'Poznámka' };
const inputClass = 'rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white';
interface Props {
    projectId: string;
    categoryId: string;
    categoryTitle: string;
    resolveFolder: (title: string) => Promise<string | null>;
    onClose: () => void;
}
export function OfferComparisonPanel({ projectId, categoryId, categoryTitle, resolveFolder, onClose }: Props) {
    const [document, setDocument] = useState<ComparisonDocument>({ schemaVersion: 1, sources: [], assignments: {} });
    const [budgetOptions, setBudgetOptions] = useState<BudgetRevisionSummary[]>([]);
    const [pendingPdf, setPendingPdf] = useState<File | null>(null);
    const [pending, setPending] = useState<{
        parsed: OfferWorkbook;
        name: string;
        hash: string;
    } | null>(null);
    const [saved, setSaved] = useState<SavedComparison>();
    const [views, setViews] = useState<Array<Omit<SavedComparison, 'document'>>>([]);
    const [canEdit, setCanEdit] = useState(false);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [title, setTitle] = useState(`Porovnání — ${categoryTitle}`);
    const [page, setPage] = useState(0);
    const [suggestions, setSuggestions] = useState<Record<string, AiSuggestion[]>>({});
    const [aiConsent, setAiConsent] = useState(false);
    const [rowSearch, setRowSearch] = useState<Record<string, string>>({});
    const request = useRef(crypto.randomUUID());
    const fileRef = useRef<HTMLInputElement>(null);
    const alive = useRef(true);
    useEffect(() => { alive.current = true; comparisonApi.index(projectId).then(result => { if (alive.current) {
        setCanEdit(result.canEdit);
        setViews(result.views.filter(v => v.category_id === categoryId));
    } }).catch(() => { if (alive.current)
        setError('Porovnání není dostupné. Ověřte přístup k projektu a dostupnost nové verze serveru.'); }); return () => { alive.current = false; }; }, [projectId, categoryId]);
    const run = async (action: () => Promise<void>) => { setBusy(true); setError(''); try {
        await action();
    }
    catch (e) {
        if (alive.current)
            setError(e instanceof Error ? e.message : 'Operace selhala.');
    }
    finally {
        if (alive.current)
            setBusy(false);
    } };
    const inspect = async (file: File) => {
        if (/\.pdf$/i.test(file.name)) {
            if (file.size > 10 * 1024 * 1024)
                throw new Error('Vyberte PDF do 10 MB.');
            const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))].map(b => b.toString(16).padStart(2, '0')).join('');
            if (document.sources.some(s => s.sha256 === hash))
                throw new Error('Tento dokument je již v porovnání.');
            setPendingPdf(file);
            return;
        }
        if (!/\.xlsx$/i.test(file.name) || file.size > 30 * 1024 * 1024)
            throw new Error('Vyberte XLSX do 30 MB.');
        const bytes = await file.arrayBuffer();
        const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
        if (document.sources.some(s => s.sha256 === hash))
            throw new Error('Tento dokument je již v porovnání.');
        const parsed = readOfferWorkbook(bytes);
        if (!parsed.mappings.length)
            parsed.mappings.push({ sheet: parsed.workbook.SheetNames[0], headerRow: 1, columns: {} });
        if (alive.current)
            setPending({ parsed, name: file.name, hash });
    };
    const choose = () => void run(async () => {
        if (!isDesktop) {
            fileRef.current?.click();
            return;
        }
        const path = await resolveFolder(categoryTitle);
        const selection = await pickFile({ title: document.sources.length ? 'Vybrat cenovou nabídku ze Složkomatu' : 'Vybrat poptávkový Excel', defaultPath: path || undefined });
        if (selection.error)
            throw new Error(selection.error);
        if (selection.cancelled || !selection.path)
            return;
        const bytes = await readFile(selection.path, { maxBytes: 30 * 1024 * 1024 });
        await inspect(new File([new Uint8Array(bytes).buffer], selection.name || 'nabidka.xlsx'));
    });
    const acceptSource = () => {
        if (!pending)
            return;
        try {
            const extracted = extractOfferItems(pending.parsed.workbook, pending.parsed.mappings);
            const source: ComparisonSource = { id: crypto.randomUUID(), name: pending.name, sha256: pending.hash, ...extracted, origin: 'file' };
            setDocument(previous => ({ ...previous, sources: [...previous.sources, source], assignments: { ...previous.assignments, ...(previous.sources.length ? { [source.id]: matchOfferItems(previous.sources[0].items, source.items) } : {}) } }));
            setPending(null);
            setError('');
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Chyba mapování.');
        }
    };
    const base = document.sources[0];
    const results = document.sources.slice(1).map(source => ({ source, result: compareOffer(base.items, source.items, document.assignments[source.id] || []) }));
    const save = () => void run(async () => {
        const budget = document.sources[0];
        if (budget.origin === 'budget' && budget.revisionId) {
            const current = await budgetApi.revision(projectId, budget.revisionId);
            if (current.version !== budget.revisionVersion)
                throw new Error('Zdrojová revize rozpočtu se změnila. Vytvořte nové porovnání nad aktuální revizí.');
        }
        const result = await comparisonApi.save(projectId, categoryId, title, document, request.current, saved);
        if (alive.current) {
            setSaved(result);
            setViews((await comparisonApi.index(projectId)).views.filter(v => v.category_id === categoryId));
        }
    });
    return <section aria-label="Porovnání nabídek" className="m-4 space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
    <div className="flex flex-wrap items-center gap-3"><h2 className="text-lg font-bold">Porovnání nabídek</h2><button type="button" onClick={onClose} className={inputClass}>Zavřít porovnání</button></div>
    <p className="text-sm text-slate-500">Pohled nad kopiemi rozpoznaných položek. Původní dokumenty, rozpočet a souhrnné ceny nabídek se nemění. Nová verze souboru vyžaduje nové párování.</p>
    {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
    <div className="flex flex-wrap gap-3"><label>Uložené porovnání <ThemedNativeSelect aria-label="Uložené porovnání" className={inputClass} value={saved?.id || ''} disabled={busy} onChange={e => { const id = e.target.value; if (!id) {
        setSaved(undefined);
        setDocument({ schemaVersion: 1, sources: [], assignments: {} });
        setSuggestions({});
        setRowSearch({});
        setTitle(`Porovnání — ${categoryTitle}`);
        setPending(null);
        setPendingPdf(null);
        setPage(0);
        request.current = crypto.randomUUID();
    } if (id)
        void run(async () => { const result = await comparisonApi.load(projectId, id); if (alive.current) {
            setSaved(result);
            setDocument(result.document);
            setTitle(result.title);
            setSuggestions({});
            setRowSearch({});
            setPendingPdf(null);
            setPending(null);
            setPage(0);
        } }); }}><option value="">Nové porovnání</option>{views.map(v => <option key={v.id} value={v.id}>{v.title}</option>)}</ThemedNativeSelect></label>
    <label>Název <input className={inputClass} maxLength={200} value={title} onChange={e => setTitle(e.target.value)} disabled={!canEdit || busy}/></label></div>
    <input ref={fileRef} type="file" accept=".xlsx,.pdf" className="hidden" aria-label="Vybrat existující XLSX nebo PDF" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file)
        void run(() => inspect(file)); }}/>
    <div className="flex flex-wrap gap-2"><button type="button" className={inputClass} onClick={choose} disabled={!canEdit || busy || !!pending || !!pendingPdf || document.sources.length >= 21}>{!base ? 'Vybrat poptávku' : 'Přidat cenovou nabídku'}</button><button type="button" className={inputClass} disabled={!canEdit || busy || document.sources.length < 2 || !!pending} onClick={save}>{busy ? 'Zpracovávám…' : 'Uložit porovnání'}</button><button type="button" className={inputClass} disabled={busy || document.sources.length < 2} onClick={() => void run(() => exportComparisonXlsx(document, title))}>Export XLSX</button><button type="button" className={inputClass} disabled={busy || document.sources.length < 2} onClick={() => void run(() => exportComparisonPdf(document, title))}>Export PDF</button>{saved && <span className="text-sm text-slate-500">Uložená verze {saved.version}</span>}</div>
    {(base || pendingPdf) && <label className="block text-sm"><input type="checkbox" checked={aiConsent} onChange={e => setAiConsent(e.target.checked)}/> Povolit placené zpracování Mistralem: u párování se odešlou údaje nejvýše 20 nejasných položek a jejich kandidátů; u PDF obsah vybraného souboru. Výsledek vyžaduje kontrolu.</label>}
    {!base && <div><button type="button" className={inputClass} disabled={!canEdit || busy} onClick={() => void run(async () => { const index = await budgetApi.index(projectId); setBudgetOptions(index.revisions.filter(r => !r.deleted_at)); })}>Vybrat revizi rozpočtu TF</button>{budgetOptions.length > 0 && <ThemedNativeSelect aria-label="Revize rozpočtu pro porovnání" className={inputClass} value="" onChange={e => { const id = e.target.value; if (id)
        void run(async () => { const revision = await budgetApi.revision(projectId, id); const source = await comparisonBudgetSource(revision, categoryId); if (alive.current)
            setDocument({ schemaVersion: 1, sources: [source], assignments: {} }); }); }}><option value="">Vyberte revizi a přiřazené položky VŘ</option>{budgetOptions.map(r => <option key={r.id} value={r.id}>{r.title} · v{r.version}</option>)}</ThemedNativeSelect>}</div>}
    {pendingPdf && <div className="rounded border p-3"><p>{pendingPdf.name}: PDF odešleme Mistralu pro OCR a rozpoznání položek. Zpracuje se nejvýše 20 stran. Náklady se evidují v administraci; výsledek musí být ověřen proti originálu.</p><button className={inputClass} disabled={!aiConsent || busy || !canEdit} onClick={() => void run(async () => {
                const file = pendingPdf;
                const extracted = await extractPdfOffer(projectId, file);
                if (!base && !extracted.items.length)
                    throw new Error('PDF neobsahuje spolehlivý položkový základ. Vyberte poptávkový Excel.');
                const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))].map(b => b.toString(16).padStart(2, '0')).join('');
                if (document.sources.some(s => s.sha256 === sha256))
                    throw new Error('Dokument je již v porovnání.');
                const source: ComparisonSource = { id: crypto.randomUUID(), name: file.name, sha256, ...extracted, origin: 'file' };
                if (alive.current) {
                    setDocument(previous => ({ ...previous, sources: [...previous.sources, source], assignments: { ...previous.assignments, ...(previous.sources.length ? { [source.id]: matchOfferItems(previous.sources[0].items, source.items).map(a => ({ ...a, offerId: null, status: a.candidates?.length ? 'review' as const : 'unmatched' as const })) } : {}) } }));
                    setPendingPdf(null);
                }
            })}>Odeslat PDF Mistralu</button> <button className={inputClass} disabled={busy} onClick={() => setPendingPdf(null)}>Zrušit</button></div>}
    {pending && <fieldset className="space-y-3 rounded border p-3"><legend>Mapování: {pending.name}</legend>{pending.parsed.mappings.map((m, i) => <div key={i} className="flex flex-wrap gap-3"><label>List <ThemedNativeSelect className={inputClass} value={m.sheet} onChange={e => setPending({ ...pending, parsed: { ...pending.parsed, mappings: pending.parsed.mappings.map((x, n) => n === i ? { ...x, sheet: e.target.value } : x) } })}>{pending.parsed.workbook.SheetNames.map(s => <option key={s}>{s}</option>)}</ThemedNativeSelect></label><label>Řádek hlavičky <input type="number" min={1} max={10000} className={`${inputClass} w-20`} value={m.headerRow} onChange={e => setPending({ ...pending, parsed: { ...pending.parsed, mappings: pending.parsed.mappings.map((x, n) => n === i ? { ...x, headerRow: Number(e.target.value) } : x) } })}/></label>{(Object.keys(labels) as OfferColumn[]).map(role => <label key={role}>{labels[role]} <input aria-label={`${m.sheet} ${labels[role]}`} type="number" min={1} max={128} placeholder="—" className={`${inputClass} w-20`} value={m.columns[role] === undefined ? '' : m.columns[role]! + 1} onChange={e => setPending({ ...pending, parsed: { ...pending.parsed, mappings: pending.parsed.mappings.map((x, n) => n === i ? { ...x, columns: { ...x.columns, [role]: e.target.value ? Number(e.target.value) - 1 : undefined } } : x) } })}/></label>)}</div>)}<p className="text-xs">Čísla sloupců: A = 1, B = 2… Prázdná role se nepoužije.</p><button className={inputClass} onClick={acceptSource}>Potvrdit mapování</button> <button className={inputClass} onClick={() => setPending(null)}>Zrušit</button></fieldset>}
    {base && <><p className="text-sm">Základna: <strong>{base.name}</strong> · {base.items.length} položek · ceny v původní měně a režimu DPH dokumentů; před porovnáním ověřte jejich shodu.</p><div className="max-h-[60vh] overflow-auto rounded border"><table className="w-full border-collapse text-sm"><thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800"><tr><th className="md:sticky left-0 z-30 min-w-[100px] bg-slate-100 p-2 dark:bg-slate-800">Kód</th><th className="md:sticky left-[100px] z-30 min-w-[360px] bg-slate-100 p-2 dark:bg-slate-800">Položka / objekt</th><th className="md:sticky left-[460px] z-30 min-w-[136px] bg-slate-100 p-2 dark:bg-slate-800">Množství</th>{results.map(({ source, result }) => <th key={source.id} className="min-w-64 border-l p-2">{source.name}<div><button type="button" className={inputClass} disabled={!canEdit || busy || !aiConsent} onClick={() => void run(async () => { const proposed = await suggestOfferMatches(projectId, base.items, source.items, document.assignments[source.id] || []); if (alive.current)
        setSuggestions(previous => ({ ...previous, [source.id]: proposed })); })}>Navrhnout nejasné shody</button></div><div className="font-normal">{result.pricedCount}/{base.items.length} srovnatelných cen · {result.total}{!result.complete && ' (dílčí)'}</div></th>)}</tr></thead><tbody>{base.items.slice(page * 100, (page + 1) * 100).map((item, offset) => { const index = page * 100 + offset; return <tr key={item.id} className="border-b odd:bg-white even:bg-slate-100 dark:odd:bg-slate-900 dark:even:bg-slate-800"><td className="md:sticky left-0 z-10 min-w-[100px] max-w-[100px] bg-inherit p-2">{item.code}</td><td className="md:sticky left-[100px] z-10 min-w-[360px] max-w-[360px] bg-inherit p-2"><span className="text-xs text-slate-500">{item.group}</span><div>{item.description}</div></td><td className="md:sticky left-[460px] z-10 min-w-[136px] max-w-[136px] whitespace-nowrap bg-inherit p-2">{item.quantity} {item.unit}</td>{results.map(({ source, result }) => { const row = result.rows[index], link = document.assignments[source.id]?.find(a => a.baseId === item.id); return <td key={source.id} className="border-l p-2">{suggestions[source.id]?.filter(s => s.baseId === item.id).map(s => <p key={s.baseId} className="text-xs text-amber-700 dark:text-amber-300">AI návrh: {s.offerId ? source.items.find(o => o.id === s.offerId)?.description : 'Bez jisté shody'} — {s.reason}. Ověřte a vyberte položku níže. <button disabled={busy} onClick={() => void run(() => reviewSuggestion(s.runId, s.baseId, true))}>Návrh správný</button> / <button disabled={busy} onClick={() => void run(() => reviewSuggestion(s.runId, s.baseId, false))}>Návrh chybný</button></p>)}<div>{row.quotedTotal ?? (row.priceStatus === 'missing-price' ? 'Chybí cena' : 'Nespárováno')}{row.priceStatus === 'different-scope' && ' · jiné množství / MJ'}</div><input aria-label={`Hledat položku: ${source.name} ${item.code}`} placeholder="Hledat kód nebo popis…" className={`${inputClass} max-w-72`} value={rowSearch[`${source.id}:${item.id}`] || ''} onChange={e => setRowSearch(previous => ({ ...previous, [`${source.id}:${item.id}`]: e.target.value }))}/><ThemedNativeSelect aria-label={`${source.name}: ${item.code} ${item.description}`} className={`${inputClass} max-w-72`} value={link?.offerId || ''} disabled={!canEdit || busy} onChange={e => { const offerId = e.target.value || null; setDocument(previous => ({ ...previous, assignments: { ...previous.assignments, [source.id]: previous.assignments[source.id].map(a => a.baseId === item.id ? { ...a, offerId, status: offerId ? 'manual' : 'unmatched' } : a) } })); }}><option value="">{link?.status === 'review' ? 'Ověřit shodu…' : 'Bez přiřazení'}</option>{[...source.items.filter(o => o.id === link?.offerId), ...source.items.filter(o => o.id !== link?.offerId && ((!rowSearch[`${source.id}:${item.id}`] ? link?.candidates?.includes(o.id) : `${o.code} ${o.description}`.toLocaleLowerCase('cs').includes(rowSearch[`${source.id}:${item.id}`].toLocaleLowerCase('cs'))) && !document.assignments[source.id].some(a => a.offerId === o.id))).slice(0, 50)].map(o => <option key={o.id} value={o.id}>{o.code} · {o.description.slice(0, 70)} · {o.quantity} {o.unit} · {o.source.sheet}:{o.source.row}</option>)}</ThemedNativeSelect></td>; })}</tr>; })}</tbody></table></div><div className="flex gap-3"><button className={inputClass} disabled={page === 0} onClick={() => setPage(p => p - 1)}>Předchozí</button><span>Řádky {page * 100 + 1}–{Math.min((page + 1) * 100, base.items.length)}</span><button className={inputClass} disabled={(page + 1) * 100 >= base.items.length} onClick={() => setPage(p => p + 1)}>Další</button></div>{results.map(({ source, result }) => <details key={source.id}><summary>{source.name}: {result.extraIds.length} položek bez protějšku · {source.notes.length} původních poznámek</summary><ul>{result.extraIds.map(id => <li key={id}>{source.items.find(i => i.id === id)?.description}</li>)}{source.notes.map((note, i) => <li key={`note-${i}`}>{note}</li>)}</ul></details>)}</>}
  </section>;
}
