import { describe, expect, it } from "vitest";
import { buildAppUrl, parseAppRoute } from "@/shared/routing/routeUtils";

describe("TODO routing", () => {
  it("sestaví URL samostatného TODO modulu", () => {
    expect(buildAppUrl("todo")).toBe("/app/todo");
  });

  it("přesměruje výchozí /app na TODO modul", () => {
    expect(parseAppRoute("/app", "")).toEqual({
      isApp: true,
      redirectTo: "/app/todo",
    });
  });

  it("rozpozná TODO modul z app routy", () => {
    expect(parseAppRoute("/app/todo", "")).toEqual({
      isApp: true,
      view: "todo",
    });
  });
});
