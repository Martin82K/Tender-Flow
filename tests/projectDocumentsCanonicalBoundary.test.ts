import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");

describe("project documents module boundary", () => {
  it("uses the canonical feature module without shared or legacy shims", () => {
    const layout = fs.readFileSync(
      path.join(root, "features/projects/ProjectLayout.tsx"),
      "utf8",
    );

    expect(layout).toContain(
      'from "@features/projects/documents/ui/ProjectDocuments"',
    );
    expect(
      fs.existsSync(path.join(root, "features/projects/documents/ui/ProjectDocuments.tsx")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(root, "features/projects/documents/model/useDocHubIntegration.ts")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(root, "shared/ui/projects/ProjectDocuments.tsx")),
    ).toBe(false);
    expect(
      fs.existsSync(path.join(root, "components/projectLayoutComponents/ProjectDocuments.tsx")),
    ).toBe(false);
    expect(fs.existsSync(path.join(root, "hooks/useDocHubIntegration.ts"))).toBe(false);
  });
});
