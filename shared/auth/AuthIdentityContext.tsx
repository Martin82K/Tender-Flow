import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
} from "react";
import type { User } from "@/types";

export type AuthIdentity = Pick<User, "id" | "email" | "role">;

type AuthIdentityProviderProps = PropsWithChildren<{
  identity: AuthIdentity | null;
}>;

const AuthIdentityContext = createContext<AuthIdentity | null | undefined>(
  undefined,
);

export const AuthIdentityProvider = ({
  children,
  identity,
}: AuthIdentityProviderProps) => {
  const value = useMemo<AuthIdentity | null>(
    () =>
      identity
        ? {
            id: identity.id,
            email: identity.email,
            role: identity.role,
          }
        : null,
    [identity?.email, identity?.id, identity?.role],
  );

  return (
    <AuthIdentityContext.Provider value={value}>
      {children}
    </AuthIdentityContext.Provider>
  );
};

export const useAuthIdentity = (): AuthIdentity | null => {
  const identity = useContext(AuthIdentityContext);
  if (identity === undefined) {
    throw new Error(
      "useAuthIdentity must be used within an AuthIdentityProvider",
    );
  }
  return identity;
};
