import { beforeEach, describe, expect, it, vi } from "vitest";

describe("runtimeDiagnostics", () => {
  beforeEach(() => {
    vi.resetModules();
    window.sessionStorage.clear();
  });

  it("rediguje citlivé hodnoty v payloadu", async () => {
    const storageMap: Record<string, string> = {};

    vi.doMock("../services/platformAdapter", () => ({
      isDesktop: true,
      platformAdapter: {
        platform: { os: "darwin" },
        storage: {
          get: vi.fn(async (key: string) => storageMap[key] ?? null),
          set: vi.fn(async (key: string, value: string) => {
            storageMap[key] = value;
          }),
          delete: vi.fn(async (key: string) => {
            delete storageMap[key];
          }),
        },
        shell: {
          openTempFile: vi.fn(async () => undefined),
        },
      },
    }));

    const diagnostics = await import("../infra/diagnostics/runtimeDiagnostics");

    diagnostics.logRuntimeEvent("auth", "login_attempt", {
      email: "john@example.com",
      password: "very-secret",
      refreshToken: "abcd1234",
      nested: {
        authorization: "Bearer real-token",
      },
    });

    const snapshot = diagnostics.getRuntimeDiagnosticsSnapshot();
    expect(snapshot.events.length).toBeGreaterThan(0);
    const last = snapshot.events[snapshot.events.length - 1];
    const serialized = JSON.stringify(last.data);

    expect(serialized).toContain("[redacted]");
    expect(serialized).toContain("[redacted-email]");
    expect(serialized).not.toContain("very-secret");
    expect(serialized).not.toContain("real-token");
  });

  it("exportuje JSON přes desktop shell bridge", async () => {
    const openTempFile = vi.fn(async () => undefined);

    vi.doMock("../services/platformAdapter", () => ({
      isDesktop: true,
      platformAdapter: {
        platform: { os: "darwin" },
        storage: {
          get: vi.fn(async () => null),
          set: vi.fn(async () => undefined),
          delete: vi.fn(async () => undefined),
        },
        shell: {
          openTempFile,
        },
      },
    }));

    const diagnostics = await import("../infra/diagnostics/runtimeDiagnostics");
    diagnostics.logRuntimeEvent("router", "navigate", { to: "/login" });

    const result = await diagnostics.exportRuntimeDiagnostics();
    expect(result.success).toBe(true);
    expect(result.eventCount).toBeGreaterThan(0);
    expect(openTempFile).toHaveBeenCalledTimes(1);

    const [content, filename] = openTempFile.mock.calls[0];
    expect(String(filename)).toContain("tender-flow-debug-");
    expect(String(content)).toContain("\"events\"");
    expect(String(content)).toContain("\"router\"");
  });

  it("rediguje search/hash v route diagnostiky", async () => {
    const originalPathname = window.location.pathname;
    const originalSearch = window.location.search;
    const originalHash = window.location.hash;

    window.history.replaceState({}, "", "/reset-password?token=super-secret#access_token=very-secret");

    vi.doMock("../services/platformAdapter", () => ({
      isDesktop: false,
      platformAdapter: {
        platform: { os: "unknown" },
        storage: {
          get: vi.fn(async () => null),
          set: vi.fn(async () => undefined),
          delete: vi.fn(async () => undefined),
        },
        shell: {
          openTempFile: vi.fn(async () => undefined),
        },
      },
    }));

    const diagnostics = await import("../infra/diagnostics/runtimeDiagnostics");

    diagnostics.logRuntimeEvent("auth", "route_check");

    const snapshot = diagnostics.getRuntimeDiagnosticsSnapshot();
    const route = String(snapshot.events[snapshot.events.length - 1]?.route ?? "");

    expect(route).toBe("/reset-password?[redacted]#[redacted]");
    expect(route).not.toContain("super-secret");
    expect(route).not.toContain("very-secret");

    window.history.replaceState({}, "", `${originalPathname}${originalSearch}${originalHash}`);
  });

});

