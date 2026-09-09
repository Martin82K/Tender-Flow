import React, { useEffect } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { navigate, useLocation } from "@/shared/routing/router";

vi.mock("@infra/diagnostics/runtimeDiagnostics", () => ({ logRuntimeEvent: vi.fn() }));

const RedirectToLogin = () => {
  useEffect(() => {
    navigate("/login?next=%2Foauth%2Fconsent%3Fauthorization_id%3Drequest-1", { replace: true });
  }, []);
  return <div>Přesměrování na přihlášení...</div>;
};
const Route = () => {
  const location = useLocation();
  return <>
    <output>{location.pathname}{location.search}</output>
    {location.pathname === "/oauth/consent" ? <RedirectToLogin /> : <button onClick={() => navigate("/app/todo")}>TODO</button>}
  </>;
};

describe("initial client navigation", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/oauth/consent?authorization_id=request-1");
  });

  it("observes a child redirect during mount without refreshing the browser", () => {
    render(<Route />);
    expect(screen.getByRole("status")).toHaveTextContent("/login?next=%2Foauth%2Fconsent%3Fauthorization_id%3Drequest-1");
    expect(screen.queryByText("Přesměrování na přihlášení...")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "TODO" }));
    expect(screen.getByRole("status")).toHaveTextContent("/app/todo");
  });
});
