import React, { createContext, useContext, useMemo, useState, useCallback } from "react";
import type { SearchInputSources } from "./types";

interface GlobalSearchContextValue {
  sources: SearchInputSources;
  /** Whether the Ctrl+K modal is open */
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  toggleModal: () => void;
}

const GlobalSearchContext = createContext<GlobalSearchContextValue | null>(null);

interface GlobalSearchProviderProps {
  sources: SearchInputSources;
  children: React.ReactNode;
}

export const GlobalSearchProvider: React.FC<GlobalSearchProviderProps> = ({ sources, children }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const openModal = useCallback(() => setIsModalOpen(true), []);
  const closeModal = useCallback(() => setIsModalOpen(false), []);
  const toggleModal = useCallback(() => setIsModalOpen((v) => !v), []);

  const value = useMemo<GlobalSearchContextValue>(
    () => ({ sources, isModalOpen, openModal, closeModal, toggleModal }),
    [sources, isModalOpen, openModal, closeModal, toggleModal],
  );

  return (
    <GlobalSearchContext.Provider value={value}>{children}</GlobalSearchContext.Provider>
  );
};

export const useGlobalSearchContext = (): GlobalSearchContextValue | null => {
  return useContext(GlobalSearchContext);
};
