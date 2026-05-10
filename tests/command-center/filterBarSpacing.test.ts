import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const commandCenterCss = readFileSync(
  join(process.cwd(), "features/command-center/command-center.css"),
  "utf8",
);
const filterBarSource = readFileSync(
  join(process.cwd(), "features/command-center/modules/filter-bar/FilterBarModule.tsx"),
  "utf8",
);

const cssBlockFor = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = commandCenterCss.match(new RegExp(`${escaped}\\s*\\{(?<body>[^}]*)\\}`, "s"));
  return match?.groups?.body ?? "";
};

describe("command center filter bar spacing", () => {
  it("keeps health chips fully visible inside the filter row", () => {
    expect(filterBarSource).toContain("cc-filterbar__group--health");
    expect(filterBarSource).toContain("cc-chip--health");

    expect(cssBlockFor(".cc-filterbar__group")).toContain("gap: 5px");
    expect(cssBlockFor(".cc-filterbar__group-chips")).toContain("row-gap: 6px");
    expect(cssBlockFor(".cc-filterbar__group-chips")).toContain("padding-block: 2px");
    expect(cssBlockFor(".cc-root .cc-chip")).toContain("min-height: 24px");
    expect(cssBlockFor(".cc-root .cc-chip")).toContain("flex: 0 0 auto");
    expect(cssBlockFor(".cc-root .cc-chip")).toContain("line-height: 1");
    expect(cssBlockFor(".cc-root .cc-chip--health-crit")).toContain("min-width: 66px");
    expect(cssBlockFor(".cc-root .cc-chip--health-warn")).toContain("min-width: 58px");
    expect(cssBlockFor(".cc-root .cc-chip--health-ok")).toContain("min-width: 42px");
  });
});
