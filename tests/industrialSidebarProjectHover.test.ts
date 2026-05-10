import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "index.css"), "utf8");
const sidebarSource = readFileSync(join(process.cwd(), "components/Sidebar.tsx"), "utf8");

const cssBlockFor = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{(?<body>[^}]*)\\}`, "s"));
  return match?.groups?.body ?? "";
};

describe("industrial sidebar project hover", () => {
  it("uses a readable dark hover state for project rows", () => {
    expect(sidebarSource).toContain('data-help-id="sidebar-project-item"');
    expect(sidebarSource).toContain('data-help-id="sidebar-project-expand"');

    const hoverBlock = cssBlockFor(
      'html.dark[data-skin="industrial"] .tf-sidebar [data-help-id="sidebar-project-item"][data-active="false"]:hover',
    );
    const expandBlock = cssBlockFor(
      'html.dark[data-skin="industrial"] .tf-sidebar [data-help-id="sidebar-project-item"][data-active="false"]:hover [data-help-id="sidebar-project-expand"]',
    );

    expect(hoverBlock).toContain("var(--tf-skin-surface-muted) 88%");
    expect(hoverBlock).toContain("inset 2px 0 0 var(--tf-skin-orange)");
    expect(hoverBlock).toContain("color: var(--tf-skin-text) !important");
    expect(expandBlock).toContain("background: transparent !important");
    expect(expandBlock).toContain("color: var(--tf-skin-orange) !important");
  });
});
