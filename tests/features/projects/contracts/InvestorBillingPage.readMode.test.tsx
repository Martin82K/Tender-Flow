import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InvestorBillingPage } from "@/features/projects/contracts/investor/InvestorBillingPage";
import type { ProjectDetails } from "@/types";

const projectDetails: ProjectDetails = {
  id: "project-read-mode",
  title: "Bazén Aš",
  location: "",
  finishDate: "",
  siteManager: "",
  categories: [],
  investorFinancials: {
    contractNumber: "SOD-2026-01",
    contractTitle: "Rekonstrukce bazénu",
    customerName: "Město Aš",
    signedAt: "2026-02-10",
    sodPrice: 1_000_000,
    retentionAPercent: 5,
    retentionBPercent: 3,
    amendments: [{ id: "amendment-1", number: "D1", label: "Technologie bazénu", signedAt: "2026-03-05", price: 100_000 }],
    invoices: [{ id: "invoice-1", period: "2026-04", invoiceNumber: "FV-2026-04", issueDate: "2026-04-30", dueDate: "2026-05-30", amount: 250_000, currency: "CZK", status: "issued" }],
  },
};

describe("InvestorBillingPage read mode", () => {
  it("zobrazuje smlouvu jako text a inputy až po zapnutí editace", () => {
    render(<InvestorBillingPage projectDetails={projectDetails} onUpdateDetails={vi.fn()} />);

    expect(screen.getByText("SOD-2026-01")).toBeInTheDocument();
    expect(screen.getByText("Rekonstrukce bazénu")).toBeInTheDocument();
    expect(screen.queryByLabelText("Číslo smlouvy")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Upravit smlouvu s objednatelem"));

    expect(screen.getByLabelText("Číslo smlouvy")).toHaveValue("SOD-2026-01");
    expect(screen.getByLabelText("Cena smlouvy")).toHaveValue("1 000 000,00");
  });

  it("u dodatku přepíná textový řádek do editace a zrušení obnoví hodnotu", () => {
    render(<InvestorBillingPage projectDetails={projectDetails} onUpdateDetails={vi.fn()} />);

    expect(screen.getByText("Technologie bazénu")).toBeInTheDocument();
    expect(screen.queryByLabelText("Název dodatku 1")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Upravit dodatek 1"));
    fireEvent.change(screen.getByLabelText("Název dodatku 1"), { target: { value: "Dočasná změna" } });
    fireEvent.click(screen.getByLabelText("Zrušit úpravu dodatku 1"));

    expect(screen.getByText("Technologie bazénu")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Dočasná změna")).not.toBeInTheDocument();
  });

  it("uloženou fakturu zobrazuje jako text a novou fakturu rovnou jako formulář", () => {
    render(<InvestorBillingPage projectDetails={projectDetails} onUpdateDetails={vi.fn()} />);

    expect(screen.getByText("FV-2026-04")).toBeInTheDocument();
    expect(screen.queryByLabelText("Číslo faktury 1")).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Upravit fakturu 1"));
    expect(screen.getByLabelText("Číslo faktury 1")).toHaveValue("FV-2026-04");

    fireEvent.click(screen.getByLabelText("Zrušit úpravu faktury 1"));
    fireEvent.click(screen.getByText("+ Přidat fakturu"));

    expect(screen.getByLabelText("Číslo faktury 2")).toBeInTheDocument();
  });
});
