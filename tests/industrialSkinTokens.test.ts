import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "index.css"), "utf8");
const sidebarSource = readFileSync(join(process.cwd(), "components/Sidebar.tsx"), "utf8");
const tenderPlanSource = readFileSync(join(process.cwd(), "components/TenderPlan.tsx"), "utf8");
const pipelineSource = readFileSync(join(process.cwd(), "components/Pipeline.tsx"), "utf8");
const modalSource = readFileSync(join(process.cwd(), "shared/ui/Modal.tsx"), "utf8");
const categoryFormModalSource = readFileSync(join(process.cwd(), "components/pipelineComponents/CategoryFormModal.tsx"), "utf8");

const cssBlockFor = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blocks = [...css.matchAll(new RegExp(`${escaped}\\s*\\{(?<body>[^}]*)\\}`, "gs"))];
  return blocks.map((match) => match.groups?.body ?? "").find((body) => body.includes("background:")) ?? "";
};

describe("industrial skin tokens", () => {
  it("drží papírovou paletu z HTML předlohy", () => {
    expect(css).toContain("--tf-skin-bg: #f6f4ee");
    expect(css).toContain("--tf-skin-surface-deep: #e6e0d2");
    expect(css).toContain("--tf-skin-surface-muted: #ece8de");
    expect(css).toContain("--tf-skin-card: #ffffff");
    expect(css).toContain("--tf-skin-orange: #ff8a33");
    expect(css).toContain("--tf-skin-orange-deep: #b03a05");
  });

  it("aplikuje blueprint mřížku jako součást skin vrstvy", () => {
    expect(css).toContain("linear-gradient(var(--tf-skin-grid) 1px, transparent 1px)");
    expect(css).toContain("120px 120px");
  });

  it("má samostatné světlé i tmavé industrial tokeny a shell selektory", () => {
    expect(css).toContain('html[data-skin="industrial"]');
    expect(css).toContain('html.dark[data-skin="industrial"]');
    expect(css).toContain("color-scheme: light");
    expect(css).toContain("color-scheme: dark");
    expect(css).toContain(".tf-app-main");
    expect(css).toContain(".tf-project-shell");
    expect(css).toContain(".tf-sidebar");
    expect(css).toContain(".tf-topbar");
  });

  it("přepisuje průřezové taby a přepínače mimo classic pill vzhled", () => {
    expect(css).toContain("[data-help-id=\"overview-demand-table\"]");
    expect(css).toContain("[data-help-id=\"pipeline-filters\"]");
    expect(css).toContain("[data-help-id=\"pipeline-view-toggle\"]");
    expect(css).toContain("[data-help-id=\"schedule-controls\"] > div");
    expect(css).toContain("[data-help-id=\"contracts-subtabs\"]");
    expect(css).toContain("[data-help-id=\"contracts-view-toggle\"]");
    expect(css).toContain("[data-help-id=\"contracts-list-filters\"]");
    expect(css).toContain("background: transparent !important");
    expect(css).toContain("border-radius: 0 !important");
  });

  it("skin Smluv má KPI strip, list a detailový rail jako samostatnou vrstvu", () => {
    expect(css).toContain("[data-help-id=\"contracts-kpi-strip\"]");
    expect(css).toContain("[data-help-id=\"contracts-kpi-card\"]");
    expect(css).toContain("[data-help-id=\"contracts-list-rail\"]");
    expect(css).toContain("[data-help-id=\"contract-detail-shell\"]");
    expect(css).toContain("[data-help-id=\"contract-detail-rail\"]");
    expect(css).toContain("[data-help-id=\"contracts-investor-kpi-card\"]");
    expect(css).toContain("[data-help-id=\"contracts-investor-panel\"]");
    expect(css).toContain("grid-template-columns: minmax(132px, 156px) minmax(0, 1fr)");
  });

  it("plná industrial CTA drží teplou oranžovou akci bez zelené a cihlové výplně", () => {
    const pipelineCta = cssBlockFor('html[data-skin="industrial"] [data-help-id="pipeline-add-category"]');
    const investorSave = cssBlockFor('html[data-skin="industrial"] [data-help-id="contracts-investor-save"]');

    expect(pipelineCta).toContain("linear-gradient(180deg, #ffb052 0%, var(--tf-skin-orange) 100%)");
    expect(investorSave).toContain("linear-gradient(180deg, #ffb052 0%, var(--tf-skin-orange) 100%)");
    expect(`${pipelineCta}\n${investorSave}`).not.toContain("--tf-skin-green");
    expect(`${pipelineCta}\n${investorSave}`).not.toContain("--tf-skin-orange-deep");
  });

  it("industrial průřez zachová canvas i pro Plán VŘ a Pipeline", () => {
    expect(tenderPlanSource).toContain("tf-tender-plan-view");
    expect(tenderPlanSource).toContain('data-help-id="tender-plan-add"');
    expect(pipelineSource).toContain("tf-pipeline-view");
    expect(css).toContain(".tf-tender-plan-view");
    expect(css).toContain(".tf-pipeline-view");
    expect(css).toContain('html[data-skin="industrial"] .tf-tender-plan-view');
    expect(css).toContain('html[data-skin="industrial"] .tf-pipeline-view');
  });

  it("industrial modály mají sdílené skin třídy i pro ruční pipeline dialogy", () => {
    expect(modalSource).toContain("tf-modal-overlay");
    expect(modalSource).toContain("tf-modal-panel");
    expect(modalSource).toContain("tf-modal-footer");
    expect(categoryFormModalSource).toContain('data-help-id="pipeline-category-form-modal"');
    expect(categoryFormModalSource).toContain("tf-pipeline-modal-panel");
    expect(css).toContain(".tf-modal-overlay");
    expect(css).toContain(".tf-modal-panel");
    expect(css).toContain(".tf-pipeline-modal-panel");
  });

  it("zmenšuje industrial submenu ikony ve stavbách", () => {
    expect(sidebarSource).toContain("inline-flex size-7");
    expect(sidebarSource).toContain('text-[14px] w-4');
    expect(sidebarSource).not.toContain('text-[20px] w-4');
  });
});
