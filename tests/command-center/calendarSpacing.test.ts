import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const commandCenterCss = readFileSync(
  join(process.cwd(), "features/command-center/command-center.css"),
  "utf8",
).replace(/\r\n/g, "\n");

const cssBlockFor = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = commandCenterCss.match(new RegExp(`${escaped}\\s*\\{(?<body>[^}]*)\\}`, "s"));
  return match?.groups?.body ?? "";
};

describe("command center calendar spacing", () => {
  it("keeps upcoming event list content away from panel edges", () => {
    expect(cssBlockFor(".cc-cal__list")).toContain("padding: 0 10px 10px");
    expect(cssBlockFor(".cc-cal__list-head")).toContain("padding: 8px 4px 4px");
    expect(cssBlockFor(".cc-root .cc-cal__list .cc-cal__event-btn")).toContain("padding-inline: 8px");
  });

  it("keeps month date hover and keyboard focus visible", () => {
    const cellHover = cssBlockFor(".cc-cal__cell:hover,\n.cc-cal__cell:focus-visible");
    const todayHover = cssBlockFor(".cc-cal__cell--today:hover,\n.cc-cal__cell--today:focus-visible");

    expect(cellHover).toContain("background: var(--cc-blue-soft)");
    expect(cellHover).toContain("border-color: color-mix(in srgb, var(--cc-blue) 44%, transparent)");
    expect(cellHover).toContain("box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--cc-blue) 22%, transparent)");
    expect(cellHover).toContain("transform: translateY(-1px)");
    expect(todayHover).toContain("background: var(--cc-blue-soft)");
    expect(todayHover).toContain("border-color: var(--cc-blue)");
  });
});
