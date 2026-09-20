import { beforeEach, expect, it, vi } from 'vitest';
import { dbAdapter } from '@infra/db/dbAdapter';
import { budgetApi } from '@features/projects/budget/api/budgetApi';
import type { BudgetDocument } from '@features/projects/budget/model/types';
vi.mock('@infra/db/dbAdapter',()=>({dbAdapter:{rpc:vi.fn()}}));
beforeEach(()=>vi.mocked(dbAdapter.rpc).mockResolvedValue({data:{id:'saved'},error:null} as never));
it('never persists raw sheet previews outside the server-redacted source cells',async()=>{
  const document:BudgetDocument={schemaVersion:1,nodes:[],figures:{},issues:[],sheets:[{id:'s',name:'Sheet',title:'Sheet',object:'SO',headerRow:1,selected:true,role:'items',sourcePreview:{rowCount:2,columnCount:1,rows:[{row:2,cells:[{value:97531,formula:'PRICE()'}]}]}}],importRepairs:[{nodeId:'n',parentId:'s',kind:'section',scope:'subtree'}]};
  await budgetApi.save({projectId:'p',sourceId:'source',title:'Draft',document,allocations:[]});
  const payload=vi.mocked(dbAdapter.rpc).mock.calls[0][1] as {document_input:BudgetDocument};
  expect(payload.document_input.sheets[0]).not.toHaveProperty('sourcePreview');
  expect(payload.document_input.importRepairs).toEqual(document.importRepairs);
  expect(document.sheets[0].sourcePreview?.rows[0].cells[0].value).toBe(97531);
});
