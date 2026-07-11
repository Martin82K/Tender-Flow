import type { PropsWithChildren } from "react";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  AuthIdentityProvider,
  useAuthIdentity,
  type AuthIdentity,
} from "@shared/auth/AuthIdentityContext";

describe("AuthIdentityContext", () => {
  it("exposes only the minimal identity projection", () => {
    const identity = {
      id: "user-1",
      email: "user@example.com",
      role: "admin",
      accessToken: "must-not-cross-the-boundary",
    } as AuthIdentity & { accessToken: string };
    const wrapper = ({ children }: PropsWithChildren) => (
      <AuthIdentityProvider identity={identity}>{children}</AuthIdentityProvider>
    );

    const { result } = renderHook(() => useAuthIdentity(), { wrapper });

    expect(result.current).toEqual({
      id: "user-1",
      email: "user@example.com",
      role: "admin",
    });
    expect(result.current).not.toHaveProperty("accessToken");
  });

  it("represents an authenticated absence as null", () => {
    const wrapper = ({ children }: PropsWithChildren) => (
      <AuthIdentityProvider identity={null}>{children}</AuthIdentityProvider>
    );

    const { result } = renderHook(() => useAuthIdentity(), { wrapper });

    expect(result.current).toBeNull();
  });

  it("keeps the context value stable when unrelated user fields change", () => {
    let identity = {
      id: "user-1",
      email: "user@example.com",
      role: "user",
      name: "Původní jméno",
    } as AuthIdentity & { name: string };
    const wrapper = ({ children }: PropsWithChildren) => (
      <AuthIdentityProvider identity={identity}>{children}</AuthIdentityProvider>
    );
    const { result, rerender } = renderHook(() => useAuthIdentity(), { wrapper });
    const firstValue = result.current;

    identity = { ...identity, name: "Nové jméno" };
    rerender();

    expect(result.current).toBe(firstValue);
  });

  it("fails fast outside the auth identity provider", () => {
    expect(() => renderHook(() => useAuthIdentity())).toThrow(
      "useAuthIdentity must be used within an AuthIdentityProvider",
    );
  });
});
