import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ContractOverview } from "@/features/contracts-overview/ContractOverview";
import type { ContractOverviewRow } from "@/features/contracts-overview/api/contractOverviewApi";

const { exportContractOverviewToExcelMock, getContractOverviewMock } = vi.hoisted(() => ({
  exportContractOverviewToExcelMock: vi.fn(),
  getContractOverviewMock: vi.fn(),
}));

const overviewRow: ContractOverviewRow = {
  organizationId: "org-1",
  projectId: "project-1",
  projectName: "Stavba Alfa",
  projectStatus: "realization",
  contractId: "contract-1",
  contractPartner: "Dodavatel Alfa",
  contractTitle: "Smlouva o dílo",
  contractNumber: "S-1",
  contractStatus: "active",
  currency: "CZK",
  basePrice: 100,
  currentTotal: 120,
  approvedDrawdown: 20,
  remainingAmount: 100,
  retentionPercent: null,
  retentionShortPercent: null,
  retentionShortAmount: null,
  retentionShortReleaseOn: null,
  retentionLongPercent: null,
  retentionLongAmount: null,
  retentionLongReleaseOn: null,
  warrantyMonths: null,
  warrantyEnd: null,
  warrantyRetentionPercent: null,
  warrantyRetentionReleaseOn: null,
  maturityDays: null,
  paymentTerms: null,
  signedAt: null,
  effectiveFrom: null,
  effectiveTo: null,
  documentUrl: null,
  documentStoragePath: null,
  documentFileName: null,
  amendments: [{
    id: "amendment-1",
    amendmentNo: 1,
    status: "active",
    signedAt: null,
    effectiveFrom: null,
    deltaPrice: 20,
    documentUrl: null,
    documentStoragePath: null,
    documentFileName: null,
  }],
};

vi.mock("@/features/contracts-overview/api/contractOverviewApi", () => ({
  getContractOverview: getContractOverviewMock,
  formatContractOverviewMoney: (value: number) => `${value} Kč`,
  openContractOverviewDocument: vi.fn(),
}));

vi.mock("@/features/contracts-overview/api/contractOverviewExport", () => ({
  exportContractOverviewToExcel: exportContractOverviewToExcelMock,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      organizationId: "org-1",
      organizationName: "REKO a.s.",
      name: "Martin Kalkus",
      email: "martin@example.com",
    },
  }),
}));

vi.mock("@/context/UIContext", () => ({
  useUI: () => ({ showAlert: vi.fn() }),
}));

vi.mock("@/shared/ui/Header", () => ({
  Header: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

vi.mock("@features/notifications/ui/NotificationBell", () => ({ NotificationBell: () => null }));
vi.mock("@features/help", () => ({ HelpButton: () => null }));

describe("seskupení smluv a dodatků ve Smluvním přehledu", () => {
  it("zobrazí dodatky až po rozbalení rodičovské smlouvy a umožní je znovu skrýt", async () => {
    getContractOverviewMock.mockResolvedValueOnce([overviewRow]);
    render(<ContractOverview />);

    const expandButton = await screen.findByRole("button", {
      name: "Rozbalit dodatky smlouvy Smlouva o dílo",
    });
    expect(screen.queryByText("Dodatek č. 1")).not.toBeInTheDocument();
    expect(expandButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(expandButton);
    expect(await screen.findByText("Dodatek č. 1")).toBeInTheDocument();
    expect(screen.getByRole("button", {
      name: "Sbalit dodatky smlouvy Smlouva o dílo",
    })).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("button", {
      name: "Sbalit dodatky smlouvy Smlouva o dílo",
    }));
    await waitFor(() => expect(screen.queryByText("Dodatek č. 1")).not.toBeInTheDocument());
  });

  it("při hledání podle dodatku automaticky odkryje odpovídající řádek", async () => {
    getContractOverviewMock.mockResolvedValueOnce([overviewRow]);
    render(<ContractOverview />);

    fireEvent.change(await screen.findByRole("textbox", {
      name: "Hledat ve smluvním přehledu",
    }), { target: { value: "dodatek 1" } });

    expect(await screen.findByText("Dodatek č. 1")).toBeInTheDocument();
    expect(screen.getByRole("button", {
      name: "Dodatky smlouvy Smlouva o dílo rozbalené výsledkem hledání",
    })).toBeDisabled();
  });

  it("pojmenuje legacy dokument dodatku podle jeho skutečného typu", async () => {
    getContractOverviewMock.mockResolvedValueOnce([{
      ...overviewRow,
      amendments: [{
        ...overviewRow.amendments[0],
        documentUrl: "https://legacy.example/dodatek.pdf",
      }],
    }]);
    render(<ContractOverview />);

    fireEvent.click(await screen.findByRole("button", {
      name: "Rozbalit dodatky smlouvy Smlouva o dílo",
    }));

    expect(await screen.findByRole("button", {
      name: "Otevřít soubor dodatku",
    })).toBeInTheDocument();
  });

  it("předá exportu značku organizace, verzi aplikace a jméno bez e-mailu", async () => {
    getContractOverviewMock.mockResolvedValueOnce([overviewRow]);
    exportContractOverviewToExcelMock.mockResolvedValueOnce(undefined);
    render(<ContractOverview />);

    fireEvent.click(await screen.findByRole("button", { name: "Export do Excelu" }));

    await waitFor(() => expect(exportContractOverviewToExcelMock).toHaveBeenCalledWith(
      [overviewRow],
      expect.any(Array),
      expect.objectContaining({
        organizationName: "REKO a.s.",
        exportedBy: "Martin Kalkus",
        appVersion: "1.9.0-beta.14",
      }),
    ));
    expect(exportContractOverviewToExcelMock.mock.calls[0][2].exportedBy).not.toContain("@");
  });
});
