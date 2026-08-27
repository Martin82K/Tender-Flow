import React from "react";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  complete: vi.fn(),
  navigate: vi.fn(),
  start: vi.fn(),
  subscribe: vi.fn(),
  syncSession: vi.fn(),
}));

vi.mock("@/infra/auth/authSessionStore", () => ({
  authSessionStore: {
    start: mocks.start,
    subscribe: mocks.subscribe,
    syncSession: mocks.syncSession,
  },
}));

vi.mock("@/infra/auth/microsoftAccountService", () => ({
  microsoftAccountService: {
    completeMicrosoftAccountConnection: mocks.complete,
  },
}));

vi.mock("@/shared/routing/router", () => ({
  navigate: mocks.navigate,
}));

import { MicrosoftConnectionCallback } from "@app/MicrosoftConnectionCallback";

describe("MicrosoftConnectionCallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.complete.mockResolvedValue(true);
    mocks.subscribe.mockImplementation((listener: (snapshot: { session: object }) => void) => {
      listener({ session: { access_token: "app-session" } });
      return vi.fn();
    });
    mocks.syncSession.mockResolvedValue(undefined);
  });

  it("po webovém Microsoft přihlášení dokončí Graph grant na cílové stránce", async () => {
    window.history.replaceState({}, "", "/app/projects?microsoft_provider=connected");

    render(<MicrosoftConnectionCallback />);

    await waitFor(() => expect(mocks.complete).toHaveBeenCalledTimes(1));
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("na stránce nastavení ponechá dokončení existujícímu stavovému panelu", async () => {
    window.history.replaceState({}, "", "/app/settings?microsoft_provider=connected");

    render(<MicrosoftConnectionCallback />);

    await Promise.resolve();
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it("při chybě přesměruje na stavový panel bez přenosu chybové zprávy v URL", async () => {
    window.history.replaceState({}, "", "/app/projects?microsoft_provider=connected");
    mocks.complete.mockRejectedValue(new Error("sensitive provider failure"));

    render(<MicrosoftConnectionCallback />);

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith(
      "/app/settings?tab=user&subTab=profile&microsoft_provider=connected",
      { replace: true },
    ));
    expect(mocks.navigate.mock.calls.flat().join(" ")).not.toContain("sensitive provider failure");
  });
});
