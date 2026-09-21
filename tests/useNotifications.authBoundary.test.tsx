import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthIdentity } from "@shared/auth/AuthIdentityContext";
import type { AppNotification } from "@features/notifications/types";

type SubscriptionOptions = {
  userId: string | undefined;
  enabled: boolean;
  onNotificationsChanged: (userId: string) => void;
  onConnectionChange: (connected: boolean, userId: string) => void;
  onNewNotification: (
    notification: AppNotification,
    sourceUserId: string,
  ) => void;
};

const state = vi.hoisted(() => ({
  identity: null as AuthIdentity | null,
  legacyIdentity: null as AuthIdentity | null,
  subscriptionOptions: null as SubscriptionOptions | null,
  getNotifications: vi.fn(),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
  dismiss: vi.fn(),
  dismissAll: vi.fn(),
  showDesktopNotification: vi.fn(),
  legacyUseAuth: vi.fn(),
}));

vi.mock("@shared/auth/AuthIdentityContext", () => ({
  useAuthIdentity: () => state.identity,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: state.legacyUseAuth,
}));

vi.mock("@features/notifications/api/notificationApi", () => ({
  notificationApi: {
    getNotifications: state.getNotifications,
    markRead: state.markRead,
    markAllRead: state.markAllRead,
    dismiss: state.dismiss,
    dismissAll: state.dismissAll,
    showDesktopNotification: state.showDesktopNotification,
  },
}));

vi.mock("@features/notifications/hooks/useNotificationSubscription", () => ({
  useNotificationSubscription: (options: SubscriptionOptions) => {
    state.subscriptionOptions = options;
  },
}));

import { useNotifications } from "@features/notifications/hooks/useNotifications";

const userA: AuthIdentity = {
  id: "user-a",
  email: "a@example.com",
  role: "user",
};
const userB: AuthIdentity = {
  id: "user-b",
  email: "b@example.com",
  role: "admin",
};
const demoUser: AuthIdentity = {
  id: "demo-user",
  email: "demo@example.com",
  role: "demo",
};

const makeNotification = (
  id: string,
  overrides: Partial<AppNotification> = {},
): AppNotification => ({
  id,
  type: "info",
  title: `Notifikace ${id}`,
  body: null,
  created_at: "2026-07-11T10:00:00.000Z",
  read_at: null,
  category: "system",
  action_url: null,
  entity_type: null,
  entity_id: null,
  dismissed_at: null,
  ...overrides,
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    reject = nextReject;
    resolve = nextResolve;
  });
  return { promise, resolve, reject };
};

