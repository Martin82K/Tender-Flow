import { describe, expect, it } from "vitest";

import type { ContractWithDetails, ProjectDetails } from "@/types";
import { computeContractsDashboardStats } from "@/features/projects/contracts/dashboard/contractsDashboardModel";

const contract = (overrides: Partial<ContractWithDetails> = {}): ContractWithDetails => ({
  id: "contract-1",
  projectId: "project-1",
  vendorName: "Dodavatel A",
  title: "Hrubá stavba",
  contractNumber: "SOD-001",
  status: "active",
  currency: "CZK",
  basePrice: 900_000,
  currentTotal: 1_000_000,
  approvedSum: 0,
  remaining: 1_000_000,
  source: "manual",
  amendments: [
    {
      id: "am-1",
      contractId: "contract-1",
      amendmentNo: 1,
      deltaPrice: 100_000,
    },
  ],
  drawdowns: [],
  invoices: [
    {
      id: "invoice-1",
      contractId: "contract-1",
      invoiceNumber: "FD-001",
      issueDate: "2026-01-15",
      dueDate: "2026-02-14",
      amount: 300_000,
      currency: "CZK",
      status: "paid",
    },
    {
      id: "invoice-2",
      contractId: "contract-1",
      invoiceNumber: "FD-002",
      issueDate: "2026-03-15",
      dueDate: "2026-04-14",
      amount: 200_000,
      currency: "CZK",
      status: "issued",
    },
  ],
  invoicedSum: 500_000,
  paidSum: 300_000,
  overdueSum: 0,
  ...overrides,
});

describe("contractsDashboardModel", () => {
  it("porovnává investorský rozpočet a fakturaci s dodavatelskými náklady", () => {
    const projectDetails = {
      id: "project-1",
      title: "Projekt A",
      location: "",
      finishDate: "",
      siteManager: "",
      categories: [],
      investorFinancials: {
        sodPrice: 1_300_000,
        amendments: [{ id: "ia-1", label: "Investor dodatek", price: 200_000 }],
        invoices: [
          {
            id: "ii-1",
            invoiceNumber: "FV-001",
            issueDate: "2026-01-20",
            dueDate: "2026-02-19",
            amount: 700_000,
            currency: "CZK",
            status: "paid",
          },
          {
            id: "ii-2",
            invoiceNumber: "FV-002",
            issueDate: "2026-03-20",
            dueDate: "2026-04-19",
            amount: 250_000,
            currency: "CZK",
            status: "approved",
          },
          {
            id: "ii-3",
            invoiceNumber: "FV-003",
            issueDate: "2099-03-20",
            dueDate: "2099-04-19",
            amount: 50_000,
            currency: "CZK",
            status: "issued",
          },
        ],
      },
    } satisfies ProjectDetails;

    const stats = computeContractsDashboardStats([contract()], projectDetails);

    expect(stats.investorBudget).toBe(1_500_000);
    expect(stats.contractedCosts).toBe(1_000_000);
    expect(stats.expectedProfit).toBe(500_000);
    expect(stats.investorInvoiced).toBe(1_000_000);
    expect(stats.invoiced).toBe(500_000);
    expect(stats.invoicingProfit).toBe(500_000);
    expect(stats.investorPaid).toBe(700_000);
    expect(stats.investorApproved).toBe(250_000);
    expect(stats.investorIssued).toBe(50_000);
    expect(stats.investorInvoiceProgress).toBeCloseTo(0.6667, 4);
    expect(stats.supplierInvoiceProgress).toBe(0.5);
  });

  it("funguje i bez investorských finančních dat", () => {
    const stats = computeContractsDashboardStats([contract()], undefined);

    expect(stats.investorBudget).toBe(0);
    expect(stats.investorInvoiced).toBe(0);
    expect(stats.expectedProfit).toBe(-1_000_000);
    expect(stats.invoicingProfit).toBe(-500_000);
  });
});
