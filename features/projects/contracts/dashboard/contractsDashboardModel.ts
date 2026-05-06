import type {
  ContractInvoiceStatus,
  ContractWithDetails,
  InvestorInvoice,
  ProjectDetails,
} from '@/types';
import { computeRetention, sumProjectRetention } from '../utils/retention';

const todayIso = (): string => new Date().toISOString().slice(0, 10);

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

const deriveInvoiceStatus = (
  status: ContractInvoiceStatus,
  dueDate?: string,
): ContractInvoiceStatus => {
  if (status === 'issued' && dueDate && dueDate < todayIso()) {
    return 'overdue';
  }
  return status;
};

const sumInvestorInvoicesByStatus = (
  invoices: InvestorInvoice[],
  status: ContractInvoiceStatus,
): number =>
  invoices.reduce((sum, invoice) => {
    const effectiveStatus = deriveInvoiceStatus(invoice.status, invoice.dueDate);
    return effectiveStatus === status ? sum + (invoice.amount || 0) : sum;
  }, 0);

export const computeContractsDashboardStats = (
  contracts: ContractWithDetails[],
  projectDetails?: ProjectDetails,
) => {
  const active = contracts.filter((c) => c.status === 'active').length;
  const closed = contracts.filter((c) => c.status === 'closed').length;
  const values = contracts.filter((c) => c.currentTotal > 0).map((c) => c.currentTotal);
  const avg = values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
  const med = median(values);
  const amendmentDelta = contracts.reduce(
    (s, c) => s + ((c.currentTotal || 0) - (c.basePrice || 0)),
    0,
  );
  const amendmentCount = contracts.reduce((s, c) => s + (c.amendments?.length || 0), 0);
  const rated = contracts.filter((c) => c.vendorRating != null);
  const avgRating = rated.length
    ? rated.reduce((s, c) => s + (c.vendorRating || 0), 0) / rated.length
    : null;

  const allInvoices = contracts.flatMap((c) => c.invoices || []);
  const sumBy = (status: ContractInvoiceStatus) =>
    allInvoices
      .filter((i) => deriveInvoiceStatus(i.status, i.dueDate) === status)
      .reduce((s, i) => s + i.amount, 0);

  const invoiced = contracts.reduce((s, c) => s + (c.invoicedSum || 0), 0);
  const paid = sumBy('paid');
  const approved = sumBy('approved');
  const issued = sumBy('issued');
  const overdue = contracts.reduce((s, c) => s + (c.overdueSum || 0), 0);

  const { shortTotal, longTotal } = sumProjectRetention(contracts);

  const topVendors = [...contracts]
    .filter((c) => c.currentTotal > 0)
    .sort((a, b) => b.currentTotal - a.currentTotal)
    .slice(0, 6);
  const topVendorsTotal = topVendors.reduce((s, c) => s + c.currentTotal, 0);

  const topRetention = [...contracts]
    .map((c) => {
      const breakdown = computeRetention(c);
      return {
        contract: c,
        shortAmount: breakdown.shortAmount,
        longAmount: breakdown.longAmount,
        total: breakdown.totalAmount,
      };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const investorFinancials = projectDetails?.investorFinancials;
  const investorSod = investorFinancials?.sodPrice || 0;
  const investorAmendments = investorFinancials?.amendments || [];
  const investorBudget = investorSod + investorAmendments.reduce(
    (sum, amendment) => sum + (amendment.price || 0),
    0,
  );
  const investorInvoices = investorFinancials?.invoices || [];
  const investorInvoiced = investorInvoices.reduce(
    (sum, invoice) => sum + (invoice.amount || 0),
    0,
  );
  const investorPaid = sumInvestorInvoicesByStatus(investorInvoices, 'paid');
  const investorApproved = sumInvestorInvoicesByStatus(investorInvoices, 'approved');
  const investorIssued = sumInvestorInvoicesByStatus(investorInvoices, 'issued');
  const investorOverdue = sumInvestorInvoicesByStatus(investorInvoices, 'overdue');
  const contractedCosts = contracts.reduce((sum, contract) => sum + (contract.currentTotal || 0), 0);
  const expectedProfit = investorBudget - contractedCosts;
  const invoicingProfit = investorInvoiced - invoiced;
  const investorInvoiceProgress = investorBudget > 0 ? investorInvoiced / investorBudget : 0;
  const supplierInvoiceProgress = contractedCosts > 0 ? invoiced / contractedCosts : 0;

  return {
    count: contracts.length,
    active,
    closed,
    avg,
    med,
    amendmentDelta,
    amendmentCount,
    avgRating,
    invoiced,
    paid,
    approved,
    issued,
    overdue,
    shortTotal,
    longTotal,
    topVendors,
    topVendorsTotal,
    topRetention,
    investorBudget,
    investorInvoiced,
    investorPaid,
    investorApproved,
    investorIssued,
    investorOverdue,
    contractedCosts,
    expectedProfit,
    invoicingProfit,
    investorInvoiceProgress,
    supplierInvoiceProgress,
  };
};
