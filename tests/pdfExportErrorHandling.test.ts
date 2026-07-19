import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  PDF_EXPORT_ERROR_MESSAGE,
  runPdfExportSafely,
} from "@/shared/pdf/pdfExportError";

describe("PDF export error handling", () => {
  it("zobrazí bezpečnou uživatelskou chybu při selhání lazy runtime", async () => {
    const setError = vi.fn();

    const succeeded = await runPdfExportSafely(
      () => Promise.reject(new Error("Failed to fetch dynamically imported module")),
      setError,
    );

    expect(succeeded).toBe(false);
    expect(setError).toHaveBeenNthCalledWith(1, null);
    expect(setError).toHaveBeenNthCalledWith(2, PDF_EXPORT_ERROR_MESSAGE);
    expect(PDF_EXPORT_ERROR_MESSAGE).not.toContain("dynamically imported module");
  });

  it("obaluje všechny UI vstupy do lazy PDF exportu", () => {
    for (const modulePath of [
      "features/projects/ProjectOverview.tsx",
      "features/projects/ui/ProjectSchedule.tsx",
      "shared/contracts/MarkdownDocumentPanel.tsx",
    ]) {
      const source = readFileSync(resolve(process.cwd(), modulePath), "utf8");

      expect(source).toContain("runPdfExportSafely");
    }
  });
});
