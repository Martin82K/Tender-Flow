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
    expect(screen.getByRole("heading", { name: "Přehled dostupných nástrojů" })).toBeInTheDocument();
    expect(screen.getByText("tf_list_projects")).toBeInTheDocument();
    expect(screen.getByText("tf_list_contacts")).toBeInTheDocument();
    expect(screen.getByText("tf_execute_change")).toBeInTheDocument();
    expect(screen.getByText("10 z 17 aktivních")).toBeInTheDocument();
    expect(screen.getAllByText("Aktivní").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Vyžaduje kontaktní údaje").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Vyžaduje zápis").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Povolit kontaktní údaje" }));
    await waitFor(() => {
      expect(grantMocks.set).toHaveBeenCalledWith(
        "client-1",
        "tenderflow.contacts.read",
        true,
      );
    });
  });

  it("requires a second explicit confirmation before the eight-hour write grant", async () => {
    render(<McpAccessSettings />);
    await screen.findByText("ChatGPT Tender Flow");

    fireEvent.click(screen.getByRole("button", { name: "Povolit zápis" }));
    expect(grantMocks.set).not.toHaveBeenCalled();
    expect(screen.getByText(/Každý zápis stále vyžaduje prepare\/confirm\/execute/)).toBeInTheDocument();

    grantMocks.set.mockResolvedValueOnce({
      permission: "tenderflow.write",
      enabled: true,
      expiresAt: "2026-08-09T08:00:00Z",
    });
    fireEvent.click(screen.getByRole("button", { name: "Potvrdit zápis na 8 hodin" }));

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
      writeExpiresAt: "2099-08-09T08:00:00Z",
    }]);

    render(<McpAccessSettings />);

    expect(await screen.findByText("17 z 17 aktivních")).toBeInTheDocument();
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
      }, {
        clientId: "active-client",
        clientName: "ChatGPT Tender Flow 2",
        clientUri: "https://chatgpt.com",
        contactsReadExpiresAt: "2026-09-08T00:00:00Z",
        writeExpiresAt: null,
      }])
      .mockResolvedValueOnce([{
        clientId: "active-client",
        clientName: "ChatGPT Tender Flow 2",
        clientUri: "https://chatgpt.com",
        contactsReadExpiresAt: "2026-09-08T00:00:00Z",
        writeExpiresAt: null,
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
});
