import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BudgetPurgeDialog } from '@features/projects/budget/ui/BudgetPurgeDialog';
import { budgetApi } from '@features/projects/budget/api/budgetApi';
import { dbAdapter } from '@infra/db/dbAdapter';
const {remove}=vi.hoisted(()=>({remove:vi.fn()}));
vi.mock('@infra/db/dbAdapter',()=>({dbAdapter:{rpc:vi.fn(),storage:{from:vi.fn(()=>({remove}))}}}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
const revision={id:'r',title:'Test',version:2,status:'draft' as const,source_id:'s',created_at:'2026-09-19T10:00:00Z',deleted_at:'2026-09-19T11:00:00Z'};
describe('permanent budget deletion',()=>{
 it('requires typed confirmation and sends only the previewed versions',async()=>{
  const onPurge=vi.fn().mockResolvedValue(undefined);
  render(<BudgetPurgeDialog revisions={[revision]} sources={[]} allRevisions={[revision]} onClose={vi.fn()} onPurge={onPurge}/>);
  expect(screen.getByRole('button',{name:'Trvale smazat'})).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Potvrzení trvalého smazání'),{target:{value:'SMAZAT'}});
  fireEvent.click(screen.getByRole('button',{name:'Trvale smazat'}));
  await waitFor(()=>expect(onPurge).toHaveBeenCalledWith(expect.any(String),{revisions:[{id:'r',version:2}],sources:[]}));
 });
 it('does not finalize when Storage fails, allowing a durable retry',async()=>{
  vi.mocked(dbAdapter.rpc).mockResolvedValue({data:{id:'job',completed:false,paths:['org/source/source.xlsx'],revisionCount:1,sourceCount:1},error:null});
  remove.mockResolvedValue({error:{message:'offline'}});
  await expect(budgetApi.purge('p','job',{revisions:[],sources:[]})).rejects.toThrow('Dokončit mazání');
  expect(dbAdapter.rpc).toHaveBeenCalledTimes(1);
  expect(remove).toHaveBeenCalledWith(['org/source/source.xlsx']);
 });
 it('removes Storage objects before finalizing the database and treats a completed retry as done',async()=>{
  vi.mocked(dbAdapter.rpc).mockResolvedValueOnce({data:{completed:false,paths:['stored.xlsx']},error:null}).mockResolvedValueOnce({data:null,error:null});
  remove.mockResolvedValue({error:null});
  await budgetApi.purge('p','job',{revisions:[],sources:[]});
  expect(dbAdapter.rpc).toHaveBeenLastCalledWith('construction_budget_purge_finish',{project_input:'p',job_input:'job'});
  expect(remove.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(dbAdapter.rpc).mock.invocationCallOrder[1]);
  vi.clearAllMocks();vi.mocked(dbAdapter.rpc).mockResolvedValue({data:{completed:true,paths:[]},error:null});
  await budgetApi.purge('p','job',{revisions:[],sources:[]});
  expect(remove).not.toHaveBeenCalled();expect(dbAdapter.rpc).toHaveBeenCalledTimes(1);
 });
});
