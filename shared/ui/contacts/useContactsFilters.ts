import { useEffect, useMemo, useState, useCallback } from "react";
import { Subcontractor } from "@/types";
import {
  type ContactsFilterState,
  type ContactSort,
  type RatingFilter,
  EMPTY_FILTER_STATE,
  type GeoPoint,
  filterContacts,
  hasActiveFilters,
} from "./contactsFiltersLogic";

const SEARCH_DEBOUNCE_MS = 250;

export interface UseContactsFiltersResult {
  state: ContactsFilterState;
  debouncedState: ContactsFilterState;
  setRatingFilter: (value: RatingFilter) => void;
  setSortBy: (value: ContactSort) => void;
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
  defaultSort: ContactSort = "name",
): UseContactsFiltersResult {
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all");
  const [sortBy, setSortBy] = useState<ContactSort>(defaultSort);
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
    () => ({ searchText, specialization, status, region, distanceKm, ratingFilter, sortBy }),
    [searchText, specialization, status, region, distanceKm, ratingFilter, sortBy],
  );

  const debouncedState: ContactsFilterState = useMemo(
    () => ({
      ratingFilter,
      sortBy,
      searchText: debouncedSearch,
      specialization,
      status,
      region,
      distanceKm,
    }),
    [debouncedSearch, specialization, status, region, distanceKm, ratingFilter, sortBy],
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
    setRatingFilter("all");
    setSearchText("");
    setSpecialization("all");
    setStatus("all");
    setRegion("all");
    setDistanceKmState(null);
  }, []);

  return {
    state,
    debouncedState,
    setRatingFilter,
    setSortBy,
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
