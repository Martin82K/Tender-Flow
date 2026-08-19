import { describe, expect, it } from "vitest";
import type { Subcontractor } from "@/types";
import {
  assertUniqueSubcontractorName,
  findSubcontractorNameConflict,
  mapSubcontractorPersistenceError,
  normalizeSubcontractorIdentityName,
} from "@shared/contacts/subcontractorIdentity";

const contact = (id: string, company: string): Subcontractor => ({
  id,
  company,
  specialization: ["Ostatní"],
  contacts: [],
  status: "available",
});

describe("subcontractor identity", () => {
  it("normalizuje Unicode, velikost písmen a vnitřní mezery", () => {
    expect(normalizeSubcontractorIdentityName("  BAUSTAV\u00a0  servis  ")).toBe(
      "baustav servis",
    );
  });

  it("zachová rozlišující část názvu střediska", () => {
    expect(normalizeSubcontractorIdentityName("Baustav")).not.toBe(
      normalizeSubcontractorIdentityName("Baustav - zemní práce"),
    );
  });

  it("najde shodný název, ale při editaci ignoruje vlastní záznam", () => {
    const contacts = [contact("c-1", "Baustav")];
    expect(findSubcontractorNameConflict(contacts, "BAUSTAV")?.id).toBe("c-1");
    expect(findSubcontractorNameConflict(contacts, "BAUSTAV", "c-1")).toBeUndefined();
  });

  it("vrátí uživatelskou chybu při duplicitním názvu", () => {
    expect(() => assertUniqueSubcontractorName([contact("c-1", "Baustav")], "baustav"))
      .toThrow(/již existuje/i);
  });

  it("převede databázový konflikt na stejnou uživatelskou chybu", () => {
    const error = mapSubcontractorPersistenceError(
      {
        code: "23505",
        details: null,
        message: "SUBCONTRACTOR_NAME_CONFLICT",
      },
      "Baustav",
    );

    expect(error.message).toContain("Baustav");
    expect(error.message).toMatch(/již existuje/i);
  });
});
