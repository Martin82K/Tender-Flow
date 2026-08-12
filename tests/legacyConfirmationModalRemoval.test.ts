import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const consumers = [
  "components/layouts/MainLayout.tsx",
  "components/TemplateManager.tsx",
  "components/projectLayoutComponents/ProjectDocuments.tsx",
  "components/projectLayoutComponents/documents/dochub/DocHubHistory.tsx",
];

describe("legacy ConfirmationModal removal", () => {
  it("směruje produkční konzumenty na canonical shared UI", () => {
    for (const path of consumers) {
      const source = readFileSync(join(root, path), "utf8");
      expect(source, path).toContain("@shared/ui/ConfirmationModal");
    }
  });

  it("odstraňuje legacy kopii i její freeze výjimku", () => {
    expect(existsSync(join(root, "components/ConfirmationModal.tsx"))).toBe(false);

    const freezeConfig = readFileSync(
      join(root, "config/legacy-freeze.json"),
      "utf8",
    );
    expect(freezeConfig).not.toContain("components/ConfirmationModal.tsx");
  });
});
