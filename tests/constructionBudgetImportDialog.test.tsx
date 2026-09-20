import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { parseKrosWorkbook } from '@features/projects/budget/model/krosImport';
import { BudgetImportDialog } from '@features/projects/budget/ui/BudgetImportDialog';
import { importInWorker } from '@features/projects/budget/api/importWorker';
import { budgetApi } from '@features/projects/budget/api/budgetApi';

vi.mock('@features/projects/budget/api/budgetApi', () => ({ budgetApi: { save: vi.fn().mockResolvedValue({ id: 'revision' }), registerSource: vi.fn(), sourceStatus: vi.fn().mockResolvedValue(undefined), download: vi.fn().mockResolvedValue(new Blob(['xlsx'])) } }));
vi.mock('@features/projects/budget/api/importWorker', () => ({ importInWorker: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

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
