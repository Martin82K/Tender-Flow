import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const commandCenterCss = readFileSync(
  join(process.cwd(), "features/command-center/command-center.css"),
  "utf8",
);
const actionQueueSource = readFileSync(
  join(process.cwd(), "features/command-center/modules/action-queue/ActionQueueModule.tsx"),
  "utf8",
);

const cssBlockFor = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = commandCenterCss.match(new RegExp(`${escaped}\\s*\\{(?<body>[^}]*)\\}`, "s"));
  return match?.groups?.body ?? "";
};

describe("command center action queue spacing", () => {
  it("keeps queue content away from flush panel edges", () => {
    expect(cssBlockFor(".cc-queue")).toContain("padding: 8px clamp(14px, 2.2vw, 22px) 12px");
    expect(cssBlockFor(".cc-root .cc-queue-item__btn")).toContain("grid-template-columns: 30px minmax(0, 1fr) minmax(118px, 170px)");
    expect(cssBlockFor(".cc-root .cc-queue-item__btn")).toContain("min-height: 54px");
    expect(cssBlockFor(".cc-root .cc-queue-item__btn")).toContain("padding: 8px 10px");
  });

  it("neobsahuje inline quick-add v akční frontě", () => {
    expect(actionQueueSource).not.toContain("TaskQuickAdd");
    expect(actionQueueSource).toContain('data-help-id="command-action-queue"');
  });
});
