import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { BudgetTenderImport } from '@features/projects/budget/ui/BudgetTenderImport';
import { parseKrosWorkbook } from '@features/projects/budget/model/krosImport';
import { budgetApi } from '@features/projects/budget/api/budgetApi';
import type { BudgetRevision } from '@features/projects/budget/model/types';
vi.mock('@features/projects/budget/api/budgetApi',()=>({budgetApi:{projectTenders:vi.fn(),importTenders:vi.fn()}}));
beforeEach(()=>{vi.clearAllMocks();vi.mocked(budgetApi.projectTenders).mockResolvedValue([{id:'tender',title:'Práce',externalCode:'02'}]);});
function setup(allocations:BudgetRevision['allocations']=[],duplicate=false,fallbackCount=0){
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['č. VŘ','Název VŘ','Typ','Kód','Popis','MJ','Množství','J.cena','Celkem'],['02','Práce','K','001','Položka','m2',999,500,499500]]),'SO');
  if(duplicate)XLSX.utils.sheet_add_aoa(wb.Sheets.SO,[['03','Jiné práce','K','001','Položka','m2',999,500,499500]],{origin:-1});
  const document=parseKrosWorkbook(wb);const before=structuredClone(document);before.nodes.find(n=>n.kind==='K')!.quantity='10';before.nodes.find(n=>n.kind==='K')!.unitPrice='20';
  if(fallbackCount){const original=before.nodes.find(n=>n.kind==='K')!;before.nodes=before.nodes.filter(n=>n.kind!=='K');for(let i=0;i<fallbackCount;i++)before.nodes.push({...original,id:`candidate-${i}`,description:`Jiná položka ${i}`});}
  const previous={id:'revision',project_id:'p',organization_id:'org',source_id:'original',title:'Původní',status:'draft',version:3,created_at:'',document:before,allocations} satisfies BudgetRevision;
  const onComplete=vi.fn();
  const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
  render(<QueryClientProvider client={client}><BudgetTenderImport projectId="p" sourceId="incoming" document={document} previous={previous} mode="assignments" title="Import" allocations={[]} onBack={vi.fn()} onComplete={onComplete} onBusyChange={vi.fn()}/></QueryClientProvider>);
  return {previous,onComplete,client};
}
it('confirms detected columns and sends only assignments, never imported prices or quantities',async()=>{
  const {previous,onComplete}=setup();vi.mocked(budgetApi.importTenders).mockResolvedValue({revision:previous,createdCategoryIds:[]});
  expect(screen.getByLabelText('SO: name')).toHaveValue('1');
  fireEvent.click(screen.getByText('Potvrdit sloupce a zkontrolovat shody'));
  await screen.findByLabelText('VŘ: Práce');
  expect(screen.getByText('Potvrdit import přiřazení')).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByText('Potvrdit import přiřazení'));
  await waitFor(()=>expect(onComplete).toHaveBeenCalledWith(previous));
  const request=vi.mocked(budgetApi.importTenders).mock.calls[0][1];
  expect(request).toMatchObject({mode:'assignments',revisionId:'revision',version:3,assignments:[{itemId:'sheet:0:row:2',categoryId:'tender',action:'remaining'}]});
  expect(request).not.toHaveProperty('document');expect(request).not.toHaveProperty('allocations');
});
it('blocks conflicting existing assignments until the user decides and reuses retry identity',async()=>{
  const {previous,onComplete}=setup([{itemId:'sheet:0:row:2',categoryId:'old',quantity:'3'}]);
  vi.mocked(budgetApi.importTenders).mockRejectedValueOnce(new Error('Síť')).mockResolvedValue({revision:previous,createdCategoryIds:[]});
  fireEvent.click(screen.getByText('Potvrdit sloupce a zkontrolovat shody'));await screen.findByLabelText('VŘ: Práce');
  fireEvent.click(screen.getByRole('checkbox'));expect(screen.getByText('Potvrdit import přiřazení')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Vazby sheet:0:row:2'),{target:{value:'remaining'}});fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByText('Potvrdit import přiřazení'));await screen.findByText(/Síť/);
  fireEvent.click(screen.getByText('Potvrdit import přiřazení'));await waitFor(()=>expect(onComplete).toHaveBeenCalled());
  expect(vi.mocked(budgetApi.importTenders).mock.calls[0][1].operationId).toBe(vi.mocked(budgetApi.importTenders).mock.calls[1][1].operationId);
});

it('excludes skipped groups when checking duplicate target selections',async()=>{
  setup([],true);
  fireEvent.click(screen.getByText('Potvrdit sloupce a zkontrolovat shody'));await screen.findByLabelText('VŘ: Práce');
  fireEvent.change(screen.getByLabelText('Položka sheet:0:row:2'),{target:{value:'sheet:0:row:2'}});
  fireEvent.change(screen.getByLabelText('Položka sheet:0:row:3'),{target:{value:'sheet:0:row:2'}});
  fireEvent.change(screen.getByLabelText('VŘ: Jiné práce'),{target:{value:'skip'}});
  fireEvent.click(screen.getByRole('checkbox'));
  expect(screen.getByText('Potvrdit import přiřazení')).not.toBeDisabled();
});

it('bounds manual code suggestions and keeps search available for further targets',async()=>{
  setup([],false,250);
  fireEvent.click(screen.getByText('Potvrdit sloupce a zkontrolovat shody'));await screen.findByLabelText('VŘ: Práce');
  const target=screen.getByLabelText('Položka sheet:0:row:2');
  fireEvent.click(target);expect(screen.getAllByRole('option').length).toBeLessThanOrEqual(102);fireEvent.click(target);
  fireEvent.change(screen.getByLabelText('Hledat další cílové položky (kód nebo popis)'),{target:{value:'Jiná položka 249'}});
  fireEvent.click(target);expect(screen.getByRole('option',{name:/Jiná položka 249/})).toBeInTheDocument();
});

it('requires a fresh confirmation when the project tender catalog changes',async()=>{
  const {client}=setup();
  fireEvent.click(screen.getByText('Potvrdit sloupce a zkontrolovat shody'));await screen.findByLabelText('VŘ: Práce');
  fireEvent.click(screen.getByRole('checkbox'));expect(screen.getByText('Potvrdit import přiřazení')).not.toBeDisabled();
  await act(async()=>{client.setQueryData(['budget-project-tenders','p'],[{id:'replacement',title:'Práce',externalCode:'02'}]);});
  await waitFor(()=>expect(screen.getByRole('checkbox')).not.toBeChecked());expect(screen.getByText('Potvrdit import přiřazení')).toBeDisabled();
});

it('pages large tender group lists and blocks creating over 1000 categories before a request',async()=>{
  vi.mocked(budgetApi.projectTenders).mockResolvedValue([]);
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([
    ['Typ','Kód','Popis','MJ','Množství','J.cena','Celkem','Název VŘ'],
    ...Array.from({length:1001},(_,i)=>['K',String(i),`Položka ${i}`,'m2',1,1,1,`Skupina ${i}`])]),'SO');
  const document=parseKrosWorkbook(wb);const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<QueryClientProvider client={client}><BudgetTenderImport projectId="p" sourceId="s" document={document} mode="revision" title="Nová" allocations={[]} onBack={vi.fn()} onComplete={vi.fn()} onBusyChange={vi.fn()}/></QueryClientProvider>);
  fireEvent.click(screen.getByText('Potvrdit sloupce a zkontrolovat shody'));await screen.findByLabelText('VŘ: Skupina 0');
  expect(screen.getAllByLabelText(/^VŘ: /)).toHaveLength(30);
  expect(screen.getByText(/Nejvýše 1 000 nových VŘ/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox'));expect(screen.getByText('Potvrdit import přiřazení')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Hledat skupinu VŘ'),{target:{value:'Skupina 1000'}});
  fireEvent.change(screen.getByLabelText('VŘ: Skupina 1000'),{target:{value:'skip'}});
  expect(screen.queryByText(/Nejvýše 1 000 nových VŘ/)).not.toBeInTheDocument();
  expect(budgetApi.importTenders).not.toHaveBeenCalled();
});
