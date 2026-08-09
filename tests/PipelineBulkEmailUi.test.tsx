import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { PipelineEmailRecipientSelection } from "@/features/projects/model/pipelineEmailModel";
import { PipelineBulkEmailConfirmationModal } from "@/features/projects/ui/PipelineBulkEmailConfirmationModal";
import { PipelineBulkEmailMenu } from "@/features/projects/ui/PipelineBulkEmailMenu";
import type { Bid } from "@/types";

const createBid = (overrides: Partial<Bid>): Bid =>
  ({
    id: overrides.id || "bid-1",
    subcontractorId: overrides.subcontractorId || "supplier-1",
    companyName: overrides.companyName || "Dodavatel",
    contactPerson: "Kontakt",
    email: "supplier@example.com",
    status: "contacted",
    ...overrides,
  }) as Bid;

describe("PipelineBulkEmailMenu", () => {
  it("nabízí všechny tři akce, počty příjemců a tooltipy", () => {
    const onSelect = vi.fn();
    render(
      <PipelineBulkEmailMenu
        inquiryRecipientCount={4}
        loserRecipientCount={2}
        onSelect={onSelect}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Hromadný e-mail" });
    expect(trigger).toHaveAttribute(
      "title",
      "Otevřít nabídku hromadných e-mailů",
    );
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute(
      "data-help-id",
      "pipeline-bulk-email-trigger",
    );
    expect(screen.getByRole("menu")).toHaveClass("tf-pipeline-popover");
    const standard = screen.getByRole("menuitem", {
      name: /Standardní poptávka/,
    });
    const material = screen.getByRole("menuitem", {
      name: /Materiálová poptávka/,
    });
    const losers = screen.getByRole("menuitem", {
      name: /Poděkování nevybraným/,
    });
    expect(standard).toHaveAttribute(
      "title",
      "Připravit standardní poptávku všem dodavatelům v Oslovení",
    );
    expect(standard).toHaveClass("tf-pipeline-popover-item");
    expect(material).toHaveTextContent("4");
    expect(losers).toHaveTextContent("2");

    fireEvent.click(material);
    expect(onSelect).toHaveBeenCalledWith("materialInquiry");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("podporuje šipky a zavření klávesou Escape", () => {
    render(
      <PipelineBulkEmailMenu
        inquiryRecipientCount={1}
        loserRecipientCount={0}
        onSelect={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Hromadný e-mail" });
    fireEvent.click(trigger);
    const items = screen.getAllByRole("menuitem");
    expect(items[0]).toHaveFocus();

    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(items[1]).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("udrží nabídku uvnitř úzkého viewportu", () => {
    const viewportSpy = vi
      .spyOn(window, "innerWidth", "get")
      .mockReturnValue(300);
    render(
      <PipelineBulkEmailMenu
        inquiryRecipientCount={1}
        loserRecipientCount={0}
        onSelect={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Hromadný e-mail" });
    vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({
      bottom: 48,
      height: 40,
      left: 12,
      right: 100,
      top: 8,
      width: 88,
      x: 12,
      y: 8,
      toJSON: () => ({}),
    });

    fireEvent.click(trigger);

    expect(screen.getByRole("menu")).toHaveStyle({ left: "8px" });
    expect(screen.getByRole("menu")).toHaveClass(
      "max-w-[calc(100vw-1rem)]",
    );
    viewportSpy.mockRestore();
  });
});

describe("PipelineBulkEmailConfirmationModal", () => {
  it("zobrazuje To, BCC příjemce, vynechané karty a tooltipy tlačítek", () => {
    const recipient = createBid({
      id: "recipient",
      companyName: "Platný dodavatel",
      email: "valid@example.com",
    });
    const missing = createBid({
      id: "missing",
      companyName: "Bez emailu",
      email: "",
    });
    const invalid = createBid({
      id: "invalid",
      companyName: "Neplatný email",
      email: "invalid",
    });
    const selection: PipelineEmailRecipientSelection = {
      candidateBids: [recipient, missing, invalid],
      recipientBids: [recipient],
      missingEmailBids: [missing],
      invalidEmailBids: [invalid],
      emails: ["valid@example.com"],
    };
    const onConfirm = vi.fn();

    render(
      <PipelineBulkEmailConfirmationModal
        isOpen
        kind="inquiry"
        userEmail="sender@example.com"
        selection={selection}
        isSubmitting={false}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText("sender@example.com")).toBeInTheDocument();
    expect(screen.getByText("1 unikátních adres")).toBeInTheDocument();
    expect(screen.getByText("Platný dodavatel")).toBeInTheDocument();
    expect(screen.getByText("Vynecháno – chybí email (1)")).toBeInTheDocument();
    expect(screen.getByText("Vynecháno – neplatný email (1)")).toBeInTheDocument();

    const cancel = screen.getByRole("button", { name: "Zrušit" });
    const confirm = screen.getByRole("button", {
      name: "Vytvořit koncept (1)",
    });
    expect(cancel).toHaveAttribute(
      "title",
      "Zavřít dialog bez vytvoření e-mailového konceptu",
    );
    expect(confirm).toHaveAttribute(
      "title",
      "Vytvořit koncept se 1 skrytými příjemci",
    );

    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
