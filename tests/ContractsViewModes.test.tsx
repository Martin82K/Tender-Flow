import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getContractsByProjectMock = vi.hoisted(() => vi.fn());

vi.mock("../services/contractService", () => ({
  contractService: {
    getContractsByProject: (...args: unknown[]) => getContractsByProjectMock(...args),
  },
}));

vi.mock("../components/projectLayoutComponents/contractsComponents/ContractsOverview", () => ({
  ContractsOverview: () => <div>ContractsOverviewMock</div>,
}));

vi.mock("../components/projectLayoutComponents/contractsComponents/ContractsList", () => ({
  ContractsList: () => <div>ContractsListMock</div>,
}));

vi.mock("../components/projectLayoutComponents/contractsComponents/AmendmentsList", () => ({
  AmendmentsList: () => <div>AmendmentsListMock</div>,
}));

vi.mock("../components/projectLayoutComponents/contractsComponents/DrawdownsList", () => ({
  DrawdownsList: () => <div>DrawdownsListMock</div>,
}));

vi.mock("@/shared/ui/projects/ContractsSummaryView", () => ({
  ContractsSummaryView: ({ rowActionLabel }: { rowActionLabel?: string }) => (
    <div>{rowActionLabel ? `ContractsSummaryViewMock:${rowActionLabel}` : "ContractsSummaryViewMock"}</div>
  ),
}));

import { Contracts } from "../components/projectLayoutComponents/Contracts";

const contracts = [
  {
    id: "contract-1",
    projectId: "project-1",
    vendorName: "KLIMA - ELEKTRON s.r.o.",
    title: "VZT",
    contractNumber: "SOD-001",
    status: "active",
    currency: "CZK",
    basePrice: 100000,
    source: "manual",
    amendments: [],
    drawdowns: [],
    currentTotal: 100000,
    approvedSum: 0,
    remaining: 100000,
  },
];

describe("Contracts view modes", () => {
  beforeEach(() => {
    getContractsByProjectMock.mockReset();
    getContractsByProjectMock.mockResolvedValue(contracts);
  });

  it("přepíná mezi tabulkou a přehledem smluv", async () => {
    render(<Contracts projectId="project-1" projectDetails={{ id: "project-1", title: "Projekt A", categories: [] } as any} />);

    fireEvent.click(await screen.findByText("Smlouvy"));
    expect(screen.getByText("ContractsListMock")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Přehled smluv"));
    expect(screen.getByText("ContractsSummaryViewMock")).toBeInTheDocument();
  });

  it("v čerpání umí přepnout na pohled smluv", async () => {
    render(<Contracts projectId="project-1" projectDetails={{ id: "project-1", title: "Projekt A", categories: [] } as any} />);

    fireEvent.click(await screen.findByText("Čerpání"));
    expect(screen.getByText("DrawdownsListMock")).toBeInTheDocument();

    fireEvent.click(screen.getAllByText("Smlouvy")[1]);

    await waitFor(() => {
      expect(screen.getByText("ContractsSummaryViewMock:Otevřít čerpání")).toBeInTheDocument();
    });
  });
});
