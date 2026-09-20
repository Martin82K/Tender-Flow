import { decimal, money, multiplyMoney, sumMoney } from './budgetModel';
import { isPriced } from './types';
import type { BudgetAllocation, BudgetDocument, BudgetImportRepair, BudgetNode, ImportIssue } from './types';
export type ImportRepair = BudgetImportRepair;

export function sourceColumnName(index: number): string {
  let result = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) result = String.fromCharCode(65 + (n - 1) % 26) + result;
  return result;
}

export function importNodePath(nodeId: string | null, byId: ReadonlyMap<string, BudgetNode>): string {
  const parts: string[] = []; const visited = new Set<string>();
  while (nodeId && !visited.has(nodeId)) {
    visited.add(nodeId); const node = byId.get(nodeId); if (!node) break;
    parts.push([node.code, node.description].filter(Boolean).join(' · ')); nodeId = node.parentId;
  }
  return parts.reverse().join(' / ');
}

/** Parents precede children, matching the source ordering and server validation. */
export function importRepairParents(document: BudgetDocument, nodeId: string, kind: ImportRepair['kind']): BudgetNode[] {
  const index = document.nodes.findIndex(node => node.id === nodeId); const node = document.nodes[index];
  if (!node) return [];
  return document.nodes.slice(0, index).filter(parent => parent.sheetId === node.sheetId &&
    (parent.kind === 'sheet' || parent.kind === 'section' || ((kind === 'VV' || kind === 'note') && isPriced(parent))));
}

export function previewImportRepair(document: BudgetDocument, repair: ImportRepair, allocations: readonly BudgetAllocation[] = []) {
  if (!['section','K','M','VV','note','subtotal'].includes(repair.kind) || !['row','subtree'].includes(repair.scope)) throw new Error('Neplatný typ nebo rozsah opravy.');
  const node = document.nodes.find(node => node.id === repair.nodeId);
  if (!node || node.kind === 'object' || node.kind === 'sheet') throw new Error('Vyberte zdrojový řádek.');
  if (isPriced(node) && !['K','M'].includes(repair.kind) && (node.tags.length || allocations.some(a => a.itemId === node.id))) throw new Error('Položka má vazby na štítky nebo alokace. Nejprve je vyřešte v rozpočtu, potom změňte typ řádku.');
  if (!importRepairParents(document, node.id, repair.kind).some(parent => parent.id === repair.parentId)) throw new Error('Nadřazený uzel musí předcházet řádku a patřit do stejného soupisu.');
  const ids = new Set([node.id]);
  // Imported and repaired nodes are topologically ordered; one pass is sufficient.
  for (const candidate of document.nodes) if (candidate.parentId && ids.has(candidate.parentId)) ids.add(candidate.id);
  const descendants = document.nodes.filter(candidate => ids.has(candidate.id));
  if (isPriced(node) && (!['K','M'].includes(repair.kind) || repair.scope === 'row') && descendants.some(child => child.id !== node.id && (child.kind === 'VV' || child.kind === 'note'))) throw new Error('Položka má výkaz výměr nebo poznámky. Ponechte typ položky a zvolte celý podstrom, nebo nejprve upravte zařazení těchto řádků.');
  if (repair.scope === 'subtree' && repair.kind !== 'section' && descendants.some(child => child.id !== node.id && child.kind !== 'VV' && child.kind !== 'note')) {
    throw new Error('Tento typ nemůže obsahovat oddíly ani položky. Zvolte rozsah pouze tento řádek.');
  }
  if (repair.scope === 'subtree' && !['section','K','M'].includes(repair.kind) && descendants.length > 1) throw new Error('Poznámka, výkaz ani mezisoučet nemůže být rodičem. Zvolte pouze tento řádek.');
  const affected = repair.scope === 'subtree' ? descendants : [node];
  return { rows: affected.map(item => item.source.row), count: affected.length, items: affected.filter(isPriced).length,
    total: sumMoney(affected.filter(isPriced).map(item => item.total)), incomplete: affected.some(item => isPriced(item) && item.total === null), descendants };
}

export function applyImportRepair(document: BudgetDocument, repair: ImportRepair, allocations: readonly BudgetAllocation[] = []): BudgetDocument {
  const preview = previewImportRepair(document, repair, allocations);
  const original = document.nodes.find(node => node.id === repair.nodeId)!;
  const columns = document.sheets.find(sheet => sheet.id === original.sheetId)?.columns;
  const invalidNumbers = new Set<string>();
  const number = (key: string): string | null => {
    const column = columns?.[key]; if (column === undefined || column < 0) return null;
    const cell = original.source.cells[`${sourceColumnName(column)}${original.source.row}`];
    try { if(cell?.formula&&(cell.value===null||cell.value===''))throw new Error('Chybí uložený výsledek vzorce'); return decimal(typeof cell?.value === 'number' ? Number(cell.value.toPrecision(15)).toLocaleString('en-US', {useGrouping:false,maximumFractionDigits:18}) : cell?.value); } catch { invalidNumbers.add(sourceColumnName(column)); return null; }
  };
  const edited: BudgetNode = { ...original, kind: repair.kind, parentId: repair.parentId };
  if (edited.kind !== original.kind && !(isPriced(edited) && isPriced(original))) {
    edited.quantity = isPriced(edited) || edited.kind === 'VV' ? number('quantity') : null;
    edited.unitPrice = isPriced(edited) ? number('unitPrice') : null;
    const total = isPriced(edited) ? number('total') : null;
    edited.total = total === null ? null : money(total);
  }
  const hierarchyRows = new Set(preview.rows);
  const issues = document.issues.filter(issue => !(issue.kind === 'hierarchy' && issue.sheet === original.source.sheet && hierarchyRows.has(issue.row)) && !(issue.sheet === original.source.sheet && issue.row === original.source.row &&
    (issue.kind === 'hierarchy' || issue.kind === 'unclassified' || (edited.kind !== original.kind && (/^Neplatná nebo chybějící hodnota /.test(issue.message) || issue.message.startsWith('Položka nemá úplné ocenění') || issue.message === 'Položka nemá vyplněné množství.' || issue.message.startsWith('Uložená cena se liší'))))));
  if (edited.kind !== original.kind && isPriced(edited)) {
    const issue: Omit<ImportIssue,'message'> = { sheet: original.source.sheet, row: original.source.row, severity:'error' };
    for(const column of invalidNumbers)issues.push({...issue,message:`Neplatná nebo chybějící hodnota ${column}.`});
    for(const prior of document.issues.filter(i=>i.sheet===original.source.sheet&&i.row===original.source.row&&/^Neplatná nebo chybějící hodnota /.test(i.message)))if(!issues.some(i=>i.sheet===prior.sheet&&i.row===prior.row&&i.message===prior.message))issues.push({...prior,severity:'error'});
    if (edited.quantity === null) issues.push({...issue,message:'Položka nemá vyplněné množství.'});
    else if (edited.unitPrice !== null && edited.total !== null && multiplyMoney(edited.quantity, edited.unitPrice) !== edited.total) issues.push({...issue,severity:'warning',message:'Uložená cena se liší od množství × jednotkové ceny.'});
  }
  return { ...document, issues, importRepairs:[...(document.importRepairs ?? []),{...repair}], nodes:document.nodes.map(node =>
    node.id === original.id ? edited : repair.scope === 'row' && node.parentId === original.id ? {...node,parentId:original.parentId} : node) };
}
