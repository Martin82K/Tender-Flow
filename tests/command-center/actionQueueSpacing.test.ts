import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const commandCenterCss = readFileSync(
  join(process.cwd(), "features/command-center/command-center.css"),
  "utf8",
);

const cssBlockFor = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = commandCenterCss.match(new RegExp(`${escaped}\\s*\\{(?<body>[^}]*)\\}`, "s"));
  return match?.groups?.body ?? "";
};

describe("command center action queue spacing", () => {
  it("keeps queue content away from flush panel edges", () => {
    expect(cssBlockFor(".cc-queue")).toContain("padding: 0 clamp(14px, 2.2vw, 24px) 10px");
    expect(cssBlockFor(".cc-root .cc-queue-item__btn")).toContain("padding: 9px 10px");
    expect(cssBlockFor(".cc-task-quickadd")).toContain("padding: 10px clamp(24px, 3vw, 34px)");
  });
});
