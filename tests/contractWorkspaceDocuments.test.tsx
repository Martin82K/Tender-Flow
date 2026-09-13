import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ContractWithDetails } from '@/types';
const mocks = vi.hoisted(() => ({ save: vi.fn(), confirm: vi.fn(), canWrite: vi.fn().mockResolvedValue(true), events: vi.fn().mockResolvedValue([]) }));
vi.mock('@features/projects/contracts/documents/api', () => ({ contractDocumentsApi: { ...mocks }, downloadDocumentBlob: vi.fn() }));
vi.mock('@features/projects/contracts/documents/export', () => ({ exportDocumentPdf: vi.fn().mockResolvedValue(new Uint8Array([37,80,68,70])), exportDocumentDocx: vi.fn() }));
import { ProtocolEditor } from '@features/projects/contracts/documents/ProtocolEditor';
import { HandoverSection } from '@features/projects/contracts/documents/HandoverSection';
import { createHandoverDraft } from '@features/projects/contracts/documents/model';
import { applyContractFilter } from '@features/projects/contracts/list/ContractFilters';
const contract = { id: 'c1', projectId: 'p1', vendorName: 'Novák', title: 'Most', signedAt: '2026-01-01', completionDate: '2026-06-01', warrantyMonths: 60, currency: 'CZK', basePrice: 100 } as ContractWithDetails;
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const wrapper = ({children}: {children: React.ReactNode}) => <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry:false}}})}>{children}</QueryClientProvider>;
describe('contract protocol controls', () => {
  it('saves typed defects together with handwriting space without confirming handover', async () => {
    mocks.save.mockImplementation(async (_c, _d, _v, snapshot) => ({id:'v1', version:1, snapshot}));
    const close = vi.fn();
    render(<ProtocolEditor contractId="c1" initialFields={createHandoverDraft(contract)} logo={null} onClose={close} onSaved={async () => {}} />);
    expect(screen.getByLabelText('Skutečné datum předání')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('Vady a nedodělky'), {target:{value:'Doplnit lištu'}});
    fireEvent.click(screen.getByRole('combobox', {name:'Místo pro ruční doplnění'}));
    fireEvent.click(screen.getByRole('option', {name:'10 prázdných řádků'}));
    fireEvent.click(screen.getByText('Uložit koncept'));
    await waitFor(() => expect(close).toHaveBeenCalled());
    expect(mocks.save.mock.calls[0][3].fields).toMatchObject({ defects:'Doplnit lištu', handwritingLines:10, actualDate:'', result:'' });
    expect(mocks.confirm).not.toHaveBeenCalled();
  });
  it('retains entered fields when saving is denied', async () => {
    mocks.save.mockRejectedValue(new Error('Chybí oprávnění'));
    render(<ProtocolEditor contractId="c1" initialFields={createHandoverDraft(contract)} logo={null} onClose={vi.fn()} onSaved={async () => {}} />);
    fireEvent.change(screen.getByLabelText('Vady a nedodělky'), {target:{value:'Zachovat text'}});
    fireEvent.click(screen.getByText('Uložit koncept'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Chybí oprávnění');
    expect(screen.getByLabelText('Vady a nedodělky')).toHaveValue('Zachovat text');
  });
  it('does not derive confirmed warranty from legacy completion/signature dates', async () => {
    render(<HandoverSection contract={contract} onRefresh={vi.fn()} />, {wrapper});
    expect(await screen.findByText('Předání zatím nepotvrzeno')).toBeInTheDocument();
    expect(screen.getByText(/Začátek záruky zatím není potvrzený/)).toBeInTheDocument();
    expect(applyContractFilter(contract, 'warranty')).toBe(false);
    expect(mocks.confirm).not.toHaveBeenCalled();
  });
  it('requires a separate explicit action and source to confirm warranty', async () => {
    mocks.confirm.mockResolvedValue(undefined);
    render(<HandoverSection contract={contract} onRefresh={vi.fn()} />, {wrapper});
    await waitFor(() => expect(screen.getByText('Potvrdit začátek záruky')).toBeEnabled());
    fireEvent.click(screen.getByText('Potvrdit začátek záruky'));
    fireEvent.change(screen.getByLabelText('Začátek záruky'), {target:{value:'2026-09-01'}});
    fireEvent.change(screen.getByLabelText('Zdroj potvrzení'), {target:{value:'Podepsaný protokol PP-1'}});
    fireEvent.click(screen.getByText('Potvrdit a uložit'));
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledWith('c1','warranty','2026-09-01','','Podepsaný protokol PP-1'));
  });
});
