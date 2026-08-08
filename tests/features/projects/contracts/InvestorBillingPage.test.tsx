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

    fireEvent.change(screen.getByLabelText("Číslo faktury 1"), {
      target: { value: "FV-001" },
    });
    fireEvent.change(screen.getByLabelText("Fakturovaná částka 1"), {
      target: { value: "250000" },
    });
    fireEvent.change(screen.getByLabelText("Stav faktury 1"), {
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

    fireEvent.doubleClick(screen.getByLabelText("Upravit fakturu 1"));
    fireEvent.click(screen.getByLabelText("Smazat fakturu 1"));

    expect(screen.getByText("Smazat fakturu?")).toBeInTheDocument();
    expect(screen.getByLabelText("Číslo faktury 1")).toHaveValue("FV-001");
    expect(screen.queryByText("Změny nejsou uložené. Pro trvalé smazání použijte Uložit."))
      .not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Zrušit" }));
    expect(screen.getByLabelText("Číslo faktury 1")).toHaveValue("FV-001");

    fireEvent.click(screen.getByLabelText("Smazat fakturu 1"));
    fireEvent.click(screen.getByRole("button", { name: "Smazat" }));
    expect(screen.getByText("Změny nejsou uložené. Pro trvalé smazání použijte Uložit.")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Uložit"));

    await waitFor(() => expect(onUpdateDetails).toHaveBeenCalledWith({
      investorFinancials: expect.objectContaining({
        invoices: [],
      }),
    }));
  });

  it("dědí globální pozastávky bez procentních polí na faktuře", async () => {
    const onUpdateDetails = vi.fn();
    render(
      <InvestorBillingPage
        projectDetails={{
          ...projectDetails,
          investorFinancials: {
            ...projectDetails.investorFinancials!,
            retentionAPercent: 5,
            retentionBPercent: 3,
          },
        }}
        onUpdateDetails={onUpdateDetails}
      />,
    );

    fireEvent.click(screen.getByText("+ Přidat fakturu"));
    expect(screen.queryByLabelText("Pozastávka A procento 1")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Pozastávka B procento 1")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Číslo faktury 1"), { target: { value: "FV-RET" } });
    fireEvent.change(screen.getByLabelText("Fakturovaná částka 1"), { target: { value: "100000" } });
    fireEvent.change(screen.getByLabelText("Stav faktury 1"), { target: { value: "paid" } });
    fireEvent.click(screen.getByText("Uložit"));

    await waitFor(() => expect(onUpdateDetails).toHaveBeenCalledTimes(1));
    const savedInvoice = onUpdateDetails.mock.calls[0][0].investorFinancials?.invoices?.[0];
    expect(savedInvoice).toEqual(expect.objectContaining({
      period: expect.stringMatching(/^\d{4}-\d{2}$/),
      retentionAAmount: 5_000,
      retentionBAmount: 3_000,
      paidAmount: 92_000,
    }));
    expect(savedInvoice).not.toHaveProperty("retentionAPercent");
    expect(savedInvoice).not.toHaveProperty("retentionBPercent");
  });

  it("umožní na faktuře zapnout individuální výjimku", () => {
    render(
      <InvestorBillingPage
        projectDetails={{
          ...projectDetails,
          investorFinancials: {
            ...projectDetails.investorFinancials!,
            retentionAPercent: 5,
            retentionBPercent: 3,
          },
        }}
        onUpdateDetails={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("+ Přidat fakturu"));
    fireEvent.click(screen.getByLabelText("Nastavit individuální pozastávky faktury 1"));

    expect(screen.getByLabelText("Pozastávka A procento 1")).toHaveValue(5);
    expect(screen.getByLabelText("Pozastávka B procento 1")).toHaveValue(3);
    expect(screen.getByLabelText("Použít globální pozastávky faktury 1")).toBeInTheDocument();
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

    expect(screen.getByText("300260019")).toBeInTheDocument();
    expect(screen.queryByLabelText("Číslo faktury 1")).not.toBeInTheDocument();

    fireEvent.doubleClick(screen.getByLabelText("Upravit fakturu 1"));
    const invoiceNumber = screen.getByLabelText("Číslo faktury 1");

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
    expect(container.querySelectorAll("[data-help-id='contracts-investor-kpi-card']")).toHaveLength(6);
    expect(container.querySelector("[data-help-id='contracts-investor-contract-panel']")).toBeInTheDocument();
    expect(container.querySelector("[data-help-id='contracts-investor-panel']")).toBeInTheDocument();
    expect(container.querySelector("[data-help-id='contracts-investor-empty']")).toBeInTheDocument();
    expect(screen.getByText("+ Přidat fakturu")).toHaveAttribute("data-help-id", "contracts-investor-add-invoice");
    expect(screen.getByText("Uložit")).toHaveAttribute("data-help-id", "contracts-investor-save");
  });

  it("používá kompaktní mřížku a přístupné názvy polí smlouvy", () => {
    const { container } = render(
      <InvestorBillingPage
        projectDetails={projectDetails}
        onUpdateDetails={vi.fn()}
      />,
    );

    fireEvent.doubleClick(screen.getByLabelText("Upravit smlouvu s objednatelem"));

    expect(container.querySelector("[data-help-id='contracts-investor-contract-fields']"))
      .toHaveClass("lg:grid-cols-12");
    expect(screen.getByLabelText("Číslo smlouvy").parentElement).toHaveClass("lg:col-span-2");
    expect(screen.getByLabelText("Název smlouvy").parentElement).toHaveClass("lg:col-span-4");
    expect(screen.getByLabelText("Datum podpisu").parentElement).toHaveClass("lg:col-span-2");
    expect(screen.getByLabelText("Pozastávka A – do předání").parentElement?.parentElement)
      .toHaveClass("lg:col-span-2");
  });

  it("udržuje krátká pole dodatku v kompaktních sloupcích", () => {
    const { container } = render(
      <InvestorBillingPage
        projectDetails={projectDetails}
        onUpdateDetails={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText("+ Přidat dodatek"));

    const columns = container.querySelectorAll(
      "[data-help-id='contracts-investor-amendments-table'] col",
    );
    expect(columns).toHaveLength(5);
    expect(columns[0]).toHaveClass("w-44");
    expect(columns[2]).toHaveClass("w-44");
    expect(columns[3]).toHaveClass("w-56");
    expect(columns[4]).toHaveClass("w-20");
  });

  it("sjednocuje native a numerická pole pro světlý i tmavý režim", () => {
    render(
      <InvestorBillingPage
        projectDetails={projectDetails}
        onUpdateDetails={vi.fn()}
      />,
    );

    fireEvent.doubleClick(screen.getByLabelText("Upravit smlouvu s objednatelem"));

    const contractNumber = screen.getByLabelText("Číslo smlouvy");
    const contractPrice = screen.getByLabelText("Cena smlouvy");
    const signedAt = screen.getByLabelText("Datum podpisu");

    for (const field of [contractNumber, contractPrice, signedAt]) {
      expect(field).toHaveClass("tf-contracts-investor-field");
      expect(field).toHaveClass("bg-white", "text-slate-900");
      expect(field).toHaveClass("dark:bg-slate-950", "dark:text-slate-100");
    }
  });

  it("používá jednotný vzhled také pro cenu dodatku", () => {
    render(
      <InvestorBillingPage
        projectDetails={projectDetails}
        onUpdateDetails={vi.fn()}
      />,
    );

    fireEvent.doubleClick(screen.getByLabelText("Upravit dodatek 1"));

    expect(screen.getByLabelText("Změna ceny dodatku 1")).toHaveClass(
      "tf-contracts-investor-field",
      "dark:bg-slate-950",
    );
  });
});
