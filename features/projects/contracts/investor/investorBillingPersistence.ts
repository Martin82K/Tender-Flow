import type { InvestorInvoice } from '@/types';

export const buildInvestorInvoiceRow = (
  projectId: string,
  invoice: InvestorInvoice,
) => ({
  id: invoice.id,
  project_id: projectId,
  period: invoice.period || invoice.issueDate.slice(0, 7),
  invoice_number: invoice.invoiceNumber.trim(),
  issue_date: invoice.issueDate,
  due_date: invoice.dueDate,
  amount: invoice.amount,
  currency: invoice.currency || 'CZK',
  status: invoice.status,
  retention_a_percent: invoice.retentionAPercent ?? null,
  retention_b_percent: invoice.retentionBPercent ?? null,
  retention_a_amount: invoice.retentionAAmount || 0,
  retention_b_amount: invoice.retentionBAmount || 0,
  paid_amount: invoice.paidAmount || 0,
  paid_at: invoice.status === 'paid' ? invoice.paidAt || null : null,
  note: invoice.note?.trim() || null,
});
