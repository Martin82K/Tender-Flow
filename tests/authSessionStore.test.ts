import { afterEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  unsubscribe: vi.fn(),
  getSession: vi.fn(async () => ({ data: { session: null } })),
  onAuthStateChange: vi.fn(),
  authChangeCallback: null as ((event: string, session: any) => void) | null,
}));

mockState.onAuthStateChange.mockImplementation(
  (callback: (event: string, session: any) => void) => {
    mockState.authChangeCallback = callback;
    return {
      data: {
        subscription: {
          unsubscribe: mockState.unsubscribe,
        },
      },
    };
  },
);

vi.mock("@/services/supabase", () => ({
  supabase: {
    auth: {
      onAuthStateChange: mockState.onAuthStateChange,
      getSession: mockState.getSession,
    },
  },
}));

import { authSessionStore } from "@/infra/auth/authSessionStore";

const resetStore = () => {
  authSessionStore.stop();
  (authSessionStore as any).snapshot = null;
};

afterEach(() => {
  resetStore();
  mockState.authChangeCallback = null;
  mockState.onAuthStateChange.mockClear();
  mockState.getSession.mockClear();
  mockState.unsubscribe.mockClear();
});

describe("AuthSessionStore", () => {
  it("registers a single Supabase auth listener", () => {
    authSessionStore.start();
    authSessionStore.start();

    expect(mockState.onAuthStateChange).toHaveBeenCalledTimes(1);
  });

  it("publishes auth token updates to subscribers", () => {
    const listener = vi.fn();
    authSessionStore.start();
    const stopListening = authSessionStore.subscribe(listener);

    mockState.authChangeCallback?.("SIGNED_IN", { access_token: "token-123" });

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "SIGNED_IN",
        accessToken: "token-123",
      }),
    );

    stopListening();
  });

  it("deduplicates concurrent syncSession calls", async () => {
    await Promise.all([authSessionStore.syncSession(), authSessionStore.syncSession()]);
    expect(mockState.getSession).toHaveBeenCalledTimes(1);
  });
});
