import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createUsageSessionId,
  shouldRecordUsageHeartbeat,
  useAppUsageHeartbeat,
} from "../app/hooks/useAppUsageHeartbeat";
import {
  clearCookieConsentDecision,
  setCookieConsentDecision,
} from "@/shared/privacy/cookieConsent";

const usageMocks = vi.hoisted(() => ({
  recordUsageHeartbeat: vi.fn(),
}));

vi.mock("@/infra/usage/appUsageService", () => ({
  recordUsageHeartbeat: usageMocks.recordUsageHeartbeat,
}));

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const setVisibleFocusedDocument = () => {
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => "visible",
  });
};

describe("useAppUsageHeartbeat", () => {
  beforeEach(() => {
    usageMocks.recordUsageHeartbeat.mockResolvedValue(true);
    window.localStorage.clear();
    clearCookieConsentDecision();
  });

  afterEach(() => {
    Reflect.deleteProperty(document, "visibilityState");
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    usageMocks.recordUsageHeartbeat.mockReset();
  });

  it("povolí heartbeat pro viditelné a aktivní okno", () => {
    expect(
      shouldRecordUsageHeartbeat({
        now: 10_000,
        lastActivityAt: 9_000,
        isDocumentVisible: true,
        isWindowFocused: true,
      }),
    ).toBe(true);
  });

  it("nepočítá heartbeat pro idle uživatele", () => {
    expect(
      shouldRecordUsageHeartbeat({
        now: 10 * 60_000,
        lastActivityAt: 4 * 60_000,
        isDocumentVisible: true,
        isWindowFocused: true,
      }),
    ).toBe(false);
  });

  it("nepočítá heartbeat pro skryté nebo rozostřené okno", () => {
    expect(
      shouldRecordUsageHeartbeat({
        now: 10_000,
        lastActivityAt: 9_000,
        isDocumentVisible: false,
        isWindowFocused: true,
      }),
    ).toBe(false);

    expect(
      shouldRecordUsageHeartbeat({
        now: 10_000,
        lastActivityAt: 9_000,
        isDocumentVisible: true,
        isWindowFocused: false,
      }),
    ).toBe(false);
  });

  it("generuje UUID kompatibilní fallback session ID", () => {
    vi.stubGlobal("crypto", {});

    expect(createUsageSessionId()).toMatch(UUID_REGEX);
  });

  it("bez analytického souhlasu heartbeat nespustí", async () => {
    const sessionId = "11111111-1111-4111-8111-111111111111";
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => sessionId) });
    setVisibleFocusedDocument();

    const { unmount } = renderHook(() => (
      useAppUsageHeartbeat({ enabled: true, sessionKey: "user-1" })
    ));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(usageMocks.recordUsageHeartbeat).not.toHaveBeenCalled();

    unmount();
  });

  it("odešle první heartbeat hned po aktivaci trackingu se souhlasem", async () => {
    const sessionId = "11111111-1111-4111-8111-111111111111";
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => sessionId) });
    setCookieConsentDecision("accepted_all");
    setVisibleFocusedDocument();

    const { unmount } = renderHook(() => (
      useAppUsageHeartbeat({ enabled: true, sessionKey: "user-1" })
    ));

    await waitFor(() => {
      expect(usageMocks.recordUsageHeartbeat).toHaveBeenCalledWith(sessionId, 1);
    });

    unmount();
  });

  it("otočí session ID po znovuzapnutí trackingu pro jiného uživatele", async () => {
    const firstSessionId = "11111111-1111-4111-8111-111111111111";
    const secondSessionId = "22222222-2222-4222-8222-222222222222";
    const randomUUID = vi.fn()
      .mockReturnValueOnce(firstSessionId)
      .mockReturnValueOnce(secondSessionId);
    vi.stubGlobal("crypto", { randomUUID });
    setCookieConsentDecision("accepted_all");
    setVisibleFocusedDocument();

    const { rerender, unmount } = renderHook(
      ({ enabled, sessionKey }: { enabled: boolean; sessionKey: string | null }) => (
        useAppUsageHeartbeat({ enabled, sessionKey })
      ),
      {
        initialProps: { enabled: true, sessionKey: "user-1" },
      },
    );

    await waitFor(() => {
      expect(usageMocks.recordUsageHeartbeat).toHaveBeenCalledWith(firstSessionId, 1);
    });

    usageMocks.recordUsageHeartbeat.mockClear();
    rerender({ enabled: false, sessionKey: null });
    rerender({ enabled: true, sessionKey: "user-2" });

    await waitFor(() => {
      expect(usageMocks.recordUsageHeartbeat).toHaveBeenCalledWith(secondSessionId, 1);
    });
    expect(randomUUID).toHaveBeenCalledTimes(2);

    unmount();
  });
});
