import { decimal, normalizeSearch, remainingQuantity } from './budgetModel';
import { validateRevisionAllocations } from './revisions';
import { isPriced } from './types';
import type { BudgetAllocation, BudgetDocument, BudgetNode, BudgetSheet } from './types';

export interface TenderColumns { name?: number; code?: number; part?: number; sourceRef?: number }
export interface TenderDefinition { title: string; externalCode: string }
export interface ProjectTender extends TenderDefinition { id: string }
export interface TenderRow { node: BudgetNode; name: string; externalCode: string; part: string; sourceRef: string }
export interface TenderMatch { row: TenderRow; targetId?: string; candidates: string[] }
export interface TenderAssignment { itemId: string; categoryId: string; action: 'remaining' | 'replace' | 'keep' | 'unresolved' }
export const tenderKey = (code: string, name: string) => JSON.stringify([code.trim(), name.trim()]);
export const tenderNameKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('cs');
export function columnLetter(column: number): string {
  let value = column + 1; let result = '';
  while (value > 0) { value--; result = String.fromCharCode(65 + value % 26) + result; value = Math.floor(value / 26); }
  return result;
}

/** Header AND sample evidence propose a column; ambiguous headers never pick the first. */
export function detectTenderColumns(sheet: BudgetSheet): TenderColumns {
  const preview = sheet.sourcePreview;
  if (!preview) return {};
  const header = preview.rows.find(r => r.row === sheet.headerRow);
  const result: TenderColumns = {};
  const patterns: Record<keyof TenderColumns, RegExp> = {
    name: /^(nazev|popis)\s+(vr|vyberoveho rizeni|tendru|kategorie)$|^(vr|vyberove rizeni|tendr|profese)$/,
    code: /^(c\.?|cislo|kod)\s*(vr|vyberoveho rizeni|tendru|kategorie)$/,
    part: /^(cast|objekt|soupis|stavebni objekt)$/,
    sourceRef: /^(zdrojovy list a radek|zdrojova polozka)$/,
  };
  for (const field of Object.keys(patterns) as Array<keyof TenderColumns>) {
    const candidates = (header?.cells ?? []).flatMap((cell, index) => patterns[field].test(normalizeSearch(String(cell.value ?? '')).trim()) ? [index] : []);
    if (candidates.length !== 1) continue;
    const index = candidates[0];
    const values = preview.rows.filter(r => r.row > sheet.headerRow).map(r => r.cells[index]?.value).filter(v => v !== null && v !== undefined && String(v).trim());
    if (values.length && (field !== 'name' || values.some(v => /\p{L}/u.test(String(v))))) result[field] = index;
  }
  // Content-only hints are conservative and still require the preview confirmation.
  const standard=new Set(Object.values(sheet.columns??{}));
  for(const field of ['name','code'] as const){
    if(result[field]!==undefined||(header?.cells??[]).some(c=>patterns[field].test(normalizeSearch(String(c.value??'')).trim())))continue;
    const candidates=Array.from({length:preview.columnCount},(_,index)=>index).filter(index=>{
      if(standard.has(index))return false;
      const values=preview.rows.filter(r=>r.row>sheet.headerRow).map(r=>String(r.cells[index]?.value??'').trim()).filter(Boolean);
      return values.length>=3&&new Set(values).size<values.length&&values.every(v=>field==='code'?/^[0-9]{1,8}$/.test(v):v.length<=255&&/\p{L}/u.test(v)&&!/[=<>]/.test(v));
    });
    if(candidates.length===1)result[field]=candidates[0];
  }
  return result;
}

export function readTenderRows(document: BudgetDocument, mapping: Record<string, TenderColumns>): TenderRow[] {
  const selected = new Set(document.sheets.filter(s => s.selected && s.role === 'items').map(s => s.id));
  return document.nodes.filter(n => selected.has(n.sheetId) && isPriced(n)).map(node => {
    const columns = mapping[node.sheetId] ?? {};
    const read = (index?: number) => {
      if (index === undefined) return '';
      if (!Number.isInteger(index) || index < 0 || index >= 512) throw new Error('Neplatný sloupec VŘ.');
      const cell = node.source.cells[`${columnLetter(index)}${node.source.row}`];
      return String(cell?.displayText ?? cell?.value ?? '').trim();
    };
    return {node, name:read(columns.name), externalCode:read(columns.code), part:read(columns.part), sourceRef:read(columns.sourceRef)};
  });
}

