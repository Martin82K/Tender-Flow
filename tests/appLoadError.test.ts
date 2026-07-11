import { describe, expect, it } from "vitest";
import { buildCoreDataLoadDiagnostic } from "@/shared/errors/appLoadError";

describe("core data load diagnostic", () => {
  it("does not classify a single query failure as a critical app load failure", () => {
    expect(
      buildCoreDataLoadDiagnostic([
        { query: "projects", error: new Error("timeout") },
        { query: "contacts", error: null },
      ]),
    ).toBeNull();
  });

  it("keeps query names and technical causes for the sanitized incident log", () => {
    expect(
      buildCoreDataLoadDiagnostic([
        { query: "projects", error: new Error("timeout") },
        { query: "contacts", error: new Error("connection refused") },
        { query: "contact_statuses", error: null },
      ]),
    ).toBe("projects: timeout | contacts: connection refused");
  });
});
