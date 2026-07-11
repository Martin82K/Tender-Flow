import { describe, expect, it } from "vitest";
import { createConsoleGuard } from "./utils/consoleGuard";

describe("consoleGuard", () => {
  it("fails with the unexpected console.error content", () => {
    const guard = createConsoleGuard();
    guard.capture("error", ["request failed", { code: "E_NETWORK" }]);

    expect(() => guard.verify()).toThrow(
      /Unexpected console\.error.*request failed.*E_NETWORK/s,
    );
  });

  it("fails with the unexpected console.warn content", () => {
    const guard = createConsoleGuard();
    guard.capture("warn", ["deprecated option"]);

    expect(() => guard.verify()).toThrow(
      /Unexpected console\.warn.*deprecated option/s,
    );
  });

  it("accepts explicitly expected text and regular expressions", () => {
    const guard = createConsoleGuard();
    guard.expect("error", "known failure");
    guard.expect("warn", /retry attempt \d/);

    guard.capture("error", ["known failure", { recoverable: true }]);
    guard.capture("warn", ["retry attempt 2"]);

    expect(() => guard.verify()).not.toThrow();
  });

  it("requires the declared number of matching calls", () => {
    const guard = createConsoleGuard();
    guard.expect("warn", /retry/, 2);
    guard.capture("warn", ["retry once"]);

    expect(() => guard.verify()).toThrow(
      /Missing expected console\.warn.*expected 2.*received 1/s,
    );
  });

  it("fails when an expected console call never happens", () => {
    const guard = createConsoleGuard();
    guard.expect("error", "must happen");

    expect(() => guard.verify()).toThrow(
      /Missing expected console\.error.*must happen/s,
    );
  });

  it("resets captured calls and expectations between tests", () => {
    const guard = createConsoleGuard();
    guard.expect("error", "old expected error");
    guard.capture("warn", ["old unexpected warning"]);

    guard.reset();

    expect(() => guard.verify()).not.toThrow();
  });
});
