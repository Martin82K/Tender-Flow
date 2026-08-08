import type { InvestorFinancials, InvestorInvoice } from '@/types';

const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const safeAmount = (value: number | null | undefined): number =>
  Number.isFinite(value) && Number(value) > 0 ? Number(value) : 0;

const safePercent = (value: number | null | undefined): number =>
  Number.isFinite(value) ? Math.min(100, Math.max(0, Number(value))) : 0;

export interface InvestorInvoiceBreakdown {
  grossAmount: number;
  retentionAAmount: number;
  retentionBAmount: number;
  payableAmount: number;
  paidAmount: number;
}

type InvestorRetentionDefaults = Pick<
  InvestorFinancials,
  'retentionAPercent' | 'retentionBPercent'
>;

export const computeInvestorInvoiceBreakdown = (
  invoice: InvestorInvoice,
  defaults?: InvestorRetentionDefaults,
): InvestorInvoiceBreakdown => {
  const grossAmount = roundMoney(safeAmount(invoice.amount));
  const retentionAPercent = safePercent(
    invoice.retentionAPercent ?? defaults?.retentionAPercent,
  );
  const retentionBPercent = safePercent(
    invoice.retentionBPercent ?? defaults?.retentionBPercent,
  );
  if (retentionAPercent + retentionBPercent > 100) {
    throw new Error('Součet pozastávek nesmí překročit 100 %.');
  }

  const retentionAAmount = roundMoney(grossAmount * retentionAPercent / 100);
  const retentionBAmount = roundMoney(grossAmount * retentionBPercent / 100);
  const payableAmount = roundMoney(Math.max(0, grossAmount - retentionAAmount - retentionBAmount));
  const explicitPaid = safeAmount(invoice.paidAmount);
  const paidAmount = roundMoney(
    invoice.status === 'paid'
      ? Math.min(payableAmount, explicitPaid > 0 ? explicitPaid : payableAmount)
      : Math.min(payableAmount, explicitPaid),
  );

  return { grossAmount, retentionAAmount, retentionBAmount, payableAmount, paidAmount };
};

export const computeInvestorTotals = (financials: InvestorFinancials) => {
  const amendmentsTotal = financials.amendments.reduce(
    (sum, amendment) => sum + safeAmount(amendment.price),
    0,
  );
  const contractTotal = roundMoney(safeAmount(financials.sodPrice) + amendmentsTotal);
  let invoiced = 0;
  let retentionA = 0;
  let retentionB = 0;
  let payable = 0;
  let paid = 0;

  for (const invoice of financials.invoices || []) {
    const breakdown = computeInvestorInvoiceBreakdown(invoice, financials);
    invoiced += breakdown.grossAmount;
    retentionA += breakdown.retentionAAmount;
    retentionB += breakdown.retentionBAmount;
    payable += breakdown.payableAmount;
    paid += breakdown.paidAmount;
  }

  return {
    contractTotal,
    amendmentsTotal: roundMoney(amendmentsTotal),
    invoiced: roundMoney(invoiced),
    retentionA: roundMoney(retentionA),
    retentionB: roundMoney(retentionB),
    payable: roundMoney(payable),
    paid: roundMoney(paid),
    remainingToInvoice: roundMoney(Math.max(0, contractTotal - invoiced)),
  };
};
