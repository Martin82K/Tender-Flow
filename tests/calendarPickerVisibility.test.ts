import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "index.css"), "utf8");
const projectOverview = readFileSync(
  join(process.cwd(), "features/projects/ui/ProjectOverviewNew.tsx"),
  "utf8",
);

describe("viditelnost nativních kalendářových ikon", () => {
  it.each(["date", "datetime-local", "month", "time"])(
    "ponechá nativně světlou ikonu pole %s v dark a space vzhledu",
    (inputType) => {
      expect(css).toContain(
        `html.dark input[type="${inputType}"]::-webkit-calendar-picker-indicator`,
      );
      expect(css).toContain(
        `html[data-skin="space"] input[type="${inputType}"]::-webkit-calendar-picker-indicator`,
      );
    },
  );

  it("nepoužívá jednorázovou opravu pouze pro termín nabídky", () => {
    expect(css).not.toContain("tf-offer-submission-deadline-input");
    expect(projectOverview).not.toContain("tf-offer-submission-deadline-input");
  });
});
