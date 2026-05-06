import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectOverviewNew } from "../components/ProjectOverviewNew";
import type { ProjectDetails } from "../types";

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

const buildProject = (): ProjectDetails => ({
  id: "project-1",
  title: "Projekt 1",
  investor: "Investor",
  technicalSupervisor: "TDI",
  location: "Praha",
  finishDate: "2026-12-31",
  siteManager: "Stavbyvedoucí",
  constructionManager: "CM",
  constructionTechnician: "CT",
  categories: [],
  contract: {
    maturity: 30,
    warranty: 24,
    retention: "5 %",
    siteFacilities: 2,
    insurance: 1,
  },
  investorFinancials: {
    sodPrice: 410000000,
    amendments: [
      { id: "a1", label: "Dodatek č.1", price: 6000000 },
      { id: "a2", label: "Dodatek č.2", price: 4000000 },
    ],
    invoices: [
      {
        id: "ii1",
        invoiceNumber: "FV-001",
        issueDate: "2026-01-15",
        dueDate: "2026-02-14",
        amount: 1500000,
        currency: "CZK",
        status: "paid",
        paidAt: "2026-02-10",
      },
    ],
  },
  plannedCost: 400000000,
});

describe("ProjectOverviewNew compact editace", () => {
  it("industrial skin vykreslí přepínače poptávek jako linkové ovládání bez bílých pillů", () => {
    const project = buildProject();
    project.categories = [
      {
        id: "cat-1",
        title: "Zemní práce",
        budget: "0 Kč",
        sodBudget: 1000,
        planBudget: 900,
        status: "open",
        subcontractorCount: 0,
        description: "",
      },
    ];

    render(
      <ProjectOverviewNew
        project={project}
        onUpdate={() => undefined}
        variant="compact"
        skin="industrial"
      />,
    );

    const table = screen.getByText("Přehled Poptávek").closest("[data-help-id='overview-demand-table']");
    expect(table).toHaveClass("industrial-demand-table");

    const allButton = screen.getByRole("button", { name: /Vše \(1\)/i });
    expect(allButton).toHaveAttribute("data-active", "true");
    expect(allButton.className).toContain("border-[#ff8a33]");
    expect(allButton.className).toContain("tracking-[0.08em]");
    expect(allButton.className).not.toContain("bg-white");
    expect(allButton.className).not.toContain("rounded-xl");

    const columnsButton = screen.getByRole("button", { name: /Sloupce/i });
    expect(columnsButton.className).toContain("tracking-[0.08em]");
    expect(columnsButton.className).not.toContain("bg-white");
    expect(columnsButton.className).not.toContain("rounded-xl");
  });

  it("industrial skin kopiruje odkaz bez query parametru", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    window.history.pushState({}, "", "/app/project/project-1?token=secret");

    render(
      <ProjectOverviewNew
        project={buildProject()}
        onUpdate={() => undefined}
        variant="compact"
        skin="industrial"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Sdílet stavbu/i }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("http://localhost:3000/app/project/project-1");
    });
  });

  it("otevře modal pro finance investora a uloží změnu", () => {
    const onUpdate = vi.fn();
    render(
      <ProjectOverviewNew
        project={buildProject()}
        onUpdate={onUpdate}
        variant="compact"
      />,
    );

    const financeHeader = screen.getByText("Finance (Investor)").parentElement;
    expect(financeHeader).toBeTruthy();
    const editButton = within(financeHeader as HTMLElement).getByRole("button");

    fireEvent.click(editButton);

    expect(screen.getByText("Upravit finance investora")).toBeInTheDocument();
    expect(screen.getByText("Počet dodatků:")).toBeInTheDocument();
    expect(screen.getByText("Dodatky celkem:")).toBeInTheDocument();
    expect(screen.getAllByText("10 000 000 Kč").length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue("FV-001").length).toBeGreaterThan(0);

    const sodInput = screen.getByDisplayValue("410 000 000");
    fireEvent.change(sodInput, { target: { value: "420000000" } });

    fireEvent.click(screen.getByText("Uložit změny"));

    expect(onUpdate).toHaveBeenCalledWith({
      investorFinancials: {
        sodPrice: 420000000,
        amendments: [
          { id: "a1", label: "Dodatek č.1", price: 6000000 },
          { id: "a2", label: "Dodatek č.2", price: 4000000 },
        ],
        invoices: [
          {
            id: "ii1",
            invoiceNumber: "FV-001",
            issueDate: "2026-01-15",
            dueDate: "2026-02-14",
            amount: 1500000,
            currency: "CZK",
            status: "paid",
            paidAt: "2026-02-10",
          },
        ],
      },
    });
  });
});
