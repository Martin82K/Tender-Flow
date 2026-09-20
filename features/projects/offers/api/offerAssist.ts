import { dbAdapter } from '@infra/db/dbAdapter';
import { invokeAuthedFunction } from '@infra/functions/functionsClient';
import { matchOfferItems } from '@shared/offers/comparison.js';
import type { OfferAssignment, OfferItem } from '@shared/offers/comparison.js';
export interface AiSuggestion {
    baseId: string;
    offerId: string | null;
    reason: string;
    runId: string;
}
export async function suggestOfferMatches(projectId: string, base: OfferItem[], offers: OfferItem[], assignments: OfferAssignment[]): Promise<AiSuggestion[]> {
    const links = new Map(assignments.map(link => [link.baseId, link]));
    const used = new Set(assignments.map(link => link.offerId).filter(Boolean));
    const unresolved = base.filter(row => !links.get(row.id)?.offerId).slice(0, 20);
    const available = offers.filter(row => !used.has(row.id));
    const derived = new Map(matchOfferItems(unresolved, available).map(link => [link.baseId, link]));
    const data = unresolved.map(row => {
        const ids = new Set([...(links.get(row.id)?.candidates || []), ...(derived.get(row.id)?.candidates || [])]);
        return { base: row, candidates: available.filter(offer => ids.has(offer.id)).slice(0, 5) };
    });
    if (!data.some(r => r.candidates.length))
        return [];
    // Prices are unnecessary for identity matching and deliberately omitted.
    const minimal = (i: OfferItem | undefined) => i ? ({ id: i.id, code: i.code, description: i.description, unit: i.unit, quantity: i.quantity, group: i.group }) : null;
    const content = JSON.stringify(data.map(r => ({ base: minimal(r.base), candidates: r.candidates.map(minimal) })));
    if (content.length > 24000)
        throw new Error('Dávka obsahuje příliš dlouhé popisy. Zmenšete počet nejasných položek.');
    const result = await invokeAuthedFunction<{
        text: string;
        complete: boolean;
        runId: string;
        error?: string;
    }>('offer-assist', { body: { projectId, requestId: crypto.randomUUID(), stage: 'matching', content }, retries: 0, timeoutMs: 100000 });
    if (result.error || !result.complete)
        throw new Error('AI návrh není úplný. Žádná vazba nebyla změněna.');
    const parsed = JSON.parse(result.text);
    if (!Array.isArray(parsed.suggestions))
        throw new Error('Neplatný návrh párování.');
    const seen = new Set<string>();
    return parsed.suggestions.map((value: {
        baseId: unknown;
        offerId: unknown;
        reason: unknown;
    }) => {
        const candidates = data.find(r => r.base?.id === value.baseId)?.candidates;
        if (typeof value.baseId !== 'string' || seen.has(value.baseId) || !candidates || (value.offerId !== null && !candidates.some(c => c.id === value.offerId)) || typeof value.reason !== 'string')
            throw new Error('AI navrhlo nepovolenou vazbu.');
        seen.add(value.baseId);
        return { baseId: value.baseId, offerId: value.offerId as string | null, reason: value.reason.slice(0, 500), runId: result.runId };
    });
}
export async function extractPdfOffer(projectId: string, file: File): Promise<{
    items: OfferItem[];
    notes: string[];
}> {
    if (file.size > 10 * 1024 * 1024)
        throw new Error('PDF je větší než 10 MB.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192)
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    const ocr = await invokeAuthedFunction<{
        pages: Array<{
            page: number;
            text: string;
        }>;
        limitedToPages: number;
        error?: string;
    }>('offer-assist', { body: { projectId, requestId: crypto.randomUUID(), stage: 'ocr', pdfBase64: btoa(binary) }, retries: 0, timeoutMs: 100000 });
    if (ocr.error || !Array.isArray(ocr.pages))
        throw new Error('OCR nebylo dokončeno.');
    const items: OfferItem[] = [], notes: string[] = ['PDF: položky vyžadují kontrolu proti originálu. Nerozpoznaná položka není důkazem chybějící ceny.'];
    if (ocr.pages.length >= ocr.limitedToPages)
        notes.push(`Zpracováno nejvýše ${ocr.limitedToPages} stran. Další strany nebyly ověřeny.`);
    for (const page of ocr.pages) {
        if (typeof page.text !== 'string' || page.text.length > 23000)
            throw new Error('Strana PDF překročila limit bezpečné extrakce. Použijte menší soubor nebo ruční zpracování.');
        const result = await invokeAuthedFunction<{
            text: string;
            complete: boolean;
            error?: string;
        }>('offer-assist', { body: { projectId, requestId: crypto.randomUUID(), stage: 'extraction', content: JSON.stringify(page) }, retries: 0, timeoutMs: 100000 });
        if (result.error || !result.complete)
            throw new Error(`Extrakce strany ${page.page} není úplná.`);
        const extracted = JSON.parse(result.text);
        if (!Array.isArray(extracted.items) || extracted.items.length > 1000 || !Array.isArray(extracted.notes))
            throw new Error('Neplatná struktura PDF položek.');
        for (const [index, row] of extracted.items.entries()) {
            const text = (key: string) => { if (typeof row[key] !== 'string' || row[key].length > 4000)
                throw new Error('Neplatný text extrakce.'); return row[key]; };
            const number = (key: string) => { if (row[key] !== null && (typeof row[key] !== 'string' || !/^-?\d{1,15}(\.\d{1,12})?$/.test(row[key])))
                throw new Error('Neplatné číslo extrakce.'); return row[key] as string | null; };
            items.push({ id: `page:${page.page}:${index + 1}`, code: text('code'), description: text('description'), unit: text('unit'), quantity: number('quantity'), unitPrice: number('unitPrice'), total: number('total'), group: text('group'), source: { sheet: `PDF strana ${page.page}`, row: index + 1 } });
        }
        for (const note of extracted.notes)
            if (typeof note === 'string')
                notes.push(`Strana ${page.page}: ${note.slice(0, 4000)}`);
        if (extracted.summary !== null && extracted.summary !== undefined)
            notes.push(`Strana ${page.page}, neověřený souhrn: ${String(extracted.summary).slice(0, 4000)}`);
    }
    return { items, notes };
}
export async function reviewSuggestion(runId: string, itemId: string, accepted: boolean): Promise<void> {
    const { error } = await dbAdapter.rpc('offer_processing_feedback_save', { run_input: runId, item_input: itemId, accepted_input: accepted });
    if (error)
        throw new Error('Hodnocení návrhu se nepodařilo uložit.');
}
