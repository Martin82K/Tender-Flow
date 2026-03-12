import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getOrganizationLogoUrlMock = vi.hoisted(() => vi.fn());
const exportContractSummariesToXlsxMock = vi.hoisted(() => vi.fn());
const exportContractSummariesToPdfMock = vi.hoisted(() => vi.fn());
const logIncidentMock = vi.hoisted(() => vi.fn());

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "user-1",
      organizationId: "org-1",
      organizationName: "Tender Flow Demo",
    },
  }),
}));

vi.mock("@/services/organizationService", () => ({
  organizationService: {
    getOrganizationLogoUrl: (...args: unknown[]) => getOrganizationLogoUrlMock(...args),
  },
}));

vi.mock("@/services/exportService", () => ({
  exportContractSummariesToXlsx: (...args: unknown[]) =>
    exportContractSummariesToXlsxMock(...args),
  exportContractSummariesToPdf: (...args: unknown[]) =>
    exportContractSummariesToPdfMock(...args),
}));

vi.mock("@/services/incidentLogger", () => ({
  logIncident: (...args: unknown[]) => logIncidentMock(...args),
}));

import { ContractsSummaryView } from "@/shared/ui/projects/ContractsSummaryView";

const contracts = [
  {
    id: "contract-1",
    projectId: "project-1",
    title: "VZT",
    contractNumber: "SOD-001",
    vendorName: "KLIMA - ELEKTRON s.r.o.",
    status: "active" as const,
    currency: "CZK",
    basePrice: 100000,
    currentTotal: 120000,
    approvedSum: 30000,
    remaining: 90000,
    retentionPercent: 5,
    siteSetupPercent: 2,
    warrantyMonths: 24,
    paymentTerms: "21 dní",
  },
  {
    id: "contract-2",
    projectId: "project-1",
    title: "AL výplně",
    contractNumber: "SOD-002",
    vendorName: "Alumarc s.r.o.",
    status: "draft" as const,
    currency: "CZK",
    basePrice: 80000,
    currentTotal: 80000,
    approvedSum: 0,
    remaining: 80000,
    retentionAmount: 5000,
    warrantyMonths: 12,
    paymentTerms: "14 dní",
  },
];

describe("ContractsSummaryView", () => {
  beforeEach(() => {
    getOrganizationLogoUrlMock.mockReset();
    exportContractSummariesToXlsxMock.mockReset();
    exportContractSummariesToPdfMock.mockReset();
    logIncidentMock.mockReset();
    getOrganizationLogoUrlMock.mockResolvedValue(null);
    exportContractSummariesToXlsxMock.mockResolvedValue(undefined);
    exportContractSummariesToPdfMock.mockResolvedValue(undefined);
    logIncidentMock.mockResolvedValue({ incidentId: "INC-1" });
  });

  it("zobrazuje přehledové sloupce a filtruje podle dotazu a stavu", async () => {
    render(
      <ContractsSummaryView
        contracts={contracts}
        projectDetails={{ id: "project-1", title: "Projekt A", categories: [] } as any}
      />,
    );

    expect(screen.getByText("Číslo smlouvy")).toBeInTheDocument();
    expect(screen.getAllByText("Zařízení staveniště").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Záruční doba").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText("Číslo smlouvy, dodavatel nebo název"), {
      target: { value: "alu" },
    });

    await waitFor(() => {
      expect(screen.queryByText("KLIMA - ELEKTRON s.r.o.")).not.toBeInTheDocument();
    });
    expect(screen.getAllByText("Alumarc s.r.o.").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByDisplayValue("Všechny stavy"), {
      target: { value: "active" },
    });

    await waitFor(() => {
      expect(screen.getByText("Žádné smlouvy k zobrazení")).toBeInTheDocument();
    });
  });

  it("exportuje právě filtrovaný seznam do Excelu a PDF", async () => {
    render(
      <ContractsSummaryView
        contracts={contracts}
        projectDetails={{ id: "project-1", title: "Projekt A", categories: [] } as any}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Číslo smlouvy, dodavatel nebo název"), {
      target: { value: "KLIMA" },
    });

    fireEvent.click(screen.getByText("Export do Excelu"));
    await waitFor(() => {
      expect(exportContractSummariesToXlsxMock).toHaveBeenCalledTimes(1);
    });
    expect(exportContractSummariesToXlsxMock.mock.calls[0][0]).toHaveLength(1);

    fireEvent.click(screen.getByText("Export do PDF"));
    await waitFor(() => {
      expect(exportContractSummariesToPdfMock).toHaveBeenCalledTimes(1);
    });
    expect(exportContractSummariesToPdfMock.mock.calls[0][0]).toHaveLength(1);
  });

  it("zaloguje incident při selhání exportu", async () => {
    exportContractSummariesToPdfMock.mockRejectedValueOnce(
      new Error("pdf export fail"),
    );

    render(
      <ContractsSummaryView
        contracts={contracts}
        projectDetails={{ id: "project-1", title: "Projekt A", categories: [] } as any}
      />,
    );

    fireEvent.click(screen.getByText("Export do PDF"));

    await waitFor(() => {
      expect(logIncidentMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "CONTRACT_SUMMARY_EXPORT_PDF_FAILED",
          category: "ui",
          severity: "error",
          context: expect.objectContaining({
            project_id: "project-1",
            organization_id: "org-1",
          }),
        }),
      );
    });

    expect(screen.getByText("pdf export fail")).toBeInTheDocument();
  });

  it("zaloguje incident při selhání načtení branding loga", async () => {
    getOrganizationLogoUrlMock.mockRejectedValueOnce(new Error("logo fail"));

    render(
      <ContractsSummaryView
        contracts={contracts}
        projectDetails={{ id: "project-1", title: "Projekt A", categories: [] } as any}
      />,
    );

    await waitFor(() => {
      expect(logIncidentMock).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "CONTRACT_SUMMARY_BRANDING_LOAD_FAILED",
          severity: "warn",
          context: expect.objectContaining({
            project_id: "project-1",
            organization_id: "org-1",
            action_status: "fallback",
          }),
        }),
      );
    });
  });
});
