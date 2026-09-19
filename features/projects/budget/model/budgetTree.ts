import { sumMoney } from './budgetModel';
import { isPriced } from './types';
import type { BudgetNode } from './types';
export interface BudgetRecapEntry { node: BudgetNode; parentId: string | null; depth: number; position: number; siblings: number }
export function budgetRecapTree(nodes: BudgetNode[]): BudgetRecapEntry[] {
  const groups = nodes.filter(n => ['object', 'sheet', 'section'].includes(n.kind));
  const byId = new Map(nodes.map(n => [n.id, n]));
  const groupIds = new Set(groups.map(n => n.id));
  const children = new Map<string | null, BudgetNode[]>();
  for (const node of groups) {
    let parent = node.parentId;
    const seen = new Set([node.id]);
    while (parent && !groupIds.has(parent) && !seen.has(parent)) {
      seen.add(parent); parent = byId.get(parent)?.parentId ?? null;
    }
    if (parent && (seen.has(parent) || !groupIds.has(parent))) parent = null;
    const list = children.get(parent) ?? []; list.push(node); children.set(parent, list);
  }
  const result: BudgetRecapEntry[] = []; const visited = new Set<string>();
  const walk = (roots: BudgetNode[]) => {
    const stack = roots.map((node, index) => ({ node, parentId: null as string | null, depth: 0, position: index + 1, siblings: roots.length })).reverse();
    while (stack.length) {
      const entry = stack.pop()!;
      if (visited.has(entry.node.id)) continue;
      visited.add(entry.node.id); result.push(entry);
      const descendants = children.get(entry.node.id) ?? [];
      for (let index = descendants.length - 1; index >= 0; index--) {
        stack.push({ node: descendants[index], parentId: entry.node.id, depth: entry.depth + 1, position: index + 1, siblings: descendants.length });
      }
    }
  };
  walk(children.get(null) ?? []);
  // Preserve orphaned/cyclic imported chapters without following a cycle indefinitely.
  for (const node of groups) if (!visited.has(node.id)) walk([node]);
  return result;
}
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
