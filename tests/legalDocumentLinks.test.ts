import { describe, expect, it } from "vitest";
import { getLegalDocumentUrl } from "@/shared/legal/legalDocumentLinks";

describe("legalDocumentLinks", () => {
  it("na webu vrací absolutní URL na aktuální origin", () => {
    expect(
      getLegalDocumentUrl("/terms", {
        origin: "https://app.example.test",
        protocol: "https:",
      }),
    ).toBe("https://app.example.test/terms");
  });

  it("ve file protokolu vrací produkční webovou adresu", () => {
    expect(
      getLegalDocumentUrl("/privacy", {
        origin: "file://",
        protocol: "file:",
      }),
    ).toBe("https://www.tenderflow.cz/privacy");
  });
});
