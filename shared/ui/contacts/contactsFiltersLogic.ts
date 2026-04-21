import { Subcontractor } from "@/types";
import type { CzRegionCode } from "@/config/constants";

export interface ContactsFilterState {
  searchText: string;
  specialization: string;
  status: string;
  region: string | "all";
}

export const EMPTY_FILTER_STATE: ContactsFilterState = {
  searchText: "",
  specialization: "all",
  status: "all",
  region: "all",
};

export function matchesContactFilters(
  contact: Subcontractor,
  state: ContactsFilterState,
): boolean {
  const search = state.searchText.trim().toLowerCase();
  const matchesSearch =
    !search ||
    contact.company.toLowerCase().includes(search) ||
    contact.contacts.some(
      (c) =>
        c.name.toLowerCase().includes(search) ||
        c.email.toLowerCase().includes(search) ||
        c.phone.toLowerCase().includes(search),
    ) ||
    contact.specialization.some((s) => s.toLowerCase().includes(search));

  const matchesSpec =
    state.specialization === "all" ||
    contact.specialization.includes(state.specialization);

  const matchesStatus =
    state.status === "all" || contact.status === state.status;

  const matchesRegion =
    state.region === "all" || contactCoversRegion(contact, state.region as CzRegionCode);

  return matchesSearch && matchesSpec && matchesStatus && matchesRegion;
}

export function contactCoversRegion(
  contact: Subcontractor,
  regionCode: CzRegionCode,
): boolean {
  const regions = contact.regions;
  if (!Array.isArray(regions) || regions.length === 0) return false;
  return regions.includes(regionCode);
}

export function filterContacts(
  contacts: Subcontractor[],
  state: ContactsFilterState,
): Subcontractor[] {
  return contacts.filter((c) => matchesContactFilters(c, state));
}

export function hasActiveFilters(state: ContactsFilterState): boolean {
  return (
    state.searchText.trim() !== "" ||
    state.specialization !== "all" ||
    state.status !== "all" ||
    state.region !== "all"
  );
}
