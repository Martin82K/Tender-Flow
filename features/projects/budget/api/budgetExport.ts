import * as XLSX from 'xlsx';
import type { BudgetNode } from '../model/types';
// Explicit string cells prevent Excel formula injection; numeric columns remain numeric.
export function exportBudget(nodes: BudgetNode[], filename: string): void {
  const rows = [['Typ','Kód','Popis','MJ','Množství','J. cena','Celkem','VŘ','Štítky'], ...nodes.map(n => [n.kind,n.code,n.description,n.unit,n.quantity === null ? null : Number(n.quantity),n.unitPrice === null ? null : Number(n.unitPrice),n.total === null ? null : Number(n.total),n.tenders.join('; '),n.tags.join('; ')])];
  const workbook = XLSX.utils.book_new(); const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook,sheet,'Rozpočet'); XLSX.writeFile(workbook,filename);
}
