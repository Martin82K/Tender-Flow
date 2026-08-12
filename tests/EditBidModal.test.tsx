import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EditBidModal } from "@features/projects/pipeline";
import type { Bid, StatusConfig, Subcontractor } from "@/types";

const bid: Bid = {
  id: "bid-1",
  subcontractorId: "supplier-1",
  companyName: "Dodavatel s.r.o.",
  contactPerson: "Původní kontakt",
  email: "kontakt@example.com",
  phone: "123456789",
  price: "?",
  priceHistory: { 1: "2 000 000 Kč" },
  selectionRound: 1,
  status: "offer",
};

const subcontractor: Subcontractor = {
  id: "supplier-1",
  company: "Dodavatel s.r.o.",
  specialization: ["Elektro"],
  status: "available",
  contacts: [
    {
      id: "contact-1",
      name: "Nový kontakt",
      email: "novy@example.com",
      phone: "987654321",
      position: "Jednatel",
    },
  ],
};

const statuses: StatusConfig[] = [
  { id: "available", label: "Dostupný", color: "green" },
  { id: "busy", label: "Vytížený", color: "yellow" },
];

describe("EditBidModal", () => {
  it("zachová cenu vybraného kola a odešle upravenou nabídku", () => {
    const onSave = vi.fn();

    render(
      <EditBidModal bid={bid} onClose={vi.fn()} onSave={onSave} />,
    );

    const priceInput = screen.getByPlaceholderText("1 500 000");
    expect((priceInput as HTMLInputElement).value.replace(/\s/g, " ")).toBe(
      "2 000 000,00",
    );

    fireEvent.change(screen.getByPlaceholderText("Jméno a příjmení"), {
      target: { value: "Upravený kontakt" },
    });
    fireEvent.change(priceInput, { target: { value: "1 500 000" } });
    fireEvent.click(screen.getByRole("button", { name: "Uložit" }));

    const savedBid = onSave.mock.calls[0]?.[0] as Bid;
    expect(savedBid).toEqual(
      expect.objectContaining({
        id: "bid-1",
        contactPerson: "Upravený kontakt",
        selectionRound: 1,
      }),
    );
    expect(savedBid.price?.replace(/\s/g, " ")).toBe("1 500 000,00 Kč");
    expect(savedBid.priceHistory?.[1]?.replace(/\s/g, " ")).toBe(
      "1 500 000,00 Kč",
    );
  });

  it("zachová cancel a typovaný update dodavatele", () => {
    const onClose = vi.fn();
    const onUpdateSubcontractor = vi.fn();

    render(
      <EditBidModal
        bid={bid}
        subcontractor={subcontractor}
        statuses={statuses}
        onClose={onClose}
        onSave={vi.fn()}
        onUpdateSubcontractor={onUpdateSubcontractor}
      />,
    );

    fireEvent.change(screen.getByDisplayValue("Dostupný"), {
      target: { value: "busy" },
    });
    expect(onUpdateSubcontractor).toHaveBeenCalledWith("supplier-1", {
      status: "busy",
    });

    fireEvent.click(screen.getByRole("button", { name: "Zrušit" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
