import { describe, expect, it } from "vitest";
import {
  buildBudgetAttachmentMetadata,
  getRelativePathWithinDirectory,
  isPathInsideDirectory,
  resolveBudgetAttachmentPath,
} from "@/features/projects/model/budgetAttachmentModel";

describe("budgetAttachmentModel", () => {
  it("povolí soubor uvnitř složky VŘ a uloží relativní cestu", () => {
    const attachment = buildBudgetAttachmentMetadata({
      tenderFolderPath: "/Projects/Stavba/03_Vyberova_rizeni/Betony",
      filePath: "/Projects/Stavba/03_Vyberova_rizeni/Betony/rozpocet cast A.xlsx",
      size: 1234,
    });

    expect(attachment).toEqual(
      expect.objectContaining({
        source: "dochub",
        fileName: "rozpocet cast A.xlsx",
        relativePath: "rozpocet cast A.xlsx",
        size: 1234,
        enabled: true,
      }),
    );
  });

  it("odmítne soubor mimo složku VŘ", () => {
    expect(
      getRelativePathWithinDirectory(
        "/Projects/Stavba/03_Vyberova_rizeni/Jine/rozpocet.xlsx",
        "/Projects/Stavba/03_Vyberova_rizeni/Betony",
      ),
    ).toBeNull();
  });

  it("správně vyhodnotí Windows cestu uvnitř složky VŘ", () => {
    expect(
      isPathInsideDirectory(
        "D:\\Stavba\\03_Vyberova_rizeni\\Betony\\casti\\rozpocet.xlsx",
        "D:\\Stavba\\03_Vyberova_rizeni\\Betony",
      ),
    ).toBe(true);
  });

  it("nepovolí path traversal v uložené relativní cestě", () => {
    expect(() =>
      resolveBudgetAttachmentPath("/Projects/Stavba/Betony", {
        source: "dochub",
        fileName: "hack.xlsx",
        relativePath: "../hack.xlsx",
        selectedAt: "2026-07-01T20:00:00.000Z",
        enabled: true,
      }),
    ).toThrow("Neplatná relativní cesta přílohy.");
  });
});
