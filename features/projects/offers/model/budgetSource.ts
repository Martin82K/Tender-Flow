import { decimal, remainingQuantity } from '@features/projects/budget/model/budgetModel';
import { isPriced } from '@features/projects/budget/model/types';
import type { BudgetRevision } from '@features/projects/budget/model/types';
import type { ComparisonSource } from './types';
export async function comparisonBudgetSource(revision: BudgetRevision, categoryId: string): Promise<ComparisonSource> {
    const selected = revision.document.nodes.filter(n => isPriced(n) && revision.allocations.some(a => a.itemId === n.id && a.categoryId === categoryId));
    if (!selected.length)
        throw new Error('V této revizi nejsou položky přiřazené do vybraného VŘ. Použijte samostatný poptávkový Excel.');
    const items = selected.map(n => {
        const allocations = revision.allocations.filter(a => a.itemId === n.id && a.categoryId === categoryId).map(a => a.quantity);
        // Twice subtract from the original to obtain an exact sum without rounding quantities.
        if (n.quantity === null)
            throw new Error('Rozpočet obsahuje neznámé množství.');
        const remainder = remainingQuantity(n.quantity, allocations);
        const quantity = remainingQuantity(n.quantity, [remainder]);
        const ancestors: string[] = [];
        let parent = n.parentId;
        const seen = new Set<string>();
        while (parent) {
            if (seen.has(parent) || seen.size >= 32)
                throw new Error('Neplatná hierarchie rozpočtu.');
            seen.add(parent);
            const node = revision.document.nodes.find(p => p.id === parent);
            if (!node)
                break;
            ancestors.unshift(node.description || node.code);
            parent = node.parentId;
        }
        return { id: n.id, code: n.code, description: n.description, unit: n.unit, quantity: decimal(quantity), unitPrice: null, total: null, group: ancestors.join(' / '), source: { sheet: n.source.sheet, row: n.source.row } };
    });
    const serialized = JSON.stringify({ revisionId: revision.id, version: revision.version, categoryId, items });
    const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialized)))].map(b => b.toString(16).padStart(2, '0')).join('');
    return { id: crypto.randomUUID(), name: `${revision.title} · v${revision.version}`, sha256, items, notes: ['Základna obsahuje pouze přiřazené množství VŘ, bez interních rozpočtových cen.'], origin: 'budget', revisionId: revision.id, revisionVersion: revision.version };
}
