import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { OfferComparisonPanel } from '../../features/projects/offers/ui/OfferComparisonPanel';
vi.mock('../../features/projects/offers/api/offerAssist', () => ({ suggestOfferMatches: vi.fn(), extractPdfOffer: vi.fn(), reviewSuggestion: vi.fn() }));
vi.mock('@features/projects/budget/api/budgetApi', () => ({ budgetApi: { index: vi.fn(), revision: vi.fn() } }));
const api = vi.hoisted(() => ({ index: vi.fn(), load: vi.fn(), save: vi.fn() }));
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
 api.load.mockResolvedValue({ id: 'v', version: 1, title: 'Test', document: { schemaVersion: 1, sources: [{ id: 'base', name: 'Poptávka', items: [item], notes: [] }, { id: 'offer', name: 'Nabídka', items: [{ ...item, id: 'b' }], notes: [] }], assignments: { offer: [{ baseId: 'a', offerId: 'b', status: 'matched' }] } } });
 render(<OfferComparisonPanel projectId="p" categoryId="c" categoryTitle="Malby" resolveFolder={async () => null} onClose={() => {}} />);
 await waitFor(() => expect(screen.getByRole('combobox', { name: 'Uložené porovnání' })).toBeEnabled());
 fireEvent.click(screen.getByRole('combobox', { name: 'Uložené porovnání' }));
 fireEvent.click(await screen.findByRole('option', { name: 'Test' }));
 expect(await screen.findByText('0.00')).toBeInTheDocument();
 expect(screen.getByText('Malba').closest('tr')).toHaveClass('even:bg-slate-100');
});
