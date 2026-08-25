import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LandingPage } from "@/components/LandingPage";

const mockState = vi.hoisted(() => ({
  navigate: vi.fn(),
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
  it("popisuje konkrétní projektové údaje v Enterprise nabídce", () => {
    render(<LandingPage />);

    const projectFeatures = screen.getByText("Tendry & projekty").parentElement;
    expect(projectFeatures).not.toBeNull();

    const projectFeatureList = within(projectFeatures as HTMLElement);
    expect(
      projectFeatureList.getByText(
        "Přehled stavby: investor, lokace, termíny a odpovědné osoby",
      ),
    ).toBeInTheDocument();
    expect(
      projectFeatureList.getByText(
        "Finanční řízení: plánované náklady, smluvní ceny, dodatky a fakturace",
      ),
    ).toBeInTheDocument();
    expect(
      projectFeatureList.getByText(
        "Stav výběrových řízení: otevřené kategorie, vítězné nabídky a uzavřené smlouvy",
      ),
    ).toBeInTheDocument();
    expect(
      projectFeatureList.getByText(
        "Termíny, rizika a pokrytí rozpočtu napříč projekty",
      ),
    ).toBeInTheDocument();
  });

  it("komunikuje TODO Osobní bez odstraněného Command Centeru", () => {
    render(<LandingPage />);

    expect(
      screen.getByText(/Sedm modulů navržených specificky/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "TODO Osobní" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Command Center/i)).not.toBeInTheDocument();
  });

  it("nabízí demo pouze na vyžádání a nespouští veřejnou demo session", () => {
    render(<LandingPage />);

    const requestLinks = screen.getAllByRole("link", { name: /vyžádat demo/i });
    expect(requestLinks.length).toBeGreaterThan(0);
    requestLinks.forEach((link) => {
      expect(link).toHaveAttribute(
        "href",
        "mailto:martin@tenderflow.cz?subject=%C5%BD%C3%A1dost%20o%20demo%20TenderFlow",
      );
    });
    expect(
      screen.queryByRole("button", { name: /prohlédnout demo|vyzkoušet demo/i }),
    ).not.toBeInTheDocument();
  });

  it("neprezentuje trial ani veřejnou registraci", () => {
    render(<LandingPage />);

    expect(
      screen.queryByText(/14 dn[ií] zdarma|bez kreditn[ií] karty|účet zdarma/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /začít|vytvořit účet|vyzkoušet/i }),
    ).not.toBeInTheDocument();
    expect(mockState.navigate).not.toHaveBeenCalledWith("/register");
  });

  it("vypráví cestu tendru přes ovladatelné procesní body", () => {
    render(<LandingPage />);

    const offersStep = screen.getByRole("button", { name: /02 nabídky/i });
    const contractStep = screen.getByRole("button", { name: /05 smlouva/i });

    expect(offersStep).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/nabídky na jednom místě/i)).toBeInTheDocument();

    fireEvent.click(contractStep);

    expect(contractStep).toHaveAttribute("aria-pressed", "true");
    expect(offersStep).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText(/rozhodnutí má dohledatelnou historii/i)).toBeInTheDocument();
  });
});
