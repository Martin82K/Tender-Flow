import { describe, expect, it } from "vitest";
import { buildAppUrl, parseAppRoute } from "@/shared/routing/routeUtils";

describe("TODO routing", () => {
  it("sestaví URL samostatného TODO modulu", () => {
    expect(buildAppUrl("todo")).toBe("/app/todo");
  });

  it("zakóduje a rozpozná přímý odkaz na úkol", () => {
    const url = buildAppUrl("todo", { taskId: "task/a & b" });
    expect(url).toBe("/app/todo?taskId=task%2Fa+%26+b");
    const parsed = new URL(url, "https://example.test");
    expect(parseAppRoute(parsed.pathname, parsed.search)).toEqual({
      isApp: true,
      view: "todo",
      taskId: "task/a & b",
    });
  });

  it("ignoruje prázdný identifikátor úkolu", () => {
    expect(buildAppUrl("todo", { taskId: "" })).toBe("/app/todo");
    expect(parseAppRoute("/app/todo", "?taskId=")).toEqual({ isApp: true, view: "todo" });
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

  it("přesměruje historickou Command Center routu na TODO modul", () => {
    expect(parseAppRoute("/app/command-center", "")).toEqual({
      isApp: true,
      redirectTo: "/app/todo",
    });
  });
});
