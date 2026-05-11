import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProjectOverviewNew } from "@/features/projects/ui/ProjectOverviewNew";
import { formatMoney } from "@/utils/formatters";
import type { ProjectDetails } from "../types";

const hasNormalizedText = (expected: string) => (_content: string, element: Element | null) =>
  (element?.textContent ?? "").replace(/\s/g, " ").trim() === expected.replace(/\s/g, " ").trim();

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

  it("industrial skin zobrazí nad KPI kartami název stavby s brandovým psacím písmem", () => {
    const project = buildProject();
    project.title = "REKO Bazén Aš";

    render(
      <ProjectOverviewNew
        project={project}
        onUpdate={() => undefined}
        variant="compact"
        skin="industrial"
      />,
    );

    const heading = screen.getByRole("heading", { name: "REKO Bazén Aš" });
    const headingBlock = heading.closest("[data-help-id='overview-section-heading']");
    const scriptPart = within(heading).getByText("Bazén");
    const kpiCards = screen.getByText("Rozpočet").closest("[data-help-id='overview-kpi-cards']");

    expect(headingBlock).toHaveClass("industrial-section-heading");
    expect(heading).toHaveClass("industrial-section-title");
    expect(scriptPart).toHaveClass("tf-skin-script");
    expect(screen.queryByRole("heading", { name: "Přehled stavby" })).not.toBeInTheDocument();
    expect(kpiCards).toBeTruthy();
    expect(heading.compareDocumentPosition(kpiCards as HTMLElement) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("industrial skin zvýrazní typ stavby psacím písmem i u ostatních projektů", () => {
    const project = buildProject();
    project.title = "25036 Statické zajištění silnice Oloví - Boučí, 2.etapa";

    render(
      <ProjectOverviewNew
        project={project}
        onUpdate={() => undefined}
        variant="compact"
        skin="industrial"
      />,
    );

    const heading = screen.getByRole("heading", {
      name: "25036 Statické zajištění silnice Oloví - Boučí, 2.etapa",
    });
    const scriptPart = within(heading).getByText("Statické zajištění silnice");

    expect(scriptPart).toHaveClass("tf-skin-script");
  });

  it("industrial skin nezobrazuje rušivé tlačítko sdílení nad KPI kartami", () => {
    render(
      <ProjectOverviewNew
        project={buildProject()}
        onUpdate={() => undefined}
        variant="compact"
        skin="industrial"
      />,
    );

    expect(screen.queryByRole("button", { name: /Sdílet stavbu/i })).not.toBeInTheDocument();
  });

  it("otevře modal pro finance investora a uloží změnu", () => {
    const onUpdate = vi.fn();
    render(
      <ProjectOverviewNew
        project={buildProject()}
        onUpdate={onUpdate}
        variant="compact"
        currentUserId="user-1"
      />,
    );

    const financeHeader = screen.getByText("Finance (Investor)").parentElement;
    expect(financeHeader).toBeTruthy();
    const editButton = within(financeHeader as HTMLElement).getByRole("button");

    fireEvent.click(editButton);

    expect(screen.getByText("Upravit finance investora")).toBeInTheDocument();
    const modal = screen.getByText("Upravit finance investora").closest("[data-help-id='overview-investor-finance-modal']");
    expect(modal).toHaveClass("tf-modal-overlay");
    expect(within(modal as HTMLElement).getByRole("dialog")).toHaveClass("tf-modal-panel", "max-w-4xl");
    expect(screen.getByText("Počet dodatků:")).toBeInTheDocument();
    expect(screen.getByText("Dodatky celkem:")).toBeInTheDocument();
    expect(screen.getAllByText(hasNormalizedText(formatMoney(10000000))).length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue("FV-001").length).toBeGreaterThan(0);

    const sodInput = screen.getByLabelText("Základní cena SOD");
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

  it("umožní zadat cenu SOD i dodatků jako celé částky bez vynuceného desetinného zápisu", () => {
    const onUpdate = vi.fn();
    render(
      <ProjectOverviewNew
        project={buildProject()}
        onUpdate={onUpdate}
        variant="compact"
        currentUserId="user-1"
      />,
    );

    const financeHeader = screen.getByText("Finance (Investor)").parentElement;
    const editButton = within(financeHeader as HTMLElement).getByRole("button");

    fireEvent.click(editButton);

    const sodInput = screen.getByLabelText("Základní cena SOD") as HTMLInputElement;
    expect(sodInput.value).toBe("410\u00A0000\u00A0000");

    fireEvent.focus(sodInput);
    expect(sodInput.value).toBe("410000000");
    fireEvent.change(sodInput, { target: { value: "123456789" } });
    expect(sodInput.value).toBe("123456789");
    fireEvent.blur(sodInput);
    expect(sodInput.value).toBe("123\u00A0456\u00A0789");

    const amendmentInput = screen.getByLabelText("Cena dodatku 1") as HTMLInputElement;
    fireEvent.focus(amendmentInput);
    expect(amendmentInput.value).toBe("6000000");
    fireEvent.change(amendmentInput, { target: { value: "7654321" } });
    expect(amendmentInput.value).toBe("7654321");
    fireEvent.blur(amendmentInput);
    expect(amendmentInput.value).toBe("7\u00A0654\u00A0321");

    fireEvent.click(screen.getByText("Uložit změny"));

    expect(onUpdate).toHaveBeenCalledWith({
      investorFinancials: expect.objectContaining({
        sodPrice: 123456789,
        amendments: [
          { id: "a1", label: "Dodatek č.1", price: 7654321 },
          { id: "a2", label: "Dodatek č.2", price: 4000000 },
        ],
      }),
    });
  });
});
