import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppEntry } from "@/components/providers/AppProviders";

const state = vi.hoisted(() => ({
  auth: { isAuthenticated: false, isLoading: false, user: null, logout: vi.fn(), updatePreferences: vi.fn() },
  features: { currentPlan: "enterprise", isLoading: false, refetchFeatures: vi.fn() },
  location: { pathname: "/", search: "" },
  isDesktop: false,
  loadedInternal: vi.fn(),
  publicTheme: vi.fn(),
  readSettings: vi.fn(),
}));
vi.mock("@/services/dbAdapter", () => ({
  dbAdapter: {
    from: () => {
      state.readSettings();
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) };
    },
  },
}));
vi.mock("@infra/diagnostics/incidentLogger", () => ({ setIncidentContext: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => state.auth }));
vi.mock("@/context/FeatureContext", () => ({ useFeatures: () => state.features }));
vi.mock("@/hooks/useDesktop", () => ({ useDesktop: () => ({ isDesktop: state.isDesktop }) }));
vi.mock("@/hooks/useTheme", () => ({ useTheme: () => state.publicTheme() }));
vi.mock("@shared/routing/router", () => ({ useLocation: () => state.location }));
vi.mock("@shared/routing/ShortUrlRedirect", () => ({ ShortUrlRedirect: ({ code }: { code: string }) => <div>short:{code}</div> }));
vi.mock("@app/views/AuthGate", () => ({ AuthGate: ({ pathname, search, isDesktop }: { pathname: string; search: string; isDesktop: boolean }) => <div>public:{pathname}{search}:{String(isDesktop)}</div> }));
vi.mock("@app/views/AppLoadingView", () => ({ AppLoadingView: () => <div>loading</div> }));
vi.mock("@app/views/LazyViewErrorBoundary", () => ({ LazyViewErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@app/views/LegalPageRouter", () => ({ getLegalPage: (pathname: string) => pathname === "/terms" ? <div>terms</div> : null }));
vi.mock("@app/AuthenticatedApp", () => {
  state.loadedInternal();
  return { default: () => <div>authenticated app with existing legal gate</div> };
});

beforeEach(() => {
  state.features.currentPlan = "enterprise";
  state.features.isLoading = false;
  state.auth.isAuthenticated = false;
  state.auth.isLoading = false;
  state.location = { pathname: "/", search: "" };
  state.isDesktop = false;
  state.publicTheme.mockClear();
  state.readSettings.mockClear();
  window.localStorage.clear();
});

describe("AppEntry", () => {
  it("renders public routes without loading the internal application", () => {
    render(<AppEntry />);
    expect(screen.getByText("public:/:false")).toBeInTheDocument();
    expect(state.loadedInternal).not.toHaveBeenCalled();
    expect(state.readSettings).not.toHaveBeenCalled();
  });
  it("waits for the auth session before redirecting a protected deep link", () => {
    state.auth.isLoading = true;
    state.location = { pathname: "/app/todo", search: "?taskId=task-1" };
    const view = render(<AppEntry />);
    expect(screen.getByText("loading")).toBeInTheDocument();
    state.auth.isLoading = false;
    view.rerender(<AppEntry />);
    expect(screen.getByText("public:/app/todo?taskId=task-1:false")).toBeInTheDocument();
    expect(state.loadedInternal).not.toHaveBeenCalled();
    expect(state.readSettings).not.toHaveBeenCalled();
  });
  it("preserves desktop login routing and the original next query", () => {
    state.isDesktop = true;
    state.location = { pathname: "/login", search: "?next=%2Fapp%2Ftodo%3FtaskId%3Dtask-1" };
    render(<AppEntry />);
    expect(screen.getByText("public:/login?next=%2Fapp%2Ftodo%3FtaskId%3Dtask-1:true")).toBeInTheDocument();
  });
  it("keeps legal documents and short links outside the internal application", () => {
    state.auth.isAuthenticated = true;
    state.location = { pathname: "/terms", search: "" };
    const view = render(<AppEntry />);
    expect(screen.getByText("terms")).toBeInTheDocument();
    state.location = { pathname: "/s/abc", search: "" };
    view.rerender(<AppEntry />);
    expect(screen.getByText("short:abc")).toBeInTheDocument();
    expect(state.loadedInternal).not.toHaveBeenCalled();
    expect(state.readSettings).not.toHaveBeenCalled();
  });
  it.each([false, true])("blocks an account without a subscription before loading work data (desktop=%s)", async (desktop) => {
    state.auth.isAuthenticated = true;
    state.isDesktop = desktop;
    state.features.currentPlan = "free";
    state.location = { pathname: "/app/projects", search: "" };
    render(<AppEntry />);
    expect(await screen.findByRole("heading", { name: "Předplatné není aktivní" })).toBeInTheDocument();
    expect(state.loadedInternal).not.toHaveBeenCalled();
    expect(state.readSettings).not.toHaveBeenCalled();
    screen.getByRole("button", { name: "Odhlásit se" }).click();
    expect(state.auth.logout).toHaveBeenCalled();
    await act(async () => { screen.getByRole("button", { name: "Znovu ověřit předplatné" }).click(); });
    expect(state.features.refetchFeatures).toHaveBeenCalled();
  });
  it("waits for verified entitlements before loading the internal application", () => {
    state.auth.isAuthenticated = true;
    state.features.isLoading = true;
    render(<AppEntry />);
    expect(screen.getByText("loading")).toBeInTheDocument();
    expect(state.loadedInternal).not.toHaveBeenCalled();
  });
  it("loads internal guards after authentication and unmounts them on logout", async () => {
    const view = render(<AppEntry />);
    state.publicTheme.mockClear();
    state.auth.isAuthenticated = true;
    await act(async () => { view.rerender(<AppEntry />); });
    await waitFor(() => expect(screen.getByText("authenticated app with existing legal gate")).toBeInTheDocument());
    expect(state.loadedInternal).toHaveBeenCalledOnce();
    expect(state.publicTheme).not.toHaveBeenCalled();
    state.features.currentPlan = "free";
    view.rerender(<AppEntry />);
    expect(screen.getByRole("heading", { name: "Předplatné není aktivní" })).toBeInTheDocument();
    expect(screen.queryByText("authenticated app with existing legal gate")).not.toBeInTheDocument();
    state.features.currentPlan = "enterprise";
    await act(async () => { view.rerender(<AppEntry />); });
    expect(screen.getByText("authenticated app with existing legal gate")).toBeInTheDocument();
    state.readSettings.mockClear();
    state.auth.isAuthenticated = false;
    view.rerender(<AppEntry />);
    expect(state.readSettings).not.toHaveBeenCalled();
    expect(screen.queryByText("authenticated app with existing legal gate")).not.toBeInTheDocument();
    expect(screen.getByText("public:/:false")).toBeInTheDocument();
  });
  it.each(["essential_only", "accepted_all"])("does not read analytics configuration after %s consent and session changes", async (decision) => {
    window.localStorage.setItem("tf_cookie_consent_v1", decision);
    const view = render(<AppEntry />);
    state.auth.isAuthenticated = true;
    await act(async () => { view.rerender(<AppEntry />); });
    window.dispatchEvent(new CustomEvent("tf:cookie-consent-change", { detail: decision }));
    state.auth.isAuthenticated = false;
    view.rerender(<AppEntry />);
    expect(state.readSettings).not.toHaveBeenCalled();
  });
});
