import { decimal, remainingQuantity } from '@features/projects/budget/model/budgetModel';
import { isPriced } from '@features/projects/budget/model/types';
import type { BudgetRevision, BudgetNode } from '@features/projects/budget/model/types';
import type { ComparisonSource } from './types';
export async function comparisonBudgetSource(revision: BudgetRevision, categoryId: string): Promise<ComparisonSource> {
    const allocationsByItem = new Map<string, string[]>();
    for (const allocation of revision.allocations) {
        if (allocation.categoryId !== categoryId) continue;
        const id = allocation.itemId;
        const quantities = allocationsByItem.get(id) || [];
        quantities.push(allocation.quantity);
        allocationsByItem.set(id, quantities);
    }
    const selected: BudgetNode[] = [];
    for (const node of revision.document.nodes) {
        if (!isPriced(node) || !allocationsByItem.has(node.id)) continue;
        selected.push(node);
        if (selected.length > 10000) throw new Error('Porovnání podporuje nejvýše 10 000 položek.');
    }
    const nodesById = new Map(revision.document.nodes.map(node => [node.id, node]));
    if (!selected.length)
        throw new Error('V této revizi nejsou položky přiřazené do vybraného VŘ. Použijte samostatný poptávkový Excel.');
    const items = selected.map(n => {
        const allocations = allocationsByItem.get(n.id)!;
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
            const node = nodesById.get(parent);
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
