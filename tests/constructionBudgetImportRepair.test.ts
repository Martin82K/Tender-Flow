import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseKrosWorkbook } from '@features/projects/budget/model/krosImport';
import { applyImportRepair, previewImportRepair } from '@features/projects/budget/model/importRepair';
import { aggregateBudget } from '@features/projects/budget/model/budgetTree';

export function repairFixture() {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
    ['Typ', 'Kód', 'Popis', 'MJ', 'Množství', 'J.cena', 'Celkem', 'Úroveň'],
    ['D', 'HSV', 'Práce HSV', '', null, null, null, 0],
    ['D', '6', 'Úpravy povrchů', '', null, null, null, 1],
    ['D', '61', 'Vnitřní povrchy', '', null, null, null, 2],
    ['K', '001', 'Omítky', 'm2', 2, 50, 100],
    ['VV', '', '2*1', '', 2],
    ['D', '9', 'Ostatní', '', null, null, null, 1],
    ['K', '002', 'Úklid', 'm2', 1, 20, 20],
    ['', '003', 'Nerozpoznaná položka', 'm', 1, 5, 5],
  ]), 'Soupis');
  return book;
}

describe('import repair', () => {
  it('honors an explicit depth column outside AU and returns to a higher level', () => {
    const doc = parseKrosWorkbook(repairFixture(), undefined, { Soupis: { columns: { depth: 7 } } });
    expect(doc.nodes.find(n => n.code === '61')?.parentId).toBe('sheet:0:row:3');
    expect(doc.nodes.find(n => n.code === '9')?.parentId).toBe('sheet:0:row:2');
  });
  it('keeps unknown source rows and blocks unverified KROS hierarchy', () => {
    const doc = parseKrosWorkbook(repairFixture());
    expect(doc.nodes.find(n => n.source.row === 9)?.source.cells.C9.value).toBe('Nerozpoznaná položka');
    expect(doc.issues).toContainEqual(expect.objectContaining({ kind: 'hierarchy', row: 4, severity: 'error' }));
  });
  it('flags depth jumps instead of silently accepting a flattened tree', () => {
    const book = repairFixture(); book.Sheets.Soupis.H4.v = 8;
    const doc = parseKrosWorkbook(book, undefined, { Soupis: { columns: { depth: 7 } } });
    expect(doc.issues).toContainEqual(expect.objectContaining({ kind: 'hierarchy', row: 4, severity: 'error' }));
  });
  it('bounds the proposed tree even when a workbook contains growing invalid depths',()=>{
    const book=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([
      ['Typ','Kód','Popis','MJ','Množství','J.cena','Celkem','Úroveň'],
      ...Array.from({length:100},(_,depth)=>['D',String(depth),'Oddíl','',null,null,null,depth]),
      ['K','item','Položka','m',1,1,1],
    ]),'Deep');
    const doc=parseKrosWorkbook(book,undefined,{Deep:{columns:{depth:7}}});
    const depths=new Map<string,number>();
    for(const node of doc.nodes)depths.set(node.id,node.kind==='section'?(depths.get(node.parentId??'')??0)+1:(depths.get(node.parentId??'')??0));
    expect(Math.max(...depths.values())).toBeLessThanOrEqual(33);
    expect(doc.issues.filter(i=>i.kind==='hierarchy')).toHaveLength(67);
    expect(aggregateBudget(doc.nodes).total).toBe('1.00');
  });
  it('previews only the selected subtree and preserves source, totals and the next section', () => {
    const doc = parseKrosWorkbook(repairFixture());
    const change = { nodeId: 'sheet:0:row:4', parentId: 'sheet:0:row:3', kind: 'section' as const, scope: 'subtree' as const };
    expect(previewImportRepair(doc, change).rows).toEqual([4, 5, 6]);
    const repaired = applyImportRepair(doc, change);
    expect(repaired.nodes.find(n => n.code === '61')?.parentId).toBe(change.parentId);
    expect(repaired.nodes.find(n => n.code === '9')).toEqual(doc.nodes.find(n => n.code === '9'));
    expect(aggregateBudget(repaired.nodes).total).toBe(aggregateBudget(doc.nodes).total);
    expect(repaired.nodes.find(n => n.code === '61')?.source).toEqual(doc.nodes.find(n => n.code === '61')?.source);
    expect(doc.nodes.find(n => n.code === '61')?.parentId).toBe('sheet:0:row:2');
    expect(repaired.issues.some(i => i.kind === 'hierarchy' && i.row === 4)).toBe(false);
    expect(repaired.issues.some(i => i.kind === 'hierarchy' && i.row === 3)).toBe(true);
  });
  it('can narrow a repair to one row without moving its children', () => {
    const doc = parseKrosWorkbook(repairFixture());
    const repaired = applyImportRepair(doc, { nodeId: 'sheet:0:row:4', parentId: 'sheet:0:row:3', kind: 'section', scope: 'row' });
    expect(repaired.nodes.find(n => n.code === '001')?.parentId).toBe('sheet:0:row:2');
  });
  it('rejects own, later, missing and foreign-sheet parents', () => {
    const doc = parseKrosWorkbook(repairFixture());
    doc.nodes.unshift({ ...doc.nodes[1], id: 'foreign', sheetId: 'foreign' });
    for (const parentId of ['sheet:0:row:4', 'sheet:0:row:5', 'missing', 'foreign']) {
      expect(() => applyImportRepair(doc, { nodeId: 'sheet:0:row:4', parentId, kind: 'section', scope: 'subtree' })).toThrow();
    }
  });
  it('rescues an unclassified item from original cells without executing formulas', () => {
    const doc = parseKrosWorkbook(repairFixture());
    const repaired = applyImportRepair(doc, { nodeId: 'sheet:0:row:9', parentId: 'sheet:0:row:7', kind: 'K', scope: 'row' });
    expect(repaired.nodes.find(n => n.source.row === 9)).toMatchObject({ kind: 'K', quantity: '1', unitPrice: '5', total: '5.00' });
    expect(repaired.issues.some(i => i.row === 9)).toBe(false);
    expect(JSON.parse(JSON.stringify(repaired)).importRepairs).toHaveLength(1);
  });
  it('keeps missing cached formula results unpriced rather than evaluating them or using zero', () => {
    const book=repairFixture();book.Sheets.Soupis.F9={t:'n',f:'WEBSERVICE("https://example.invalid")'};
    const doc=parseKrosWorkbook(book);
    const repaired=applyImportRepair(doc,{nodeId:'sheet:0:row:9',parentId:'sheet:0:row:7',kind:'K',scope:'row'});
    expect(repaired.nodes.find(n=>n.source.row===9)?.unitPrice).toBeNull();
    expect(repaired.issues).toContainEqual(expect.objectContaining({row:9,severity:'error',message:expect.stringContaining('úplné ocenění')}));
  });
  it('retains edited prices when changing a priced item category',()=>{
    const doc=parseKrosWorkbook(repairFixture());doc.nodes.find(n=>n.code==='001')!.unitPrice='75';
    const repaired=applyImportRepair(doc,{nodeId:'sheet:0:row:5',parentId:'sheet:0:row:4',kind:'M',scope:'subtree'});
    expect(repaired.nodes.find(n=>n.code==='001')?.unitPrice).toBe('75');
  });
});
