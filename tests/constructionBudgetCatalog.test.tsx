import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BudgetCatalogDialog } from '@features/projects/budget/ui/BudgetCatalogDialog';
const api=vi.hoisted(()=>({catalog:vi.fn(),canManageCatalog:vi.fn(),saveCatalog:vi.fn()}));
vi.mock('@features/projects/budget/api/budgetApi',()=>({budgetApi:api}));
afterEach(cleanup);
beforeEach(()=>{vi.resetAllMocks();api.catalog.mockResolvedValue([]);api.canManageCatalog.mockResolvedValue(true);api.saveCatalog.mockResolvedValue(undefined);});
function open(){const client=new QueryClient({defaultOptions:{queries:{retry:false}}});render(<QueryClientProvider client={client}><BudgetCatalogDialog organizationId="org" userId="user" onClose={()=>{}}/></QueryClientProvider>);}
it('labels an empty catalog and prevents duplicate requests while saving',async()=>{
 let finish!:()=>void;api.saveCatalog.mockImplementation(()=>new Promise<void>(resolve=>{finish=resolve;}));open();
 await screen.findByText('Zatím žádné profese');
 fireEvent.change(screen.getByLabelText('Název profese'),{target:{value:'Priorita'}});
 const add=screen.getByRole('button',{name:'Přidat profesi'});fireEvent.click(add);fireEvent.click(add);
 expect(api.saveCatalog).toHaveBeenCalledTimes(1);expect(screen.getByRole('button',{name:'Ukládání…'})).toBeDisabled();
 finish();await waitFor(()=>expect(screen.getByLabelText('Název profese')).toHaveValue(''));
});
it('keeps save errors inside the dialog and preserves the entered name',async()=>{
 api.saveCatalog.mockRejectedValue(new Error('Přístup zamítnut.'));open();await screen.findByText('Zatím žádné profese');
 fireEvent.change(screen.getByLabelText('Název profese'),{target:{value:'Priorita'}});fireEvent.click(screen.getByRole('button',{name:'Přidat profesi'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('Přístup zamítnut.');expect(screen.getByLabelText('Název profese')).toHaveValue('Priorita');
});
it('shows a read only list for non administrators',async()=>{
 api.canManageCatalog.mockResolvedValue(false);api.catalog.mockResolvedValue([{id:'t',kind:'profession',organization_id:'org',name:'Priorita',archived:false,color:'#64748b'}]);open();
 await screen.findByText('Priorita');expect(screen.queryByRole('button',{name:'Archivovat Priorita'})).not.toBeInTheDocument();expect(screen.queryByLabelText('Název profese')).not.toBeInTheDocument();
});
it('archives an entry instead of deleting it',async()=>{
 const entry={id:'t',kind:'profession',organization_id:'org',name:'Priorita',archived:false,color:'#64748b'};api.catalog.mockResolvedValue([entry]);open();
 fireEvent.click(await screen.findByRole('button',{name:'Archivovat Priorita'}));await waitFor(()=>expect(api.saveCatalog).toHaveBeenCalledWith({...entry,archived:true}));
});

it('does not offer the retired tag catalog even when historical entries exist',async()=>{
 api.catalog.mockResolvedValue([{id:'old',kind:'tag',name:'Historical',archived:false}]);open();
 await screen.findByText('Zatím žádné profese');
 fireEvent.click(screen.getByRole('combobox',{name:'Číselník'}));
 expect(screen.queryByRole('option',{name:'Štítky'})).not.toBeInTheDocument();
 expect(screen.queryByText('Historical')).not.toBeInTheDocument();
});
