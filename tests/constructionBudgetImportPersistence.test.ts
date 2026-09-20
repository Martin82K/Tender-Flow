import { beforeEach, expect, it, vi } from 'vitest';
import { dbAdapter } from '@infra/db/dbAdapter';
import { budgetApi } from '@features/projects/budget/api/budgetApi';
import { syncImportedTenderDocHub } from '@features/projects/budget/api/tenderDocHub';
import type { BudgetDocument } from '@features/projects/budget/model/types';
vi.mock('@infra/db/dbAdapter',()=>({dbAdapter:{rpc:vi.fn()}}));
vi.mock('@features/projects/budget/api/tenderDocHub',()=>({syncImportedTenderDocHub:vi.fn()}));
beforeEach(()=>{vi.clearAllMocks();vi.mocked(syncImportedTenderDocHub).mockResolvedValue();vi.mocked(dbAdapter.rpc).mockResolvedValue({data:{id:'saved'},error:null} as never);});
it('never persists raw sheet previews outside the server-redacted source cells',async()=>{
  const document:BudgetDocument={schemaVersion:1,nodes:[],figures:{},issues:[],sheets:[{id:'s',name:'Sheet',title:'Sheet',object:'SO',headerRow:1,selected:true,role:'items',sourcePreview:{rowCount:2,columnCount:1,rows:[{row:2,cells:[{value:97531,formula:'PRICE()'}]}]}}],importRepairs:[{nodeId:'n',parentId:'s',kind:'section',scope:'subtree'}]};
  await budgetApi.save({projectId:'p',sourceId:'source',title:'Draft',document,allocations:[]});
  const payload=vi.mocked(dbAdapter.rpc).mock.calls[0][1] as {document_input:BudgetDocument};
  expect(payload.document_input.sheets[0]).not.toHaveProperty('sourcePreview');
  expect(payload.document_input.importRepairs).toEqual(document.importRepairs);
  expect(document.sheets[0].sourcePreview?.rows[0].cells[0].value).toBe(97531);
});

it.each(['assignments','template'] as const)('synchronizes committed categories after %s import',async mode=>{
  vi.mocked(dbAdapter.rpc).mockResolvedValue({data:{revision:null,createdCategoryIds:['new']},error:null} as never);
  await budgetApi.importTenders('p',{mode,operationId:'op',expectedCatalog:[],newCategories:[],assignments:[]});
  expect(syncImportedTenderDocHub).toHaveBeenCalledWith('p',['new']);
});
it('returns the committed result with a warning if DocHub fails, without retrying the import',async()=>{
  vi.mocked(dbAdapter.rpc).mockResolvedValue({data:{revision:{id:'saved'},createdCategoryIds:['new']},error:null} as never);
  vi.mocked(syncImportedTenderDocHub).mockRejectedValue(new Error('Offline'));
  const result=await budgetApi.importTenders('p',{mode:'revision',operationId:'op',expectedCatalog:[],newCategories:[],assignments:[]});
  expect(result.revision?.id).toBe('saved');expect(result.docHubWarning).toMatch(/DocHub/);expect(dbAdapter.rpc).toHaveBeenCalledTimes(1);
});
it('never synchronizes folders when the database import fails',async()=>{
  vi.mocked(dbAdapter.rpc).mockResolvedValue({data:null,error:{message:'Denied'}} as never);
  await expect(budgetApi.importTenders('p',{mode:'template',operationId:'op',expectedCatalog:[],newCategories:[],assignments:[]})).rejects.toThrow('Denied');
  expect(syncImportedTenderDocHub).not.toHaveBeenCalled();
});
