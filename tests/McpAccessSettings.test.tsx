/* @vitest-environment jsdom */

import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { McpAccessSettings } from "@/features/settings/McpAccessSettings";
import type { McpClientGrant, McpElevatedPermission } from "@/features/settings/api/mcpGrantService";

const grantMocks = vi.hoisted(() => ({ list: vi.fn(), set: vi.fn(), revoke: vi.fn() }));
vi.mock("@/features/settings/api/mcpGrantService", () => ({
  listMyMcpClientGrants: grantMocks.list,
  setMyMcpClientGrant: grantMocks.set,
  revokeMyMcpClientAccess: grantMocks.revoke,
}));

const makeClient = (overrides: Partial<McpClientGrant> = {}): McpClientGrant => ({
  clientId: "client-1", clientName: "ChatGPT Tender Flow", clientUri: "https://chatgpt.com",
  contactsReadExpiresAt: null, writeExpiresAt: null, bidOfferWriteExpiresAt: null,
  ...overrides,
});
let clients: McpClientGrant[];

describe("McpAccessSettings", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    clients = [makeClient()];
    grantMocks.list.mockImplementation(async () => structuredClone(clients));
    grantMocks.set.mockImplementation(async (clientId: string, permission: McpElevatedPermission, enabled: boolean) => {
      const field = { "tenderflow.write": "writeExpiresAt", "tenderflow.contacts.read": "contactsReadExpiresAt", "tenderflow.bids.offer.write": "bidOfferWriteExpiresAt" }[permission];
      clients = clients.map((client) => client.clientId === clientId ? { ...client, [field]: enabled ? "infinity" : null } : client);
      return { permission, enabled, expiresAt: enabled ? "infinity" : null };
    });
    grantMocks.revoke.mockImplementation(async (clientId: string) => { clients = clients.filter((client) => client.clientId !== clientId); });
  });

  it("renders only three simple permission switches and saves a write toggle directly", async () => {
    render(<McpAccessSettings />);
    await screen.findByText("ChatGPT Tender Flow");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText("Skupiny oprávnění")).not.toBeInTheDocument();
    expect(screen.getAllByRole("switch")).toHaveLength(3);
    const write = screen.getByRole("switch", { name: "Zápisové operace" });
    expect(write).not.toBeChecked();
    expect(grantMocks.set).not.toHaveBeenCalled();
    fireEvent.click(write);
    await waitFor(() => expect(write).toBeChecked());
    expect(grantMocks.set).toHaveBeenCalledWith("client-1", "tenderflow.write", true);
    fireEvent.click(write);
    await waitFor(() => expect(write).not.toBeChecked());
    expect(grantMocks.set).toHaveBeenLastCalledWith("client-1", "tenderflow.write", false);
  });

  it("changes only the selected permission for the selected connection", async () => {
    clients.push(makeClient({ clientId: "client-2", clientName: "Druhá AI" }));
    render(<McpAccessSettings />);
    const second = (await screen.findByText("Druhá AI")).closest("article")!;
    fireEvent.click(within(second).getByRole("switch", { name: "Kontaktní údaje" }));
    await waitFor(() => expect(grantMocks.set).toHaveBeenCalledWith("client-2", "tenderflow.contacts.read", true));
    expect(grantMocks.set).toHaveBeenCalledTimes(1);
  });

  it("requires general write before separately enabling financial writes", async () => {
    render(<McpAccessSettings />);
    await screen.findByText("ChatGPT Tender Flow");
    const financial = screen.getByRole("switch", { name: "Zápis ceny nabídky" });
    expect(financial).toBeDisabled();
    fireEvent.click(screen.getByRole("switch", { name: "Zápisové operace" }));
    await waitFor(() => expect(financial).toBeEnabled());
    expect(financial).not.toBeChecked();
    fireEvent.click(financial);
    await waitFor(() => expect(financial).toBeChecked());
    expect(grantMocks.set).toHaveBeenLastCalledWith("client-1", "tenderflow.bids.offer.write", true);
  });

  it("allows revoking an active financial grant after general write was revoked", async () => {
    clients = [makeClient({ bidOfferWriteExpiresAt: "infinity" })];
    render(<McpAccessSettings />);
    const financial = await screen.findByRole("switch", { name: "Zápis ceny nabídky" });
    expect(financial).toBeEnabled();
    expect(financial).toBeChecked();
    fireEvent.click(financial);
    await waitFor(() => expect(grantMocks.set).toHaveBeenCalledWith("client-1", "tenderflow.bids.offer.write", false));
  });

  it("keeps the actual permission state and displays a rejected toggle", async () => {
    grantMocks.set.mockRejectedValueOnce(new Error("Uložení selhalo"));
    render(<McpAccessSettings />);
    const write = await screen.findByRole("switch", { name: "Zápisové operace" });
    fireEvent.click(write);
    expect(await screen.findByRole("alert")).toHaveTextContent("Uložení selhalo");
    expect(write).not.toBeChecked();
    expect(write).toBeEnabled();
  });

  it("disables toggles while a permission mutation is pending", async () => {
    let finish: (value: unknown) => void = () => {};
    grantMocks.set.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    render(<McpAccessSettings />);
    fireEvent.click(await screen.findByRole("switch", { name: "Zápisové operace" }));
    for (const toggle of screen.getAllByRole("switch")) expect(toggle).toBeDisabled();
    finish({ permission: "tenderflow.write", enabled: true, expiresAt: "infinity" });
    await waitFor(() => expect(screen.getByRole("switch", { name: "Zápisové operace" })).toBeEnabled());
  });

  it("requires confirmation and revokes only the selected OAuth client", async () => {
    clients.push(makeClient({ clientId: "client-2", clientName: "Druhá AI" }));
    render(<McpAccessSettings />);
    await screen.findByText("Druhá AI");
    fireEvent.click(screen.getAllByRole("button", { name: "Odpojit klienta" })[0]);
    expect(grantMocks.revoke).not.toHaveBeenCalled();
    expect(screen.getByText(/zneplatní jeho aktivní relace a obnovovací tokeny/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Potvrdit odpojení" }));
    await waitFor(() => expect(screen.queryByText("ChatGPT Tender Flow", { exact: true })).not.toBeInTheDocument());
    expect(grantMocks.revoke).toHaveBeenCalledWith("client-1");
    expect(screen.getByText("Druhá AI")).toBeInTheDocument();
  });
});
