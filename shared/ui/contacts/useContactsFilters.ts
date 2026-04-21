import { useEffect, useMemo, useState, useCallback } from "react";
import { Subcontractor } from "@/types";
import {
  ContactsFilterState,
  EMPTY_FILTER_STATE,
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
  clear: () => void;
  specializations: string[];
  filteredContacts: Subcontractor[];
  hasActive: boolean;
}

export function useContactsFilters(
  contacts: Subcontractor[],
): UseContactsFiltersResult {
  const [searchText, setSearchText] = useState("");
  const [specialization, setSpecialization] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [region, setRegion] = useState<string>("all");

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchText), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchText]);

  const state: ContactsFilterState = useMemo(
    () => ({ searchText, specialization, status, region }),
    [searchText, specialization, status, region],
  );

  const debouncedState: ContactsFilterState = useMemo(
    () => ({ searchText: debouncedSearch, specialization, status, region }),
    [debouncedSearch, specialization, status, region],
  );

  const specializations = useMemo(() => {
    const specs = new Set(contacts.flatMap((c) => c.specialization));
    return Array.from(specs).sort();
  }, [contacts]);

  const filteredContacts = useMemo(
    () => filterContacts(contacts, debouncedState),
    [contacts, debouncedState],
  );

  const clear = useCallback(() => {
    setSearchText("");
    setSpecialization("all");
    setStatus("all");
    setRegion("all");
  }, []);

  return {
    state,
    debouncedState,
    setSearchText,
    setSpecialization,
    setStatus,
    setRegion,
    clear,
    specializations,
    filteredContacts,
    hasActive: hasActiveFilters(state) || hasActiveFilters(debouncedState),
  };
}

export { EMPTY_FILTER_STATE };
