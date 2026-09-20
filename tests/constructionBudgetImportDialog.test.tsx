import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { parseKrosWorkbook } from '@features/projects/budget/model/krosImport';
import { BudgetImportDialog } from '@features/projects/budget/ui/BudgetImportDialog';
import { importInWorker } from '@features/projects/budget/api/importWorker';
import { budgetApi } from '@features/projects/budget/api/budgetApi';
import type { BudgetRevision, BudgetSource } from '@features/projects/budget/model/types';

vi.mock('@features/projects/budget/api/budgetApi', () => ({ budgetApi: { save: vi.fn().mockResolvedValue({ id: 'revision' }), registerSource: vi.fn(), sourceStatus: vi.fn().mockResolvedValue(undefined), download: vi.fn().mockResolvedValue(new Blob(['xlsx'])) } }));
vi.mock('@features/projects/budget/api/importWorker', () => ({ importInWorker: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function editorDocument() {
  const book=XLSX.utils.book_new();
  for(const name of ['Soupis','Elektro']) XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([
    ['Typ','Kód','Popis','MJ','Množství','J.cena','Celkem'],
    ['D','HSV','HSV'],['D','6','Úpravy'],['D','61','Stěny'],['K','001','Omítka','m2',2,50,100],
  ]),name);
  return parseKrosWorkbook(book);
}
const editorSource:BudgetSource={id:'s',project_id:'p',filename:'rozpocet.xlsx',storage_path:'s',sha256:'a',status:'ready',created_at:'2026-09-20'};
function editorRevision():BudgetRevision {return {id:'r',project_id:'p',organization_id:'o',source_id:'s',title:'Pracovní',status:'draft',version:3,created_at:'2026-09-20',document:editorDocument(),allocations:[]};}

describe('import repair workspace',()=>{
  it('opens source cells with column letters and aligned mapping controls',async()=>{
    vi.mocked(importInWorker).mockResolvedValue(editorDocument());
    render(<BudgetImportDialog projectId="p" source={editorSource} onClose={vi.fn()} onComplete={vi.fn()}/>);
    fireEvent.click(await screen.findByRole('button',{name:'Otevřít editor oprav'}));
    expect(screen.getByRole('region',{name:'Původní buňky'})).toHaveTextContent('Omítka');
    const code=screen.getByLabelText('Kód');
    expect(code.closest('label')).toHaveClass('tf-budget-mapping-row');
    expect(code).toHaveTextContent('B · Kód');
    expect(screen.getByLabelText('Úroveň hierarchie')).toBeVisible();
  });
  it('resumes a draft, applies a scoped repair, supports undo and saves the same revision',async()=>{
    const original=editorRevision();const complete=vi.fn();
    render(<BudgetImportDialog projectId="p" source={editorSource} editRevision={original} onClose={vi.fn()} onComplete={complete}/>);
    expect(importInWorker).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'2 · Struktura'}));
    fireEvent.click(screen.getByRole('button',{name:'Upravit řádek 4'}));
    fireEvent.change(screen.getByLabelText('Nadřazený uzel'),{target:{value:'sheet:0:row:3'}});
    fireEvent.click(screen.getByRole('button',{name:'Použít opravu'}));
    expect(screen.getByRole('button',{name:'Vrátit poslední opravu'})).toBeEnabled();
    fireEvent.click(screen.getByRole('button',{name:'Vrátit poslední opravu'}));
    expect(screen.getByLabelText('Nadřazený uzel')).toHaveValue('sheet:0:row:2');
    fireEvent.change(screen.getByLabelText('Nadřazený uzel'),{target:{value:'sheet:0:row:3'}});
    fireEvent.click(screen.getByRole('button',{name:'Použít opravu'}));
    fireEvent.click(screen.getByRole('button',{name:'Uložit a zavřít'}));
    await waitFor(()=>expect(complete).toHaveBeenCalledOnce());
    const saved=vi.mocked(budgetApi.save).mock.calls[0][0];
    expect(saved.revision).toBe(original);
    expect(saved.document.nodes.find(n=>n.id==='sheet:0:row:4')?.parentId).toBe('sheet:0:row:3');
    expect(saved.document.importRepairs).toHaveLength(1);
    expect(original.document.nodes.find(n=>n.id==='sheet:0:row:4')?.parentId).toBe('sheet:0:row:2');
  });
  it('preserves repair undo and selection when remapping fails',async()=>{
    vi.mocked(budgetApi.download).mockRejectedValueOnce(new Error('Stažení selhalo'));
    render(<BudgetImportDialog projectId="p" source={editorSource} editRevision={editorRevision()} onClose={vi.fn()} onComplete={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button',{name:'2 · Struktura'}));
    fireEvent.click(screen.getByRole('button',{name:'Upravit řádek 4'}));
    fireEvent.change(screen.getByLabelText('Nadřazený uzel'),{target:{value:'sheet:0:row:3'}});
    fireEvent.click(screen.getByRole('button',{name:'Použít opravu'}));
    fireEvent.click(screen.getByRole('button',{name:'1 · Sloupce'}));
    fireEvent.click(screen.getByRole('checkbox',{name:'Znovu rozpoznat tento list a nahradit jeho ruční úpravy'}));
    fireEvent.click(screen.getByRole('button',{name:'Použít mapování'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('Stažení selhalo');
    expect(screen.getByRole('checkbox',{name:'Znovu rozpoznat tento list a nahradit jeho ruční úpravy'})).toBeChecked();
    fireEvent.click(screen.getByRole('button',{name:'2 · Struktura'}));
    expect(screen.getByLabelText('Nadřazený uzel')).toHaveValue('sheet:0:row:3');
    fireEvent.click(screen.getByRole('button',{name:'Vrátit poslední opravu'}));
    expect(screen.getByLabelText('Nadřazený uzel')).toHaveValue('sheet:0:row:2');
  });
  it('remaps only one sheet and preserves a repair in another sheet',async()=>{
    const original=editorRevision();
    original.document.nodes.find(n=>n.id==='sheet:1:row:4')!.parentId='sheet:1:row:3';
    original.document.importRepairs=[{nodeId:'sheet:1:row:4',parentId:'sheet:1:row:3',kind:'section',scope:'subtree'}];
    vi.mocked(importInWorker).mockResolvedValue(editorDocument());
    render(<BudgetImportDialog projectId="p" source={editorSource} editRevision={original} onClose={vi.fn()} onComplete={vi.fn()}/>);
    fireEvent.click(screen.getByRole('checkbox',{name:'Znovu rozpoznat tento list a nahradit jeho ruční úpravy'}));
    fireEvent.click(screen.getByRole('button',{name:'Použít mapování'}));
    await waitFor(()=>expect(importInWorker).toHaveBeenCalledOnce());
    await waitFor(()=>expect(screen.getByRole('button',{name:'Uložit a zavřít'})).toBeEnabled());
    fireEvent.click(screen.getByRole('button',{name:'Uložit a zavřít'}));
    await waitFor(()=>expect(budgetApi.save).toHaveBeenCalledOnce());
    expect(vi.mocked(budgetApi.save).mock.calls[0][0].document.nodes.find(n=>n.id==='sheet:1:row:4')?.parentId).toBe('sheet:1:row:3');
    expect(vi.mocked(budgetApi.save).mock.calls[0][0].document.importRepairs).toHaveLength(1);
    expect(budgetApi.sourceStatus).not.toHaveBeenCalled();
  });
  it('requires an explicit choice before replacing manual repairs on the mapped sheet',()=>{
    const original=editorRevision();original.document.importRepairs=[{nodeId:'sheet:0:row:4',parentId:'sheet:0:row:3',kind:'section',scope:'subtree'}];
    render(<BudgetImportDialog projectId="p" source={editorSource} editRevision={original} onClose={vi.fn()} onComplete={vi.fn()}/>);
    expect(screen.getByRole('button',{name:'Použít mapování'})).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox',{name:'Znovu rozpoznat tento list a nahradit jeho ruční úpravy'}));
    expect(screen.getByRole('button',{name:'Použít mapování'})).toBeEnabled();
  });
  it('does not inherit row repairs when importing a new revision',async()=>{
    const previous=editorRevision();previous.document.importRepairs=[{nodeId:'sheet:0:row:4',parentId:'sheet:0:row:3',kind:'section',scope:'subtree'}];
    previous.document.nodes.find(n=>n.id==='sheet:0:row:4')!.parentId='sheet:0:row:3';
    vi.mocked(importInWorker).mockResolvedValue(editorDocument());
    render(<BudgetImportDialog projectId="p" source={{...editorSource,id:'new-source'}} previous={previous} onClose={vi.fn()} onComplete={vi.fn()}/>);
    fireEvent.click(await screen.findByRole('button',{name:'Vytvořit novou verzi'}));
    await waitFor(()=>expect(budgetApi.save).toHaveBeenCalledOnce());
    const saved=vi.mocked(budgetApi.save).mock.calls[0][0];
    expect(saved.document.importRepairs).toBeUndefined();
    expect(saved.document.nodes.find(n=>n.id==='sheet:0:row:4')?.parentId).toBe('sheet:0:row:2');
    expect(saved.sourceId).toBe('new-source');
  });
  it('loads protected previews without replacing saved hierarchy or edited prices',async()=>{
    const original=editorRevision();original.document.sheets.forEach(s=>delete s.sourcePreview);
    original.document.nodes.find(n=>n.id==='sheet:0:row:4')!.parentId='sheet:0:row:3';
    original.document.nodes.find(n=>n.id==='sheet:0:row:5')!.unitPrice='80';
    vi.mocked(importInWorker).mockResolvedValue(editorDocument());
    render(<BudgetImportDialog projectId="p" source={editorSource} editRevision={original} onClose={vi.fn()} onComplete={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button',{name:'Načíst náhled originálu'}));
    await waitFor(()=>expect(screen.queryByRole('button',{name:'Načíst náhled originálu'})).not.toBeInTheDocument());
    expect(budgetApi.download).toHaveBeenCalledWith(editorSource);
    fireEvent.click(screen.getByRole('button',{name:'Uložit a zavřít'}));
    await waitFor(()=>expect(budgetApi.save).toHaveBeenCalledOnce());
    const saved=vi.mocked(budgetApi.save).mock.calls[0][0].document;
    expect(saved.nodes.find(n=>n.id==='sheet:0:row:4')?.parentId).toBe('sheet:0:row:3');
    expect(saved.nodes.find(n=>n.id==='sheet:0:row:5')?.unitPrice).toBe('80');
  });
  it('refuses remapping an allocated sheet before downloading or altering it',async()=>{
    const original=editorRevision();original.allocations=[{itemId:'sheet:0:row:5',categoryId:'c',quantity:'1'}];
    render(<BudgetImportDialog projectId="p" source={editorSource} editRevision={original} onClose={vi.fn()} onComplete={vi.fn()}/>);
    fireEvent.click(screen.getByRole('checkbox',{name:'Znovu rozpoznat tento list a nahradit jeho ruční úpravy'}));
    fireEvent.click(screen.getByRole('button',{name:'Použít mapování'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('Tento list má přiřazené štítky nebo množství');
    expect(budgetApi.download).not.toHaveBeenCalled();
    expect(importInWorker).not.toHaveBeenCalled();
    expect(budgetApi.sourceStatus).not.toHaveBeenCalled();
  });
  it('does not apply unfinished mapping changes from another sheet',async()=>{
    vi.mocked(importInWorker).mockResolvedValue(editorDocument());
    render(<BudgetImportDialog projectId="p" source={editorSource} onClose={vi.fn()} onComplete={vi.fn()}/>);
    fireEvent.click(await screen.findByRole('button',{name:'Otevřít editor oprav'}));
    fireEvent.change(screen.getByLabelText('List v editoru'),{target:{value:'sheet:1'}});
    fireEvent.change(screen.getByLabelText('Řádek hlavičky v editoru'),{target:{value:'999'}});
    fireEvent.change(screen.getByLabelText('List v editoru'),{target:{value:'sheet:0'}});
    fireEvent.click(screen.getByRole('button',{name:'Použít mapování'}));
    await waitFor(()=>expect(importInWorker).toHaveBeenCalledTimes(2));
    expect(vi.mocked(importInWorker).mock.calls[1][3]?.Elektro.headerRow).toBe(1);
  });
  it.each([
    {origin:'source' as const,value:'2',values:['2','3'],keep:true},
    {origin:'custom' as const,value:'7',values:['2','3'],keep:true},
    {origin:'source' as const,value:'2',values:['2','4'],keep:false},
  ])('revalidates $origin figure decisions after a scoped remap ($keep)',async({origin,value,values,keep})=>{
    const original=editorRevision();
    const conflict={sheet:'Figury',row:2,severity:'warning' as const,kind:'ambiguous-figures' as const,message:'Konflikt',figures:[{code:'F1',values:['2','3']}]};
    original.document.issues.push(conflict);original.document.figures.F1=value;original.document.figureResolutions={F1:{origin,value}};
    const parsed=editorDocument();parsed.issues.push({...conflict,figures:[{code:'F1',values}]});
    vi.mocked(importInWorker).mockResolvedValue(parsed);
    render(<BudgetImportDialog projectId="p" source={editorSource} editRevision={original} onClose={vi.fn()} onComplete={vi.fn()}/>);
    fireEvent.click(screen.getByRole('checkbox',{name:'Znovu rozpoznat tento list a nahradit jeho ruční úpravy'}));
    fireEvent.click(screen.getByRole('button',{name:'Použít mapování'}));
    await waitFor(()=>expect(importInWorker).toHaveBeenCalledOnce());
    await waitFor(()=>expect(screen.getByRole('button',{name:'Uložit a zavřít'})).toBeEnabled());
    fireEvent.click(screen.getByRole('button',{name:'Uložit a zavřít'}));
    await waitFor(()=>expect(budgetApi.save).toHaveBeenCalledOnce());
    const saved=vi.mocked(budgetApi.save).mock.calls[0][0].document;
    expect(saved.figures.F1).toBe(keep?value:undefined);
    expect(saved.figureResolutions?.F1).toEqual(keep?{origin,value}:undefined);
  });
  it('recomputes transfer suggestions after a manual change of parent context',async()=>{
    const previous=editorRevision();
    previous.document.nodes.find(n=>n.id==='sheet:0:row:5')!.tags=['tag'];
    previous.allocations=[{itemId:'sheet:0:row:5',categoryId:'c',quantity:'1'}];
    vi.mocked(importInWorker).mockResolvedValue(editorDocument());
    render(<BudgetImportDialog canAllocate projectId="p" source={editorSource} previous={previous} onClose={vi.fn()} onComplete={vi.fn()}/>);
    fireEvent.click(await screen.findByRole('button',{name:'Otevřít editor oprav'}));
    fireEvent.click(screen.getByRole('button',{name:'2 · Struktura'}));
    fireEvent.click(screen.getByRole('button',{name:'Upravit řádek 4'}));
    fireEvent.change(screen.getByLabelText('Nadřazený uzel'),{target:{value:'sheet:0:row:3'}});
    fireEvent.click(screen.getByRole('button',{name:'Použít opravu'}));
    fireEvent.click(screen.getByRole('button',{name:'Zpět na listy'}));
    fireEvent.click(screen.getByText('Přenos štítků a alokací z předchozí verze'));
    fireEvent.click(screen.getByRole('checkbox',{name:'Přenést ověřené vazby'}));
    fireEvent.click(screen.getByRole('button',{name:'Vytvořit novou verzi'}));
    await waitFor(()=>expect(budgetApi.save).toHaveBeenCalledOnce());
    const saved=vi.mocked(budgetApi.save).mock.calls[0][0];
    expect(saved.allocations).toEqual([]);
    expect(saved.document.nodes.find(n=>n.id==='sheet:0:row:5')?.tags).toEqual([]);
  });
  it.each(['tags','allocations'])('protects a saved sheet with %s from being excluded',async(kind)=>{
    const original=editorRevision();
    if(kind==='tags')original.document.nodes.find(n=>n.id==='sheet:0:row:5')!.tags=['tag'];
    else original.allocations=[{itemId:'sheet:0:row:5',categoryId:'c',quantity:'1'}];
    render(<BudgetImportDialog projectId="p" source={editorSource} editRevision={original} onClose={vi.fn()} onComplete={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button',{name:'Zpět na listy'}));
    expect(screen.getByRole('checkbox',{name:'Zařadit Soupis'})).toBeDisabled();
    expect(screen.getByRole('button',{name:'Žádný'})).toBeDisabled();
    expect(screen.getByRole('checkbox',{name:'Zařadit Elektro'})).toBeEnabled();
    fireEvent.click(screen.getByRole('button',{name:'Uložit a zavřít'}));
    await waitFor(()=>expect(budgetApi.save).toHaveBeenCalledOnce());
    const saved=vi.mocked(budgetApi.save).mock.calls[0][0];
    expect(saved.document.nodes.find(n=>n.id==='sheet:0:row:5')?.tags).toEqual(kind==='tags'?['tag']:[]);
    expect(saved.allocations).toEqual(original.allocations);
  });
  it('blocks converting an allocated item to a note in the repair preview',()=>{
    const original=editorRevision();original.allocations=[{itemId:'sheet:0:row:5',categoryId:'c',quantity:'1'}];
    render(<BudgetImportDialog projectId="p" source={editorSource} editRevision={original} onClose={vi.fn()} onComplete={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button',{name:'2 · Struktura'}));
    fireEvent.click(screen.getByRole('button',{name:'Upravit řádek 5'}));
    fireEvent.change(screen.getByLabelText('Nový typ řádku'),{target:{value:'note'}});
    expect(screen.getByRole('alert')).toHaveTextContent('vazby');
    expect(screen.getByRole('button',{name:'Použít opravu'})).toBeDisabled();
  });
});

describe('budget import dialog', () => {
  it('allows choosing Globus for unrecognized headings before repeating recognition', async () => {
    vi.mocked(importInWorker).mockResolvedValue({ schemaVersion: 1, figures: {}, nodes: [], issues: [], sheets: [
      { id: 's1', name: '000', role: 'unknown', object: 'Bez objektu', title: '000', headerRow: 0, selected: false },
    ] });
    render(<BudgetImportDialog projectId="p" source={{ id: 's', project_id: 'p', filename: 'custom.xlsx', storage_path: 's', sha256: 'a', status: 'ready', created_at: '2026-09-19T10:00:00Z' }} onClose={vi.fn()} onComplete={vi.fn()}/>);
    fireEvent.click(await screen.findByRole('button', { name: 'Zkontrolovat 000' }));
    fireEvent.change(screen.getByLabelText('Formát listu'), { target: { value: 'globus' } });
    fireEvent.change(screen.getByLabelText('Role listu'), { target: { value: 'items' } });
    fireEvent.change(screen.getByLabelText('Řádek hlavičky'), { target: { value: '5' } });
    expect(screen.getByLabelText('Formát listu')).toHaveValue('globus');
    fireEvent.click(screen.getByRole('button', { name: 'Znovu rozpoznat s tímto mapováním' }));
    await waitFor(() => expect(importInWorker).toHaveBeenCalledTimes(2));
    expect(vi.mocked(importInWorker).mock.calls[1][3]).toMatchObject({ '000': { format: 'globus', role: 'items', headerRow: 5 } });
    fireEvent.change(screen.getByLabelText('Formát listu'), { target: { value: 'auto' } });
    expect(screen.getByLabelText('Formát listu')).toHaveValue('auto');
  });
  it('shows the automatically detected Globus format with mapping collapsed and saves its items', async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ['O', 'Rozpočet:', '000', null, 'Příprava'],
      ['Typ', 'Poř. číslo', 'Kód položky', 'Varianta', 'Název položky', 'MJ', 'Množství', 'Cena'],
      [null, null, null, null, null, null, null, 'Jednotková', 'Celkem'],
      ['P', 1, '001', null, 'Zaměření', 'KPL', 2, 25, 50],
    ]), '000');
    vi.mocked(importInWorker).mockResolvedValue(parseKrosWorkbook(workbook));
    const onComplete = vi.fn();
    render(<BudgetImportDialog projectId="p" source={{ id: 's', project_id: 'p', filename: 'globus.xlsx', storage_path: 's', sha256: 'a', status: 'ready', created_at: '2026-09-19T10:00:00Z' }} onClose={vi.fn()} onComplete={onComplete}/>);
    expect(await screen.findByText('Rozpoznaný formát: Globus')).toBeVisible();
    expect(screen.getByText('Pokročilé mapování sloupců').closest('details')).not.toHaveAttribute('open');
    expect(screen.getByRole('checkbox', { name: 'Zařadit 000' })).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Vytvořit rozpočet' }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
    expect(budgetApi.save).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'p', sourceId: 's', document: expect.objectContaining({
        nodes: expect.arrayContaining([expect.objectContaining({ code: '001', sourceType: 'P', total: '50.00' })]),
      }),
    }));
  });
  it('accepts a dropped XLSX without starting an upload', () => {
    render(<BudgetImportDialog projectId="p" onClose={vi.fn()} onComplete={vi.fn()}/>);
    const zone = screen.getByLabelText('Soubor XLSX').parentElement!;
    fireEvent.dragEnter(zone, { dataTransfer: { types: ['Files'] } });
    expect(screen.getByText('Pusťte soubor sem')).toBeVisible();
    fireEvent.drop(zone, { dataTransfer: { files: [new File(['test'], 'pretazeny.xlsx')] } });
    expect(screen.getByText('pretazeny.xlsx')).toBeVisible();
    expect(screen.queryByText('Pusťte soubor sem')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nahrát a pokračovat' })).toBeEnabled();
    expect(budgetApi.registerSource).not.toHaveBeenCalled();
  });

  it('rejects multiple, unsupported and oversized dropped files and preserves the current selection', () => {
    render(<BudgetImportDialog projectId="p" onClose={vi.fn()} onComplete={vi.fn()}/>);
    const zone = screen.getByLabelText('Soubor XLSX').parentElement!;
    const valid = new File(['test'], 'platny.xlsx');
    fireEvent.drop(zone, { dataTransfer: { files: [valid] } });
    fireEvent.drop(zone, { dataTransfer: { files: [valid, valid] } });
    expect(screen.getByRole('alert')).toHaveTextContent('jeden soubor');
    fireEvent.drop(zone, { dataTransfer: { files: [new File(['test'], 'soubor.csv')] } });
    expect(screen.getByRole('alert')).toHaveTextContent('XLSX');
    const large = new File(['test'], 'velky.xlsx');
    Object.defineProperty(large, 'size', { value: 30 * 1024 * 1024 + 1 });
    fireEvent.drop(zone, { dataTransfer: { files: [large] } });
    expect(screen.getByRole('alert')).toHaveTextContent('30 MB');
    expect(screen.getByText('platny.xlsx')).toBeVisible();
    expect(budgetApi.registerSource).not.toHaveBeenCalled();
  });
  it('immediately converts the stored source and explains nonblocking figure warnings', async () => {
    vi.mocked(importInWorker).mockResolvedValue({ schemaVersion:1, figures:{}, nodes:[], sheets:[{id:'s',name:'Soupis',role:'items',object:'SO 1',title:'Práce',headerRow:1,selected:true}], issues:[{sheet:'Figury',row:9,severity:'warning',kind:'ambiguous-figures',message:'Uložená množství a ceny položek jsou zachované.',figures:[{code:'F1',values:['2','3']}]}] });
    render(<BudgetImportDialog projectId="p" source={{id:'s',project_id:'p',filename:'ulozeny.xlsx',storage_path:'s',sha256:'a',status:'ready',created_at:'2026-09-19T10:00:00Z'}} onClose={vi.fn()} onComplete={vi.fn()}/>);
    await waitFor(()=>expect(screen.getByRole('button',{name:'Vytvořit rozpočet'})).toBeEnabled());
    expect(budgetApi.download).toHaveBeenCalledOnce();
    expect(budgetApi.registerSource).not.toHaveBeenCalled();
    expect(screen.queryByRole('button',{name:'Nahrát a pokračovat'})).not.toBeInTheDocument();
    expect(screen.getByText('Import lze dokončit')).toBeVisible();
    fireEvent.click(screen.getByText('Co zkontrolovat'));
    expect(screen.getByText('Import ani potvrzení to neblokuje.')).toBeVisible();
    fireEvent.click(screen.getByRole('button',{name:'Žádný'}));
    expect(screen.getByRole('button',{name:'Vytvořit rozpočet'})).toBeDisabled();
  });

  it('keeps sheet selection and mapping in named regions with shared validation', async () => {
    vi.mocked(importInWorker).mockResolvedValue({
      schemaVersion: 1, figures: {}, nodes: [],
      sheets: [
        { id: 's1', name: 'Zemní práce', role: 'items', object: 'SO 1', title: 'Zemní práce', headerRow: 1, selected: true },
        { id: 's2', name: 'Elektro', role: 'items', object: 'SO 2', title: 'Elektro', headerRow: 1, selected: true },
      ],
      issues: [{ sheet: 'Elektro', row: 3, severity: 'error', message: 'Chybí množství.' }],
    });
    render(<BudgetImportDialog projectId="p" source={{ id: 's', project_id: 'p', filename: 'rozpocet.xlsx', storage_path: 's', sha256: 'a', status: 'ready', created_at: '2026-09-19T10:00:00Z' }} onClose={vi.fn()} onComplete={vi.fn()}/>);
    const selection = within(await screen.findByRole('region', { name: 'Výběr soupisů' }));
    const review = within(screen.getByRole('complementary', { name: 'Mapování a kontrola importu' }));
    expect(selection.getByText('rozpocet.xlsx')).toBeVisible();
    expect(selection.getByLabelText('Název rozpočtu')).toHaveValue('Výchozí rozpočet');
    fireEvent.click(review.getByText(/Co zkontrolovat/));
    fireEvent.click(review.getByRole('button', { name: 'Zkontrolovat mapování listu' }));
    expect(review.getByText('Pokročilé mapování sloupců').closest('details')).toHaveAttribute('open');
    expect(review.getByLabelText('Název soupisu')).toHaveValue('Elektro');
    fireEvent.click(selection.getByRole('checkbox', { name: 'Zařadit Elektro' }));
    expect(review.getByText('Import lze dokončit')).toBeVisible();
    expect(review.getByText(/Vybráno 1 z 2 soupisů/)).toBeVisible();
    fireEvent.click(selection.getByRole('button', { name: 'Žádný' }));
    expect(screen.getByRole('button', { name: 'Vytvořit rozpočet' })).toBeDisabled();
    fireEvent.click(selection.getByRole('button', { name: 'Vše' }));
    expect(screen.getByRole('button', { name: 'Vytvořit rozpočet' })).toBeEnabled();
    expect(review.getByText('Lze uložit pracovní rozpočet, potvrzení je blokované')).toBeVisible();
  });

  it('shows the selected filename and enables continuing without uploading automatically', () => {
    render(<BudgetImportDialog projectId="p" onClose={vi.fn()} onComplete={vi.fn()}/>);
    expect(screen.getByRole('button', { name: 'Nahrát a pokračovat' })).toBeDisabled();
    const file = new File(['test'], 'rozpocet.xlsx');
    fireEvent.change(screen.getByLabelText('Soubor XLSX'), { target: { files: [file] } });
    expect(screen.getByText('rozpocet.xlsx')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Nahrát a pokračovat' })).toBeEnabled();
    expect(budgetApi.registerSource).not.toHaveBeenCalled();
  });

  it('keeps attachment mode distinct and uploads only after explicit confirmation', async () => {
    const onComplete = vi.fn();
    vi.mocked(budgetApi.registerSource).mockResolvedValue({ id: 'source' } as Awaited<ReturnType<typeof budgetApi.registerSource>>);
    render(<BudgetImportDialog projectId="p" onClose={vi.fn()} onComplete={onComplete}/>);
    const file = new File(['test'], 'priloha.xlsx');
    fireEvent.change(screen.getByLabelText('Soubor XLSX'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('radio', { name: /Pouze příloha/ }));
    expect(screen.getByRole('radio', { name: /Rozpočet do položek/ })).not.toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Uložit přílohu' }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce());
    expect(budgetApi.registerSource).toHaveBeenCalledWith('p', file);
  });
});
it('blocks allocation transfer without the allocate permission', async () => {
 const document={schemaVersion:1,figures:{},nodes:[],issues:[],sheets:[]} as import('@features/projects/budget/model/types').BudgetDocument;
 vi.mocked(importInWorker).mockResolvedValue(document);
 const previous={id:'old',title:'Old',document,allocations:[{itemId:'a',categoryId:'c',quantity:'1'}]} as import('@features/projects/budget/model/types').BudgetRevision;
 render(<BudgetImportDialog projectId="p" previous={previous} source={{id:'s',project_id:'p',filename:'x.xlsx',storage_path:'s',sha256:'a',status:'ready',created_at:''}} onClose={vi.fn()} onComplete={vi.fn()}/>);
 fireEvent.click(await screen.findByText('Přenos štítků a alokací z předchozí verze'));
 const transfer=await screen.findByRole('checkbox',{name:'Přenést ověřené vazby'});
 expect(transfer).toBeDisabled();
 expect(screen.getByText(/Přenos alokací vyžaduje oprávnění/)).toBeInTheDocument();
});

it('keeps assignment-only source out of processing while the user reviews or closes it',async()=>{
  vi.mocked(budgetApi.registerSource).mockResolvedValue({...editorSource,status:'attachment'});
  vi.mocked(importInWorker).mockResolvedValue(editorDocument());
  const close=vi.fn();
  render(<BudgetImportDialog canAllocate canImportTenders projectId="p" previous={editorRevision()} onClose={close} onComplete={vi.fn()}/>);
  fireEvent.click(screen.getByRole('radio',{name:/Pouze převzít přiřazení/}));
  fireEvent.change(screen.getByLabelText('Soubor XLSX'),{target:{files:[new File(['xlsx'],'assignments.xlsx')]}});
  fireEvent.click(screen.getByRole('button',{name:'Nahrát a pokračovat'}));
  await screen.findByRole('button',{name:'Pokračovat k přiřazení VŘ'});
  expect(screen.queryByRole('checkbox',{name:'Přenést ověřené vazby'})).not.toBeInTheDocument();
  expect(budgetApi.sourceStatus).not.toHaveBeenCalledWith(expect.anything(),'processing');
  fireEvent.keyDown(screen.getByRole('dialog'),{key:'Escape'});
  expect(close).toHaveBeenCalled();
});

it('returns a parsed new-revision source to attachment while awaiting confirmation',async()=>{
  vi.mocked(budgetApi.registerSource).mockResolvedValue({...editorSource,status:'attachment'});
  vi.mocked(importInWorker).mockResolvedValue(editorDocument());
  render(<BudgetImportDialog projectId="p" onClose={vi.fn()} onComplete={vi.fn()}/>);
  fireEvent.change(screen.getByLabelText('Soubor XLSX'),{target:{files:[new File(['xlsx'],'revision.xlsx')]}});
  fireEvent.click(screen.getByRole('button',{name:'Nahrát a pokračovat'}));
  await screen.findByRole('button',{name:'Vytvořit rozpočet'});
  expect(vi.mocked(budgetApi.sourceStatus).mock.calls.map(call=>call[1])).toEqual(['processing','attachment']);
});

it('retains the assignment target when the parent revision query temporarily disappears',async()=>{
  vi.mocked(budgetApi.registerSource).mockResolvedValue({...editorSource,status:'attachment'});
  vi.mocked(importInWorker).mockResolvedValue(editorDocument());
  const props={canAllocate:true,canImportTenders:true,projectId:'p',onClose:vi.fn(),onComplete:vi.fn()};
  const {rerender}=render(<BudgetImportDialog {...props} previous={editorRevision()}/>);
  fireEvent.click(screen.getByRole('radio',{name:/Pouze převzít přiřazení/}));
  rerender(<BudgetImportDialog {...props} previous={undefined}/>);
  expect(screen.getByRole('radio',{name:/Pouze převzít přiřazení/})).toBeChecked();
});
it('uses Excel letters in advanced mapping including columns after Z',async()=>{
 const document=editorDocument();document.sheets[0].sourcePreview!.columnCount=28;
 vi.mocked(importInWorker).mockResolvedValue(document);
 render(<BudgetImportDialog projectId="p" source={editorSource} onClose={vi.fn()} onComplete={vi.fn()}/>);
 fireEvent.click(await screen.findByText('Pokročilé mapování sloupců'));
 fireEvent.change(screen.getByLabelText('Mapování listu'),{target:{value:'Soupis'}});
 const code=screen.getByLabelText('Kód · sloupec Excelu');
 expect(code).toHaveTextContent('B');
 fireEvent.change(code,{target:{value:'26'}});
 expect(code).toHaveValue('26');
 expect(code).toHaveTextContent('AA');
 expect(screen.queryByLabelText(/číslo sloupce/)).not.toBeInTheDocument();
});
it('edits cells and assigns tenders in the editor without opening another dialog, then persists both', async () => {
  vi.spyOn(HTMLElement.prototype,'offsetWidth','get').mockReturnValue(1600);
  vi.spyOn(HTMLElement.prototype,'offsetHeight','get').mockReturnValue(400);
  try {
    render(<BudgetImportDialog canAllocate categories={[{id:'c',title:'Omítky'}]} projectId="p" source={editorSource} editRevision={editorRevision()} onClose={vi.fn()} onComplete={vi.fn()}/>);
    fireEvent.click(screen.getByRole('button',{name:'Položky a VŘ'}));
    const row=screen.getByRole('button',{name:'Omítka',exact:true}).closest('[role="row"]') as HTMLElement;
    fireEvent.doubleClick(within(row).getByRole('button',{name:'Omítka',exact:true}));
    fireEvent.change(screen.getByLabelText('Upravit Popis'),{target:{value:'Nová omítka'}});
    fireEvent.keyDown(screen.getByLabelText('Upravit Popis'),{key:'Enter'});
    await waitFor(()=>expect(screen.getByRole('button',{name:'Nová omítka'})).toBeVisible());
    fireEvent.click(screen.getByRole('button',{name:'VŘ: 001'}));
    fireEvent.change(screen.getByLabelText('Cílové VŘ'),{target:{value:'c'}});
    fireEvent.click(screen.getByRole('button',{name:'Přiřadit VŘ'}));
    await waitFor(()=>expect(screen.getByText('Omítky · 2 m2')).toBeVisible());
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    fireEvent.doubleClick(within(row).getByText('2',{exact:true}));
    fireEvent.change(screen.getByLabelText('Upravit Množství'),{target:{value:'3'}});
    fireEvent.keyDown(screen.getByLabelText('Upravit Množství'),{key:'Enter'});
    await waitFor(()=>expect(screen.getByText('Omítky · 3 m2')).toBeVisible());
    fireEvent.click(screen.getByRole('button',{name:'Uložit a zavřít'}));
    await waitFor(()=>expect(budgetApi.save).toHaveBeenCalledWith(expect.objectContaining({allocations:[{itemId:'sheet:0:row:5',categoryId:'c',quantity:'3'}],document:expect.objectContaining({nodes:expect.arrayContaining([expect.objectContaining({description:'Nová omítka'})])})})));
  } finally { vi.restoreAllMocks(); }
});
it('lets an explicit whole-item assignment replace transferred links in a new revision',async()=>{
 vi.spyOn(HTMLElement.prototype,'offsetWidth','get').mockReturnValue(1600);
 vi.spyOn(HTMLElement.prototype,'offsetHeight','get').mockReturnValue(400);
 try{
  const previous=editorRevision();previous.allocations=[{itemId:'sheet:0:row:5',categoryId:'old',quantity:'2'}];
  vi.mocked(importInWorker).mockResolvedValue(editorDocument());
  render(<BudgetImportDialog canAllocate categories={[{id:'new',title:'Nové práce'}]} projectId="p" source={editorSource} previous={previous} onClose={vi.fn()} onComplete={vi.fn()}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Otevřít editor oprav'}));
  fireEvent.click(screen.getByRole('button',{name:'Položky a VŘ'}));
  fireEvent.click(screen.getByRole('button',{name:'VŘ: 001'}));
  fireEvent.change(screen.getByLabelText('Cílové VŘ'),{target:{value:'new'}});
  fireEvent.click(screen.getByRole('button',{name:'Přiřadit VŘ',exact:true}));
  await screen.findByText('Nové práce · 2 m2');
  fireEvent.click(screen.getByRole('button',{name:'Zpět na listy'}));
  fireEvent.click(screen.getByText('Přenos štítků a alokací z předchozí verze'));
  fireEvent.click(screen.getByRole('checkbox',{name:'Přenést ověřené vazby'}));
  fireEvent.click(screen.getByRole('button',{name:'Vytvořit novou verzi'}));
  await waitFor(()=>expect(budgetApi.save).toHaveBeenCalledWith(expect.objectContaining({allocations:[{itemId:'sheet:0:row:5',categoryId:'new',quantity:'2'}]})));
 }finally{vi.restoreAllMocks();}
});
it('hides draft assignment controls in assignment-only source repair',async()=>{
 vi.spyOn(HTMLElement.prototype,'offsetWidth','get').mockReturnValue(1600);
 vi.spyOn(HTMLElement.prototype,'offsetHeight','get').mockReturnValue(400);
 try{
  vi.mocked(budgetApi.registerSource).mockResolvedValue({...editorSource,status:'attachment'});
  vi.mocked(importInWorker).mockResolvedValue(editorDocument());
  render(<BudgetImportDialog canAllocate canImportTenders onCreateTender={vi.fn()} projectId="p" previous={editorRevision()} onClose={vi.fn()} onComplete={vi.fn()}/>);
  fireEvent.click(screen.getByRole('radio',{name:/Pouze převzít přiřazení/}));
  fireEvent.change(screen.getByLabelText('Soubor XLSX'),{target:{files:[new File(['xlsx'],'assignments.xlsx')]}});
  fireEvent.click(screen.getByRole('button',{name:'Nahrát a pokračovat'}));
  fireEvent.click(await screen.findByRole('button',{name:'Otevřít editor oprav'}));
  fireEvent.click(screen.getByRole('button',{name:'Položky a VŘ'}));
  fireEvent.click(screen.getByRole('button',{name:'VŘ: 001'}));
  expect(screen.queryByRole('combobox',{name:'Cílové VŘ'})).not.toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Nové VŘ'})).not.toBeInTheDocument();
 }finally{vi.restoreAllMocks();}
});
it('preserves explicitly edited tags when transferring a previous revision',async()=>{
 vi.spyOn(HTMLElement.prototype,'offsetWidth','get').mockReturnValue(1600);
 vi.spyOn(HTMLElement.prototype,'offsetHeight','get').mockReturnValue(400);
 try{
  vi.mocked(importInWorker).mockResolvedValue(editorDocument());
  render(<BudgetImportDialog tagOptions={[{id:'new',name:'Nový štítek'}]} projectId="p" source={editorSource} previous={editorRevision()} onClose={vi.fn()} onComplete={vi.fn()}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Otevřít editor oprav'}));fireEvent.click(screen.getByRole('button',{name:'Položky a VŘ'}));
  const row=screen.getByRole('button',{name:'Omítka',exact:true}).closest('[role="row"]') as HTMLElement;
  fireEvent.doubleClick(row.lastElementChild!);
  fireEvent.click(screen.getByRole('option',{name:'Nový štítek'}));fireEvent.click(screen.getByRole('button',{name:'Uložit změnu'}));
  await waitFor(()=>expect(screen.queryByLabelText('Upravit Štítky')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button',{name:'Zpět na listy'}));fireEvent.click(screen.getByText('Přenos štítků a alokací z předchozí verze'));
  fireEvent.click(screen.getByRole('checkbox',{name:'Přenést ověřené vazby'}));fireEvent.click(screen.getByRole('button',{name:'Vytvořit novou verzi'}));
  await waitFor(()=>expect(budgetApi.save).toHaveBeenCalledWith(expect.objectContaining({document:expect.objectContaining({nodes:expect.arrayContaining([expect.objectContaining({id:'sheet:0:row:5',tags:['new']})])})})));
 }finally{vi.restoreAllMocks();}
});

it('preserves explicit allocation removal when transferring links',async()=>{
 vi.spyOn(HTMLElement.prototype,'offsetWidth','get').mockReturnValue(1600);
 vi.spyOn(HTMLElement.prototype,'offsetHeight','get').mockReturnValue(400);
 try{
  const previous=editorRevision();previous.allocations=[{itemId:'sheet:0:row:5',categoryId:'old',quantity:'2'}];
  vi.mocked(importInWorker).mockResolvedValue(editorDocument());
  render(<BudgetImportDialog canAllocate categories={[{id:'new',title:'Nové práce'}]} projectId="p" source={editorSource} previous={previous} onClose={vi.fn()} onComplete={vi.fn()}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Otevřít editor oprav'}));
  fireEvent.click(screen.getByRole('button',{name:'Položky a VŘ'}));
  fireEvent.click(screen.getByRole('button',{name:'VŘ: 001'}));
  fireEvent.change(screen.getByLabelText('Cílové VŘ'),{target:{value:'new'}});
  fireEvent.click(screen.getByRole('button',{name:'Přiřadit VŘ',exact:true}));
  await screen.findByText('Nové práce · 2 m2');
  fireEvent.click(screen.getByRole('button',{name:'Odebrat Nové práce'}));
  await waitFor(()=>expect(screen.queryByText('Nové práce · 2 m2')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button',{name:'Zpět na listy'}));
  fireEvent.click(screen.getByText('Přenos štítků a alokací z předchozí verze'));
  fireEvent.click(screen.getByRole('checkbox',{name:'Přenést ověřené vazby'}));
  fireEvent.click(screen.getByRole('button',{name:'Vytvořit novou verzi'}));
  await waitFor(()=>expect(budgetApi.save).toHaveBeenCalledWith(expect.objectContaining({allocations:[]})));
 }finally{vi.restoreAllMocks();}
});
