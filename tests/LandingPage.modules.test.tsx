import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LandingPage } from "@/components/LandingPage";

const mockState = vi.hoisted(() => ({
  loginAsDemo: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    loginAsDemo: mockState.loginAsDemo,
  }),
}));

vi.mock("@/shared/routing/router", () => ({
  Link: ({ children, to, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  navigate: mockState.navigate,
  useLocation: () => ({ pathname: "/", search: "", hash: "" }),
}));

describe("LandingPage nové moduly", () => {
  it("komunikuje Command Center a TODO Osobní ve veřejném obsahu", () => {
    render(<LandingPage />);

    expect(
      screen.getByText(/Osm modulů navržených specificky/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Command Center" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "TODO Osobní" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Command Center s prioritami dne")).toBeInTheDocument();
    expect(screen.getByText("TODO Osobní s podúkoly")).toBeInTheDocument();
  });
});
