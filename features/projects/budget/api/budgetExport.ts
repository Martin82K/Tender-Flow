import * as XLSX from 'xlsx';
import { multiplyMoney, sumMoney, sumQuantities, validateAllocation } from '../model/budgetModel';
import { isPriced } from '../model/types';
import type { BudgetAllocation, BudgetNode } from '../model/types';

export type BudgetExportScope = { kind: 'whole' } | { kind: 'tender'; categoryId: string; title: string } | { kind: 'selection'; itemIds: string[] };
export interface BudgetExportOptions {
  scope: BudgetExportScope;
  allocations: BudgetAllocation[];
  includePrices: boolean;
  canViewPrices: boolean;
}
const isGroup = (node: BudgetNode) => ['object', 'sheet', 'section'].includes(node.kind);

/** Build a fresh workbook from an allowlist; never reuse source cells, metadata or formulas. Inquiry formulas are generated afresh. */
export function buildBudgetWorkbook(nodes: BudgetNode[], options: BudgetExportOptions): XLSX.WorkBook {
  if (options.includePrices && !options.canViewPrices) throw new Error('Export cen vyžaduje oprávnění k cenám rozpočtu.');
  const byId = new Map(nodes.map(node => [node.id, node]));
  const chosen = options.scope.kind === 'selection' ? new Set(options.scope.itemIds) : null;
  const allocated = new Map<string, string>();
  if (options.scope.kind === 'tender') {
    const all = new Map<string, string[]>();
    for (const allocation of options.allocations) {
      const quantities = all.get(allocation.itemId) ?? [];
      quantities.push(allocation.quantity); all.set(allocation.itemId, quantities);
      if (allocation.categoryId !== options.scope.categoryId) continue;
      allocated.set(allocation.itemId, sumQuantities([allocated.get(allocation.itemId) ?? '0', allocation.quantity]));
    }
    for (const id of allocated.keys()) {
      const node = byId.get(id);
      if (!node || !isPriced(node) || node.quantity === null) throw new Error('VŘ obsahuje neplatnou položku nebo množství.');
      validateAllocation(node.quantity, all.get(id) ?? []);
    }
  }
  const items = nodes.filter(node => isPriced(node) && (!chosen || chosen.has(node.id)) && (options.scope.kind !== 'tender' || allocated.has(node.id)));
  if (!items.length) throw new Error('Vybraný rozsah neobsahuje položky k exportu.');
  const included = new Set(items.map(node => node.id));
  const amounts = new Map<string, Array<string | null>>();
  const itemValues = new Map<string, { quantity: string | null; amount: string | null }>();
  for (const item of items) {
    const quantity = options.scope.kind === 'tender' ? allocated.get(item.id)! : item.quantity;
    const amount = !options.includePrices || quantity === null || item.unitPrice === null ? null : options.scope.kind === 'tender'
      ? multiplyMoney(quantity, item.unitPrice) : item.total;
    itemValues.set(item.id, { quantity, amount });
    let parent = item.parentId;
    const seen = new Set([item.id]);
    while (parent) {
      if (seen.has(parent)) throw new Error('Struktura rozpočtu obsahuje cyklus.');
      seen.add(parent); const ancestor = byId.get(parent);
      if (!ancestor) throw new Error('Ve struktuře rozpočtu chybí nadřazený řádek.');
      if (isGroup(ancestor)) {
        included.add(parent); const values = amounts.get(parent) ?? [];
        values.push(amount); amounts.set(parent, values);
      }
      parent = ancestor.parentId;
    }
  }
  const total = (values: Array<string | null>) => options.includePrices && values.every(value => value !== null) ? sumMoney(values) : '';
  const rows: Array<Array<string | null>> = [['Typ', 'Kód', 'Popis', 'MJ', 'Množství', 'J. cena', 'Celkem', 'VŘ', 'Štítky']];
  const recap: Array<Array<string | null>> = [['Typ', 'Kód', 'Název', 'Celkem bez DPH']];
  const children = new Map<string | null, BudgetNode[]>();
  for (const node of nodes) {
    if (!included.has(node.id)) continue;
    let parent = node.parentId ?? null;
    while (parent && !included.has(parent)) parent = byId.get(parent)?.parentId ?? null;
    const siblings = children.get(parent) ?? []; siblings.push(node); children.set(parent, siblings);
  }
  const ordered: BudgetNode[] = []; const stack = [...(children.get(null) ?? [])].reverse();
  while (stack.length) {const node = stack.pop()!; ordered.push(node); const nested = children.get(node.id) ?? []; for (let i = nested.length - 1; i >= 0; i--) stack.push(nested[i]);}
  const rowById = new Map<string, number>();
  const recapLinks: number[] = [];
  for (const node of ordered) {
    rowById.set(node.id, rows.length + 1);
    const values = itemValues.get(node.id);
    const amount = values ? (values.amount ?? '') : total(amounts.get(node.id) ?? []);
    rows.push([node.kind, node.code, node.description, values ? node.unit : '', values?.quantity ?? '',
      values && options.includePrices ? node.unitPrice : '', amount,
      values ? (options.scope.kind === 'tender' ? options.scope.title : node.tenders.join('; ')) : '',
      values && options.includePrices ? node.tags.join('; ') : '']);
    if (isGroup(node)) {recap.push([node.kind, node.code, node.description, amount]); recapLinks.push(rows.length);}
  }
  recap.push(['celkem', '', 'Celkem exportovaný rozsah', total([...itemValues.values()].map(value => value.amount))]);
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [8, 20, 75, 10, 22, 22, 24, 35, 25].map(wch => ({ wch }));
  const summary = XLSX.utils.aoa_to_sheet(recap);
  summary['!cols'] = [12, 20, 75, 24].map(wch => ({ wch }));
  if (!options.includePrices) {
    const bounds = new Map<string, {first:number;last:number}>();
    for (const item of items) {
      const row = rowById.get(item.id)!;
      sheet[`G${row}`] = {t:'n', f:`IF(AND(ISNUMBER(F${row}),E${row}<>""),ROUND(_xlfn.NUMBERVALUE(E${row},".",",")*F${row},2),"")`, z:'0.00'};
      sheet[`F${row}`] = {t:'s',v:'',z:'0.00'};
      let parent = item.parentId;
      while (parent) {const bound=bounds.get(parent);bounds.set(parent,{first:Math.min(bound?.first??row,row),last:Math.max(bound?.last??row,row)});parent=byId.get(parent)?.parentId??null;}
    }
    const subtotal = (first:number,last:number) => {
      const kinds=`A${first}:A${last}`; const values=`G${first}:G${last}`;
      return `IF(COUNTIFS(${kinds},"K",${values},"")+COUNTIFS(${kinds},"M",${values},"")>0,"",SUMIF(${kinds},"K",${values})+SUMIF(${kinds},"M",${values}))`;
    };
    for (const node of ordered.filter(isGroup)) {const bound=bounds.get(node.id)!;sheet[`G${rowById.get(node.id)}`]={t:'n',f:subtotal(bound.first,bound.last),z:'0.00'};}
    for (let i=0;i<recapLinks.length;i++) {const ref=`'Rozpočet'!G${recapLinks[i]}`;summary[`D${i+2}`]={t:'n',f:`IF(${ref}="","",${ref})`,z:'0.00'};}
    // The final recap sums leaves only, so parent subtotals cannot double-count them.
    const formula=subtotal(2,rows.length).replace(/([AG]\d+(?::[AG]\d+)?)/g,"'Rozpočet'!$1");
    summary[`D${recap.length}`]={t:'n',f:formula,z:'0.00'};
  }
  // All user strings remain explicit string cells, including codes beginning with '='.
  XLSX.utils.book_append_sheet(workbook, sheet, 'Rozpočet');
  XLSX.utils.book_append_sheet(workbook, summary, 'Rekapitulace');
  return workbook;
}

export function exportBudget(nodes: BudgetNode[], filename: string, options: BudgetExportOptions): void {
  XLSX.writeFile(buildBudgetWorkbook(nodes, options), filename);
}
