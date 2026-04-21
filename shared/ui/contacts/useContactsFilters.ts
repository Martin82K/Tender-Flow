import { useEffect, useMemo, useState, useCallback } from "react";
import { Subcontractor } from "@/types";
import {
  ContactsFilterState,
  EMPTY_FILTER_STATE,
  GeoPoint,
  filterContacts,
  hasActiveFilters,
} from "./contactsFiltersLogic";

const SEARCH_DEBOUNCE_MS = 250;

export interface UseContactsFiltersResult {
  state: ContactsFilterState;
  debouncedState: ContactsFilterState;
  setSearchText: (value: string) => void;
  setSpecialization: (value: string) => void;
  setStatus: (value: string) => void;
  setRegion: (value: string) => void;
  setDistanceKm: (value: number | null) => void;
  clear: () => void;
  specializations: string[];
  filteredContacts: Subcontractor[];
  hasActive: boolean;
  projectPosition: GeoPoint | null;
}

export function useContactsFilters(
  contacts: Subcontractor[],
  projectPosition?: GeoPoint | null,
): UseContactsFiltersResult {
  const [searchText, setSearchText] = useState("");
  const [specialization, setSpecialization] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [region, setRegion] = useState<string>("all");
  const [distanceKm, setDistanceKmState] = useState<number | null>(null);

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchText), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchText]);

  const setDistanceKm = useCallback((value: number | null) => {
    setDistanceKmState(value);
  }, []);

  // Pokud projekt přijde bez souřadnic, distanční filtr nemá smysl udržovat aktivní
  useEffect(() => {
    if (!projectPosition && distanceKm !== null) {
      setDistanceKmState(null);
    }
  }, [projectPosition, distanceKm]);

  const state: ContactsFilterState = useMemo(
    () => ({ searchText, specialization, status, region, distanceKm }),
    [searchText, specialization, status, region, distanceKm],
  );

  const debouncedState: ContactsFilterState = useMemo(
    () => ({
      searchText: debouncedSearch,
      specialization,
      status,
      region,
      distanceKm,
    }),
    [debouncedSearch, specialization, status, region, distanceKm],
  );

  const specializations = useMemo(() => {
    const specs = new Set(contacts.flatMap((c) => c.specialization));
    return Array.from(specs).sort();
  }, [contacts]);

  const filteredContacts = useMemo(
    () => filterContacts(contacts, debouncedState, projectPosition ?? null),
    [contacts, debouncedState, projectPosition],
  );

  const clear = useCallback(() => {
    setSearchText("");
    setSpecialization("all");
    setStatus("all");
    setRegion("all");
    setDistanceKmState(null);
  }, []);

  return {
    state,
    debouncedState,
    setSearchText,
    setSpecialization,
    setStatus,
    setRegion,
    setDistanceKm,
    clear,
    specializations,
    filteredContacts,
    hasActive: hasActiveFilters(state) || hasActiveFilters(debouncedState),
    projectPosition: projectPosition ?? null,
  };
}

export { EMPTY_FILTER_STATE };
