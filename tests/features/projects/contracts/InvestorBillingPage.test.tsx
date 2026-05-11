import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProjectDetails } from "@/types";
import { InvestorBillingPage } from "@/features/projects/contracts/investor/InvestorBillingPage";

const projectDetails: ProjectDetails = {
  id: "project-1",
  title: "Projekt A",
  location: "",
  finishDate: "",
  siteManager: "",
  categories: [],
  investorFinancials: {
    sodPrice: 1_000_000,
    amendments: [{ id: "a1", label: "Dodatek č.1", price: 100_000 }],
    invoices: [],
  },
};

describe("InvestorBillingPage", () => {
  it("přidá fakturu na investora a uloží ji do investorFinancials", async () => {
    const onUpdateDetails = vi.fn();

    render(
      <InvestorBillingPage
        projectDetails={projectDetails}
        onUpdateDetails={onUpdateDetails}
      />,
    );

    fireEvent.click(screen.getByText("+ Přidat fakturu"));

    fireEvent.change(screen.getByPlaceholderText("Číslo faktury"), {
      target: { value: "FV-001" },
    });
    fireEvent.change(screen.getByDisplayValue("0"), {
      target: { value: "250000" },
    });
    fireEvent.change(screen.getByDisplayValue("Vystaveno"), {
      target: { value: "approved" },
    });

    fireEvent.click(screen.getByText("Uložit"));

    await waitFor(() => expect(onUpdateDetails).toHaveBeenCalledWith({
      investorFinancials: expect.objectContaining({
        sodPrice: 1_000_000,
        amendments: [{ id: "a1", label: "Dodatek č.1", price: 100_000 }],
        invoices: [
          expect.objectContaining({
            invoiceNumber: "FV-001",
            amount: 250_000,
            currency: "CZK",
            status: "approved",
          }),
        ],
      }),
    }));
  });

  it("uloží smazání investorské faktury jako prázdný seznam", async () => {
    const onUpdateDetails = vi.fn();

    render(
      <InvestorBillingPage
        projectDetails={{
          ...projectDetails,
          investorFinancials: {
            ...projectDetails.investorFinancials!,
            invoices: [
              {
                id: "ii1",
                invoiceNumber: "FV-001",
                issueDate: "2026-03-31",
                dueDate: "2026-05-16",
                amount: 2_449_376.82,
                currency: "CZK",
                status: "issued",
              },
            ],
          },
        }}
        onUpdateDetails={onUpdateDetails}
      />,
    );

    fireEvent.click(screen.getByLabelText("Smazat fakturu"));
    expect(screen.getByText("Změny nejsou uložené. Pro trvalé smazání použijte Uložit.")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Uložit"));

    await waitFor(() => expect(onUpdateDetails).toHaveBeenCalledWith({
      investorFinancials: expect.objectContaining({
        invoices: [],
      }),
    }));
  });

  it("umožní odemknout uloženou fakturu a opravit překlep", async () => {
    const onUpdateDetails = vi.fn();

    render(
      <InvestorBillingPage
        projectDetails={{
          ...projectDetails,
          investorFinancials: {
            ...projectDetails.investorFinancials!,
            invoices: [
              {
                id: "ii1",
                invoiceNumber: "300260019",
                issueDate: "2026-03-31",
                dueDate: "2026-05-16",
                amount: 2_449_376.82,
                currency: "CZK",
                status: "issued",
              },
            ],
          },
        }}
        onUpdateDetails={onUpdateDetails}
      />,
    );

    const invoiceNumber = screen.getByDisplayValue("300260019");
    expect(invoiceNumber).toBeDisabled();

    fireEvent.click(screen.getByLabelText("Upravit fakturu"));
    expect(invoiceNumber).not.toBeDisabled();

    fireEvent.change(invoiceNumber, {
      target: { value: "30026019" },
    });
    fireEvent.click(screen.getByText("Uložit"));

    await waitFor(() => expect(onUpdateDetails).toHaveBeenCalledWith({
      investorFinancials: expect.objectContaining({
        invoices: [
          expect.objectContaining({
            id: "ii1",
            invoiceNumber: "30026019",
          }),
        ],
      }),
    }));
  });

  it("má stabilní kotvy pro industrial skin investor fakturace", () => {
    const { container } = render(
      <InvestorBillingPage
        projectDetails={projectDetails}
        onUpdateDetails={vi.fn()}
      />,
    );

    expect(container.querySelector("[data-help-id='contracts-investor-page']")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-help-id='contracts-investor-kpi-card']")).toHaveLength(4);
    expect(container.querySelector("[data-help-id='contracts-investor-panel']")).toBeInTheDocument();
    expect(container.querySelector("[data-help-id='contracts-investor-empty']")).toBeInTheDocument();
    expect(screen.getByText("+ Přidat fakturu")).toHaveAttribute("data-help-id", "contracts-investor-add-invoice");
    expect(screen.getByText("Uložit")).toHaveAttribute("data-help-id", "contracts-investor-save");
  });
});
