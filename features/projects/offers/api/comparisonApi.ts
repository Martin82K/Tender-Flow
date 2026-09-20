import { dbAdapter } from '@infra/db/dbAdapter';
import { validateAssignments, normalizeOfferItems, validateComparisonWork } from '@shared/offers/comparison.js';
import type { ComparisonDocument, SavedComparison } from '../model/types';
const unwrap = <T>(r: {
    data: unknown;
    error: {
        message: string;
    } | null;
}): T => { if (r.error)
    throw new Error(r.error.message.includes('Comparison storage quota') ? 'Dosáhli jste limitu uložených porovnání. Smažte nepotřebné pohledy v projektu nebo firmě a opakujte uložení.' : r.error.message); return r.data as T; };
export function validateComparison(document: ComparisonDocument) {
    validateComparisonWork(document.sources, document.assignments);
    if (document.schemaVersion !== 1 || document.sources.length < 2 || document.sources.length > 21)
        throw new Error('Vyberte poptávku a nejméně jednu nabídku.');
    const ids = new Set<string>();
    for (const source of document.sources) {
        if (ids.has(source.id) || !/^[a-f0-9]{64}$/.test(source.sha256))
            throw new Error('Neplatná identita zdroje.');
        ids.add(source.id);
    }
    for (const source of document.sources.slice(1))
        validateAssignments(document.sources[0].items, source.items, document.assignments[source.id] || []);
}
export const comparisonApi = {
    async index(projectId: string): Promise<{
        canEdit: boolean;
        views: Array<Omit<SavedComparison, 'document'>>;
    }> {
        return unwrap(await dbAdapter.rpc('offer_comparison_load', { project_input: projectId }));
    },
    async load(projectId: string, id: string): Promise<SavedComparison> {
        const result = unwrap<SavedComparison | null>(await dbAdapter.rpc('offer_comparison_load', { project_input: projectId, id_input: id }));
        if (!result)
            throw new Error('Porovnání nebylo nalezeno.');
        validateComparison(result.document);
        return result;
    },
    async remove(projectId: string, id: string, version: number): Promise<void> {
        unwrap(await dbAdapter.rpc('offer_comparison_delete', { project_input: projectId, id_input: id, version_input: version }));
    },
    async save(projectId: string, categoryId: string | null, title: string, document: ComparisonDocument, requestId: string, saved?: SavedComparison): Promise<SavedComparison> {
        validateComparison(document);
        const assignments = { ...document.assignments };
        for (const source of document.sources.slice(1)) assignments[source.id] ??= [];
        return unwrap(await dbAdapter.rpc('offer_comparison_save', { project_input: projectId, category_input: categoryId, title_input: title, document_input: { ...document, assignments, sources: document.sources.map(source => ({ ...source, items: normalizeOfferItems(source.items) })) }, request_input: requestId, id_input: saved?.id ?? null, version_input: saved?.version ?? 0 }));
    },
};
