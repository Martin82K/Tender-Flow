import { sumMoney } from './budgetModel';
import { isPriced } from './types';
import type { BudgetNode } from './types';
export function aggregateBudget(nodes: BudgetNode[]) {
  const byId = new Map(nodes.map(n => [n.id, n])); const values = new Map<string, Array<string | null>>();
  const incompleteIds = new Set<string>();
  for (const node of nodes.filter(isPriced)) {
    let parent: string | null = node.id; const seen = new Set<string>();
    while (parent && !seen.has(parent)) { seen.add(parent); if(node.total===null)incompleteIds.add(parent); const list = values.get(parent) || []; list.push(node.total); values.set(parent, list); parent = byId.get(parent)?.parentId ?? null; }
  }
  return { total: sumMoney(nodes.filter(isPriced).map(n => n.total)), byId: new Map([...values].map(([id, list]) => [id, sumMoney(list)])), incomplete: incompleteIds.size > 0, incompleteIds };
}
export function visibleBudgetRows(nodes: BudgetNode[], matched: Set<string>, collapsed: Set<string>, showVV: boolean): BudgetNode[] {
  const byId = new Map(nodes.map(n => [n.id, n])); const included = new Set(matched);
  for (const id of matched) { let parent = byId.get(id)?.parentId; const seen = new Set<string>(); while (parent && !seen.has(parent)) { seen.add(parent); included.add(parent); parent = byId.get(parent)?.parentId; } }
  return nodes.filter(n => {
    if (n.kind === 'VV' || n.kind === 'note') { if (!showVV || !n.parentId || !matched.has(n.parentId)) return false; }
    else if (!included.has(n.id)) return false;
    let parent = n.parentId; const seen = new Set<string>();
    while (parent && !seen.has(parent)) { if (collapsed.has(parent)) return false; seen.add(parent); parent = byId.get(parent)?.parentId ?? null; }
    return true;
  });
}
