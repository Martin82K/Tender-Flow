import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("ThemedNativeSelect caret migration", () => {
  it("nevykresluje v migrovaných obrazovkách druhou externí šipku", () => {
    const overview = readFileSync(
      join(process.cwd(), "features/projects/ProjectOverview.tsx"),
      "utf8",
    );
    const tasks = readFileSync(
      join(process.cwd(), "features/tasks/ui/TasksPage.tsx"),
      "utf8",
    );

    expect(overview).not.toContain("<ChevronDown");
    expect(tasks).not.toContain("arrow_drop_down");
  });
});
