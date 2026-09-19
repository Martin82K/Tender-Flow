import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BudgetImportDialog } from '@features/projects/budget/ui/BudgetImportDialog';
import { importInWorker } from '@features/projects/budget/api/importWorker';
import { budgetApi } from '@features/projects/budget/api/budgetApi';
import type { BudgetDocument, BudgetRevision, BudgetSource } from '@features/projects/budget/model/types';

vi.mock('@features/projects/budget/api/budgetApi', () => ({ budgetApi: { save: vi.fn(), sourceStatus: vi.fn(), download: vi.fn() } }));
vi.mock('@features/projects/budget/api/importWorker', () => ({ importInWorker: vi.fn() }));
const source: BudgetSource = { id: 'src', project_id: 'p', filename: 'rozpocet.xlsx', storage_path: 's', sha256: 'a', status: 'ready', created_at: '2026-09-19' };
const document: BudgetDocument = {
  schemaVersion: 1, figures: {},
  sheets: [{ id: 's', name: 'Soupis', role: 'items', title: 'Práce', object: 'SO 1', headerRow: 1, selected: true }],
  nodes: [{ id: 'vv', parentId: null, sheetId: 's', kind: 'VV', order: 0, code: '', description: 'F1*2', unit: 'm', quantity: '10', unitPrice: null, total: null, source: { sheet: 'Soupis', row: 7, cells: {} }, sourceType: 'VV', tags: [], tenders: [] }],
  issues: [{ sheet: 'Figury', row: 2, severity: 'warning', kind: 'ambiguous-figures', message: 'Konflikt.', figures: [{ code: 'F1', values: ['2', '3'], sources: [{ sheet: 'Figury', row: 2, cell: 'B2', value: '2' }, { sheet: 'Figury', row: 3, cell: 'B3', value: '3' }] }] }],
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(budgetApi.download).mockResolvedValue(new Blob(['xlsx']));
  vi.mocked(budgetApi.sourceStatus).mockResolvedValue(undefined);
  vi.mocked(importInWorker).mockResolvedValue(document);
  vi.mocked(budgetApi.save).mockImplementation(async args => ({ id: 'revision', document: args.document } as BudgetRevision));
});
afterEach(cleanup);
async function open() {
  render(<BudgetImportDialog projectId="p" source={source} onClose={vi.fn()} onComplete={vi.fn()}/>);
  fireEvent.click(await screen.findByText('F1', { exact: true }));
}

it('shows source locations and usage, saves the chosen value and preserves stored quantities', async () => {
  await open();
  expect(screen.getByText('Figury, řádek 2 · B2')).toBeVisible();
  fireEvent.click(screen.getByText(/Použití ve výkazu výměr/));
  expect(screen.getByText(/Soupis, řádek 7/)).toBeVisible();
  fireEvent.click(screen.getByRole('radio', { name: 'Použít 3 pro F1' }));
  expect(screen.getByText('Vyřešeno 1 z 1')).toBeVisible();
  expect(screen.queryByText('Co zkontrolovat')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Vytvořit rozpočet' }));
  await waitFor(() => expect(budgetApi.save).toHaveBeenCalledOnce());
  const saved = vi.mocked(budgetApi.save).mock.calls[0][0].document;
  expect(saved.figures.F1).toBe('3');
  expect(saved.figureResolutions?.F1).toEqual({ value: '3', origin: 'source' });
  expect(saved.nodes).toEqual(document.nodes);
  expect(saved.issues[0].figures?.[0].sources).toEqual(document.issues[0].figures?.[0].sources);
});

it('validates a custom decimal, supports zero and lets the user undo the decision', async () => {
  await open();
  const input = screen.getByRole('textbox', { name: 'Vlastní hodnota pro F1' });
  fireEvent.change(input, { target: { value: 'alert(1)' } });
  fireEvent.click(screen.getByRole('button', { name: 'Použít vlastní hodnotu pro F1' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Neplatné desetinné číslo.');
  expect(screen.getByText('Vyřešeno 0 z 1')).toBeVisible();
  fireEvent.change(input, { target: { value: '-0,125' } });
  fireEvent.click(screen.getByRole('button', { name: 'Použít vlastní hodnotu pro F1' }));
  expect(screen.getByText('Vyřešeno · -0,125')).toBeVisible();
  fireEvent.change(input, { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: 'Použít vlastní hodnotu pro F1' }));
  expect(screen.getByText('Vyřešeno · 0')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Zrušit volbu pro F1' }));
  expect(screen.getByText('Vyřešeno 0 z 1')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Vytvořit rozpočet' }));
  await waitFor(() => expect(budgetApi.save).toHaveBeenCalledOnce());
  expect(Object.hasOwn(vi.mocked(budgetApi.save).mock.calls[0][0].document.figures, 'F1')).toBe(false);
});

it('resets decisions after recognition and disables conflict controls while saving', async () => {
  await open();
  fireEvent.click(screen.getByRole('radio', { name: 'Použít 2 pro F1' }));
  fireEvent.click(screen.getByText('Pokročilé mapování sloupců'));
  fireEvent.click(screen.getByRole('button', { name: 'Znovu rozpoznat s tímto mapováním' }));
  await waitFor(() => expect(importInWorker).toHaveBeenCalledTimes(2));
  await screen.findByText('Vyřešeno 0 z 1');
  fireEvent.click(screen.getByText('F1', { exact: true }));
  vi.mocked(budgetApi.save).mockReturnValue(new Promise(() => {}));
  fireEvent.click(screen.getByRole('button', { name: 'Vytvořit rozpočet' }));
  expect(screen.getByRole('radio', { name: 'Použít 2 pro F1' })).toBeDisabled();
  expect(screen.getByRole('textbox', { name: 'Vlastní hodnota pro F1' })).toBeDisabled();
});
