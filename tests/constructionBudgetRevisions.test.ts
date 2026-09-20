import { describe,it,expect } from 'vitest';
import { assignWholeItems,syncWholeItemQuantity,applyBudgetItemEdit,compareRevisions,validateRevisionAllocations } from '@features/projects/budget/model/revisions';
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
it('edits code and unit without changing immutable source references',()=>{
 const updated=applyBudgetItemEdit(document([item]),{...item,code:'002',unit:'m2',source:{sheet:'Other',row:99,cells:{}}});
 expect(updated.nodes[0]).toMatchObject({code:'002',unit:'m2',source:item.source});
});

it('clears only the explicitly repaired mapped numeric column on an unpriced row',()=>{
 const unpriced={...item,quantity:null,unitPrice:null,total:null};
 const d=document([unpriced]);d.sheets=[{id:'s',name:'S',columns:{quantity:4,unitPrice:5,total:6}} as BudgetDocument['sheets'][number]];
 d.issues=['E','F'].map(column=>({sheet:'S',row:1,severity:'error' as const,message:`Neplatná nebo chybějící hodnota ${column}.`}));
 const quantityFixed=applyBudgetItemEdit(d,{...unpriced,quantity:'5'},['quantity']);
 expect(quantityFixed.issues.map(i=>i.message)).toEqual(['Neplatná nebo chybějící hodnota F.']);
 const priceCleared=applyBudgetItemEdit(quantityFixed,quantityFixed.nodes[0],['unitPrice']);
 expect(priceCleared.issues).toEqual([]);
 expect(applyBudgetItemEdit(d,{...unpriced,description:'Edited'},['description']).issues).toHaveLength(2);
 expect(()=>applyBudgetItemEdit(d,{...unpriced,quantity:'bad'},['quantity'])).toThrow();
});


describe('whole-item tender assignment',()=>{
 it('replaces all old splits with one full assignment and is idempotent',()=>{
  const existing=[{itemId:'a',categoryId:'old',quantity:'4'},{itemId:'a',categoryId:'other',quantity:'6'},{itemId:'b',categoryId:'keep',quantity:'2'}];
  const next=assignWholeItems([item],existing,new Set(['a']),'new');
  expect(next).toEqual([existing[2],{itemId:'a',categoryId:'new',quantity:'10'}]);
  expect(assignWholeItems([item],next,new Set(['a']),'new')).toEqual(next);
 });
 it.each(['3','-3','0'])('keeps the entire assignment in sync with quantity %s',quantity=>{
  const next=syncWholeItemQuantity(document([item]),document([{...item,quantity}]),[{itemId:'a',categoryId:'vr',quantity:'10'}],true);
  expect(next).toEqual([{itemId:'a',categoryId:'vr',quantity}]);
 });
 it('requires allocation permission and explicit resolution of legacy splits',()=>{
  const before=document([item]),after=document([{...item,quantity:'5'}]);
  const one=[{itemId:'a',categoryId:'vr',quantity:'10'}];
  expect(()=>syncWholeItemQuantity(before,after,one,false)).toThrow('oprávnění');
  expect(()=>syncWholeItemQuantity(before,after,[{...one[0],quantity:'4'},{...one[0],categoryId:'other',quantity:'6'}],true)).toThrow('jedno VŘ');
  expect(syncWholeItemQuantity(before,before,one,false)).toEqual(one);
  expect(()=>assignWholeItems([{...item,quantity:null}],[],new Set(['a']),'vr')).toThrow('množství');
 });
});
