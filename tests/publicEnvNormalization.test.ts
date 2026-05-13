import { describe, expect, it } from "vitest";
import { normalizePublicEnvValue } from "@/shared/config/publicEnv";

describe("normalizePublicEnvValue", () => {
  it("odstrani whitespace, obalove uvozovky a nove radky z verejnych build hodnot", () => {
    expect(normalizePublicEnvValue(" https://example.supabase.co\r\n")).toBe("https://example.supabase.co");
    expect(normalizePublicEnvValue('"anon.key\n"')).toBe("anon.key");
    expect(normalizePublicEnvValue("'desktop-client-id'")).toBe("desktop-client-id");
  });

  it("vraci prazdny string pro chybejici hodnoty", () => {
    expect(normalizePublicEnvValue(undefined)).toBe("");
    expect(normalizePublicEnvValue("  ")).toBe("");
  });
});
