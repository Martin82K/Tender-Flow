import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  createPipelineContactFormState,
  isBlankRegistrationValue,
  mergeRegistrationDetails,
} from "@features/projects/pipeline/model/pipelineContactFormModel";
import type { Subcontractor } from "@/types";

const existingContact: Subcontractor = {
  id: "supplier-1",
  company: "Dodavatel s.r.o.",
  specialization: ["Betony"],
  contacts: [],
  status: "available",
  name: "-",
  email: "-",
  phone: "-",
};

describe("pipeline contact form model", () => {
  it("vytvoří deterministický nový formulář s hlavním kontaktem", () => {
    const createId = vi.fn(() => "contact-1");

    expect(
      createPipelineContactFormState(undefined, "  Firma A  ", createId),
    ).toEqual({
      company: "  Firma A  ",
      specialization: [],
      specializationRaw: "",
      contacts: [
        {
          id: "contact-1",
          name: "",
          phone: "",
          email: "",
          position: "Hlavní kontakt",
        },
      ],
      ico: "",
      region: "",
      address: "",
      city: "",
      web: "",
      note: "",
      regions: [],
      status: "available",
    });
    expect(createId).toHaveBeenCalledTimes(1);
  });

  it("zachová editovaná data a doplní osobu pouze pokud žádná neexistuje", () => {
    const createId = vi.fn(() => "contact-fallback");
    const withContact = {
      ...existingContact,
      contacts: [
        {
          id: "person-1",
          name: "Jan Novák",
          phone: "123",
          email: "jan@example.cz",
          position: "Jednatel",
        },
      ],
    };

    expect(createPipelineContactFormState(withContact, "ignored", createId)).toMatchObject({
      id: "supplier-1",
      company: "Dodavatel s.r.o.",
      specializationRaw: "",
      contacts: withContact.contacts,
    });
    expect(createId).not.toHaveBeenCalled();

    expect(createPipelineContactFormState(existingContact, "ignored", createId).contacts)
      .toEqual([
        {
          id: "contact-fallback",
          name: "",
          phone: "",
          email: "",
          position: "Hlavní kontakt",
        },
      ]);
  });

  it.each([undefined, null, "", "   ", "-", "–", "—", "―"])(
    "považuje %s za prázdnou registrační hodnotu",
    (value) => {
      expect(isBlankRegistrationValue(value)).toBe(true);
    },
  );

  it("nepovažuje skutečnou hodnotu za prázdnou", () => {
    expect(isBlankRegistrationValue(" Praha ")).toBe(false);
  });

  it("doplní z registru pouze chybějící pole bez přepsání uživatele", () => {
    const current = {
      ...createPipelineContactFormState(undefined, "Firma", () => "contact-1"),
      region: "Praha",
      address: "—",
      city: "",
    };

    expect(
      mergeRegistrationDetails(
        current,
        { region: "Středočeský kraj", address: "Nová 1", city: "Kladno" },
        false,
      ),
    ).toMatchObject({ region: "Praha", address: "Nová 1", city: "Kladno" });
  });

  it("při explicitním dohledání přepíše dostupná pole, ale nemaže chybějící", () => {
    const current = {
      ...createPipelineContactFormState(undefined, "Firma", () => "contact-1"),
      region: "Praha",
      address: "Stará 2",
      city: "Praha",
    };

    expect(
      mergeRegistrationDetails(
        current,
        { region: "Jihočeský kraj", address: "Nová 1" },
        true,
      ),
    ).toMatchObject({
      region: "Jihočeský kraj",
      address: "Nová 1",
      city: "Praha",
    });
  });

  it("modal používá feature model a neduplikuje rozhodovací logiku", () => {
    const source = readFileSync(
      join(process.cwd(), "features/projects/pipeline/ui/CreateContactModal.tsx"),
      "utf8",
    );

    expect(source).toContain(
      'from "@features/projects/pipeline/model/pipelineContactFormModel"',
    );
    expect(source).not.toContain("const BLANK_LOOKUP_VALUES");
    expect(source).not.toContain("const createInitialFormState");
  });
});
