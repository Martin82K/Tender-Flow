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

  it("používá Appica komponenty i jejich stromově vytřesitelné ikony", () => {
    expect(shellDecor).toContain('from "@appica/ui-react"');
    expect(shellDecor).toContain("BackgroundPattern");
    expect(shellDecor).toContain("BorderBeam");
    expect(pipelineOverview).toContain("from '@appica/ui-react'");
    expect(pipelineOverview).toContain("from '@appica/icons-react'");
    expect(pipelineOverview).toContain("<Button");
    expect(pipelineOverview).toContain("<BuildingPlus");
  });
});