const semanticKey = (node: BudgetNode) => JSON.stringify([node.kind,node.code.trim(),node.description.trim(),node.unit.trim()]);
/** IDs/row positions alone are not identities across files. Never resolve a duplicate by order. */
export function matchTenderRows(rows: TenderRow[], targets: BudgetNode[]): TenderMatch[] {
  const byKey = new Map<string, BudgetNode[]>(); const incomingCounts = new Map<string,number>(); const sourceCounts = new Map<string,number>();
  const byId=new Map(targets.map(n=>[n.id,n]));const byPart=new Map<string,BudgetNode[]>();const bySource=new Map<string,BudgetNode[]>();const partCounts=new Map<string,number>();
  const add=(index:Map<string,BudgetNode[]>,key:string,node:BudgetNode)=>{const values=index.get(key);if(values)values.push(node);else index.set(key,[node]);};
  for(const node of targets.filter(isPriced)){
    const labels=new Set([node.source.sheet]);let parent=node.parentId;const visited=new Set<string>();
    while(parent&&!visited.has(parent)){visited.add(parent);const n=byId.get(parent);if(!n)break;if(n.kind==='sheet'||n.kind==='object')labels.add(n.description);parent=n.parentId;}
    for(const label of labels)add(byPart,JSON.stringify([semanticKey(node),label]),node);
    add(bySource,JSON.stringify([semanticKey(node),`${node.source.sheet}!${node.source.row}`]),node);
    add(byKey,semanticKey(node),node);
  }
  for (const {node,sourceRef,part} of rows) { const key=semanticKey(node); incomingCounts.set(key,(incomingCounts.get(key)??0)+1); sourceCounts.set(sourceRef,(sourceCounts.get(sourceRef)??0)+1);const partKey=JSON.stringify([key,part]);partCounts.set(partKey,(partCounts.get(partKey)??0)+1); }
  return rows.map(row => {
    const key=semanticKey(row.node); const candidates=byKey.get(key)??[];
    // Exact provenance may narrow duplicates, but abbreviated/unverified references never do.
    const exact = row.sourceRef ? bySource.get(JSON.stringify([key,row.sourceRef]))??[] : [];
    const part=row.part?byPart.get(JSON.stringify([key,row.part]))??[]:[];
    const provenanceUnique=exact.length===1&&sourceCounts.get(row.sourceRef)===1;
    const partUnique=part.length===1&&partCounts.get(JSON.stringify([key,row.part]))===1;
    const narrowed = provenanceUnique?exact:partUnique?part:candidates;
    const unique = narrowed.length === 1 && (incomingCounts.get(key)===1 || provenanceUnique || partUnique);
    return {row,candidates:narrowed.slice(0,100).map(n=>n.id),...(unique?{targetId:narrowed[0].id}:{})};
  });
}

export function planTenderAllocations(nodes: BudgetNode[], existing: BudgetAllocation[], assignments: TenderAssignment[]): BudgetAllocation[] {
  const byId=new Map(nodes.map(n=>[n.id,n])); const used=new Set<string>();
  const allocations=new Map<string,BudgetAllocation[]>();
  for(const a of existing) {const values=allocations.get(a.itemId);if(values)values.push(a);else allocations.set(a.itemId,[a]);}
  for(const a of assignments){
    const node=byId.get(a.itemId);
    if(used.has(a.itemId)||!node||!isPriced(node)||node.quantity===null||!a.categoryId||a.action==='unresolved') throw new Error('Vyřešte nejednoznačné položky a existující přiřazení.');
    used.add(a.itemId);
    if(a.action==='keep')continue;
    const current=a.action==='replace'?[]:allocations.get(a.itemId)??[];
    const quantity=a.action==='replace'?decimal(node.quantity)!:remainingQuantity(node.quantity,current.map(v=>v.quantity));
    if(quantity!=='0'){
      const same=current.find(v=>v.categoryId===a.categoryId);
      // Existing same-category allocation is kept; adding remainder is an explicit operation.
      if(same) {
        const others=current.filter(v=>v!==same);
        const combined=remainingQuantity(node.quantity,others.map(v=>v.quantity));
        allocations.set(a.itemId,[...others,{...same,quantity:combined}]);
      } else allocations.set(a.itemId,[...current,{itemId:a.itemId,categoryId:a.categoryId,quantity}]);
    } else allocations.set(a.itemId,current);
  }
  const result=[...allocations.values()].flat();
  validateRevisionAllocations({schemaVersion:1,nodes,sheets:[],issues:[],figures:{}},result);
  return result;
}

export function parseTenderTemplate(text: string): TenderDefinition[] {
  if(text.length>1024*1024)throw new Error('Vzor překročil limit 1 MB.');
  const value: unknown=JSON.parse(text);
  if(!value||typeof value!=='object'||!('format' in value)||value.format!=='tender-flow-tenders'||!('version' in value)||value.version!==1||!('categories' in value)||!Array.isArray(value.categories)||value.categories.length>1000)throw new Error('Neplatný vzor VŘ.');
  return value.categories.map((entry: unknown)=>{
    if(!entry||typeof entry!=='object'||!('title' in entry)||typeof entry.title!=='string'||!entry.title.trim()||entry.title.length>255||!('externalCode' in entry)||typeof entry.externalCode!=='string'||entry.externalCode.length>100)throw new Error('Neplatný název nebo kód VŘ ve vzoru.');
    return {title:entry.title.trim(),externalCode:entry.externalCode.trim()};
  });
}
