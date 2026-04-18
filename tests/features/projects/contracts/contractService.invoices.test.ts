import { beforeEach, describe, expect, it, vi } from 'vitest';

const insertSingleMock = vi.fn();
const updateEqMock = vi.fn();
const deleteEqMock = vi.fn();
const selectEqOrderMock = vi.fn();

vi.mock('@/services/supabase', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: vi.fn((table: string) => {
      if (table !== 'contract_invoices') {
        throw new Error('unexpected table: ' + table);
      }
      return {
        select: () => ({
          eq: () => ({
            order: selectEqOrderMock,
          }),
        }),
        insert: () => ({
          select: () => ({ single: insertSingleMock }),
        }),
        update: (payload: Record<string, unknown>) => ({
          eq: (_col: string, id: string) => updateEqMock(payload, id),
        }),
        delete: () => ({ eq: (_col: string, id: string) => deleteEqMock(id) }),
      };
    }),
    storage: { from: vi.fn() },
  },
}));

vi.mock('@/services/functionsClient', () => ({
  invokeAuthedFunction: vi.fn(),
}));

const { contractService } = await import('@/services/contractService');

describe('contractService — invoices CRUD', () => {
  beforeEach(() => {
    insertSingleMock.mockReset();
    updateEqMock.mockReset();
    deleteEqMock.mockReset();
    selectEqOrderMock.mockReset();
  });

  it('createInvoice posílá správný payload a mapuje výsledek', async () => {
    insertSingleMock.mockResolvedValue({
      data: {
        id: 'i1',
        contract_id: 'c1',
        invoice_number: 'FA26-001',
        issue_date: '2026-04-10',
        due_date: '2026-05-10',
        amount: '1500',
        currency: 'CZK',
        status: 'issued',
        paid_at: null,
        document_url: null,
        note: null,
        created_by: 'u1',
        created_at: '2026-04-10T00:00:00Z',
        updated_at: '2026-04-10T00:00:00Z',
      },
      error: null,
    });

    const result = await contractService.createInvoice({
      contractId: 'c1',
      invoiceNumber: 'FA26-001',
      issueDate: '2026-04-10',
      dueDate: '2026-05-10',
      amount: 1500,
      currency: 'CZK',
      status: 'issued',
    });

    expect(result.id).toBe('i1');
    expect(result.amount).toBe(1500);
    expect(result.status).toBe('issued');
  });

  it('markInvoicePaid označí fakturu jako zaplacenou s paid_at', async () => {
    updateEqMock.mockResolvedValue({ error: null });
    await contractService.markInvoicePaid('i1', '2026-04-15');
    expect(updateEqMock).toHaveBeenCalledWith(
      { status: 'paid', paid_at: '2026-04-15' },
      'i1',
    );
  });

  it('deleteInvoice propaguje chybu, pokud ji Supabase vrátí', async () => {
    deleteEqMock.mockResolvedValue({ error: new Error('boom') });
    await expect(contractService.deleteInvoice('i1')).rejects.toThrow('boom');
  });

  it('getInvoicesByContract mapuje pole výsledků', async () => {
    selectEqOrderMock.mockResolvedValue({
      data: [
        {
          id: 'i1',
          contract_id: 'c1',
          invoice_number: 'A',
          issue_date: '2026-01-01',
          due_date: '2026-02-01',
          amount: '200.5',
          currency: 'CZK',
          status: 'paid',
          paid_at: '2026-01-30',
        },
      ],
      error: null,
    });
    const result = await contractService.getInvoicesByContract('c1');
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBeCloseTo(200.5);
    expect(result[0].status).toBe('paid');
  });
});
