import { describe, expect, it } from "vitest";

import type { ContractWithDetails } from "../types";
import {
  buildContractSummaryList,
  formatContractSummaryMoney,
  formatContractSummaryRetention,
  mapContractWithDetailsToSummaryDto,
} from "../shared/contracts/contractSummary";

const baseContract: ContractWithDetails = {
  id: "contract-1",
  projectId: "project-1",
  vendorName: "KLIMA - ELEKTRON s.r.o.",
  title: "VZT",
  contractNumber: "SOD-2026-001",
  status: "active",
  currency: "CZK",
  basePrice: 100000,
  currentTotal: 125000,
  approvedSum: 30000,
  remaining: 95000,
  retentionPercent: 5,
  siteSetupPercent: 2,
  warrantyMonths: 24,
  paymentTerms: "21 dní",
  scopeSummary: "Vzduchotechnika",
  source: "manual",
  amendments: [],
  drawdowns: [],
  invoices: [],
  invoicedSum: 0,
  paidSum: 0,
  overdueSum: 0,
};

describe("contractSummary", () => {
  it("mapuje ContractWithDetails na ContractSummaryDto", () => {
    const result = mapContractWithDetailsToSummaryDto(baseContract);

    expect(result).toMatchObject({
      id: "contract-1",
      projectId: "project-1",
      contractNumber: "SOD-2026-001",
      vendorName: "KLIMA - ELEKTRON s.r.o.",
      currentTotal: 125000,
      approvedSum: 30000,
      remaining: 95000,
      retentionPercent: 5,
      siteSetupPercent: 2,
      warrantyMonths: 24,
      paymentTerms: "21 dní",
    });
  });

  it("při filtrování používá dotaz i stav a řadí podle dodavatele", () => {
    const result = buildContractSummaryList(
      [
        baseContract,
        {
          ...baseContract,
          id: "contract-2",
          vendorName: "Alumarc s.r.o.",
          title: "AL výplně",
          contractNumber: "SOD-2026-002",
          status: "draft",
        },
      ],
      { query: "alu", status: "draft" },
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.vendorName).toBe("Alumarc s.r.o.");
  });

  it("preferuje retenční procenta před částkou", () => {
    const result = formatContractSummaryRetention({
      currency: "CZK",
      retentionPercent: 5,
      retentionAmount: 10000,
    });

    expect(result).toBe("5 %");
  });

  it("vrací částku nebo fallback, když procenta chybí", () => {
    const amount = formatContractSummaryRetention({
      currency: "CZK",
      retentionAmount: 10000,
    });
    const fallback = formatContractSummaryRetention({
      currency: "CZK",
    });

    expect(amount).toContain("10");
    expect(fallback).toBe("-");
  });

  it("normalizuje historický kód měny Kč na CZK a nespadne", () => {
    expect(() => formatContractSummaryMoney(1000, "Kč")).not.toThrow();
    expect(formatContractSummaryMoney(1000, "Kč")).toContain("Kč");
  });

  it("při neplatném kódu měny fallbackne na CZK", () => {
    expect(() => formatContractSummaryMoney(1000, "koruny")).not.toThrow();
    expect(formatContractSummaryMoney(1000, "koruny")).toContain("Kč");
  });
});
