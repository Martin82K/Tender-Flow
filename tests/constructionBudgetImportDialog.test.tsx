import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BudgetImportDialog } from '@features/projects/budget/ui/BudgetImportDialog';
import { importInWorker } from '@features/projects/budget/api/importWorker';
import { budgetApi } from '@features/projects/budget/api/budgetApi';

vi.mock('@features/projects/budget/api/budgetApi', () => ({ budgetApi: { registerSource: vi.fn(), sourceStatus: vi.fn().mockResolvedValue(undefined), download: vi.fn().mockResolvedValue(new Blob(['xlsx'])) } }));
vi.mock('@features/projects/budget/api/importWorker', () => ({ importInWorker: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('budget import dialog', () => {
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
