import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LandingPage } from "@features/public/ui/LandingPage";

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
  it("uvádí BAU-STAV jako firemní referenci s odkazem bez smyšlené citace", () => {
    render(<LandingPage />);

    const reference = screen.getByRole("article", { name: "Firemní reference BAU-STAV a.s." });
    expect(reference).toHaveTextContent("Karlovy Vary");
    expect(within(reference).getByRole("link", { name: /baustav.cz/i })).toHaveAttribute("href", "https://www.baustav.cz/cs/");
    expect(reference).not.toHaveTextContent(/[„“★]/);
  });

  it("nezahlcuje úvod tlačítkem pro demo a nabízí kontakt v závěru stránky", () => {
    render(<LandingPage />);

    const hero = screen.getByRole("heading", { level: 1 }).closest("section")!;
    expect(within(hero).queryByRole("link", { name: "Domluvit ukázku" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Domluvit ukázku" })).toHaveAttribute("href", expect.stringContaining("mailto:"));
  });

  it("uvádí fakturaci převodem bez platební brány", () => {
    render(<LandingPage />);

    expect(screen.queryByText(/stripe/i)).not.toBeInTheDocument();
    expect(screen.getByText("Fakturace · Bankovní převod")).toBeInTheDocument();
    const pricing = screen.getByRole("heading", { name: /Firemní licence/ }).closest("section")!;
    expect(within(pricing).getAllByRole("link")).toHaveLength(1);
    expect(within(pricing).getByRole("link", { name: "Kontaktujte nás" })).toHaveAttribute("href", expect.stringContaining("mailto:martin@tenderflow.cz"));
  });

  it("ujišťuje o ochraně dokumentů srozumitelně a odkazuje na podmínky", () => {
    render(<LandingPage />);

    const section = screen.getByRole("region", { name: "Mistral AI pro vaše dokumenty" });
    expect(within(section).getByRole("heading", { name: "Vaše dokumenty zůstávají vaše" })).toBeInTheDocument();
    expect(section).toHaveTextContent(/po zpracování dokumentu neukládá jeho obsah ani odpověď ve svém API/i);
    expect(section).toHaveTextContent("Zero Data Retention");
    expect(section).toHaveTextContent(/řídíme příslušnými pravidly EU AI Act/i);
    expect(within(section).getByRole("link", { name: /ochrana dat a podmínky používání/i })).toHaveAttribute("href", "/terms");
    expect(section).not.toHaveTextContent(/bezstavové|produkční organizaci|trénování modelů|OpenAI|Gemini|Claude|ChatGPT/i);
  });

  it("vysvětluje společný postup s e-mailem, kalendářem a TenderFlow", () => {
    render(<LandingPage />);

    const section = screen.getByRole("region", { name: "Od e-mailu k dalšímu kroku v projektu" });
    expect(section).toHaveTextContent(/vlastnímu MCP serveru/i);
    expect(section).toHaveTextContent(/e-mailů, kalendáře a dokumentů/i);
    expect(within(section).getByRole("heading", { name: "Zachytí, co se změnilo" })).toBeInTheDocument();
    expect(within(section).getByRole("heading", { name: "Dohledá souvislosti" })).toBeInTheDocument();
    expect(within(section).getByRole("heading", { name: "Připraví další krok" })).toBeInTheDocument();
    expect(section).toHaveTextContent(/po vašem schválení může v TenderFlow vytvořit úkol/i);
    expect(section).toHaveTextContent(/e-mail a kalendář zajišťují jejich vlastní konektory/i);
    expect(section).not.toHaveTextContent(/OAuth|https:\/\/www.tenderflow.cz\/api\/mcp|Jak připojit MCP server/i);
  });

  it("nabízí skutečné kotvy pro nové sekce i ovládání klávesnicí", () => {
    render(<LandingPage />);

    const navigation = within(screen.getByRole("banner"));
    expect(navigation.getByRole("link", { name: "AI a data" })).toHaveAttribute("href", "#ai-data");
    expect(navigation.getByRole("link", { name: "MCP" })).toHaveAttribute("href", "#mcp");
    expect(navigation.getByRole("link", { name: "Ceník" })).toHaveAttribute("href", "#ceny");
  });

  it("ponechává v horní navigaci pouze nerušivé přihlášení", () => {
    render(<LandingPage />);

    const header = screen.getByRole("banner");
    expect(within(header).getByRole("button", { name: "Přihlásit se" })).toBeInTheDocument();
    expect(
      within(header).queryByRole("link", { name: "Domluvit ukázku" }),
    ).not.toBeInTheDocument();
  });

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

    const requestLinks = screen.getAllByRole("link", { name: /domluvit ukázku|demo na vyžádání/i });
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
