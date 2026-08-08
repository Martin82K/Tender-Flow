import { describe, expect, it } from 'vitest';
import {
  computeInvestorInvoiceBreakdown,
  computeInvestorTotals,
} from '@/features/projects/contracts/investor/investorBillingModel';
import type { InvestorFinancials, InvestorInvoice } from '@/types';

const invoice = (overrides: Partial<InvestorInvoice> = {}): InvestorInvoice => ({
  id: 'invoice-1',
  period: '2026-08',
  invoiceNumber: 'FV-001',
  issueDate: '2026-08-01',
  dueDate: '2026-08-31',
  amount: 100_000,
  currency: 'CZK',
  status: 'issued',
  retentionAPercent: 5,
  retentionBPercent: 3,
  ...overrides,
});

describe('investorBillingModel', () => {
  it('odečte obě pozastávky z vystavené částky a zatím ji neoznačí jako uhrazenou', () => {
    expect(computeInvestorInvoiceBreakdown(invoice())).toEqual({
      grossAmount: 100_000,
      retentionAAmount: 5_000,
      retentionBAmount: 3_000,
      payableAmount: 92_000,
      paidAmount: 0,
    });
  });

  it('dědí pozastávky z globálního nastavení stavby a po jeho změně je přepočítá', () => {
    const inheritedInvoice = invoice({
      retentionAPercent: undefined,
      retentionBPercent: undefined,
    });

    expect(
      computeInvestorInvoiceBreakdown(inheritedInvoice, {
        retentionAPercent: 5,
        retentionBPercent: 3,
      }),
    ).toMatchObject({
      retentionAAmount: 5_000,
      retentionBAmount: 3_000,
      payableAmount: 92_000,
    });

    expect(
      computeInvestorInvoiceBreakdown(inheritedInvoice, {
        retentionAPercent: 6,
        retentionBPercent: 2,
      }),
    ).toMatchObject({
      retentionAAmount: 6_000,
      retentionBAmount: 2_000,
      payableAmount: 92_000,
    });
  });

  it('ponechá explicitní procenta faktury jako individuální výjimku', () => {
    expect(
      computeInvestorInvoiceBreakdown(
        invoice({ retentionAPercent: 7, retentionBPercent: 1 }),
        { retentionAPercent: 5, retentionBPercent: 3 },
      ),
    ).toMatchObject({
      retentionAAmount: 7_000,
      retentionBAmount: 1_000,
      payableAmount: 92_000,
    });
  });

  it('u zaplacené faktury použije čistou částku jako úhradu, pokud nebyla zadána skutečná úhrada', () => {
    expect(
      computeInvestorInvoiceBreakdown(invoice({ status: 'paid' })),
    ).toMatchObject({ payableAmount: 92_000, paidAmount: 92_000 });
  });

  it('zaokrouhluje na haléře a nedovolí součet pozastávek nad vystavenou částku', () => {
    expect(
      computeInvestorInvoiceBreakdown(
        invoice({ amount: 100.01, retentionAPercent: 7, retentionBPercent: 3 }),
      ),
    ).toMatchObject({
      retentionAAmount: 7,
      retentionBAmount: 3,
      payableAmount: 90.01,
    });

    expect(() =>
      computeInvestorInvoiceBreakdown(
        invoice({ retentionAPercent: 70, retentionBPercent: 40 }),
      ),
    ).toThrow('Součet pozastávek');
  });

  it('sečte smlouvu, dodatky, fakturaci, pozastávky a úhrady', () => {
    const financials: InvestorFinancials = {
      sodPrice: 1_000_000,
      retentionAPercent: 5,
      retentionBPercent: 3,
      amendments: [{ id: 'a1', label: 'Dodatek č. 1', number: 'D-01', price: 100_000 }],
      invoices: [invoice(), invoice({ id: 'invoice-2', amount: 200_000, status: 'paid' })],
    };

    expect(computeInvestorTotals(financials)).toEqual({
      contractTotal: 1_100_000,
      amendmentsTotal: 100_000,
      invoiced: 300_000,
      retentionA: 15_000,
      retentionB: 9_000,
      payable: 276_000,
      paid: 184_000,
      remainingToInvoice: 800_000,
    });
  });
});
