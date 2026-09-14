import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { ContractWithDetails, ProjectDetails } from '@/types';
const api = vi.hoisted(() => ({ linkContractToBid: vi.fn(), unlinkContractFromBid: vi.fn() }));
vi.mock('@/features/projects/contracts/api/contractMutationsApi', () => ({ contractMutationsApi: api }));
import { ContractTenderLinks } from '@/features/projects/contracts/workspace/sections/ContractTenderLinks';
const contract = { id: 'c1', projectId: 'p1', sourceBidId: 'b1', linkedBidIds: ['b1', 'b2'] } as ContractWithDetails;
const project = { id: 'p1', categories: [{ id: 'a', title: 'Elektro' }, { id: 'b', title: 'ZTI' }, { id: 'c', title: 'Zemní práce' }], bids: {
  a: [{ id: 'b1', companyName: 'Dodavatel' }, { id: 'alternative', companyName: 'Jiný dodavatel' }], b: [{ id: 'b2', companyName: 'Dodavatel' }], c: [{ id: 'b3', companyName: 'Dodavatel' }],
} } as unknown as ProjectDetails;
beforeEach(() => { vi.resetAllMocks(); });
it('lists all linked tenders with their exact navigation', () => {
  const open = vi.fn();
  render(<ContractTenderLinks contract={contract} contracts={[contract]} project={project} onRefresh={vi.fn()} onOpenBid={open} />);
  fireEvent.click(screen.getByRole('button', { name: 'ZTI' }));
  expect(open).toHaveBeenCalledWith('b', 'b2');
  expect(screen.getByText('Výběrová řízení (2)')).toBeVisible();
});
it('unlinks only the selected tender after confirmation and refreshes', async () => {
  api.unlinkContractFromBid.mockResolvedValue(undefined);
  const refresh = vi.fn();
  render(<ContractTenderLinks contract={contract} contracts={[contract]} project={project} onRefresh={refresh} />);
  fireEvent.click(screen.getByRole('button', { name: 'Odpojit ZTI' }));
  expect(api.unlinkContractFromBid).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Potvrdit odpojení' }));
  await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
  expect(api.unlinkContractFromBid).toHaveBeenCalledWith('p1', 'c1', 'b2');
});
it('adds a free tender without offering other bidders from occupied tenders', async () => {
  api.linkContractToBid.mockResolvedValue(undefined);
  render(<ContractTenderLinks contract={contract} contracts={[contract]} project={project} onRefresh={vi.fn()} />);
  const select = screen.getByRole('combobox', { name: 'Přidat výběrové řízení' });
  fireEvent.click(select);
  expect(screen.queryByRole('option', { name: /Jiný dodavatel/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('option', { name: /Zemní práce/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Propojit VŘ' }));
  await waitFor(() => expect(api.linkContractToBid).toHaveBeenCalledWith('p1', 'c1', 'b3'));
});
it('keeps links visible and reports a failed unlink', async () => {
  api.unlinkContractFromBid.mockRejectedValue(new Error('Chybí oprávnění'));
  render(<ContractTenderLinks contract={contract} contracts={[contract]} project={project} onRefresh={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Odpojit ZTI' }));
  fireEvent.click(screen.getByRole('button', { name: 'Potvrdit odpojení' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Chybí oprávnění'));
  expect(screen.getByText('Výběrová řízení (2)')).toBeVisible();
});
