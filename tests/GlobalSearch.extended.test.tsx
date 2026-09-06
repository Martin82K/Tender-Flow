import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock('@shared/routing/router', () => ({ navigate: mocks.navigate }));
import { GlobalSearch } from '@shared/ui/GlobalSearch/GlobalSearch';
import { GlobalSearchProvider } from '@shared/ui/GlobalSearch/GlobalSearchContext';
import type { SearchInputSources } from '@shared/ui/GlobalSearch/types';
const sources: SearchInputSources = { projects: [{ id: 'p1', name: 'Stavba', status: 'tender', location: 'Praha' }], contacts: [], projectDetails: {}, tasksEnabled: true, contractsEnabled: true,
  contracts: [{ id: 'c1', projectId: 'p1', title: 'Smlouva na okna' }],
  tasks: Array.from({ length: 12 }, (_, i) => ({ id: `t${i}`, title: `Výkres ${i}` })),
};
const view = (data = sources) => <GlobalSearchProvider sources={data}><GlobalSearch variant="modal" isOpen onOpenChange={vi.fn()} /></GlobalSearchProvider>;
it('opens the selected contract detail directly', async () => {
  render(view());
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'okna' } });
  fireEvent.click(await screen.findByRole('option', { name: /Smlouva na okna/ }));
  expect(mocks.navigate).toHaveBeenCalledWith('/app/project/p1?tab=contracts&contractId=c1');
});
it('discloses additional results and makes every matching task selectable', async () => {
  render(view());
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'vykres' } });
  await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(5));
  fireEvent.click(screen.getByRole('button', { name: /Zobrazit další výsledky/ }));
  await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(10));
  fireEvent.click(screen.getByRole('button', { name: /Zobrazit další výsledky/ }));
  expect(screen.getAllByRole('option')).toHaveLength(12);
  expect(screen.queryByRole('button', { name: /Zobrazit další výsledky/ })).not.toBeInTheDocument();
});
it('keeps errors and pending extended indexes visible instead of claiming no matches', async () => {
  const retry = vi.fn();
  const { rerender } = render(view({ ...sources, isExtendedSearchLoading: true }));
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'missing' } });
  expect(screen.getByRole('status')).toHaveTextContent('Načítám podklady');
  expect(screen.queryByText(/Žádné výsledky/)).not.toBeInTheDocument();
  rerender(view({ ...sources, extendedSearchError: true, retryExtendedSearch: retry }));
  expect(screen.getByRole('alert')).toHaveTextContent('Výsledky mohou být neúplné');
  fireEvent.click(screen.getByRole('button', { name: 'Zkusit znovu' }));
  expect(retry).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/Žádné výsledky/)).not.toBeInTheDocument();
});

it('opens the exact task result using the shared deep-link contract', async () => {
  render(view());
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'vykres 11' } });
  fireEvent.click(await screen.findByRole('option', { name: /Výkres 11/ }));
  expect(mocks.navigate).toHaveBeenCalledWith('/app/todo?taskId=t11');
});
