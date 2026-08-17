import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

const documentsSource = readSource(
  "features/projects/documents/ui/ProjectDocuments.tsx",
);
const documentLinksSource = readSource(
  "features/projects/documents/ui/DocsLinkSection.tsx",
);
const tenderPlanSource = readSource("features/projects/ui/TenderPlan.tsx");
const tenderPlanModelSource = readSource(
  "features/projects/model/tenderPlanModel.ts",
);
const pipelineOverviewSource = readSource(
  "features/projects/pipeline/ui/PipelineOverview.tsx",
);
const projectOverviewSource = readSource(
  "features/projects/ui/ProjectOverviewNew.tsx",
);
const demandOverviewSource = projectOverviewSource.slice(
  projectOverviewSource.indexOf('data-help-id="overview-demand-table"'),
  projectOverviewSource.length,
);

describe("compact project workspace layouts", () => {
  it("uses a compact, responsive and accessible Documents section switcher", () => {
    expect(documentsSource).toContain('data-layout-density="compact"');
    expect(documentsSource).toContain('role="tablist"');
    expect(documentsSource).toContain('role="tab"');
    expect(documentsSource).toContain("aria-selected={documentsSubTab ===");
    expect(documentsSource).toContain("tf-documents-tab");
    expect(documentsSource).toContain("overflow-x-auto");
    expect(documentsSource).not.toContain(
      'data-help-id="documents-tip"\n              className="mt-8 p-4 bg-blue-500/10',
    );
  });

  it("keeps document row actions visible and explicitly labelled", () => {
    expect(documentLinksSource).not.toContain(
      "opacity-0 group-hover:opacity-100",
    );
    expect(documentLinksSource).toContain('aria-label="Smazat odkaz"');
    expect(documentLinksSource).toContain("min-h-10 min-w-10");
  });

  it("uses a compact, tokenized Tender Plan toolbar and responsive table", () => {
    expect(tenderPlanSource).toContain('data-layout-density="compact"');
    expect(tenderPlanSource).toContain("aria-pressed={viewMode ===");
    expect(tenderPlanSource).toContain(
      'data-help-id="tender-plan-add"',
    );
    expect(tenderPlanSource).toContain("bg-primary px-3 py-2");
    expect(tenderPlanSource).toContain("hover:bg-primary/90");
    expect(tenderPlanSource).not.toContain(
      "bg-gradient-to-r from-emerald-600",
    );
    expect(tenderPlanSource).toContain("overflow-x-auto");
    expect(tenderPlanSource).toContain('aria-label="Upravit VŘ"');
    expect(tenderPlanSource).toContain('aria-label="Smazat VŘ"');
  });

  it("renders semantic statuses with restrained tonal badges", () => {
    expect(tenderPlanModelSource).toContain(
      "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    );
    expect(tenderPlanModelSource).toContain(
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    );
    expect(tenderPlanModelSource).toContain(
      "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    );
  });

  it("keeps the tender list calm while documenting row interaction", () => {
    expect(pipelineOverviewSource).toContain("onContextMenu={(event) =>");
    expect(pipelineOverviewSource).toContain('event.key === "ContextMenu"');
    expect(pipelineOverviewSource).toContain("event.shiftKey && event.key === \"F10\"");
    expect(pipelineOverviewSource).toContain('aria-label="Akce výběrového řízení"');
    expect(pipelineOverviewSource).not.toContain('title="Upravit"');
    expect(pipelineOverviewSource).not.toContain('title="Smazat"');
  });

  it("uses a restrained typographic hierarchy in the demand overview", () => {
    expect(demandOverviewSource).toContain("text-lg font-semibold");
    expect(demandOverviewSource).toContain("text-xs font-normal text-slate-500");
    expect(demandOverviewSource).not.toContain("font-black");
  });
});
