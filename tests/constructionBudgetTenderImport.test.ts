import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseKrosWorkbook, readKrosFile } from '@features/projects/budget/model/krosImport';
import { detectTenderColumns, readTenderRows, matchTenderRows, planTenderAllocations, parseTenderTemplate } from '@features/projects/budget/model/tenderImport';
import type { BudgetNode } from '@features/projects/budget/model/types';

const item = (id: string, overrides: Partial<BudgetNode> = {}): BudgetNode => ({id,parentId:null,sheetId:'s',kind:'K',order:0,code:'001',description:'Práce',unit:'m2',quantity:'10',unitPrice:'20',total:'200',source:{sheet:'SO',row:4,cells:{}},sourceType:'K',tags:[],tenders:[],...overrides});
const workbook = (at: number, labels = ['č. VŘ','Název VŘ']) => {
  const headers = ['Typ','Kód','Popis','MJ','Množství','J.cena','Celkem'];
  const values: Array<string | number> = ['K','001','Práce','m2',999,999,998001];
  headers.splice(at,0,...labels); values.splice(at,0,'02','SDK A PODHLEDY, REVIZNÍ DVÍŘKA');
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([headers,values]),'SO'); return wb;
};
describe('tender column import',()=>{
  it('reads assignment-only files without requiring or interpreting prices and quantities',()=>{
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Typ','Kód','Popis','MJ','Název VŘ'],['K','001','Práce','m2','Stavba']]),'SO');
    const doc=parseKrosWorkbook(wb,undefined,{},true);
    expect(doc.nodes.filter(n=>n.kind==='K')).toHaveLength(1);
    expect(doc.nodes.find(n=>n.kind==='K')).toMatchObject({quantity:null,unitPrice:null,total:null});
    expect(doc.issues).toEqual([]);
  });
  it.each([0,3,7])('detects inserted columns at %s without shifting item identity', at=>{
    const doc=parseKrosWorkbook(workbook(at)); const mapping=detectTenderColumns(doc.sheets[0]);
    expect(mapping.name).toBe(at+1); expect(mapping.code).toBe(at);
    expect(readTenderRows(doc,{[doc.sheets[0].id]:mapping})[0]).toMatchObject({name:'SDK A PODHLEDY, REVIZNÍ DVÍŘKA',externalCode:'02',node:{code:'001'}});
  });
  it('retains headers and sample rows in bounded previews of wide multisheet workbooks',()=>{
    const wb=XLSX.utils.book_new();
    const rows=[...Array.from({length:10},()=>['Úvod']),['Typ','Kód','Popis','MJ','Množství','J.cena','Celkem','č. VŘ','Název VŘ'],['K','001','Práce','m2',1,1,1,'02','Stavba']];
    for(let i=0;i<100;i++){const sheet=XLSX.utils.aoa_to_sheet(rows);sheet['!ref']='A1:OJ12';XLSX.utils.book_append_sheet(wb,sheet,`SO${i}`);}
    const doc=parseKrosWorkbook(wb);
    for(const sheet of doc.sheets){
      expect(sheet.sourcePreview?.rows.some(row=>row.row===11)).toBe(true);
      expect(sheet.sourcePreview?.rows.some(row=>row.row===12)).toBe(true);
      expect(detectTenderColumns(sheet)).toMatchObject({name:8,code:7});
    }
    expect(doc.sheets.reduce((sum,sheet)=>sum+(sheet.sourcePreview?.rows.reduce((count,row)=>count+row.cells.length,0)??0),0)).toBeLessThanOrEqual(200000);
  });
  it('offers ambiguous or missing headers for explicit selection',()=>{
    const doc=parseKrosWorkbook(workbook(0,['VŘ','VŘ']));
    expect(detectTenderColumns(doc.sheets[0]).name).toBeUndefined();
    expect(readTenderRows(doc,{'sheet:0':{name:1,code:0}})[0].externalCode).toBe('02');
  });
  it('never inherits blank names or turns a comma into multiple tenders',()=>{
    const wb=workbook(0); XLSX.utils.sheet_add_aoa(wb.Sheets.SO,[[null,null,'K','002','Jiné','m2',1,1,1]],{origin:'A3'});
    const doc=parseKrosWorkbook(wb); const rows=readTenderRows(doc,{'sheet:0':{name:1,code:0}});
    expect(rows).toHaveLength(2); expect(rows[1].name).toBe('');
  });
  it('preserves formatted numeric tender codes with leading zeros',()=>{
    const wb=workbook(0);wb.Sheets.SO.A2={t:'n',v:2,z:'00'};
    const doc=readKrosFile(new Uint8Array(XLSX.write(wb,{type:'array',bookType:'xlsx'})),undefined,{},true);
    expect(readTenderRows(doc,{'sheet:0':{name:1,code:0}})[0].externalCode).toBe('02');
  });
  it('uses exact object context for duplicates but never abbreviated provenance',()=>{
    const row={node:item('incoming'),name:'Práce',externalCode:'02',part:'SO1',sourceRef:''};
    const targets=[item('a',{source:{sheet:'SO1',row:8,cells:{}}}),item('b',{source:{sheet:'SO2',row:8,cells:{}}})];
    expect(matchTenderRows([row],targets)[0].targetId).toBe('a');
    expect(matchTenderRows([{...row,part:'',sourceRef:'SO...!8'}],targets)[0].targetId).toBeUndefined();
  });
  it('matches unique semantics across renamed sheets, never row positions or duplicate codes alone',()=>{
    const incoming=[{node:item('new',{source:{sheet:'Sloučeno',row:9,cells:{}}}),name:'Práce',externalCode:'02',part:'',sourceRef:''}];
    expect(matchTenderRows(incoming,[item('old')])[0].targetId).toBe('old');
    expect(matchTenderRows(incoming,[item('a'),item('b')])[0].targetId).toBeUndefined();
    expect(matchTenderRows([...incoming,{...incoming[0],node:item('other')}],[item('old')]).every(r=>!r.targetId)).toBe(true);
  });
  it('preserves target prices and uses only its remaining quantity; replacement is explicit',()=>{
    const target=item('old'); const before=structuredClone(target); const existing=[{itemId:'old',categoryId:'one',quantity:'3'}];
    expect(()=>planTenderAllocations([target],existing,[{itemId:'old',categoryId:'two',action:'unresolved'}])).toThrow();
    expect(planTenderAllocations([target],existing,[{itemId:'old',categoryId:'two',action:'remaining'}])).toEqual([...existing,{itemId:'old',categoryId:'two',quantity:'7'}]);
    expect(planTenderAllocations([target],existing,[{itemId:'old',categoryId:'two',action:'replace'}])).toEqual([{itemId:'old',categoryId:'two',quantity:'10'}]);
    expect(target).toEqual(before);
  });
  it('rejects duplicate targets and produces no zero or repeated allocations',()=>{
    const a={itemId:'old',categoryId:'one',action:'remaining' as const};
    expect(()=>planTenderAllocations([item('old')],[],[a,a])).toThrow();
    const existing=[{itemId:'old',categoryId:'one',quantity:'10'}];
    expect(planTenderAllocations([item('old')],existing,[a])).toEqual(existing);
  });
  it('bounds ambiguous candidate lists for large repeated item groups',()=>{
    const targets=Array.from({length:5000},(_,i)=>item(`target-${i}`));
    const rows=Array.from({length:5000},(_,i)=>({node:item(`source-${i}`),name:'Práce',externalCode:'02',part:'',sourceRef:''}));
    const matches=matchTenderRows(rows,targets);
    expect(matches).toHaveLength(5000);expect(matches.every(m=>!m.targetId&&m.candidates.length===100)).toBe(true);
  });
  it('imports reusable definitions without project operational data or lost leading zeros',()=>{
    expect(parseTenderTemplate(JSON.stringify({format:'tender-flow-tenders',version:1,categories:[{title:'Práce',externalCode:'02',allocations:[{}],status:'closed'}]}))).toEqual([{title:'Práce',externalCode:'02'}]);
    expect(()=>parseTenderTemplate('{"format":"other"}')).toThrow();
  });
});

it('matches tender names with equivalent internal whitespace',async()=>{
 const {tenderNameKey}=await import('@features/projects/budget/model/tenderImport');
 expect(tenderNameKey(' Zemní  práce ')).toBe(tenderNameKey('Zemní práce'));
 expect(tenderNameKey('Zemní\tpráce')).toBe(tenderNameKey('Zemní práce'));
});
