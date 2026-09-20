import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseKrosWorkbook, inspectXlsxArchive } from '@features/projects/budget/model/krosImport';
import { aggregateBudget } from '@features/projects/budget/model/budgetTree';
const workbook = () => {
  const w = XLSX.utils.book_new();
  const s = XLSX.utils.aoa_to_sheet([
    ['Objekt:'], ['SO 1'], ['Typ','Kód','Popis','MJ','Množství','J.cena [CZK]','Cena celkem [CZK]'],
    ['D','HSV','HSV',null,null,null,50], ['D','2','Základy',null,null,null,50],
    ['K','001','Beton','m3',2,25,50], ['VV','','fig*2','m3',2], ['VV','','Součet',null,2],
    ['K','001','Druhá položka','m3',0,25,0],
  ]);
  s.F6.f='25'; XLSX.utils.book_append_sheet(w,s,'Soupis');
  XLSX.utils.book_append_sheet(w,XLSX.utils.aoa_to_sheet([['REKAPITULACE STAVBY'],['Cena bez DPH',50]]),'Rekapitulace'); return w;
};
describe('KROS conversion', () => {
  it('uses the deepest KROS level as the sheet title', () => {
    const w = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(w, XLSX.utils.aoa_to_sheet([
      ['Objekt:'], ['SO 101'], ['Úroveň 3:'], ['Technika prostředí'],
      ['Úroveň 4:'], ['Vzduchotechnika'],
      ['Typ','Kód','Popis','MJ','Množství','J.cena','Cena celkem'],
      ['K','001','Potrubí','m',1,10,10],
    ]), 'VZT');
    expect(parseKrosWorkbook(w).sheets[0].title).toBe('Vzduchotechnika');
  });
  it('preserves source, duplicate codes, VV and excludes summaries from totals', () => {
    const d=parseKrosWorkbook(workbook());
    expect(d.sheets.map(s=>s.role)).toEqual(['items','summary']);
    expect(d.nodes.filter(n=>n.kind==='K')).toHaveLength(2);
    expect(new Set(d.nodes.map(n=>n.id)).size).toBe(d.nodes.length);
    expect(d.nodes.find(n=>n.kind==='K')?.source.row).toBe(6);
    expect(d.nodes.find(n=>n.kind==='K')?.code).toBe('001');
    expect(d.nodes.filter(n=>n.kind==='VV').every(n=>n.total===null)).toBe(true);
    expect(aggregateBudget(d.nodes).total).toBe('50.00');
  });
  it('rejects damaged archives before invoking the XLSX reader', () => {
    expect(()=>inspectXlsxArchive(new Uint8Array([1,2,3]))).toThrow();
    expect(()=>inspectXlsxArchive(XLSX.write(workbook(),{type:'array',bookType:'xlsx'}))).not.toThrow();
  });
});
it('excludes conflicting figures from arithmetic while keeping values available for review',()=>{
 const w=workbook();XLSX.utils.book_append_sheet(w,XLSX.utils.aoa_to_sheet([['Kód','Výměra'],['F1',2],['F1',3],['F1',4],['OK',0]]),'Seznam figur');
 const d=parseKrosWorkbook(w);expect(d.figures.F1).toBeUndefined();expect(d.figures.OK).toBe('0');expect(d.issues.find(i=>i.kind==='ambiguous-figures')?.figures).toMatchObject([{code:'F1',values:['2','3','4']}]);expect(aggregateBudget(d.nodes).total).toBe('50.00');
});

it('reports calculation overflow as a blocking import issue without crashing', () => {
 const w=workbook();
 w.Sheets.Soupis.E6={t:'s',v:'999999999999999999999999'};
 w.Sheets.Soupis.F6={t:'s',v:'2'};
 const document=parseKrosWorkbook(w);
 expect(document.issues.some(issue=>issue.severity==='error' && issue.row===6)).toBe(true);
});

it.each([true, false])('keeps every unpriced tender item with price columns present: %s', (priceColumns) => {
 const w=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(w,XLSX.utils.aoa_to_sheet([
  ['Typ','Kód','Popis','MJ','Množství',...(priceColumns?['J.cena','Celkem']:[])],
  ['K','001','Výkop','m3',12],['M','002','Materiál','kg',3],
 ]),'Soutěž');
 const result=parseKrosWorkbook(w);
 expect(result.nodes.filter(n=>n.kind==='K'||n.kind==='M')).toHaveLength(2);
 expect(result.nodes.filter(n=>n.kind==='K'||n.kind==='M').map(n=>[n.unitPrice,n.total])).toEqual([[null,null],[null,null]]);
 expect(result.issues.filter(i=>i.severity==='error')).toEqual([]);
 expect(result.sheets[0]).toMatchObject({selected:true,role:'items',format:'kros'});
});
it('preserves invalid priced rows and still reports malformed numbers',()=>{
 const w=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(w,XLSX.utils.aoa_to_sheet([['Typ','Kód','Popis','MJ','Množství','J.cena','Celkem'],['K','001','Výkop','m3',12,'chyba',null]]),'Soutěž');
 const result=parseKrosWorkbook(w);expect(result.nodes.filter(n=>n.kind==='K')).toHaveLength(1);
 expect(result.issues.some(i=>i.severity==='error'&&i.message.includes('F'))).toBe(true);
});
