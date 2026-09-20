import { isPriced } from './types';
import type { BudgetNode, BudgetDocument, BudgetAllocation } from './types';
import { decimal, multiplyMoney, remainingQuantity, validateAllocation } from './budgetModel';
export interface RevisionDifference { before?: BudgetNode; after?: BudgetNode; status: 'added' | 'removed' | 'changed' | 'ambiguous' }
/** Match source identity AND semantic context; duplicate keys require human resolution. */
export function compareRevisions(before: BudgetDocument, after: BudgetDocument): RevisionDifference[] {
  const key = (n: BudgetNode) => JSON.stringify([n.source.sheet, n.kind, n.code, n.unit, n.description]);
  const old = new Map<string, BudgetNode[]>(); const next = new Map<string, BudgetNode[]>();
  before.nodes.filter(isPriced).forEach(n => old.set(key(n), [...(old.get(key(n)) || []), n]));
  after.nodes.filter(isPriced).forEach(n => next.set(key(n), [...(next.get(key(n)) || []), n]));
  const result: RevisionDifference[] = [];
  for (const k of new Set([...old.keys(), ...next.keys()])) {
    const a = old.get(k) || []; const b = next.get(k) || [];
    if (a.length > 1 || b.length > 1) { result.push(...b.map(after => ({ after, status: 'ambiguous' as const })), ...a.map(before => ({ before, status: 'ambiguous' as const }))); continue; }
    if (!a[0]) result.push({ after: b[0], status: 'added' });
    else if (!b[0]) result.push({ before: a[0], status: 'removed' });
    else if (a[0].quantity !== b[0].quantity || a[0].unitPrice !== b[0].unitPrice || a[0].total !== b[0].total || a[0].parentId !== b[0].parentId) result.push({ before: a[0], after: b[0], status: 'changed' });
  }
  return result;
}
export function validateRevisionAllocations(document: BudgetDocument, allocations: BudgetAllocation[]): void {
  const nodes = new Map(document.nodes.map(n => [n.id, n])); const grouped = new Map<string, string[]>();
  for (const allocation of allocations) {
    const node = nodes.get(allocation.itemId);
    if (!node || !isPriced(node) || node.quantity === null) throw new Error('Alokace odkazuje na neplatnou položku.');
    const values = grouped.get(node.id) ?? []; values.push(allocation.quantity); grouped.set(node.id, values);
  }
  for (const [id, values] of grouped) validateAllocation(nodes.get(id)!.quantity!, values);
}
export function proposeRevisionMapping(before: BudgetDocument, after: BudgetDocument): Record<string,string> {
  const beforeIndex=new Map(before.nodes.map(node=>[node.id,node]));const afterIndex=new Map(after.nodes.map(node=>[node.id,node]));
  const path=(n:BudgetNode,document:BudgetDocument)=>{
    const byId=document===before?beforeIndex:afterIndex; const parts:string[]=[];let parent=n.parentId;
    while(parent){const node=byId.get(parent);if(!node)break;parts.unshift(`${node.kind}:${node.code}:${node.description}`);parent=node.parentId;}
    return parts.join('/');
  };
  const key=(n:BudgetNode,d:BudgetDocument)=>JSON.stringify([n.source.sheet,path(n,d),n.kind,n.code,n.unit,n.description]);
  const old=new Map<string,BudgetNode[]>();const next=new Map<string,BudgetNode[]>();
  for(const n of before.nodes.filter(isPriced)){const k=key(n,before);old.set(k,[...(old.get(k)||[]),n]);}
  for(const n of after.nodes.filter(isPriced)){const k=key(n,after);next.set(k,[...(next.get(k)||[]),n]);}
  const mapping:Record<string,string>={};for(const[k,items]of old){const candidates=next.get(k)||[];if(items.length===1&&candidates.length===1)mapping[items[0].id]=candidates[0].id;}
  return mapping;
}
export function transferRevisionLinks(before:BudgetDocument,after:BudgetDocument,allocations:BudgetAllocation[],mapping:Record<string,string>):{document:BudgetDocument;allocations:BudgetAllocation[]} {
  const old=new Map(before.nodes.map(n=>[n.id,n]));const next=new Map(after.nodes.map(n=>[n.id,n]));const used=new Set<string>();
  for(const[from,to]of Object.entries(mapping)){
    if(!old.has(from)||!next.has(to)||!isPriced(old.get(from)!)||!isPriced(next.get(to)!)||old.get(from)!.unit!==next.get(to)!.unit||used.has(to))throw new Error('Neplatné nebo nejednoznačné párování položek. Zkontrolujte jednotky.');used.add(to);
  }
  const reverse=new Map(Object.entries(mapping).map(([from,to])=>[to,from]));
  const document={...after,nodes:after.nodes.map(n=>{const previous=old.get(reverse.get(n.id)||'');return previous?{...n,tags:previous.tags}:n;})};
  const transferred=allocations.filter(a=>mapping[a.itemId]).map(a=>({...a,itemId:mapping[a.itemId]}));
  validateRevisionAllocations(document,transferred);
  return {document,allocations:transferred};
}

/** Resolve only numeric errors on the edited source row; mapping errors stay blocking. */
export function applyBudgetItemEdit(document: BudgetDocument, edited: BudgetNode): BudgetDocument {
  const original = document.nodes.find(node => node.id === edited.id);
  if (!original || !isPriced(original)) throw new Error('Položka již není dostupná. Obnovte rozpočet.');
  const complete = edited.quantity !== null && edited.unitPrice !== null && edited.total !== null;
  if (complete) { decimal(edited.quantity); decimal(edited.unitPrice); decimal(edited.total); multiplyMoney(edited.quantity!, edited.unitPrice!); }
  return {
    ...document,
    nodes: document.nodes.map(node => node.id === edited.id ? {...node, code: edited.code, unit: edited.unit, description: edited.description, quantity: edited.quantity, unitPrice: edited.unitPrice, total: edited.total} : node),
    issues: document.issues.filter(issue => !(edited.quantity !== null && issue.sheet === original.source.sheet && issue.row === original.source.row && issue.message === 'Položka nemá vyplněné množství.') && !(complete && issue.sheet === original.source.sheet && issue.row === original.source.row && issue.severity === 'error' && (/^Neplatná nebo chybějící hodnota /.test(issue.message) || issue.message.startsWith('Položka nemá úplné ocenění') || issue.message === 'Položka nemá vyplněné množství.' || issue.message === 'Cena po zaokrouhlení přesahuje limit 24 číslic.' || issue.message === 'Množství × jednotková cena přesahuje limit 24 číslic.'))),
  };
}

/** Add only nonzero remaining quantities; existing assignments are preserved. */
export function createRemainingAllocations(nodes: BudgetNode[], existing: BudgetAllocation[], selected: Set<string>, categoryId: string, explicitQuantity?: string): BudgetAllocation[] {
  const grouped = new Map<string, string[]>();
  for (const allocation of existing) {
    const values = grouped.get(allocation.itemId) ?? []; values.push(allocation.quantity); grouped.set(allocation.itemId, values);
  }
  const additions: BudgetAllocation[] = [];
  for (const node of nodes) {
    if (!selected.has(node.id) || !isPriced(node)) continue;
    if (node.quantity === null) throw new Error('Položka nemá vyplněné množství.');
    const quantity = selected.size === 1 && explicitQuantity?.trim()
      ? decimal(explicitQuantity)!
      : remainingQuantity(node.quantity, grouped.get(node.id) ?? []);
    if (quantity !== '0') additions.push({ itemId: node.id, categoryId, quantity });
  }
  return additions;
}
