import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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
  it("přidá fakturu na investora a uloží ji do investorFinancials", () => {
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

    expect(onUpdateDetails).toHaveBeenCalledWith({
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
    });
  });
});
