/* @vitest-environment jsdom */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOAuthRedirectUrl, McpOAuthConsentPage } from "@/app/views/McpOAuthConsentPage";

const oauthMocks = vi.hoisted(() => ({
  getAuthorizationDetails: vi.fn(),
  approveAuthorization: vi.fn(),
  denyAuthorization: vi.fn(),
  setGrant: vi.fn(),
}));

const routerMocks = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("@/shared/routing/router", () => ({ navigate: routerMocks.navigate }));

vi.mock("@/components/layouts/AuthLayout", () => ({
  AuthLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

vi.mock("@/infra/auth/mcpOAuthConsentService", () => ({
  getMcpOAuthAuthorizationDetails: oauthMocks.getAuthorizationDetails,
  approveMcpOAuthAuthorization: oauthMocks.approveAuthorization,
  denyMcpOAuthAuthorization: oauthMocks.denyAuthorization,
}));

vi.mock("@/features/settings/api/mcpGrantService", () => ({
  setMyMcpClientGrant: oauthMocks.setGrant,
}));

describe("McpOAuthConsentPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, "", "/oauth/consent?authorization_id=auth-1");
    oauthMocks.getAuthorizationDetails.mockResolvedValue({
      data: {
        authorization_id: "auth-1",
        client: {
          id: "client-1",
          name: "ChatGPT",
          uri: "https://chatgpt.com",
        },
        scope: "openid email profile",
      },
      error: null,
    });
    oauthMocks.approveAuthorization.mockResolvedValue({ data: {}, error: null });
    oauthMocks.denyAuthorization.mockResolvedValue({ data: {}, error: null });
    oauthMocks.setGrant.mockImplementation(async (_client, permission) => ({
      permission, enabled: true, expiresAt: "infinity",
    }));
  });

  it("enables general write with the initial approval by default while leaving contacts and prices optional", async () => {
    oauthMocks.approveAuthorization.mockResolvedValue({ data: { redirect_to: "#connected" }, error: null });
    render(<McpOAuthConsentPage />);
    expect(await screen.findByRole("checkbox", { name: "Povolit zápisové operace" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Povolit kontaktní údaje na 180 dní" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Povolit zápis ceny nabídky" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Schválit přístup" }));
    await waitFor(() => expect(window.location.hash).toBe("#connected"));
    expect(oauthMocks.setGrant.mock.calls).toEqual([["client-1", "tenderflow.write", true]]);
  });

  it("supports legacy client_id metadata without using a client id from the URL", async () => {
    window.history.pushState({}, "", "/oauth/consent?authorization_id=auth-1&client_id=attacker");
    oauthMocks.getAuthorizationDetails.mockResolvedValue({ data: { authorization_id: "auth-1", client: { client_id: "legacy-client", name: "ChatGPT" } }, error: null });
    oauthMocks.approveAuthorization.mockResolvedValue({ data: { redirect_to: "#connected" }, error: null });
    render(<McpOAuthConsentPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Schválit přístup" }));
    await waitFor(() => expect(window.location.hash).toBe("#connected"));
    expect(oauthMocks.setGrant).toHaveBeenCalledWith("legacy-client", "tenderflow.write", true);
  });

  it("načte authorization details a oddělí OAuth identitu od základního MCP oprávnění", async () => {
    render(<McpOAuthConsentPage />);

    expect(await screen.findByText("ChatGPT")).toBeInTheDocument();
    expect(screen.getByText("https://chatgpt.com")).toBeInTheDocument();
    expect(screen.getByText("- ověření identity")).toBeInTheDocument();
    expect(screen.getByText("- e-mail uživatele")).toBeInTheDocument();
    expect(screen.getByText("- základní profil")).toBeInTheDocument();
    expect(screen.getByText(/čtení projektů, výběrových řízení, smluv, plánů a termínů/)).toBeInTheDocument();
    expect(screen.getByText(/Kontaktní údaje a zápis vyžadují váš samostatný souhlas/)).toBeInTheDocument();
    expect(screen.getByText(/Při novém připojení znovu vyberte i kontaktní a finanční oprávnění/)).toBeInTheDocument();
    expect(screen.queryByText(/Dříve udělená oprávnění tím neodeberete/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zobrazit správu MCP oprávnění" })).toHaveAttribute(
      "href",
      "/app/settings?tab=tools&subTab=mcp",
    );
    fireEvent.click(screen.getByRole("link", { name: "Zobrazit správu MCP oprávnění" }));
    expect(routerMocks.navigate).toHaveBeenCalledWith("/app/settings?tab=tools&subTab=mcp");
    expect(oauthMocks.getAuthorizationDetails).toHaveBeenCalledWith("auth-1");
  });

  it("podvržený vlastní OAuth scope nezmění consent na kontaktní nebo zápisový", async () => {
    oauthMocks.getAuthorizationDetails.mockResolvedValue({
      data: {
        authorization_id: "auth-1",
        client: { client_id: "client-1", name: "ChatGPT" },
        scope: "openid tenderflow.contacts.read tenderflow.write",
      },
      error: null,
    });

    render(<McpOAuthConsentPage />);

    expect(await screen.findByText(/Zápisové operace jsou předvolené a povolíte je schválením připojení/)).toBeInTheDocument();
    expect(screen.queryByText(/Každý zápis vyžaduje/)).not.toBeInTheDocument();
    expect(screen.queryByText(/čtení kontaktních údajů dodavatelů/)).not.toBeInTheDocument();
  });

  it("umí obnovit authorization_id z login next parametru po OAuth redirectu", async () => {
    window.history.pushState(
      {},
      "",
      `/login?next=${encodeURIComponent("/oauth/consent?authorization_id=auth-nested")}`,
    );

    render(<McpOAuthConsentPage />);

    expect(await screen.findByText("ChatGPT")).toBeInTheDocument();
    expect(oauthMocks.getAuthorizationDetails).toHaveBeenCalledWith("auth-nested");
  });

  it("schválení volá Supabase OAuth approve bez ukládání tokenů v aplikaci", async () => {
    render(<McpOAuthConsentPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Schválit přístup" }));

    await waitFor(() => {
      expect(oauthMocks.approveAuthorization).toHaveBeenCalledWith("auth-1");
    });
  });

  it("grants the selected client permission before redirect", async () => {
    oauthMocks.approveAuthorization.mockResolvedValue({ data: { redirect_to: "#connected" }, error: null });
    let finishGrant: (value: unknown) => void = () => {};
    oauthMocks.setGrant.mockReturnValueOnce(new Promise((resolve) => { finishGrant = resolve; }));
    render(<McpOAuthConsentPage />);

    const write = await screen.findByRole("checkbox", { name: "Povolit zápisové operace" });
    expect(write).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Povolit kontaktní údaje na 180 dní" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Povolit zápis ceny nabídky" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Schválit přístup" }));

    await waitFor(() => expect(oauthMocks.setGrant).toHaveBeenCalledWith("client-1", "tenderflow.write", true));
    expect(oauthMocks.approveAuthorization.mock.invocationCallOrder[0]).toBeLessThan(oauthMocks.setGrant.mock.invocationCallOrder[0]);
    expect(window.location.hash).toBe("");
    expect(write).toBeDisabled();
    finishGrant({ permission: "tenderflow.write", enabled: true, expiresAt: "infinity" });
    await waitFor(() => expect(window.location.hash).toBe("#connected"));
    expect(oauthMocks.setGrant).toHaveBeenCalledTimes(1);
  });

  it("retries a failed write grant without approving the consumed OAuth request again", async () => {
    oauthMocks.approveAuthorization.mockResolvedValue({ data: { redirect_to: "#connected" }, error: null });
    oauthMocks.setGrant.mockRejectedValueOnce(new Error("Dočasně nedostupné"));
    render(<McpOAuthConsentPage />);
    await screen.findByRole("checkbox", { name: "Povolit zápisové operace" });
    fireEvent.click(screen.getByRole("button", { name: "Schválit přístup" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Dočasně nedostupné");
    expect(window.location.hash).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Znovu uložit oprávnění" }));
    await waitFor(() => expect(window.location.hash).toBe("#connected"));
    expect(oauthMocks.approveAuthorization).toHaveBeenCalledTimes(1);
    expect(oauthMocks.setGrant).toHaveBeenCalledTimes(2);
  });

  it("does not grant anything when OAuth approval fails or the user denies access", async () => {
    oauthMocks.approveAuthorization.mockResolvedValue({ data: null, error: { message: "Schválení selhalo" } });
    render(<McpOAuthConsentPage />);
    await screen.findByRole("checkbox", { name: "Povolit zápisové operace" });
    fireEvent.click(screen.getByRole("button", { name: "Schválit přístup" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Schválení selhalo");
    expect(oauthMocks.setGrant).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Zamítnout" }));
    await waitFor(() => expect(oauthMocks.denyAuthorization).toHaveBeenCalledWith("auth-1"));
    expect(oauthMocks.setGrant).not.toHaveBeenCalled();
  });

  it("grants financial access only with separately selected general write access", async () => {
    oauthMocks.approveAuthorization.mockResolvedValue({ data: { redirect_to: "#connected" }, error: null });
    render(<McpOAuthConsentPage />);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Povolit kontaktní údaje na 180 dní" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Povolit zápis ceny nabídky" }));
    fireEvent.click(screen.getByRole("button", { name: "Schválit přístup" }));
    await waitFor(() => expect(window.location.hash).toBe("#connected"));
    expect(oauthMocks.setGrant.mock.calls).toEqual([
      ["client-1", "tenderflow.contacts.read", true],
      ["client-1", "tenderflow.write", true],
      ["client-1", "tenderflow.bids.offer.write", true],
    ]);
  });

  it("clears financial selection when general write is unchecked and preserves read-only consent", async () => {
    oauthMocks.approveAuthorization.mockResolvedValue({ data: { redirect_to: "#connected" }, error: null });
    render(<McpOAuthConsentPage />);
    const write = await screen.findByRole("checkbox", { name: "Povolit zápisové operace" });
    fireEvent.click(screen.getByRole("checkbox", { name: "Povolit zápis ceny nabídky" }));
    fireEvent.click(write);
    expect(screen.getByRole("checkbox", { name: "Povolit zápis ceny nabídky" })).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Schválit přístup" }));
    await waitFor(() => expect(window.location.hash).toBe("#connected"));
    expect(oauthMocks.setGrant).not.toHaveBeenCalled();
  });

  it("does not report a rejected grant result as successful consent", async () => {
    oauthMocks.approveAuthorization.mockResolvedValue({ data: { redirect_to: "#connected" }, error: null });
    oauthMocks.setGrant.mockResolvedValueOnce({ permission: "tenderflow.write", enabled: false, expiresAt: null });
    render(<McpOAuthConsentPage />);
    await screen.findByRole("checkbox", { name: "Povolit zápisové operace" });
    fireEvent.click(screen.getByRole("button", { name: "Schválit přístup" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Server nepotvrdil udělení vybraného oprávnění.");
    expect(window.location.hash).toBe("");
  });

  it("preferuje Supabase OAuth redirect_to a drží fallback na redirect_url", () => {
    expect(getOAuthRedirectUrl({ redirect_to: "https://chatgpt.com/callback?code=ok" })).toBe(
      "https://chatgpt.com/callback?code=ok",
    );
    expect(getOAuthRedirectUrl({ redirect_url: "https://chatgpt.com/legacy-callback?code=ok" })).toBe(
      "https://chatgpt.com/legacy-callback?code=ok",
    );
  });

  it("zamítnutí volá Supabase OAuth deny", async () => {
    render(<McpOAuthConsentPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Zamítnout" }));

    await waitFor(() => {
      expect(oauthMocks.denyAuthorization).toHaveBeenCalledWith("auth-1");
    });
  });

  it("fail-closed bez authorization_id", async () => {
    window.history.pushState({}, "", "/oauth/consent");

    render(<McpOAuthConsentPage />);

    expect(await screen.findByText("Chybí authorization_id pro OAuth schválení.")).toBeInTheDocument();
    expect(oauthMocks.getAuthorizationDetails).not.toHaveBeenCalled();
  });
});
