import { describe, expect, it } from "vitest";
import { isUserAdmin } from "@/shared/auth/adminAccess";
import { isUserAdmin as isUserAdminFromLegacy } from "../utils/helpers";

describe("isUserAdmin", () => {
  it("recognizes configured admin emails", () => {
    expect(isUserAdmin("martinkalkus82@gmail.com")).toBe(true);
    expect(isUserAdmin("kalkus@baustav.cz")).toBe(true);
  });

  it("rejects empty and unknown emails", () => {
    expect(isUserAdmin(undefined)).toBe(false);
    expect(isUserAdmin("user@example.com")).toBe(false);
  });

  it("stays available from the legacy helpers entrypoint", () => {
    expect(isUserAdminFromLegacy("kalkus@baustav.cz")).toBe(true);
  });
});
