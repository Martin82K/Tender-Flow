import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Subcontractor } from "@/types";
import {
  analyzeContactQuickPaste,
  CONTACT_QUICK_PASTE_MAX_CHARS,
  normalizeQuickPasteIco,
  stripQuickPasteLegalForm,
} from "@/features/contacts/model/contactQuickPaste";

const mocks = vi.hoisted(() => ({
  findCompanyRegistrationDetails: vi.fn(),
  invokeAuthedFunction: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@/services/geminiService", () => ({
  findCompanyRegistrationDetails: mocks.findCompanyRegistrationDetails,
}));

vi.mock("@/services/functionsClient", () => ({
  invokeAuthedFunction: mocks.invokeAuthedFunction,
}));

vi.mock("@infra/db/dbAdapter", () => ({
  dbAdapter: {
    from: mocks.fromMock,
  },
}));

const existingContact: Subcontractor = {
  id: "c-1",
  company: "Alfa Elektro s.r.o.",
  specialization: ["Elektroinstalace"],
  contacts: [{ id: "p-1", name: "Petr Stary", email: "stary@alfa.cz", phone: "111 222 333" }],
  ico: "12345678",
  region: "-",
  address: "-",
  city: "-",
  web: "",
  status: "available",
  name: "Petr Stary",
  email: "stary@alfa.cz",
  phone: "111 222 333",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findCompanyRegistrationDetails.mockResolvedValue({});
  mocks.invokeAuthedFunction.mockRejectedValue(new Error("AI unavailable"));
  mocks.fromMock.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  });
});

describe("contact quick paste", () => {
  it("normalizuje IČO na osm číslic", () => {
    expect(normalizeQuickPasteIco("1234567")).toBe("01234567");
    expect(normalizeQuickPasteIco("IČO: 12 345 678")).toBe("12345678");
    expect(normalizeQuickPasteIco("+420 777 123 456")).toBeUndefined();
  });

  it("odstraní právní formu z názvu firmy", () => {
    expect(stripQuickPasteLegalForm("ANDĚL vzduchotechnika klimatizace, s.r.o.")).toBe(
      "ANDĚL vzduchotechnika klimatizace",
    );
    expect(stripQuickPasteLegalForm("Beta Stavby a.s.")).toBe("Beta Stavby");
    expect(stripQuickPasteLegalForm("Gama spol. s r.o.")).toBe("Gama");
  });

  it("vytvoří návrh nové firmy ze zkopírovaného textu a doplní ARES údaje", async () => {
    mocks.findCompanyRegistrationDetails.mockResolvedValue({
      "quick-paste": {
        region: "Karlovarský kraj",
        address: "č.p. 88, 36225 Božičany",
        city: "Božičany",
      },
    });

    const result = await analyzeContactQuickPaste({
      input: `
        Beta Stavby s.r.o.
        IČO: 64356221
        www.betastavby.cz
        Kontakt: Jan Novak
        jan.novak@betastavby.cz
        +420 777 123 456
        Specializace: Fasády, ETICS
      `,
      existingContacts: [],
      existingSpecializations: ["Fasády"],
      defaultStatusId: "available",
      useAi: false,
    });

    expect(result.operation).toBe("create");
    expect(result.source.usedAres).toBe(true);
    expect(result.contact).toEqual(
      expect.objectContaining({
        company: "Beta Stavby",
        ico: "64356221",
        web: "https://www.betastavby.cz",
        region: "Karlovarský kraj",
        address: "č.p. 88, 36225 Božičany",
        city: "Božičany",
        status: "available",
      }),
    );
    expect(result.warnings).toContain('Název firmy byl upraven na "Beta Stavby" bez právní formy.');
    expect(result.contact.contacts[0]).toEqual(
      expect.objectContaining({
        name: "Jan Novak",
        email: "jan.novak@betastavby.cz",
        phone: "+420 777 123 456",
      }),
    );
    expect(result.contact.specialization).toEqual(expect.arrayContaining(["Fasády", "ETICS"]));
  });

  it("při shodě podle IČO doplní existující firmu bez duplikace kontaktu", async () => {
    const result = await analyzeContactQuickPaste({
      input: `
        Alfa Elektro s.r.o.
        IČO 12345678
        Kontakt: Jana Nova
        jana.nova@alfa.cz
        +420 733 444 555
        Obor: Slaboproud
      `,
      existingContacts: [existingContact],
      existingSpecializations: ["Elektroinstalace"],
      defaultStatusId: "available",
      useAi: false,
    });

    expect(result.operation).toBe("update");
    expect(result.matchedContact?.id).toBe("c-1");
    expect(result.contact.id).toBe("c-1");
    expect(result.contact.contacts).toHaveLength(2);
    expect(result.contact.contacts[1]).toEqual(
      expect.objectContaining({
        name: "Jana Nova",
        email: "jana.nova@alfa.cz",
      }),
    );
    expect(result.contact.specialization).toEqual(
      expect.arrayContaining(["Elektroinstalace", "Slaboproud"]),
    );
  });

  it("spáruje firmu podle názvu i když vložený text obsahuje právní formu", async () => {
    const storedWithoutLegalForm = {
      ...existingContact,
      ico: "-",
      company: "Alfa Elektro",
    };

    const result = await analyzeContactQuickPaste({
      input: `
        Alfa Elektro s.r.o.
        Kontakt: Jana Nova
        jana.nova@alfa.cz
      `,
      existingContacts: [storedWithoutLegalForm],
      existingSpecializations: ["Elektroinstalace"],
      defaultStatusId: "available",
      useAi: false,
    });

    expect(result.operation).toBe("update");
    expect(result.matchedContact?.id).toBe("c-1");
    expect(result.contact.company).toBe("Alfa Elektro");
  });

  it("odmítne příliš dlouhý vložený text před voláním AI", async () => {
    await expect(
      analyzeContactQuickPaste({
        input: "x".repeat(CONTACT_QUICK_PASTE_MAX_CHARS + 1),
        existingContacts: [],
        existingSpecializations: [],
        defaultStatusId: "available",
      }),
    ).rejects.toThrow(/příliš dlouhý/i);

    expect(mocks.invokeAuthedFunction).not.toHaveBeenCalled();
  });
});
