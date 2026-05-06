import React, { createContext, useContext } from "react";

const AccountMenuContext = createContext<React.ReactNode>(null);

interface AccountMenuProviderProps {
  children: React.ReactNode;
  accountMenu: React.ReactNode;
}

export const AccountMenuProvider: React.FC<AccountMenuProviderProps> = ({
  children,
  accountMenu,
}) => (
  <AccountMenuContext.Provider value={accountMenu}>
    {children}
  </AccountMenuContext.Provider>
);

export const useAccountMenu = (): React.ReactNode => useContext(AccountMenuContext);
