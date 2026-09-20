import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { buildBudgetWorkbook } from '@features/projects/budget/api/budgetExport';
import type { BudgetNode } from '@features/projects/budget/model/types';
const node=(id:string,parentId:string|null,kind:BudgetNode['kind'],extra:Partial<BudgetNode>={}):BudgetNode=>({id,parentId,kind,sheetId:'s',order:0,code:id,description:id,unit:'m2',quantity:null,unitPrice:null,total:null,source:{sheet:'raw',row:1,cells:{Z1:{value:'SECRET-PRICE'}}},sourceType:'',tags:['INTERNAL'],tenders:[],...extra});
const nodes=[node('object',null,'object'),node('s','object','sheet'),node('section','s','section'),node('sub','section','section'),node('a','sub','K',{quantity:'10',unitPrice:'123.45',total:'1234.50',description:'=HYPERLINK("bad")'}),node('b','section','M',{quantity:'5',unitPrice:'99',total:'495'}),node('unrelated',null,'object')];
const allocations=[{itemId:'a',categoryId:'vr',quantity:'3.125'},{itemId:'a',categoryId:'other',quantity:'6.875'}];
const rows=(book:XLSX.WorkBook,sheet='Rozpočet')=>XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[sheet],{header:1,defval:''});
describe('budget workbook export',()=>{
 it('exports allocated quantities with full ancestor hierarchy and rounded partial recap',()=>{
  const book=buildBudgetWorkbook(nodes,{scope:{kind:'tender',categoryId:'vr',title:'VŘ'},allocations,includePrices:true,canViewPrices:true});
  const data=rows(book);expect(data.slice(1).map(r=>r[1])).toEqual(['object','s','section','sub','a']);
  expect(data.at(-1)?.slice(4,7)).toEqual(['3.125','123.45','385.78']);
  expect(rows(book,'Rekapitulace').filter(r=>r[1]==='sub')[0].at(-1)).toBe('385.78');
  expect(book.Sheets['Rozpočet'].C6).toMatchObject({t:'s',v:'=HYPERLINK("bad")'});expect(book.Sheets['Rozpočet'].C6.f).toBeUndefined();
 });
 it.each(['whole','tender'] as const)('creates a price-free %s inquiry without original cells, internal tags, source formulas or price metadata',kind=>{
  const book=buildBudgetWorkbook(nodes,{scope:kind==='whole'?{kind}:{kind,categoryId:'vr',title:'VŘ'},allocations,includePrices:false,canViewPrices:true});
  expect(rows(book).slice(1).every(r=>r[5]===''&&r[6]==='')).toBe(true);
  expect(rows(book,'Rekapitulace').slice(1).every(r=>r.at(-1)==='')).toBe(true);
  const output=XLSX.write(book,{type:'buffer',bookType:'xlsx'});const reopened=XLSX.read(output,{type:'buffer'});const content=JSON.stringify(reopened);
  for(const secret of ['123.45','1234.50','495','SECRET-PRICE','INTERNAL'])expect(content).not.toContain(secret);
  expect(reopened.Sheets['Rozpočet'].G6.f).toContain('NUMBERVALUE(E6');
  for(const sheet of Object.values(reopened.Sheets))for(const [address,cell] of Object.entries(sheet))if(!address.startsWith('!')&&cell.f){expect(cell.f).not.toMatch(/HYPERLINK|\[|http|SECRET/);expect(cell.v??'').toBe('');}
  expect(reopened.Workbook?.Sheets?.some(s=>s.Hidden)).not.toBe(true);
 });
 it('rejects price export without permission while allowing the price-free option',()=>{
  expect(()=>buildBudgetWorkbook(nodes,{scope:{kind:'whole'},allocations,includePrices:true,canViewPrices:false})).toThrow(/oprávnění/);
  expect(()=>buildBudgetWorkbook(nodes,{scope:{kind:'whole'},allocations,includePrices:false,canViewPrices:false})).not.toThrow();
 });
 it('preserves whole-budget authoritative totals and selected-item ancestor hierarchy',()=>{
  const book=buildBudgetWorkbook(nodes,{scope:{kind:'selection',itemIds:['b']},allocations,includePrices:true,canViewPrices:true});
  expect(rows(book).slice(1).map(r=>r[1])).toEqual(['object','s','section','b']);
  expect(rows(book,'Rekapitulace').at(-1)?.at(-1)).toBe('495.00');
 });
});
it('refuses over-allocation instead of exporting a misleading inquiry',()=>{
 const options={scope:{kind:'tender' as const,categoryId:'vr',title:'VŘ'},includePrices:false,canViewPrices:false};
 expect(()=>buildBudgetWorkbook(nodes,{...options,allocations:[{itemId:'a',categoryId:'vr',quantity:'11'}]})).toThrow(/přesahuje/);

});
it('leaves incomplete totals blank and rejects cyclic hierarchy',()=>{
 const missing=nodes.map(n=>n.id==='a'?{...n,total:null}:n);
 const options={scope:{kind:'whole' as const},allocations:[],includePrices:true,canViewPrices:true};
 expect(rows(buildBudgetWorkbook(missing,options),'Rekapitulace').at(-1)?.at(-1)).toBe('');
 expect(()=>buildBudgetWorkbook(nodes.map(n=>n.id==='object'?{...n,parentId:'sub'}:n),options)).toThrow(/cyklus/);
});

it('sums repeated valid links to the same tender with exact quantity precision',()=>{
 const book=buildBudgetWorkbook(nodes,{scope:{kind:'tender',categoryId:'vr',title:'VŘ'},includePrices:true,canViewPrices:true,allocations:[{itemId:'a',categoryId:'vr',quantity:'1.000000000000000001'},{itemId:'a',categoryId:'vr',quantity:'2.125'}]});
 expect(rows(book).at(-1)?.[4]).toBe('3.125000000000000001');
 expect(rows(book).at(-1)?.[6]).toBe('385.78');
});
it.each((['whole','selection'] as const).flatMap(kind=>(['unitPrice','quantity','total'] as const).map(field=>({kind,field}))))('keeps totals blank for missing $field in $kind export',({kind,field})=>{
 const missing=nodes.map(n=>n.id==='a'?{...n,[field]:null}:n);
 const book=buildBudgetWorkbook(missing,{scope:kind==='whole'?{kind}:{kind,itemIds:['a']},allocations:[],includePrices:true,canViewPrices:true});
 expect(rows(book).find(r=>r[1]==='a')?.[6]).toBe('');
 expect(rows(book,'Rekapitulace').at(-1)?.at(-1)).toBe('');
});

it('keeps zero quantity and zero unit price valid in priced export',()=>{
 const zero=nodes.map(n=>n.id==='a'?{...n,quantity:'0',unitPrice:'0',total:'0'}:n);
 const book=buildBudgetWorkbook(zero,{scope:{kind:'selection',itemIds:['a']},allocations:[],includePrices:true,canViewPrices:true});
 expect(rows(book).find(r=>r[1]==='a')?.slice(4,7)).toEqual(['0','0','0']);expect(rows(book,'Rekapitulace').at(-1)?.at(-1)).toBe('0.00');
});
it('rejects excessively deep export hierarchies before creating a workbook',()=>{
 const deep=Array.from({length:300},(_,i)=>node(`g${i}`,i?`g${i-1}`:null,'section'));
 deep.push(node('leaf','g299','K',{quantity:'1',unitPrice:'1',total:'1'}));
 expect(()=>buildBudgetWorkbook(deep,{scope:{kind:'whole'},allocations:[],includePrices:true,canViewPrices:true})).toThrow(/hloubk/);
});
it.each([true,false])('bounds hierarchy work for many leaves sharing deep ancestors (prices=%s)',includePrices=>{
 let reads=0;const deep=Array.from({length:200},(_,i)=>node(`g${i}`,i?`g${i-1}`:null,'section'));
 deep.push(...Array.from({length:200},(_,i)=>node(`leaf${i}`,'g199','K',{quantity:'1',unitPrice:'1',total:'1'})));
 for(const n of deep){const parent=n.parentId;Object.defineProperty(n,'parentId',{get(){reads++;return parent;}});}
 const book=buildBudgetWorkbook(deep,{scope:{kind:'whole'},allocations:[],includePrices,canViewPrices:true});
 expect(rows(book)).toHaveLength(401);expect(reads).toBeLessThan(deep.length*20);
 if(includePrices)expect(rows(book,'Rekapitulace').at(-1)?.at(-1)).toBe('200.00');
 else expect(book.Sheets['Rozpočet'].G2.f).toContain('A202:A401');
});