const flushPromises = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe("useNotifications auth boundary", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    state.identity = userB;
    state.legacyIdentity = userA;
    state.subscriptionOptions = null;
    state.legacyUseAuth.mockReset();
    state.legacyUseAuth.mockImplementation(() => ({
      user: state.legacyIdentity,
    }));
    state.getNotifications.mockReset();
    state.getNotifications.mockResolvedValue([makeNotification("initial")]);
    state.markRead.mockReset();
    state.markRead.mockResolvedValue(true);
    state.markAllRead.mockReset();
    state.markAllRead.mockResolvedValue(undefined);
    state.dismiss.mockReset();
    state.dismiss.mockResolvedValue(true);
    state.dismissAll.mockReset();
    state.dismissAll.mockResolvedValue(1);
    state.showDesktopNotification.mockReset();
    state.showDesktopNotification.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads, polls and subscribes for the shared identity", async () => {
    const { result } = renderHook(() => useNotifications(true));
    await flushPromises();

    expect(state.legacyUseAuth).not.toHaveBeenCalled();
    expect(state.getNotifications).toHaveBeenCalledWith(30);
    expect(state.subscriptionOptions).toMatchObject({
      userId: "user-b",
      enabled: true,
    });
    expect(result.current.notifications.map((item) => item.id)).toEqual(["initial"]);
    expect(result.current.unreadCount).toBe(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300_000);
    });
    expect(state.getNotifications).toHaveBeenCalledTimes(2);

    await act(async () => {
      await result.current.refresh();
    });
    expect(state.getNotifications).toHaveBeenCalledTimes(3);
  });

  it("stops polling while connected and resumes after an outage", async () => {
    renderHook(() => useNotifications(true));
    await flushPromises();
    act(() => state.subscriptionOptions?.onConnectionChange(true, "user-b"));
    await act(async () => { await vi.advanceTimersByTimeAsync(600_000); });
    expect(state.getNotifications).toHaveBeenCalledTimes(1);
    act(() => state.subscriptionOptions?.onConnectionChange(false, "user-b"));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(state.getNotifications).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(270_000); });
    expect(state.getNotifications).toHaveBeenCalledTimes(2);
    state.getNotifications.mockResolvedValue([makeNotification("during-outage")]);
    act(() => state.subscriptionOptions?.onConnectionChange(true, "user-b"));
    await flushPromises();
    expect(state.getNotifications).toHaveBeenCalledTimes(3);
    await act(async () => { await vi.advanceTimersByTimeAsync(600_000); });
    expect(state.getNotifications).toHaveBeenCalledTimes(3);
  });

  it("hides immediately, suppresses stale loads and restores a failed dismissal", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const pending = deferred<boolean>();
    state.dismiss.mockReturnValue(pending.promise);
    const { result } = renderHook(() => useNotifications(true));
    await flushPromises();
    let dismissal!: Promise<void>;
    act(() => { dismissal = result.current.dismiss("initial"); });
    expect(result.current.notifications).toEqual([]);
    await act(async () => { await result.current.refresh(); });
    expect(result.current.notifications).toEqual([]);
    pending.reject(new Error("network unavailable"));
    await act(async () => { await dismissal; });
    expect(result.current.notifications.map(n => n.id)).toEqual(["initial"]);
    expect(result.current.dismissError).toBeTruthy();
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });

  it("does not restore a failed dismissal into another account", async () => {
    const pending = deferred<boolean>();
    state.dismiss.mockReturnValue(pending.promise);
    const { result, rerender } = renderHook(() => useNotifications(true));
    await flushPromises();
    let dismissal!: Promise<void>;
    act(() => { dismissal = result.current.dismiss("initial"); });
    state.identity = userA;
    state.getNotifications.mockResolvedValue([makeNotification("user-a")]);
    rerender();
    await flushPromises();
    pending.reject(new Error("network unavailable"));
    await act(async () => { await dismissal; });
    expect(result.current.notifications.map(n => n.id)).toEqual(["user-a"]);
    expect(result.current.dismissError).toBeNull();
  });

  it("treats an already dismissed notification as an idempotent success", async () => {
    state.dismiss.mockResolvedValue(false);
    const { result } = renderHook(() => useNotifications(true));
    await flushPromises();
    await act(async () => { await result.current.dismiss("initial"); });
    expect(result.current.notifications).toEqual([]);
    expect(result.current.dismissError).toBeNull();
  });

  it("refreshes changes from another tab without desktop alerts", async () => {
    const { result } = renderHook(() => useNotifications(true));
    await flushPromises();
    state.getNotifications.mockResolvedValue([]);
    act(() => state.subscriptionOptions?.onNotificationsChanged("user-a"));
    expect(state.getNotifications).toHaveBeenCalledTimes(1);
    act(() => state.subscriptionOptions?.onNotificationsChanged("user-b"));
    await flushPromises();
    expect(result.current.notifications).toEqual([]);
    expect(state.showDesktopNotification).not.toHaveBeenCalled();
  });

  it("retries a failed snapshot even when realtime is connected", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    state.getNotifications.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => useNotifications(true));
    act(() => state.subscriptionOptions?.onConnectionChange(true, "user-b"));
    await flushPromises();
    await act(async () => { await vi.advanceTimersByTimeAsync(300_000); });
    expect(result.current.notifications.map(n => n.id)).toEqual(["initial"]);
    await act(async () => { await vi.advanceTimersByTimeAsync(600_000); });
    expect(state.getNotifications).toHaveBeenCalledTimes(2);
    consoleError.mockRestore();
  });

  it("does not send desktop alerts for routine successes", async () => {
    renderHook(() => useNotifications(true));
    await flushPromises();
    act(() => state.subscriptionOptions?.onNewNotification(makeNotification("success", { type: "success" }), "user-b"));
    expect(state.showDesktopNotification).not.toHaveBeenCalled();
  });

  it("normalizes the shared identity before network work", async () => {
    state.identity = { ...userB, id: "  user-b  " };
    const { result } = renderHook(() => useNotifications(true));
    await flushPromises();

    expect(state.subscriptionOptions).toMatchObject({
      userId: "user-b",
      enabled: true,
    });
    expect(result.current.notifications.map((item) => item.id)).toEqual(["initial"]);
  });

  it.each([
    ["missing", null, true],
    ["demo", demoUser, true],
    ["empty id", { ...userB, id: "" }, true],
    ["disabled", userB, false],
  ])("does not read, subscribe or mutate for %s state", async (_label, identity, enabled) => {
    state.identity = identity;
    state.legacyIdentity = identity;
    const { result } = renderHook(() => useNotifications(enabled));
    await flushPromises();

    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.isLoading).toBe(false);
    expect(state.getNotifications).not.toHaveBeenCalled();
    expect(state.subscriptionOptions).toMatchObject({
      userId: undefined,
      enabled: false,
    });

    await act(async () => {
      await result.current.refresh();
      await result.current.markRead("notification-1");
      await result.current.markAllRead();
      await result.current.dismiss("notification-1");
      await result.current.dismissAll();
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(state.getNotifications).not.toHaveBeenCalled();
    expect(state.markRead).not.toHaveBeenCalled();
    expect(state.markAllRead).not.toHaveBeenCalled();
    expect(state.dismiss).not.toHaveBeenCalled();
    expect(state.dismissAll).not.toHaveBeenCalled();
    expect(state.showDesktopNotification).not.toHaveBeenCalled();
  });

  it("isolates an identity switch from a delayed previous load", async () => {
    const loadA = deferred<AppNotification[]>();
    state.identity = userA;
    state.legacyIdentity = userA;
    state.getNotifications
      .mockReset()
      .mockReturnValueOnce(loadA.promise)
      .mockResolvedValueOnce([makeNotification("user-b")]);
    const { result, rerender } = renderHook(() => useNotifications(true));
    await flushPromises();

    state.identity = userB;
    state.legacyIdentity = userB;
    rerender();
    await flushPromises();

    expect(result.current.notifications.map((item) => item.id)).toEqual(["user-b"]);
    expect(state.subscriptionOptions?.userId).toBe("user-b");

    loadA.resolve([makeNotification("stale-user-a")]);
    await flushPromises();

    expect(result.current.notifications.map((item) => item.id)).toEqual(["user-b"]);
  });

  it("ignores stale realtime events and preserves deduplication", async () => {
    state.getNotifications.mockResolvedValue([]);
    const { result } = renderHook(() => useNotifications(true));
    await flushPromises();
    const onNewNotification = state.subscriptionOptions?.onNewNotification;
    expect(onNewNotification).toBeTypeOf("function");

    act(() => {
      onNewNotification?.(
        makeNotification("stale", { type: "warning" }),
        "user-a",
      );
    });
    expect(result.current.notifications).toEqual([]);
    expect(state.showDesktopNotification).not.toHaveBeenCalled();

    const current = makeNotification("current", { type: "warning" });
    act(() => {
      onNewNotification?.(current, "user-b");
      onNewNotification?.(current, "user-b");
    });
    expect(result.current.notifications).toEqual([current]);
    expect(state.showDesktopNotification).toHaveBeenCalledTimes(1);
  });

  it("applies mutation results only to the still-active identity", async () => {
    const initial = makeNotification("notification-1");
    state.getNotifications.mockResolvedValue([initial]);
    const markReadRequest = deferred<boolean>();
    state.markRead.mockReturnValue(markReadRequest.promise);
    const { result, rerender } = renderHook(() => useNotifications(true));
    await flushPromises();

    let markReadPromise!: Promise<void>;
    act(() => {
      markReadPromise = result.current.markRead(initial.id);
    });

    state.identity = userA;
    state.legacyIdentity = userA;
    state.getNotifications.mockResolvedValue([makeNotification("user-a")]);
    rerender();
    await flushPromises();
    markReadRequest.resolve(true);
    await act(async () => {
      await markReadPromise;
    });

    expect(result.current.notifications.map((item) => item.id)).toEqual(["user-a"]);
  });

  it("applies all successful mutations to the active identity", async () => {
    state.getNotifications.mockResolvedValue([
      makeNotification("notification-1"),
      makeNotification("notification-2"),
      makeNotification("notification-3"),
    ]);
    const { result } = renderHook(() => useNotifications(true));
    await flushPromises();

    await act(async () => {
      await result.current.markRead("notification-1");
    });
    expect(state.markRead).toHaveBeenCalledWith("notification-1");
    expect(
      result.current.notifications.find(
        (notification) => notification.id === "notification-1",
      )?.read_at,
    ).not.toBeNull();
    expect(result.current.unreadCount).toBe(2);

    await act(async () => {
      await result.current.dismiss("notification-2");
    });
    expect(state.dismiss).toHaveBeenCalledWith("notification-2");
    expect(result.current.notifications.map((notification) => notification.id)).toEqual([
      "notification-1",
      "notification-3",
    ]);

    await act(async () => {
      await result.current.markAllRead();
    });
    expect(state.markAllRead).toHaveBeenCalledTimes(1);
    expect(result.current.unreadCount).toBe(0);

    await act(async () => {
      await result.current.dismissAll();
    });
    expect(state.dismissAll).toHaveBeenCalledTimes(1);
    expect(result.current.notifications).toEqual([]);
  });

  it("preserves active state when notification mutations fail", async () => {
    const initial = [
      makeNotification("notification-1"),
      makeNotification("notification-2"),
    ];
    state.getNotifications.mockResolvedValue(initial);
    state.markRead.mockRejectedValue(new Error("mark read failed"));
    state.markAllRead.mockRejectedValue(new Error("mark all failed"));
    state.dismiss.mockRejectedValue(new Error("dismiss failed"));
    state.dismissAll.mockRejectedValue(new Error("dismiss all failed"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result } = renderHook(() => useNotifications(true));
    await flushPromises();

    await act(async () => {
      await result.current.markRead("notification-1");
      await result.current.markAllRead();
      await result.current.dismiss("notification-1");
      await result.current.dismissAll();
    });

    expect(result.current.notifications).toEqual(initial);
    expect(result.current.unreadCount).toBe(2);
    expect(consoleError).toHaveBeenCalledTimes(4);
    consoleError.mockRestore();
  });
});
