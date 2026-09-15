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
  it("uses darker mobile industrial sidebar surfaces", () => {
    expect(css).toContain("@media (max-width: 767px)");
    expect(sidebarSource).not.toContain("bg-black/50 z-[-1] md:hidden");
    expect(css).toContain("background: var(--tf-skin-surface-deep) !important");
    expect(css).toContain("color: var(--tf-skin-text-2) !important");
    expect(css).toContain(
      'html[data-skin="industrial"] .tf-sidebar [data-help-id="sidebar-new-project"]',
    );
    expect(css).toContain("var(--tf-skin-orange) 12%, var(--tf-skin-surface) 88%");
    expect(css).toContain(
      'html[data-skin="industrial"] .tf-sidebar [data-help-id="sidebar-project-item"] > span:first-of-type',
    );
    expect(css).toContain("color: var(--tf-skin-orange-deep) !important");
    expect(css).toContain(
      'html[data-skin="industrial"] .tf-sidebar [data-help-id="sidebar-project-expand"]',
    );
    expect(css).toContain("var(--tf-skin-text) 78%, var(--tf-skin-muted) 22%");
    expect(css).toContain(
      'html[data-skin="industrial"] .tf-sidebar [data-help-id="sidebar-project-item"][data-active="true"]',
    );
    expect(css).toContain("var(--tf-skin-orange) 10%, var(--tf-skin-surface) 90%");
  });

  it("uses full-width readable hover targets for workspace sections", () => {
    const workspaceSource = readFileSync(join(process.cwd(), "features/projects/ui/ProjectSidebar.tsx"), "utf8");
    expect(workspaceSource).toContain('tf-project-nav-row');
    expect(workspaceSource).toContain('w-full');
    const hoverBlock = cssBlockFor('.tf-sidebar .tf-project-nav-row:hover');
    expect(hoverBlock).toContain('var(--tf-skin-surface-muted');
    const rowBlock = cssBlockFor('.tf-sidebar .tf-project-nav-row');
    expect(rowBlock).toContain('border-radius: 0 !important');
    expect(rowBlock).toContain('var(--tf-skin-text-2');
  });
});
