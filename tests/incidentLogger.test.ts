import { beforeEach, describe, expect, it, vi } from "vitest";

const setup = async () => {
  vi.resetModules();

  const storageMap: Record<string, string> = {};
  const rpc = vi.fn();

  vi.doMock("../services/supabase", () => ({
    supabase: {
      rpc,
    },
  }));

  vi.doMock("../services/platformAdapter", () => ({
    isDesktop: false,
    platformAdapter: {
      platform: {
        os: "web",
      },
      storage: {
        get: vi.fn(async (key: string) => storageMap[key] ?? null),
        set: vi.fn(async (key: string, value: string) => {
          storageMap[key] = value;
        }),
        delete: vi.fn(async (key: string) => {
          delete storageMap[key];
        }),
      },
    },
  }));

  vi.doMock("../config/version", () => ({
    APP_VERSION: "1.3.3-test",
  }));

  const logger = await import("../services/incidentLogger");
  return { logger, rpc, storageMap };
};

describe("incidentLogger", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("sanitizuje PII/tokeny a truncuje message/stack", async () => {
    const { logger, rpc } = await setup();
    rpc.mockResolvedValue({ data: "ok", error: null });

    await logger.logIncident({
      severity: "error",
      source: "renderer",
      category: "runtime",
      code: "test_error",
      message: "Kontakt admin@test.cz a použij Bearer abc.def.ghi token",
      stack: `authorization=supersecret\n${"x".repeat(5000)}`,
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    const payload = rpc.mock.calls[0][1].input;
    expect(payload.message).not.toContain("admin@test.cz");
    expect(payload.message).toContain("[redacted-email]");
    expect(payload.message).not.toContain("Bearer abc.def.ghi");
    expect(payload.message).toContain("Bearer [redacted-token]");
    expect(payload.stack).not.toContain("supersecret");
    expect(payload.stack).toContain("[redacted-token]");
    expect(String(payload.stack).length).toBeLessThanOrEqual(4001);
  });

  it("generuje stabilní fingerprint pro stejnou chybu", async () => {
    const { logger, rpc } = await setup();
    rpc.mockResolvedValue({ data: "ok", error: null });

    await logger.logIncident({
      severity: "error",
      source: "renderer",
      category: "auth",
      code: "AUTH_FAIL",
      message: "Auth failed",
      stack: "line1\nline2",
    });
    await logger.logIncident({
      severity: "error",
      source: "renderer",
      category: "auth",
      code: "AUTH_FAIL",
      message: "Auth failed",
      stack: "line1\nline2",
    });

    const first = rpc.mock.calls[0][1].input.fingerprint;
    const second = rpc.mock.calls[1][1].input.fingerprint;
    expect(first).toBe(second);
  });

  it("při výpadku frontuje incident a flush ho odešle později", async () => {
    const { logger, rpc, storageMap } = await setup();
    rpc
      .mockResolvedValueOnce({ data: null, error: { message: "network down" } })
      .mockResolvedValue({ data: "ok", error: null });

    await logger.logIncident({
      severity: "error",
      source: "renderer",
      category: "network",
      code: "NETWORK_DOWN",
      message: "Request failed",
    });

    expect(storageMap.app_incident_queue_v1).toBeTruthy();

    await logger.flushIncidentQueue();
    expect(storageMap.app_incident_queue_v1).toBeUndefined();
  });

  it("globální handlers logují window error", async () => {
    const { logger, rpc } = await setup();
    rpc.mockResolvedValue({ data: "ok", error: null });

    logger.initIncidentGlobalHandlers();
    window.dispatchEvent(new ErrorEvent("error", { message: "Unhandled crash" }));

    expect(rpc).toHaveBeenCalled();
    const hasWindowError = rpc.mock.calls.some(
      (call) => call[1].input.code === "WINDOW_ERROR",
    );
    expect(hasWindowError).toBe(true);
  });
});
