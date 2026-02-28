import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
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
  },
  plannedCost: 400000000,
});

describe("ProjectOverviewNew compact editace", () => {
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
      },
    });
  });
});
