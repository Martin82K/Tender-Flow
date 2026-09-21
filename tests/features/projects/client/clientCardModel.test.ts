import { describe, expect, it } from "vitest";
import {
  financialsWithConfirmedClientName,
  isClientCardDraftBlank,
  isValidCzechIco,
  resolveClientCardDraft,
  emptyClientCardDraft,
} from "@features/projects/client/clientCardModel";
import type { InvestorFinancials } from "@/types";

describe("karta objednatele", () => {
  it("uznává platné české IČO a odmítá špatný kontrolní součet", () => {
    expect(isValidCzechIco("74907026")).toBe(true);
    expect(isValidCzechIco("25596641")).toBe(true);
    expect(isValidCzechIco("60838744")).toBe(true);
    expect(isValidCzechIco("74 907 026")).toBe(true);
    expect(isValidCzechIco("74907027")).toBe(false);
    expect(isValidCzechIco("123")).toBe(false);
    expect(isValidCzechIco("")).toBe(false);
  });

  it("považuje prázdný koncept za nevyplněný, ne za chybu", () => {
    const draft = emptyClientCardDraft();
    expect(isClientCardDraftBlank(draft)).toBe(true);
    expect(resolveClientCardDraft(draft)).toEqual({ card: null, errors: {} });
  });

  it("vyžaduje firmu, jakmile je vyplněné jiné pole", () => {
    const result = resolveClientCardDraft({ ...emptyClientCardDraft(), city: "Praha" });
    expect(result.card).toBeNull();
    expect(result.errors.companyName).toMatch(/firmu nebo jméno/i);
  });

  it("normalizuje platnou kartu a odmítne neplatné IČO, e-mail a PSČ", () => {
    const valid = resolveClientCardDraft({
      ...emptyClientCardDraft(),
      companyName: "  Javor Invest  ",
      ico: "74 907 026",
      street: "Lesní 1",
      zip: "11000",
      city: "Praha",
      contactName: "Jana Nová",
      contactEmail: "Jana@Example.cz",
      contactPhone: "+420 777 123 456",
      internalNote: "Poznámka",
    });
    expect(valid.errors).toEqual({});
    expect(valid.card).toEqual({
      companyName: "Javor Invest",
      ico: "74907026",
      street: "Lesní 1",
      zip: "110 00",
      city: "Praha",
      contactName: "Jana Nová",
      contactEmail: "jana@example.cz",
      contactPhone: "+420 777 123 456",
      internalNote: "Poznámka",
    });

    const invalid = resolveClientCardDraft({
      ...emptyClientCardDraft(),
      companyName: "Javor",
      ico: "74907027",
      zip: "12",
      contactEmail: "neni-email",
    });
    expect(invalid.card).toBeNull();
    expect(invalid.errors.ico).toBeTruthy();
    expect(invalid.errors.zip).toBeTruthy();
    expect(invalid.errors.contactEmail).toBeTruthy();
  });

  it("při potvrzení přepíše jen jméno ve finanční evidenci", () => {
    const current: InvestorFinancials = {
      sodPrice: 2500000,
      contractNumber: "SOD-1",
      customerName: "Starý název",
      amendments: [{ id: "a1", label: "Dodatek", price: 1000 }],
      invoices: [{
        id: "i1",
        invoiceNumber: "FV-1",
        issueDate: "2026-01-01",
        dueDate: "2026-01-15",
        amount: 10,
        currency: "CZK",
        status: "issued",
      }],
    };
    expect(financialsWithConfirmedClientName(current, "Javor Invest")).toEqual({
      ...current,
      customerName: "Javor Invest",
    });
    expect(financialsWithConfirmedClientName(undefined, "Javor Invest").amendments).toEqual([]);
    expect(financialsWithConfirmedClientName(undefined, "Javor Invest").customerName).toBe("Javor Invest");
  });
});
