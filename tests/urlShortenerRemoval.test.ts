import { describe, expect, it } from "vitest";
import { parseAppRoute, DEFAULT_APP_URL } from "@shared/routing/routeUtils";
import { TOOLS_NAV_ITEM } from "@/config/navigation";
import { FEATURES } from "@/config/features";

describe("removed URL shortener", () => {
  it("redirects the retired route to the default app view", () => {
    expect(parseAppRoute("/app/url-shortener", "")).toEqual({ isApp: true, redirectTo: DEFAULT_APP_URL });
  });
  it("does not expose the retired tool or capability", () => {
    expect(TOOLS_NAV_ITEM.children?.some(item => String(item.settingsSubTab) === "urlShortener")).toBe(false);
    expect(Object.values(FEATURES)).not.toContain("url_shortener");
  });
});
