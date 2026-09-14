import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BidCard } from "@features/projects/pipeline";
import type { Bid, ContactPerson } from "@/types";

const bid: Bid = { id: "bid", subcontractorId: "sub", companyName: "Firma", contactPerson: "Jan", email: "jan@example.com", status: "contacted" };
const contacts: ContactPerson[] = [
  { id: "jan", name: "Jan", email: "jan@example.com", phone: "111" },
  { id: "eva", name: "Eva", email: "eva@example.com", phone: "222", position: "Rozpočtářka" },
  { id: "none", name: "Bez mailu", email: "-", phone: "" },
];
const props = { bid, contacts, onDragStart: vi.fn(), onEdit: vi.fn(), onGenerateInquiry: vi.fn(), onGenerateMaterialInquiry: vi.fn() };

describe("recipient on a bid card", () => {
  it("selects a contact with its role and email without opening or dragging the card", async () => {
    const onSelectRecipient = vi.fn().mockResolvedValue(undefined);
    const onDoubleClick = vi.fn();
    render(<BidCard {...props} onSelectRecipient={onSelectRecipient} onDoubleClick={onDoubleClick} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Příjemce poptávky" }));
    const option = screen.getByRole("option", { name: /Eva.*Rozpočtářka.*eva@example.com/ });
    fireEvent.doubleClick(option);
    fireEvent.click(option);
    await waitFor(() => expect(onSelectRecipient).toHaveBeenCalledWith(bid.id, "eva"));
    expect(onDoubleClick).not.toHaveBeenCalled();
  });
  it("keeps the old recipient and reports a failed save", async () => {
    render(<BidCard {...props} onSelectRecipient={vi.fn().mockRejectedValue(new Error("denied"))} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Příjemce poptávky" }));
    fireEvent.click(screen.getByRole("option", { name: /Eva.*eva@example.com/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Příjemce se nepodařilo uložit");
    expect(screen.getByRole("combobox", { name: "Příjemce poptávky" })).toHaveTextContent("jan@example.com");
  });
  it("blocks both kinds of inquiry while saving", async () => {
    let finish!: () => void;
    const saving = new Promise<void>(resolve => { finish = resolve; });
    render(<BidCard {...props} onSelectRecipient={() => saving} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Příjemce poptávky" }));
    fireEvent.click(screen.getByRole("option", { name: /Eva.*eva@example.com/ }));
    expect(screen.getByRole("button", { name: /Generovat poptávku/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Materiálová poptávka/ })).toBeDisabled();
    await act(async () => { finish(); await saving; });
  });
  it("disables contacts without email and explains how to fix the missing recipient", () => {
    render(<BidCard {...props} bid={{ ...bid, email: "-" }} onSelectRecipient={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Generovat poptávku/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("combobox", { name: "Příjemce poptávky" }));
    expect(screen.getByRole("option", { name: /Bez mailu.*Doplňte e-mail/ })).toBeDisabled();
  });
  it("disables recipient selection until template generation finishes", async () => {
    let finish!: () => void;
    const pending = new Promise<void>(resolve => { finish = resolve; });
    render(<BidCard {...props} onSelectRecipient={vi.fn()} onGenerateInquiry={() => pending} />);
    fireEvent.click(screen.getByRole("button", { name: /Generovat poptávku/ }));
    expect(screen.getByRole("combobox", { name: "Příjemce poptávky" })).toBeDisabled();
    await act(async () => { finish(); await pending; });
    expect(screen.getByRole("combobox", { name: "Příjemce poptávky" })).not.toBeDisabled();
  });
  it("blocks an unconfirmed recipient but lets the user retry selection", () => {
    render(<BidCard {...props} onSelectRecipient={vi.fn()} recipientUnconfirmed />);
    expect(screen.getByRole("button", { name: /Generovat poptávku/ })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Příjemce poptávky" })).not.toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Příjemce není ověřený");
  });

  it("preserves a manually saved recipient which is absent from the directory", () => {
    render(<BidCard {...props} bid={{ ...bid, contactPerson: "Externí", email: "custom@example.com" }} onSelectRecipient={vi.fn()} />);
    expect(screen.getByRole("combobox", { name: "Příjemce poptávky" })).toHaveTextContent("custom@example.com");
  });
});
