import { describe,it,expect } from 'vitest';
import { applyBudgetItemEdit,compareRevisions,validateRevisionAllocations } from '@features/projects/budget/model/revisions';
import type { BudgetDocument,BudgetNode } from '@features/projects/budget/model/types';
const item:BudgetNode={id:'a',parentId:null,sheetId:'s',kind:'K',order:0,code:'001',description:'Item',unit:'m3',quantity:'10',unitPrice:'1',total:'10.00',tags:[],tenders:[],sourceType:'K',source:{sheet:'S',row:1,cells:{}}};
const document=(nodes:BudgetNode[]):BudgetDocument=>({schemaVersion:1,nodes,sheets:[],issues:[],figures:{}});
describe('revision safety',()=>{
 it('does not match duplicated codes blindly',()=>{
  const before=document([item,{...item,id:'b',description:'Other'}]);const after=document([{...item,id:'c',quantity:'5'},{...item,id:'d',description:'Other'}]);
  expect(compareRevisions(before,after)).toEqual([expect.objectContaining({status:'changed',before:item})]);
  expect(compareRevisions(document([item,{...item,id:'duplicate'}]),document([item])).every(d=>d.status==='ambiguous')).toBe(true);
 });
 it('rejects allocation after quantity reduction or removed source',()=>{
  expect(()=>validateRevisionAllocations(document([{...item,quantity:'2'}]),[{itemId:'a',categoryId:'vr',quantity:'3'}])).toThrow();
  expect(()=>validateRevisionAllocations(document([]),[{itemId:'a',categoryId:'vr',quantity:'3'}])).toThrow();
 });
});

it('clears corrected numeric issues but preserves mapping errors and other rows',()=>{
 const d=document([{...item,unitPrice:null,total:null}]);d.issues=[{sheet:'S',row:1,severity:'error',message:'Položka nemá úplné ocenění; prázdná hodnota není nula.'},{sheet:'S',row:1,severity:'error',message:'Chybí požadovaný sloupec; upravte mapování.'},{sheet:'S',row:2,severity:'error',message:'Neplatná nebo chybějící hodnota E.'}];
 const fixed=applyBudgetItemEdit(d,item);expect(fixed.issues).toHaveLength(2);expect(d.issues).toHaveLength(3);expect(fixed.nodes[0].unitPrice).toBe('1');
 expect(applyBudgetItemEdit(d,{...item,unitPrice:null,total:null}).issues).toHaveLength(3);
});
