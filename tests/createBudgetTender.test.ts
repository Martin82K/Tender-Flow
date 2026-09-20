import { afterEach, expect, it, vi } from 'vitest';
import { createBudgetTender } from '@features/projects/budget/api/createBudgetTender';
import { budgetApi } from '@features/projects/budget/api/budgetApi';
vi.mock('@features/projects/budget/api/budgetApi',()=>({budgetApi:{projectTenders:vi.fn(),saveProjectTenders:vi.fn()}}));
afterEach(()=>vi.resetAllMocks());
it('appends to the current project catalog with its concurrency snapshot and preserves folder warnings',async()=>{
 const existing=[{id:'old',title:'Původní',externalCode:'01'}];
 vi.mocked(budgetApi.projectTenders).mockResolvedValue(existing);
 vi.mocked(budgetApi.saveProjectTenders).mockResolvedValue('Dokončete složky.');
 const result=await createBudgetTender('project','  Nové   práce ');
 expect(result).toMatchObject({tender:{title:'Nové práce',externalCode:''},warning:'Dokončete složky.'});
 expect(budgetApi.saveProjectTenders).toHaveBeenCalledWith('project',existing,[existing[0],result.tender]);
});
it('reuses an existing normalized name on retry instead of creating a duplicate',async()=>{
 const tender={id:'existing',title:'Nové práce',externalCode:''};
 vi.mocked(budgetApi.projectTenders).mockResolvedValue([tender]);
 expect(await createBudgetTender('project',' NOVÉ   práce ')).toEqual({tender});
 expect(budgetApi.saveProjectTenders).not.toHaveBeenCalled();
});
it('propagates permission and concurrent catalog failures without overwriting the catalog',async()=>{
 vi.mocked(budgetApi.projectTenders).mockResolvedValue([]);
 vi.mocked(budgetApi.saveProjectTenders).mockRejectedValue(new Error('Catalog conflict'));
 await expect(createBudgetTender('project','Nové')).rejects.toThrow('Catalog conflict');
 expect(budgetApi.saveProjectTenders).toHaveBeenCalledTimes(1);
});
it.each(['',' '.repeat(4),'x'.repeat(256)])('rejects invalid names before any write',async title=>{
 await expect(createBudgetTender('project',title)).rejects.toThrow('255');
 expect(budgetApi.saveProjectTenders).not.toHaveBeenCalled();
});
