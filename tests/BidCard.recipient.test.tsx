import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BidCard } from "@features/projects/pipeline";
import type { Bid, ContactPerson } from "@/types";

const bid: Bid = { id: "bid", subcontractorId: "sub", companyName: "Firma", contactPerson: "Jan", email: "jan@example.com", phone: "111", status: "contacted" };
const contacts: ContactPerson[] = [
  { id: "jan", name: "Jan", email: "jan@example.com", phone: "111" },
  { id: "eva", name: "Eva", email: "eva@example.com", phone: "222", position: "Rozpočtářka" },
  { id: "none", name: "Bez mailu", email: "-", phone: "" },
];
const props = { bid, contacts, onDragStart: vi.fn(), onEdit: vi.fn(), onGenerateInquiry: vi.fn(), onGenerateMaterialInquiry: vi.fn() };

describe("recipient on a bid card", () => {
  it("selects a contact with its name, email and phone without opening or dragging the card", async () => {
    const onSelectRecipient = vi.fn().mockResolvedValue(undefined);
    const onDoubleClick = vi.fn();
    render(<BidCard {...props} onSelectRecipient={onSelectRecipient} onDoubleClick={onDoubleClick} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Příjemce poptávky" }));
    const option = screen.getByRole("option", { name: /Eva.*eva@example.com.*222/ });
    fireEvent.doubleClick(option);
    fireEvent.click(option);
    await waitFor(() => expect(onSelectRecipient).toHaveBeenCalledWith(bid.id, "eva"));
    expect(onDoubleClick).not.toHaveBeenCalled();
  });
  it("renders a single recipient directly without an edit link, role or menu", () => {
    render(<BidCard {...props} contacts={[{ ...contacts[0], position: "OZ" }]} onSelectRecipient={vi.fn()} />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByText("Upravit kontakt na kartě")).not.toBeInTheDocument();
    expect(screen.queryByText(/Hlavní|OZ/)).not.toBeInTheDocument();
    expect(screen.getByText("Jan")).toBeVisible();
    expect(screen.getByText("jan@example.com")).toBeVisible();
    expect(screen.getByText("111")).toBeVisible();
  });
  it("lets a static recipient open and drag its card", () => {
    const onDoubleClick = vi.fn();
    const onDragStart = vi.fn();
    render(<BidCard {...props} contacts={[contacts[0]]} onSelectRecipient={vi.fn()} onDoubleClick={onDoubleClick} onDragStart={onDragStart} />);
    fireEvent.doubleClick(screen.getByText("jan@example.com"));
    expect(onDoubleClick).toHaveBeenCalledWith(bid);
    fireEvent.dragStart(screen.getByText("111"));
    expect(onDragStart).toHaveBeenCalledWith(expect.anything(), bid.id);
  });
  it("updates all recipient details together and clears a missing phone", async () => {
    const select = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<BidCard {...props} onSelectRecipient={select} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("111");
    fireEvent.click(screen.getByRole("combobox"));
    expect(screen.queryByText(/Hlavní|Rozpočtářka/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: /Eva.*eva@example.com.*222/ }));
    await waitFor(() => expect(select).toHaveBeenCalledWith("bid", "eva"));
    rerender(<BidCard {...props} bid={{ ...bid, contactPerson: "Eva", email: "eva@example.com", phone: "222" }} onSelectRecipient={select} />);
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveTextContent("Eva");
    expect(trigger).toHaveTextContent("eva@example.com");
    expect(within(trigger).getByText("222")).toBeVisible();
    expect(screen.queryByText("111")).not.toBeInTheDocument();
    rerender(<BidCard {...props} bid={{ ...bid, contactPerson: "Eva", email: "eva@example.com", phone: "" }} onSelectRecipient={select} />);
    expect(screen.getByRole("combobox")).not.toHaveTextContent("222");
  });
  it("shows a saved recipient without inventing a name or a dropdown", () => {
    render(<BidCard {...props} contacts={[]} bid={{ ...bid, contactPerson: "-", phone: "-" }} onSelectRecipient={vi.fn()} />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("jan@example.com")).toBeVisible();
    expect(screen.queryByText("-")).not.toBeInTheDocument();
  });
  it("can adopt the only available contact on a legacy card without a menu", async () => {
    const select = vi.fn().mockResolvedValue(undefined);
    render(<BidCard {...props} bid={{ ...bid, email: "" }} contacts={[contacts[0]]} onSelectRecipient={select} />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Generovat poptávku/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Použít tohoto příjemce" }));
    await waitFor(() => expect(select).toHaveBeenCalledWith("bid", "jan"));
  });
  it("supports keyboard selection and escape without editing the card", async () => {
    const select = vi.fn().mockResolvedValue(undefined);
    render(<BidCard {...props} onSelectRecipient={select} />);
    const trigger = screen.getByRole("combobox");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    await waitFor(() => expect(select).toHaveBeenCalledWith("bid", "eva"));
  });
  it("keeps the old recipient and reports a failed save", async () => {
    render(<BidCard {...props} onSelectRecipient={vi.fn().mockRejectedValue(new Error("denied"))} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Příjemce poptávky" }));
    fireEvent.click(screen.getByRole("option", { name: /Eva.*eva@example.com/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Volbu se nepodařilo zapamatovat");
    expect(screen.getByRole("combobox", { name: "Příjemce poptávky" })).toHaveTextContent("jan@example.com");
  });
  it("keeps inquiry generation available while remembering the recipient", async () => {
    let finish!: () => void;
    const saving = new Promise<void>(resolve => { finish = resolve; });
    render(<BidCard {...props} onSelectRecipient={() => saving} />);
    fireEvent.click(screen.getByRole("combobox", { name: "Příjemce poptávky" }));
    fireEvent.click(screen.getByRole("option", { name: /Eva.*eva@example.com/ }));
    expect(screen.getByRole("button", { name: /Generovat poptávku/ })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /Materiálová poptávka/ })).not.toBeDisabled();
    await act(async () => { finish(); await saving; });
  });
  it("disables contacts without email and explains how to fix the missing recipient", () => {
    render(<BidCard {...props} bid={{ ...bid, email: "-" }} onSelectRecipient={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Generovat poptávku/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("combobox", { name: "Příjemce poptávky" }));
    expect(screen.getByRole("option", { name: /Bez mailu.*Doplňte e-mail/ })).toBeDisabled();
  });
  it("allows changing the next recipient during template generation", async () => {
    let finish!: () => void;
    const pending = new Promise<void>(resolve => { finish = resolve; });
    render(<BidCard {...props} onSelectRecipient={vi.fn()} onGenerateInquiry={() => pending} />);
    fireEvent.click(screen.getByRole("button", { name: /Generovat poptávku/ }));
    expect(screen.getByRole("combobox", { name: "Příjemce poptávky" })).not.toBeDisabled();
    await act(async () => { finish(); await pending; });
    expect(screen.getByRole("combobox", { name: "Příjemce poptávky" })).not.toBeDisabled();
  });
  it("preserves a manually saved recipient which is absent from the directory", () => {
    render(<BidCard {...props} bid={{ ...bid, contactPerson: "Externí", email: "custom@example.com" }} onSelectRecipient={vi.fn()} />);
    expect(screen.getByRole("combobox", { name: "Příjemce poptávky" })).toHaveTextContent("custom@example.com");
  });
});
