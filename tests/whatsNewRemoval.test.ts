import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();

describe("odstranění modalu Co je nového", () => {
  it("nezapojuje modal ani jeho stav do aplikačního shellu", () => {
    const appContent = readFileSync(
      join(repositoryRoot, "app", "AppContent.tsx"),
      "utf-8",
    );

    expect(appContent).not.toContain("WhatsNewModal");
    expect(appContent).not.toContain("useWhatsNew");
  });

  it("neponechává nepoužívanou modalovou implementaci", () => {
    expect(
      existsSync(join(repositoryRoot, "features", "whats-new", "WhatsNewModal.tsx")),
    ).toBe(false);
    expect(
      existsSync(join(repositoryRoot, "features", "whats-new", "useWhatsNew.ts")),
    ).toBe(false);
  });
});
