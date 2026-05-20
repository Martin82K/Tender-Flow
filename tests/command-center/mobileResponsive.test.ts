import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const commandCenterCss = readFileSync(
  join(process.cwd(), "features/command-center/command-center.css"),
  "utf8",
);

describe("command center mobile responsive styles", () => {
  it("obsahuje telefonní breakpoint pro hlavní zóny a ovládání", () => {
    expect(commandCenterCss).toContain("@media (max-width: 720px)");
    expect(commandCenterCss).toContain(".cc-header__actions .cc-btn");
    expect(commandCenterCss).toContain("flex: 1 1 132px");
    expect(commandCenterCss).toContain(".cc-zone--main-split");
    expect(commandCenterCss).toContain(".cc-zone--temporal-split");
    expect(commandCenterCss).toContain("grid-template-columns: 1fr !important");
  });

  it("skládá datově husté moduly do mobilního layoutu", () => {
    expect(commandCenterCss).toContain(".cc-kpi-row");
    expect(commandCenterCss).toContain(".cc-alert-strip");
    expect(commandCenterCss).toContain(".cc-filterbar");
    expect(commandCenterCss).toContain(".cc-project-row");
    expect(commandCenterCss).toContain("overflow-wrap: anywhere");
  });
});
