import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LegalCookies } from "@/features/public/ui/LegalCookies";
import { LegalDpa } from "@/features/public/ui/LegalDpa";
import { LegalPrivacy } from "@/features/public/ui/LegalPrivacy";
import { LegalTerms } from "@/features/public/ui/LegalTerms";

import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION, hasAcceptedCurrentLegalDocuments } from "@/shared/legal/legalDocumentVersions";

vi.mock("@/features/public/ui/LegalPageLayout", () => ({
  LegalPageLayout: ({
    title,
    lead,
    updatedAt,
    children,
  }: {
    title: string;
    lead?: string;
    updatedAt: string;
    children: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      {lead ? <p>{lead}</p> : null}
      <p>Poslední aktualizace: {updatedAt}</p>
      <div>{children}</div>
    </div>
  ),
}));

describe("legal documents", () => {
  it("renders detailed terms sections", () => {
    render(<LegalTerms />);

    expect(
      screen.getByRole("heading", { name: "Podmínky užívání služby Tender Flow" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "5. Uživatelská data a odpovědnost uživatele",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "13. Změny podmínek a závěrečná ustanovení",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/služba nepředstavuje právní, daňové ani účetní poradenství/i)).toBeInTheDocument();
    expect(screen.getByText(/kogentní ustanovení právních předpisů na ochranu spotřebitele/i)).toBeInTheDocument();
  });

  it("explains invoice payments, AI data protection and controlled MCP access", () => {
    render(<LegalTerms />);

    expect(screen.getByText(/výhradně bankovním převodem na základě vystavené faktury/i)).toBeInTheDocument();
    expect(screen.getByText(/Mistral AI po zpracování dokumentu neukládá jeho obsah ani odpověď ve svém API/i)).toBeInTheDocument();
    expect(screen.getByText(/řídíme příslušnými pravidly EU AI Act/i)).toBeInTheDocument();
    expect(screen.getByText(/výstupy mohou obsahovat chyby/i)).toBeInTheDocument();
    expect(screen.getByText(/dokumenty a výsledky uložené v TenderFlow/i)).toBeInTheDocument();
    expect(screen.getByText(/připojený klient má vlastní pravidla zpracování dat/i)).toBeInTheDocument();
    expect(screen.getByText(/Poslední aktualizace: 5. září 2026/)).toBeInTheDocument();
  });

  it("requires acceptance of revised terms while retaining the current privacy version", () => {
    const acceptance = {
      termsVersion: "2026-03-12",
      termsAcceptedAt: "2026-08-19T12:00:00Z",
      privacyVersion: CURRENT_PRIVACY_VERSION,
      privacyAcceptedAt: "2026-08-19T12:00:00Z",
    };
    expect(hasAcceptedCurrentLegalDocuments(acceptance)).toBe(false);
    expect(CURRENT_TERMS_VERSION).toBe("2026-09-05");
    expect(hasAcceptedCurrentLegalDocuments({ ...acceptance, termsVersion: CURRENT_TERMS_VERSION })).toBe(true);
  });

  it("renders detailed privacy sections", () => {
    render(<LegalPrivacy />);

    expect(
      screen.getByRole("heading", { name: "Zásady ochrany osobních údajů" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "2. Role při zpracování osobních údajů",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "11. Práva subjektů údajů",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Úřadu pro ochranu osobních údajů/i)).toBeInTheDocument();
    expect(screen.getByText(/pouze po minimální dobu vyžadovanou právními předpisy/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Supabase/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Stripe/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/OpenAI/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Správa uživatelských účtů a organizací/i).length).toBeGreaterThan(0);
  });

  it("renders detailed cookies sections", () => {
    render(<LegalCookies />);

    expect(
      screen.getByRole("heading", { name: "Zásady používání cookies" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "3. Právní základ používání cookies",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "6. Kontakt a změny těchto zásad",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/cookie lišty/i)).toBeInTheDocument();
    expect(screen.getByText(/agregované provozní měření přihlášené aplikace/i)).toBeInTheDocument();
    expect(screen.getByText(/neobsahuje obsah práce ani jednotlivé vstupy uživatele/i)).toBeInTheDocument();
    expect(screen.getByText(/nejvýše 365 dní/i)).toBeInTheDocument();
  });

  it("renders dpa sections", () => {
    render(<LegalDpa />);

    expect(
      screen.getByRole("heading", { name: "Zpracovatelská doložka (DPA)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "1. Co je DPA",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "9. Doba zpracování a výmaz",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Data Processing Agreement/i)).toBeInTheDocument();
    expect(screen.getByText(/Databáze, autentizace, storage a backend služby/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Správa uživatelských účtů a organizací/i).length).toBeGreaterThan(0);
  });
});
