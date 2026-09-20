import * as XLSX from 'xlsx';
import { webcrypto } from 'node:crypto';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { OfferComparisonPanel } from '../../features/projects/offers/ui/OfferComparisonPanel';
vi.mock('../../features/projects/offers/api/offerAssist', () => ({ suggestOfferMatches: vi.fn(), extractPdfOffer: vi.fn(), reviewSuggestion: vi.fn() }));
vi.mock('@features/projects/budget/api/budgetApi', () => ({ budgetApi: { index: vi.fn(), revision: vi.fn() } }));
const api = vi.hoisted(() => ({ index: vi.fn(), load: vi.fn(), save: vi.fn(), remove: vi.fn() }));
vi.mock('../../features/projects/offers/api/comparisonApi', () => ({ comparisonApi: api }));
vi.mock('@infra/platform/platformAdapter', () => ({ isDesktop: false }));
vi.mock('@infra/files/fileSystemService', () => ({ pickFile: vi.fn(), readFile: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); api.index.mockResolvedValue({ canEdit: false, views: [] }); });
it('keeps mutations disabled for a read-only project member', async () => {
 render(<OfferComparisonPanel projectId="p" categoryId="c" categoryTitle="Malby" resolveFolder={async () => null} onClose={() => {}} />);
 await waitFor(() => expect(api.index).toHaveBeenCalledWith('p'));
 expect(screen.getByRole('button', { name: 'Vybrat poptávku' })).toBeDisabled();
 expect(screen.getByRole('button', { name: 'Uložit porovnání' })).toBeDisabled();
});
it('renders zero prices and unmatched rows with continuous row styling', async () => {
 const item = { id: 'a', code: '1', description: 'Malba', group: 'SO01', unit: 'm2', quantity: '1', total: '0', unitPrice: '0', source: { sheet: 'S', row: 2 } };
 api.index.mockResolvedValue({ canEdit: true, views: [{ id: 'v', category_id: 'c', title: 'Test' }] });
 api.load.mockResolvedValue({ id: 'v', version: 1, title: 'Test', document: { schemaVersion: 1, sources: [{ id: 'base', name: 'Poptávka', items: [item], notes: [] }, { id: 'offer', name: 'Nabídka', items: [{ ...item, id: 'b', note: 'Bez materiálu' }], notes: [] }], assignments: { offer: [{ baseId: 'a', offerId: 'b', status: 'matched' }] } } });
 render(<OfferComparisonPanel projectId="p" categoryId="c" categoryTitle="Malby" resolveFolder={async () => null} onClose={() => {}} />);
 await waitFor(() => expect(screen.getByRole('combobox', { name: 'Uložené porovnání' })).toBeEnabled());
 fireEvent.click(screen.getByRole('combobox', { name: 'Uložené porovnání' }));
 fireEvent.click(await screen.findByRole('option', { name: 'Test' }));
 expect(await screen.findByText('0.00')).toBeInTheDocument();
 expect(screen.getByText('Bez materiálu')).toBeInTheDocument();
 expect(screen.getByText('Malba').closest('tr')).toHaveClass('even:bg-slate-100');
});
it('allows completing an empty assignment list created through MCP', async () => {
 const item={id:'a',code:'1',description:'Malba',group:'',unit:'m2',quantity:'1',total:'0',unitPrice:'0',source:{sheet:'S',row:2}};
 const saved={id:'v',version:1,title:'Prázdné vazby',document:{schemaVersion:1,sources:[{id:'base',name:'Poptávka',items:[item],notes:[]},{id:'offer',name:'Nabídka',items:[{...item,id:'b'}],notes:[]}],assignments:{offer:[]}}};
 api.index.mockResolvedValue({canEdit:true,views:[{id:'v',category_id:'c',title:saved.title}]});api.load.mockResolvedValue(saved);api.save.mockResolvedValue({...saved,version:2});
 render(<OfferComparisonPanel projectId="p" categoryId="c" categoryTitle="Malby" resolveFolder={async()=>null} onClose={()=>{}}/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Vybrat poptávku'})).toBeEnabled());
 fireEvent.click(screen.getByRole('combobox',{name:'Uložené porovnání'}));fireEvent.click(await screen.findByRole('option',{name:'Prázdné vazby'}));
 await waitFor(()=>expect(screen.getByRole('combobox',{name:'Uložené porovnání'})).toHaveFocus());
 fireEvent.change(await screen.findByRole('textbox',{name:'Hledat položku: Nabídka 1'}),{target:{value:'Malba'}});
 fireEvent.click(screen.getByRole('combobox',{name:'Nabídka: 1 Malba'}));fireEvent.click(await screen.findByRole('option',{name:/1 · Malba/}));
 expect(await screen.findByText('0.00')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Uložit porovnání'}));
 await waitFor(()=>expect(api.save).toHaveBeenCalled());
 expect(api.save.mock.calls[0][3].assignments.offer).toEqual([{baseId:'a',offerId:'b',status:'manual'}]);
});

it('lets the user map an unrecognized sheet alongside a recognized sheet',async()=>{
 vi.stubGlobal('crypto',webcrypto);
 try{
 api.index.mockResolvedValue({canEdit:true,views:[]});
 const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['Kód','Popis','MJ','Množství'],['1','Malba','m2',2]]),'Položky');XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['A','B','C','D'],['2','Doprava','ks',1]]),'Doplňky');
 const bytes=XLSX.write(wb,{type:'array',bookType:'xlsx'});const file=new File([bytes],'multi.xlsx');Object.defineProperty(file,'arrayBuffer',{value:async()=>bytes});
 render(<OfferComparisonPanel projectId="p" categoryId="c" categoryTitle="Malby" resolveFolder={async()=>null} onClose={()=>{}}/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Vybrat poptávku'})).toBeEnabled());
 fireEvent.change(screen.getByLabelText('Vybrat existující XLSX nebo PDF'),{target:{files:[file]}});
 fireEvent.click(await screen.findByRole('button',{name:'Přidat list: Doplňky'}));
 for(const [label,value] of [['Kód','1'],['Popis','2'],['MJ','3'],['Množství','4']])fireEvent.change(screen.getByLabelText(`Doplňky ${label}`),{target:{value}});
 fireEvent.click(screen.getByRole('button',{name:'Potvrdit mapování'}));
 expect(await screen.findByText('Doprava')).toBeInTheDocument();expect(screen.getByText('Malba')).toBeInTheDocument();
 }finally{vi.unstubAllGlobals();}
});

