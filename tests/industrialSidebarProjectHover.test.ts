import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "index.css"), "utf8");
const sidebarSource = readFileSync(join(process.cwd(), "components/Sidebar.tsx"), "utf8");

const cssBlockFor = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`^${escaped}\\s*\\{(?<body>[^}]*)\\}`, "ms"));
  return match?.groups?.body ?? "";
};

describe("industrial sidebar project hover", () => {
  it("blends the selected project into the industrial sidebar instead of using the white card surface", () => {
    const block = cssBlockFor('html[data-skin="industrial"] .tf-sidebar .tf-project-switcher');
    expect(block).toContain('background: transparent');
    expect(block).not.toContain('--tf-skin-card');
  });

  it("sizes all industrial project rows and their icons consistently", () => {
    expect(cssBlockFor('html[data-skin="industrial"] .tf-sidebar .tf-project-nav-row')).toContain('min-height: 1.625rem');
    expect(cssBlockFor('html[data-skin="industrial"] .tf-sidebar .tf-project-nav-row > .material-symbols-outlined')).toContain('font-size: 0.9375rem');
  });

  it("keeps compact project icon containers at least as wide as their glyphs", () => {
    const glyphBlock = cssBlockFor('html[data-skin] .tf-sidebar[data-compact="true"] .material-symbols-outlined');
    const iconBlock = cssBlockFor('html[data-skin="industrial"] .tf-sidebar[data-compact="true"] .material-symbols-outlined:not(.tf-sidebar-label)');
    const fontSize = Number(glyphBlock.match(/font-size:\s*(\d+)px/)?.[1]);
    expect(fontSize).toBeGreaterThan(0);
    for (const property of ['width', 'min-width', 'max-width']) {
      const width = Number(iconBlock.match(new RegExp(`(?:^|\\s)${property}:\\s*(\\d+)px`))?.[1]);
      expect(width).toBeGreaterThanOrEqual(fontSize);
    }
  });

  it("keeps report and tool hover backgrounds flush with the sidebar edges", () => {
    expect(sidebarSource).not.toContain('aria-label="Přehledy" className="px-3"');
    expect(sidebarSource).not.toContain('aria-label="Nástroje" className="px-3"');
    expect(sidebarSource).not.toContain('mt-1 ml-2 gap-1');
  });

  it("aligns full-width report and tool content with project rows in each skin", () => {
    expect(cssBlockFor('.tf-sidebar .tf-sidebar-menu > details > summary')).toContain('padding-inline: 1.5rem');
    expect(cssBlockFor('html[data-skin="industrial"] .tf-sidebar .tf-sidebar-menu > details > summary')).toContain('padding-inline: 0.5rem !important');
  });

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
