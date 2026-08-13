import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("legacy AlertModal removal", () => {
  it("směruje DocHub history na canonical shared UI", () => {
    const source = readFileSync(
      join(
        root,
        "features/projects/documents/ui/dochub/DocHubHistory.tsx",
      ),
      "utf8",
    );

    expect(source).toContain("@shared/ui/AlertModal");
  });

  it("odstraňuje legacy kopii i její freeze výjimku", () => {
    expect(existsSync(join(root, "components/AlertModal.tsx"))).toBe(false);

    const freezeConfig = readFileSync(
      join(root, "config/legacy-freeze.json"),
      "utf8",
    );
    expect(freezeConfig).not.toContain("components/AlertModal.tsx");
  });
});