it('deletes a project-level comparison only after explicit confirmation',async()=>{
 const item={id:'a',code:'1',description:'Malba',group:'',unit:'m2',quantity:'1',total:'0',unitPrice:'0',source:{sheet:'S',row:2}};
 const saved={id:'v',category_id:null,version:3,title:'Samostatný pohled',document:{schemaVersion:1,sources:[{id:'base',name:'Poptávka',items:[item],notes:[]},{id:'offer',name:'Nabídka',items:[{...item,id:'b'}],notes:[]}],assignments:{offer:[]}}};
 api.index.mockResolvedValue({canEdit:true,views:[{id:'v',category_id:null,title:saved.title}]});api.load.mockResolvedValue(saved);api.remove.mockResolvedValue(undefined);
 render(<OfferComparisonPanel projectId="p" categoryId="c" categoryTitle="Malby" resolveFolder={async()=>null} onClose={()=>{}}/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'Vybrat poptávku'})).toBeEnabled());
 fireEvent.click(screen.getByRole('combobox',{name:'Uložené porovnání'}));fireEvent.click(await screen.findByRole('option',{name:/Samostatný pohled/}));
 fireEvent.click(await screen.findByRole('button',{name:'Smazat pohled'}));expect(api.remove).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Potvrdit smazání pohledu'}));
 await waitFor(()=>expect(api.remove).toHaveBeenCalledWith('p','v',3));expect(await screen.findByRole('button',{name:'Vybrat poptávku'})).toBeEnabled();
});
