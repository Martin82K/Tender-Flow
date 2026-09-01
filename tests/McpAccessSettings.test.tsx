/* @vitest-environment jsdom */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpAccessSettings } from "@/features/settings/McpAccessSettings";

const grantMocks = vi.hoisted(() => ({
  list: vi.fn(),
  set: vi.fn(),
  revoke: vi.fn(),
}));

vi.mock("@/features/settings/api/mcpGrantService", () => ({
  listMyMcpClientGrants: grantMocks.list,
  setMyMcpClientGrant: grantMocks.set,
  revokeMyMcpClientAccess: grantMocks.revoke,
}));

describe("McpAccessSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    grantMocks.list.mockResolvedValue([{
      clientId: "client-1",
      clientName: "ChatGPT Tender Flow",
      clientUri: "https://chatgpt.com",
      contactsReadExpiresAt: null,
      writeExpiresAt: null,
      bidOfferWriteExpiresAt: null,
    }]);
    grantMocks.set.mockResolvedValue({
      permission: "tenderflow.contacts.read",
      enabled: true,
      expiresAt: "2026-09-08T00:00:00Z",
    });
    grantMocks.revoke.mockResolvedValue(undefined);
  });

  it("shows baseline read and grants contacts through the exact client-bound RPC", async () => {
    render(<McpAccessSettings />);

    expect(await screen.findByText("ChatGPT Tender Flow")).toBeInTheDocument();
    expect(screen.getByText("Základní čtení aktivní")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Skupiny oprávnění" })).toBeInTheDocument();
    expect(screen.getByText("Základní čtení")).toBeInTheDocument();
    expect(screen.getByText("Kontaktní a dodavatelská data")).toBeInTheDocument();
    expect(screen.getAllByText("Zápisové operace")).toHaveLength(2);
    expect(screen.queryByText(/Úkoly, kanban a ceny/)).not.toBeInTheDocument();
    expect(screen.getByText("Vyžaduje kontaktní údaje")).toBeInTheDocument();
    expect(screen.getByText("Vyžaduje zápis")).toBeInTheDocument();
    expect(screen.getByText("Vyžaduje zápis i finanční oprávnění")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Povolit kontaktní údaje" }));
    await waitFor(() => {
      expect(grantMocks.set).toHaveBeenCalledWith(
        "client-1",
        "tenderflow.contacts.read",
        true,
      );
    });
  });

  it("requires a second explicit confirmation before a write grant valid until revoked", async () => {
    render(<McpAccessSettings />);
    await screen.findByText("ChatGPT Tender Flow");

    fireEvent.click(screen.getByRole("button", { name: "Povolit zápis" }));
    expect(grantMocks.set).not.toHaveBeenCalled();
    expect(screen.getByText(/Rizikové změny stále vyžadují prepare\/confirm\/execute/)).toBeInTheDocument();
    expect(screen.getByText(/Outlook message ID se propojuje přímo/)).toBeInTheDocument();

    grantMocks.set.mockResolvedValueOnce({
      permission: "tenderflow.write",
      enabled: true,
      expiresAt: "infinity",
    });
    fireEvent.click(screen.getByRole("button", { name: "Potvrdit zápis do odvolání" }));

    await waitFor(() => {
      expect(grantMocks.set).toHaveBeenCalledWith(
        "client-1",
        "tenderflow.write",
        true,
      );
    });
  });

  it("promítne aktivní kontaktní a zápisový grant do celé matice", async () => {
    grantMocks.list.mockResolvedValueOnce([{
      clientId: "client-1",
      clientName: "ChatGPT Tender Flow",
      clientUri: "https://chatgpt.com",
      contactsReadExpiresAt: "2099-09-08T00:00:00Z",
      writeExpiresAt: "infinity",
      bidOfferWriteExpiresAt: "infinity",
    }]);

    render(<McpAccessSettings />);

    expect(await screen.findByText("Zápisové operace povoleny")).toBeInTheDocument();
    expect(screen.getByText("Finanční zápis povolen")).toBeInTheDocument();
    expect(screen.getAllByText("Platí do odvolání")).toHaveLength(2);
    expect(screen.queryByText("Vyžaduje kontaktní údaje")).not.toBeInTheDocument();
    expect(screen.queryByText("Vyžaduje zápis")).not.toBeInTheDocument();
  });

  it("requires confirmation and revokes only the selected OAuth client", async () => {
    grantMocks.list
      .mockResolvedValueOnce([{
        clientId: "old-client",
        clientName: "ChatGPT Tender Flow",
        clientUri: "https://chatgpt.com",
        contactsReadExpiresAt: "2026-09-08T00:00:00Z",
        writeExpiresAt: null,
        bidOfferWriteExpiresAt: null,
      }, {
        clientId: "active-client",
        clientName: "ChatGPT Tender Flow 2",
        clientUri: "https://chatgpt.com",
        contactsReadExpiresAt: "2026-09-08T00:00:00Z",
        writeExpiresAt: null,
        bidOfferWriteExpiresAt: null,
      }])
      .mockResolvedValueOnce([{
        clientId: "active-client",
        clientName: "ChatGPT Tender Flow 2",
        clientUri: "https://chatgpt.com",
        contactsReadExpiresAt: "2026-09-08T00:00:00Z",
        writeExpiresAt: null,
        bidOfferWriteExpiresAt: null,
      }]);

    render(<McpAccessSettings />);
    await screen.findByText("ChatGPT Tender Flow 2");

    const disconnectButtons = screen.getAllByRole("button", { name: "Odpojit klienta" });
    fireEvent.click(disconnectButtons[0]);
    expect(grantMocks.revoke).not.toHaveBeenCalled();
    expect(screen.getByText(/zneplatní jeho aktivní relace a obnovovací tokeny/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Potvrdit odpojení" }));

    await waitFor(() => {
      expect(grantMocks.revoke).toHaveBeenCalledWith("old-client");
      expect(screen.queryByText("ChatGPT Tender Flow", { exact: true })).not.toBeInTheDocument();
    });
    expect(screen.getByText("ChatGPT Tender Flow 2")).toBeInTheDocument();
  });

  it("requires a separate explicit financial grant for bid offer prices", async () => {
    grantMocks.list.mockResolvedValueOnce([{
      clientId: "client-1",
      clientName: "ChatGPT Tender Flow",
      clientUri: "https://chatgpt.com",
      contactsReadExpiresAt: null,
      writeExpiresAt: "infinity",
      bidOfferWriteExpiresAt: null,
    }]);

    render(<McpAccessSettings />);
    await screen.findByText("ChatGPT Tender Flow");

    fireEvent.click(screen.getByRole("button", { name: "Povolit finanční zápis" }));
    expect(grantMocks.set).not.toHaveBeenCalled();
    expect(screen.getByText(/Agent může zapisovat finanční hodnotu bez DPH/)).toBeInTheDocument();

    grantMocks.set.mockResolvedValueOnce({
      permission: "tenderflow.bids.offer.write",
      enabled: true,
      expiresAt: "infinity",
    });
    fireEvent.click(screen.getByRole("button", { name: "Potvrdit finanční zápis" }));

    await waitFor(() => {
      expect(grantMocks.set).toHaveBeenCalledWith(
        "client-1",
        "tenderflow.bids.offer.write",
        true,
      );
    });
  });
});
