import { describe, it, expect } from "vitest";
import {
  contactCoversRegion,
  filterContacts,
  hasActiveFilters,
  matchesContactFilters,
  EMPTY_FILTER_STATE,
} from "../shared/ui/contacts/contactsFiltersLogic";
import type { Subcontractor } from "../types";

function make(partial: Partial<Subcontractor>): Subcontractor {
  return {
    id: partial.id ?? crypto.randomUUID(),
    company: partial.company ?? "Firma X",
    specialization: partial.specialization ?? [],
    contacts: partial.contacts ?? [],
    status: partial.status ?? "available",
    regions: partial.regions,
    region: partial.region,
    ico: partial.ico,
    vendorRatingAverage: partial.vendorRatingAverage,
    latitude: partial.latitude,
    longitude: partial.longitude,
  } as Subcontractor;
}

describe("contactsFiltersLogic", () => {
  const a = make({
    id: "a",
    company: "Alfa",
    specialization: ["Zednictví"],
    regions: ["PHA", "STC"],
    status: "available",
    contacts: [
      { id: "c1", name: "Jan Novák", phone: "111", email: "jn@a.cz" },
    ],
  });
  const b = make({
    id: "b",
    company: "Beta",
    specialization: ["Elektro"],
    regions: ["JHM"],
    status: "busy",
    contacts: [
      { id: "c2", name: "Petr Čermák", phone: "222", email: "pc@b.cz" },
    ],
  });
  const c = make({
    id: "c",
    company: "Gama",
    specialization: ["Zednictví", "Elektro"],
    regions: undefined,
    status: "available",
    contacts: [],
  });
  const dataset = [a, b, c];

  it("vrátí všechny kontakty pro prázdný filtr", () => {
    expect(filterContacts(dataset, EMPTY_FILTER_STATE)).toHaveLength(3);
  });

  it("filtruje podle textu ve firmě, jméně i emailu", () => {
    expect(
      filterContacts(dataset, { ...EMPTY_FILTER_STATE, searchText: "alfa" }),
    ).toEqual([a]);
    expect(
      filterContacts(dataset, { ...EMPTY_FILTER_STATE, searchText: "pc@b.cz" }),
    ).toEqual([b]);
    expect(
      filterContacts(dataset, { ...EMPTY_FILTER_STATE, searchText: "Petr" }),
    ).toEqual([b]);
  });

  it("filtruje podle specializace", () => {
    const res = filterContacts(dataset, {
      ...EMPTY_FILTER_STATE,
      specialization: "Elektro",
    });
    expect(res.map((r) => r.id).sort()).toEqual(["b", "c"]);
  });

  it("filtruje podle stavu", () => {
    const res = filterContacts(dataset, {
      ...EMPTY_FILTER_STATE,
      status: "available",
    });
    expect(res.map((r) => r.id).sort()).toEqual(["a", "c"]);
  });

  it("filtruje podle kraje působnosti (regions[])", () => {
    const prague = filterContacts(dataset, {
      ...EMPTY_FILTER_STATE,
      region: "PHA",
    });
    expect(prague).toEqual([a]);

    const jhm = filterContacts(dataset, {
      ...EMPTY_FILTER_STATE,
      region: "JHM",
    });
    expect(jhm).toEqual([b]);

    const msk = filterContacts(dataset, {
      ...EMPTY_FILTER_STATE,
      region: "MSK",
    });
    expect(msk).toEqual([]);
  });

  it("contactCoversRegion vrací false pro kontakt bez regions", () => {
    expect(contactCoversRegion(c, "PHA")).toBe(false);
  });

  it("kombinuje více filtrů logickým AND", () => {
    const res = filterContacts(dataset, {
      searchText: "",
      specialization: "Elektro",
      status: "busy",
      region: "JHM",
      distanceKm: null,
    });
    expect(res).toEqual([b]);
  });

  it("filtruje podle vzdálenosti od stavby", () => {
    const projectPosition = { lat: 50.0875, lng: 14.4213 }; // Praha
    const near = make({
      id: "near",
      company: "Blízká",
      latitude: 50.10,
      longitude: 14.45,
    });
    const far = make({
      id: "far",
      company: "Daleká",
      latitude: 49.20,
      longitude: 16.61, // Brno (~190 km)
    });
    const noCoords = make({ id: "noc", company: "Bez souřadnic" });

    const within50 = filterContacts(
      [near, far, noCoords],
      { ...EMPTY_FILTER_STATE, distanceKm: 50 },
      projectPosition,
    );
    expect(within50.map((r) => r.id)).toEqual(["near"]);

    // Bez projectPosition se distanční filtr neaplikuje
    const withoutPos = filterContacts(
      [near, far, noCoords],
      { ...EMPTY_FILTER_STATE, distanceKm: 50 },
    );
    expect(withoutPos).toHaveLength(3);
  });

  it("hasActiveFilters detekuje libovolný aktivní filtr", () => {
    expect(hasActiveFilters(EMPTY_FILTER_STATE)).toBe(false);
    expect(
      hasActiveFilters({ ...EMPTY_FILTER_STATE, region: "PHA" }),
    ).toBe(true);
    expect(
      hasActiveFilters({ ...EMPTY_FILTER_STATE, searchText: "  " }),
    ).toBe(false);
    expect(
      hasActiveFilters({ ...EMPTY_FILTER_STATE, searchText: "x" }),
    ).toBe(true);
  });

  it("matchesContactFilters je použitelný samostatně", () => {
    expect(
      matchesContactFilters(a, { ...EMPTY_FILTER_STATE, region: "PHA" }),
    ).toBe(true);
    expect(
      matchesContactFilters(b, { ...EMPTY_FILTER_STATE, region: "PHA" }),
    ).toBe(false);
  });
});
