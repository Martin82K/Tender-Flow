import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ContractOverview } from "@/features/contracts-overview/ContractOverview";
import type { ContractOverviewRow } from "@/features/contracts-overview/api/contractOverviewApi";

const { getContractOverviewMock } = vi.hoisted(() => ({
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

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { organizationId: "org-1" } }),
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
});
