import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppNotification } from "@features/notifications/types";

type ApiSubscriptionOptions = {
  userId: string;
  onNewNotification: (notification: AppNotification) => void;
  onSubscriptionError?: () => void;
};

const state = vi.hoisted(() => ({
  subscriptions: [] as ApiSubscriptionOptions[],
  cleanups: [] as Array<ReturnType<typeof vi.fn>>,
  subscribe: vi.fn(),
}));

vi.mock("@features/notifications/api/notificationApi", () => ({
  notificationApi: {
    subscribeToUserNotifications: state.subscribe,
  },
}));

import { useNotificationSubscription } from "@features/notifications/hooks/useNotificationSubscription";

const notification: AppNotification = {
  id: "notification-1",
  type: "info",
  title: "Notifikace",
  body: null,
  created_at: "2026-07-11T10:00:00.000Z",
  read_at: null,
  category: "system",
  action_url: null,
  entity_type: null,
  entity_id: null,
  dismissed_at: null,
};

describe("useNotificationSubscription", () => {
  beforeEach(() => {
    state.subscriptions = [];
    state.cleanups = [];
    state.subscribe.mockReset();
    state.subscribe.mockImplementation((options: ApiSubscriptionOptions) => {
      state.subscriptions.push(options);
      const cleanup = vi.fn();
      state.cleanups.push(cleanup);
      return cleanup;
    });
  });

  it("identifies the source user and cleans up on identity change and unmount", () => {
    const onNewNotification = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ userId }) =>
        useNotificationSubscription({
          userId,
          enabled: true,
          onNewNotification,
        }),
      { initialProps: { userId: "user-a" } },
    );

    expect(state.subscriptions[0].userId).toBe("user-a");
    state.subscriptions[0].onNewNotification(notification);
    expect(onNewNotification).toHaveBeenCalledWith(notification, "user-a");

    rerender({ userId: "user-b" });
    expect(state.cleanups[0]).toHaveBeenCalledOnce();
    expect(state.subscriptions[1].userId).toBe("user-b");

    unmount();
    expect(state.cleanups[1]).toHaveBeenCalledOnce();
  });

  it("does not create a subscription without an enabled user", () => {
    const { rerender } = renderHook(
      ({ userId, enabled }) =>
        useNotificationSubscription({
          userId,
          enabled,
          onNewNotification: vi.fn(),
        }),
      {
        initialProps: {
          userId: undefined as string | undefined,
          enabled: true,
        },
      },
    );

    expect(state.subscribe).not.toHaveBeenCalled();
    rerender({ userId: "user-a", enabled: false });
    expect(state.subscribe).not.toHaveBeenCalled();
  });
});
