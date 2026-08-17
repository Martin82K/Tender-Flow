import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { themeSkinOptions } from "@/shared/theme/appearanceOptions";

const css = readFileSync(join(process.cwd(), "index.css"), "utf8");
const shellDecor = readFileSync(
  join(process.cwd(), "shared/ui/SpaceShellDecor.tsx"),
  "utf8",
);
const pipelineOverview = readFileSync(
  join(process.cwd(), "features/projects/pipeline/ui/PipelineOverview.tsx"),
  "utf8",
);
const appContent = readFileSync(
  join(process.cwd(), "app/AppContent.tsx"),
  "utf8",
);
const projectManager = readFileSync(
  join(process.cwd(), "features/projects/ProjectManager.tsx"),
  "utf8",
);

describe("TF Space theme contract", () => {
  it("nabízí TF Space jako volitelný skin", () => {
    expect(themeSkinOptions).toContainEqual({
      id: "space",
      icon: "rocket_launch",
      label: "TF Space",
    });
  });

  it("balí lokální optimalizované kosmické pozadí", () => {
    const asset = join(
      process.cwd(),
      "assets/themes/space/tf-space-canvas.webp",
    );
    const size = statSync(asset).size;

    expect(size).toBeGreaterThan(50_000);
    expect(size).toBeLessThan(250_000);
  });

  it("načítá Appica styly a definuje přístupnou TF Space vrstvu", () => {
    expect(css).toContain('@import "@appica/ui-react/styles.css"');
    expect(css).toContain('@source "./node_modules/@appica/ui-react/dist/**/*.{js,mjs}"');
    expect(css).toContain('html[data-skin="space"]');
    expect(css).toContain("--tf-space-red: #f43f5e");
    expect(css).toContain("--tf-space-cyan: #67e8f9");
    expect(css).toContain(".tf-space-backdrop");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("@media (forced-colors: active)");
  });

  it("sjednocuje Appica tokeny a sdílené interaktivní prvky ve TF Space", () => {
    expect(css).toContain("--primary-muted: var(--tf-space-magenta)");
    expect(css).toContain("--secondary: var(--tf-space-blue)");
    expect(css).toContain("--background-muted: var(--tf-skin-surface-muted)");
    expect(css).toContain("--border-overlay: var(--tf-skin-line-2)");
    expect(css).toContain('html[data-skin="space"] .tf-account-menu-panel');
    expect(css).toContain('html[data-skin="space"] .tf-appearance-picker-positioner');
    expect(css).toContain('html[data-skin="space"] [data-slot="button"]');
    expect(css).toContain('html[data-skin="space"] [data-slot="toggle"]');
    expect(css).toContain(
      'html[data-skin="space"] .tf-account-menu-panel button:not([data-slot="toggle"]):not(.tf-ui-scale-button):not(:disabled):hover',
    );
    expect(css).toContain('html[data-skin="space"] .tf-themed-select-popover');
    expect(css).toContain('html[data-skin="space"] .tf-app-main input[type="checkbox"].peer:checked + div');
  });

  it("zvýrazňuje aktivní položku projektového menu invertovanou pill", () => {
    const activeProjectTabRule = css.match(
      /html\[data-skin="space"\] \.tf-topbar \[data-help-id="project-tabs"\] button\[data-active="true"\] \{([^}]*)\}/,
    );

    expect(activeProjectTabRule?.[1]).toContain("background: #ffffff !important");
    expect(activeProjectTabRule?.[1]).toContain("color: #050911 !important");
  });

  it("používá Appica komponenty i jejich stromově vytřesitelné ikony", () => {
    expect(shellDecor).toContain('from "@appica/ui-react"');
    expect(shellDecor).toContain("BackgroundPattern");
    expect(shellDecor).toContain("BorderBeam");
    expect(pipelineOverview).toContain("from '@appica/ui-react'");
    expect(pipelineOverview).toContain("from '@appica/icons-react'");
    expect(pipelineOverview).toContain("<Button");
    expect(pipelineOverview).toContain("<BuildingPlus");
  });

  it("používá pro aktivní dokumentovou záložku plný invertovaný stav", () => {
    expect(css).toContain('.tf-documents-tab[aria-selected="true"]');
    expect(css).toContain('color: var(--tf-settings-active-foreground) !important');
  });

  it("přebírá TF Space také na celé obrazovce Správa staveb", () => {
    expect(appContent).toContain("<ProjectManager");
    expect(appContent).toContain("skin={skin}");
    expect(projectManager).toContain("tf-project-manager-view");
    expect(projectManager).toContain('data-help-id="pm-create-section"');
    expect(projectManager).toContain('data-help-id="pm-project-list"');
    expect(projectManager).toContain('data-help-id="pm-edit-modal"');
    expect(projectManager).toContain('data-help-id="pm-share-modal"');
    expect(projectManager).toContain('data-help-id="pm-transfer-modal"');
    expect(css).toContain('html[data-skin="space"] .tf-project-manager-view');
    expect(css).toContain('html[data-skin="space"] .tf-project-manager-view [data-help-id="pm-create-section"]');
    expect(css).toContain('html[data-skin="space"] .tf-project-manager-view [data-help-id="pm-project-list"] [draggable="true"]');
    expect(css).toContain('html[data-skin="space"] .tf-project-manager-view [data-help-id="pm-project-actions"] button');
    expect(css).toContain('html[data-skin="space"] .tf-project-manager-view [data-help-id="pm-edit-modal"]');
  });
});
