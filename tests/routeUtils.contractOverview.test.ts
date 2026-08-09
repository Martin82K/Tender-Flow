import { describe, expect, it } from "vitest";
import { buildAppUrl, parseAppRoute } from "@/shared/routing/routeUtils";

describe("contract overview route", () => {
  it("builds and parses the organization contract overview URL", () => {
    expect(buildAppUrl("contract-overview")).toBe("/app/contract-overview");
    expect(parseAppRoute("/app/contract-overview", "")).toEqual({
      isApp: true,
      view: "contract-overview",
    });
  });
});
