import { describe, expect, it } from "vitest";
import { normalizeSecret } from "../supabase/functions/_shared/env";

describe("normalizeSecret", () => {
  it("vrati null pro prazdnou hodnotu", () => {
    expect(normalizeSecret("   ")).toBeNull();
    expect(normalizeSecret(null)).toBeNull();
  });

  it("odstrani obalove uvozovky", () => {
    expect(normalizeSecret("\"sk-test-123\"")).toBe("sk-test-123");
    expect(normalizeSecret("'sk-test-456'")).toBe("sk-test-456");
  });

  it("zachova validni neobalenou hodnotu", () => {
    expect(normalizeSecret("sk-live-789")).toBe("sk-live-789");
  });
});
