import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BudgetTenderTemplates } from '@features/projects/budget/ui/BudgetTenderTemplates';
import { budgetApi } from '@features/projects/budget/api/budgetApi';
vi.mock('@features/projects/budget/api/budgetApi',()=>({budgetApi:{projectTenders:vi.fn(),importTenders:vi.fn()}}));
beforeEach(()=>{vi.clearAllMocks();vi.mocked(budgetApi.projectTenders).mockResolvedValue([{id:'existing',title:'Stávající',externalCode:'01'}]);vi.mocked(budgetApi.importTenders).mockResolvedValue({revision:null,createdCategoryIds:['new']});});
const setup=()=>render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><BudgetTenderTemplates projectId="p" onClose={vi.fn()}/></QueryClientProvider>);
async function upload(categories:unknown[]){
  const file=new File(['fixture'],'vzor.json',{type:'application/json'});
  Object.defineProperty(file,'text',{value:async()=>JSON.stringify({format:'tender-flow-tenders',version:1,categories})});
  const input=screen.getByLabelText('Použít uložený vzor');await waitFor(()=>expect(input).not.toBeDisabled());await act(async()=>{fireEvent.change(input,{target:{files:[file]}});});
}
it('copies editable definitions into the target project and skips existing names/codes',async()=>{
  setup();await upload([{title:'Stávající',externalCode:'01'},{title:'Nové',externalCode:'02',status:'closed',allocations:[{}]}]);
  await screen.findByText('Již existuje – vynecháno');
  fireEvent.change(screen.getAllByLabelText('Název VŘ')[1],{target:{value:'Upravené'}});
  await act(async()=>{fireEvent.click(screen.getByText('Vytvořit 1 VŘ v tomto projektu'));});
  await waitFor(()=>expect(budgetApi.importTenders).toHaveBeenCalledTimes(1));
  const [project,request]=vi.mocked(budgetApi.importTenders).mock.calls[0];expect(project).toBe('p');expect(request.mode).toBe('template');
  expect(request.newCategories).toEqual([{id:expect.any(String),title:'Upravené',externalCode:'02'}]);expect(request.assignments).toEqual([]);expect(request).not.toHaveProperty('document');
});
it('blocks duplicate definitions inside the template until explicitly excluded',async()=>{
  setup();await upload([{title:'Stejné',externalCode:'02'},{title:'Stejné',externalCode:'03'}]);
  await screen.findByRole('alert');expect(screen.getByText('Vytvořit 2 VŘ v tomto projektu')).toBeDisabled();
  fireEvent.click(screen.getAllByRole('checkbox')[1]);expect(screen.getByText('Vytvořit 1 VŘ v tomto projektu')).not.toBeDisabled();
});
it('lets the user exclude a selected definition after editing it to an existing name',async()=>{
  setup();await upload([{title:'Nové',externalCode:'02'},{title:'Jiné',externalCode:'03'}]);
  await screen.findByText('Vytvořit 2 VŘ v tomto projektu');
  fireEvent.change(screen.getAllByLabelText('Název VŘ')[0],{target:{value:'Stávající'}});
  expect(screen.getByText('Vytvořit 2 VŘ v tomto projektu')).toBeDisabled();
  fireEvent.click(screen.getAllByRole('checkbox')[0]);
  expect(screen.getByText('Vytvořit 1 VŘ v tomto projektu')).not.toBeDisabled();
});

it('shows a post-save DocHub warning without offering the same definitions again',async()=>{
  vi.mocked(budgetApi.importTenders).mockResolvedValue({revision:null,createdCategoryIds:['new'],docHubWarning:'Data uložena, dokončete složky v DocHubu.'});
  setup();await upload([{title:'Nové',externalCode:'02'}]);
  fireEvent.click(screen.getByText('Vytvořit 1 VŘ v tomto projektu'));
  expect(await screen.findByRole('status')).toHaveTextContent('dokončete složky v DocHubu');
  expect(screen.queryByText('Vytvořit 1 VŘ v tomto projektu')).not.toBeInTheDocument();
  expect(budgetApi.importTenders).toHaveBeenCalledTimes(1);
});
it('normalizes edited codes for conflicts and for the submitted definitions',async()=>{
  setup();await upload([{title:'Nové',externalCode:'02'}]);
  fireEvent.change(screen.getByLabelText('Číslo VŘ'),{target:{value:'01 '}});expect(screen.getByText('Vytvořit 1 VŘ v tomto projektu')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Číslo VŘ'),{target:{value:' 03 '}});fireEvent.click(screen.getByText('Vytvořit 1 VŘ v tomto projektu'));
  await waitFor(()=>expect(budgetApi.importTenders).toHaveBeenCalled());expect(vi.mocked(budgetApi.importTenders).mock.calls[0][1].newCategories[0].externalCode).toBe('03');
});
