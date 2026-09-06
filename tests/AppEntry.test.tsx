import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppEntry } from "@/components/providers/AppProviders";

const state = vi.hoisted(() => ({
  auth: { isAuthenticated: false, isLoading: false, user: null, logout: vi.fn(), updatePreferences: vi.fn() },
  location: { pathname: "/", search: "" },
  isDesktop: false,
  loadedInternal: vi.fn(),
  publicTheme: vi.fn(),
  identity: vi.fn(),
}));
vi.mock("@app/hooks/usePosthogIdentity", () => ({ usePosthogIdentity: () => state.identity() }));
vi.mock("@infra/diagnostics/incidentLogger", () => ({ setIncidentContext: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => state.auth }));
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
  state.auth.isAuthenticated = false;
  state.auth.isLoading = false;
  state.location = { pathname: "/", search: "" };
  state.isDesktop = false;
  state.publicTheme.mockClear();
  state.identity.mockClear();
});

describe("AppEntry", () => {
  it("renders public routes without loading the internal application", () => {
    render(<AppEntry />);
    expect(screen.getByText("public:/:false")).toBeInTheDocument();
    expect(state.loadedInternal).not.toHaveBeenCalled();
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
  });
  it("loads internal guards after authentication and unmounts them on logout", async () => {
    const view = render(<AppEntry />);
    state.publicTheme.mockClear();
    state.auth.isAuthenticated = true;
    await act(async () => { view.rerender(<AppEntry />); });
    await waitFor(() => expect(screen.getByText("authenticated app with existing legal gate")).toBeInTheDocument());
    expect(state.loadedInternal).toHaveBeenCalledOnce();
    expect(state.publicTheme).not.toHaveBeenCalled();
    state.identity.mockClear();
    state.auth.isAuthenticated = false;
    view.rerender(<AppEntry />);
    expect(state.identity).toHaveBeenCalledOnce();
    expect(screen.queryByText("authenticated app with existing legal gate")).not.toBeInTheDocument();
    expect(screen.getByText("public:/:false")).toBeInTheDocument();
  });
});
