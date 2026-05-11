/* @vitest-environment jsdom */

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOAuthRedirectUrl, McpOAuthConsentPage } from "@/app/views/McpOAuthConsentPage";

const oauthMocks = vi.hoisted(() => ({
  getAuthorizationDetails: vi.fn(),
  approveAuthorization: vi.fn(),
  denyAuthorization: vi.fn(),
}));

vi.mock("@/components/layouts/AuthLayout", () => ({
  AuthLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

vi.mock("@/infra/auth/mcpOAuthConsentService", () => ({
  getMcpOAuthAuthorizationDetails: oauthMocks.getAuthorizationDetails,
  approveMcpOAuthAuthorization: oauthMocks.approveAuthorization,
  denyMcpOAuthAuthorization: oauthMocks.denyAuthorization,
}));

describe("McpOAuthConsentPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, "", "/oauth/consent?authorization_id=auth-1");
    oauthMocks.getAuthorizationDetails.mockResolvedValue({
      data: {
        authorization_id: "auth-1",
        client: {
          client_id: "client-1",
          name: "ChatGPT",
          uri: "https://chatgpt.com",
        },
        scope: "openid email profile",
      },
      error: null,
    });
    oauthMocks.approveAuthorization.mockResolvedValue({ data: {}, error: null });
    oauthMocks.denyAuthorization.mockResolvedValue({ data: {}, error: null });
  });

  it("načte authorization details a ukáže klienta, scope a MCP zápisové riziko", async () => {
    render(<McpOAuthConsentPage />);

    expect(await screen.findByText("ChatGPT")).toBeInTheDocument();
    expect(screen.getByText("https://chatgpt.com")).toBeInTheDocument();
    expect(screen.getByText("- ověření identity")).toBeInTheDocument();
    expect(screen.getByText("- e-mail uživatele")).toBeInTheDocument();
    expect(screen.getByText("- základní profil")).toBeInTheDocument();
    expect(screen.getByText(/Zápisy v Tender Flow vyžadují/)).toBeInTheDocument();
    expect(oauthMocks.getAuthorizationDetails).toHaveBeenCalledWith("auth-1");
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
