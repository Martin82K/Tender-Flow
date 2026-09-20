import {expect,it} from 'vitest';
import {webcrypto} from 'node:crypto';
import {comparisonBudgetSource} from '../../features/projects/offers/model/budgetSource';
import type {BudgetRevision} from '../../features/projects/budget/model/types';
it('uses allocated quantities without leaking internal budget prices or mutating the revision',async()=>{
 const original=globalThis.crypto;
 Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
 try{
 const revision={id:'r',title:'Rozpočet',version:2,document:{nodes:[{id:'i',parentId:null,kind:'K',code:'1',description:'Malba',unit:'m2',quantity:'1',unitPrice:'999',total:'999',source:{sheet:'S',row:2,cells:{}}}]},allocations:[{itemId:'i',categoryId:'c',quantity:'0.1'},{itemId:'i',categoryId:'c',quantity:'0.2'},{itemId:'i',categoryId:'other',quantity:'0.5'}]} as BudgetRevision;
 const before=JSON.stringify(revision),source=await comparisonBudgetSource(revision,'c');
 expect(source.items[0]).toMatchObject({quantity:'0.3',unitPrice:null,total:null});
 expect(source).toMatchObject({origin:'budget',revisionId:'r',revisionVersion:2});
 expect(source.sha256).toMatch(/^[a-f0-9]{64}$/);expect(JSON.stringify(revision)).toBe(before);
 await expect(comparisonBudgetSource(revision,'missing')).rejects.toThrow('nejsou položky');
 }finally{Object.defineProperty(globalThis,'crypto',{value:original,configurable:true});}
});

it('bounds allocation lookups and rejects more than 10000 selected items',async()=>{
 const original=globalThis.crypto;Object.defineProperty(globalThis,'crypto',{value:webcrypto,configurable:true});
 try{
 let reads=0;const count=500;
 const nodes=Array.from({length:count},(_,i)=>({id:`i${i}`,parentId:null,kind:'K',code:String(i),description:'Malba',unit:'m2',quantity:'1',unitPrice:null,total:null,source:{sheet:'S',row:i+1,cells:{}}}));
 const allocations=nodes.map(node=>({get itemId(){reads++;return node.id;},categoryId:'c',quantity:'1'}));
 const revision={id:'r',title:'Rozpočet',version:1,document:{nodes},allocations} as BudgetRevision;
 expect((await comparisonBudgetSource(revision,'c')).items).toHaveLength(count);expect(reads).toBeLessThan(count*5);
 const many=Array.from({length:10001},(_,i)=>({...nodes[0],id:`i${i}`}));
 await expect(comparisonBudgetSource({...revision,document:{...revision.document,nodes:many},allocations:many.map(node=>({itemId:node.id,categoryId:'c',quantity:'1'}))} as BudgetRevision,'c')).rejects.toThrow('10 000');
 }finally{Object.defineProperty(globalThis,'crypto',{value:original,configurable:true});}
});
