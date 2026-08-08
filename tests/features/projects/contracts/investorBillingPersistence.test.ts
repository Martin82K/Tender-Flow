import { describe, expect, it } from 'vitest';
import { buildInvestorInvoiceRow } from '@/features/projects/contracts/investor/investorBillingPersistence';
import type { InvestorInvoice } from '@/types';

const makeInvoice = (overrides: Partial<InvestorInvoice> = {}): InvestorInvoice => ({
  id: 'invoice-1',
  invoiceNumber: ' FV-001 ',
  issueDate: '2026-08-01',
  dueDate: '2026-08-31',
  amount: 100_000,
  currency: 'CZK',
  status: 'issued',
  ...overrides,
});

describe('buildInvestorInvoiceRow', () => {
  it('ukládá děděná procenta jako NULL', () => {
    expect(buildInvestorInvoiceRow('project-1', makeInvoice())).toMatchObject({
      project_id: 'project-1',
      invoice_number: 'FV-001',
      retention_a_percent: null,
      retention_b_percent: null,
    });
  });

  it('zachová explicitní nulu jako individuální výjimku', () => {
    expect(
      buildInvestorInvoiceRow(
        'project-1',
        makeInvoice({ retentionAPercent: 0, retentionBPercent: 2 }),
      ),
    ).toMatchObject({
      retention_a_percent: 0,
      retention_b_percent: 2,
    });
  });
});
