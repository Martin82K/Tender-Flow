import React, { createContext, useContext } from "react";

const TopbarActionsContext = createContext<React.ReactNode>(null);

export const TopbarActionsProvider: React.FC<{
  actions: React.ReactNode;
  children: React.ReactNode;
}> = ({ actions, children }) => (
  <TopbarActionsContext.Provider value={actions}>
    {children}
  </TopbarActionsContext.Provider>
);

export const useTopbarActions = (): React.ReactNode =>
  useContext(TopbarActionsContext);
