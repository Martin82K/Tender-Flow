import { describe, expect, it } from "vitest";
import { buildAppUrl } from "@/shared/routing/routeUtils";

describe("buildAppUrl documentsSubTab", () => {
  it("přidá documentsSubTab do URL projektu", () => {
    expect(
      buildAppUrl("project", {
        projectId: "project-1",
        tab: "documents",
        documentsSubTab: "dochub",
      }),
    ).toBe("/app/project/project-1?tab=documents&documentsSubTab=dochub");
  });
});
