import { describe, expect, it } from "vitest";
import { buildMainWindowWebPreferences } from "../desktop/main/services/windowSecurity";

describe("desktop window security", () => {
  it("keeps renderer isolation and browser security enabled", () => {
    const preferences = buildMainWindowWebPreferences("/tmp/preload.js");

    expect(preferences).toEqual({
      preload: "/tmp/preload.js",
      additionalArguments: [],
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    });
  });

  it("allows passing sanitized renderer bootstrap arguments without weakening isolation", () => {
    const preferences = buildMainWindowWebPreferences("/tmp/preload.js", [
      "--tender-flow-public-env=%7B%7D",
    ]);

    expect(preferences.additionalArguments).toEqual(["--tender-flow-public-env=%7B%7D"]);
    expect(preferences.contextIsolation).toBe(true);
    expect(preferences.nodeIntegration).toBe(false);
    expect(preferences.sandbox).toBe(true);
    expect(preferences.webSecurity).toBe(true);
  });
});
