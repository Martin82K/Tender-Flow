/* @vitest-environment jsdom */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpAccessSettings } from "@/features/settings/McpAccessSettings";

const grantMocks = vi.hoisted(() => ({
  list: vi.fn(),
  set: vi.fn(),
}));

vi.mock("@/features/settings/api/mcpGrantService", () => ({
  listMyMcpClientGrants: grantMocks.list,
  setMyMcpClientGrant: grantMocks.set,
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
  });

  it("shows baseline read and grants contacts through the exact client-bound RPC", async () => {
    render(<McpAccessSettings />);

    expect(await screen.findByText("ChatGPT Tender Flow")).toBeInTheDocument();
    expect(screen.getByText("Základní čtení aktivní")).toBeInTheDocument();

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
});
