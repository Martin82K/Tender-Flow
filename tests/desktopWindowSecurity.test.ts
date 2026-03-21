import { describe, expect, it } from "vitest";
import { buildMainWindowWebPreferences } from "../desktop/main/services/windowSecurity";

describe("desktop window security", () => {
  it("keeps renderer isolation and browser security enabled", () => {
    const preferences = buildMainWindowWebPreferences("/tmp/preload.js");

    expect(preferences).toEqual({
      preload: "/tmp/preload.js",
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    });
  });
});
