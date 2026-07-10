import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type WorkflowMap = {
  groups: Array<{ id: string; label: string; color: string }>;
  packages: Array<{ id: string; label: string; group: string; paths: string[] }>;
  flows: Array<{
    id: string;
    label: string;
    summary: string;
    entryAction: string;
    risk: string;
    aliases?: string[];
    steps: Array<{ from: string; to: string; label: string; detail: string; data: string }>;
  }>;
};

const docsDir = join(process.cwd(), "docs");
const map = JSON.parse(
  readFileSync(join(docsDir, "workflow-flows.json"), "utf8"),
) as WorkflowMap;
const html = readFileSync(join(docsDir, "workflow-map.html"), "utf8");

describe("workflow map documentation", () => {
  it("keeps JSON package and flow references internally consistent", () => {
    const groupIds = new Set(map.groups.map((group) => group.id));
    const packageIds = new Set(map.packages.map((pkg) => pkg.id));

    expect(packageIds.size).toBe(map.packages.length);
    expect(map.flows.length).toBeGreaterThanOrEqual(8);

    for (const pkg of map.packages) {
      expect(groupIds.has(pkg.group), `${pkg.id} references missing group ${pkg.group}`).toBe(true);
      expect(pkg.paths.length, `${pkg.id} should document at least one path`).toBeGreaterThan(0);
    }

    for (const flow of map.flows) {
      expect(flow.steps.length, `${flow.id} should have annotated handoff steps`).toBeGreaterThan(2);
      for (const step of flow.steps) {
        expect(packageIds.has(step.from), `${flow.id} from=${step.from}`).toBe(true);
        expect(packageIds.has(step.to), `${flow.id} to=${step.to}`).toBe(true);
        expect(step.data.trim(), `${flow.id} should document passed data`).not.toBe("");
      }
    }
  });

  it("covers the requested example workflows", () => {
    const searchableFlows = map.flows.map((flow) =>
      [flow.id, flow.label, flow.entryAction, ...(flow.aliases || [])].join(" ").toLowerCase(),
    );

    expect(searchableFlows.some((flow) => flow.includes("invite new user"))).toBe(true);
    expect(searchableFlows.some((flow) => flow.includes("todesktop build"))).toBe(true);
    expect(searchableFlows.some((flow) => flow.includes("desktop build"))).toBe(true);
  });

  it("keeps the HTML single-page, local, and JSON-driven", () => {
    expect(html).toContain("workflow-flows.json");
    expect(html).toContain("fetch(DATA_URL");
    expect(html).not.toMatch(/<script[^>]+src=/i);
    expect(html).not.toMatch(/<link[^>]+href=["']https?:/i);
    expect(html).not.toContain(".innerHTML");
  });
});
