import { beforeEach, describe, expect, it, vi } from "vitest";

const notificationServiceMock = vi.hoisted(() => ({
  getSupabaseClient: vi.fn(),
}));
const desktopNotificationAdapterMock = vi.hoisted(() => ({
  requestPermission: vi.fn(),
  show: vi.fn(),
}));

vi.mock("@/services/notificationService", () => ({
  notificationService: notificationServiceMock,
}));
vi.mock("@infra/platform/platformAdapter", () => ({
  desktopNotificationAdapter: desktopNotificationAdapterMock,
}));

import { notificationApi } from "../features/notifications/api/notificationApi";
import type { AppNotification } from "../features/notifications/types";

describe("notificationApi realtime subscriptions", () => {
  const setupSubscription = () => {
    const on = vi.fn().mockReturnThis();
    const subscribe = vi.fn().mockReturnThis();
    const channel = { on, subscribe };
    const removeChannel = vi.fn();
    notificationServiceMock.getSupabaseClient.mockReturnValue({
      channel: vi.fn().mockReturnValue(channel),
      removeChannel,
    });
    const onConnectionChange = vi.fn();
    const onSubscriptionError = vi.fn();
    const onNewNotification = vi.fn();
    const cleanup = notificationApi.subscribeToUserNotifications({
      userId: "user-1", onSubscriptionError, onNewNotification, onConnectionChange,
    });
    const status = subscribe.mock.calls[0][0] as (value: string) => void;
    const payload = on.mock.calls[0][2] as (value: { new: unknown }) => void;
    return { onConnectionChange, status, payload, cleanup, removeChannel, onSubscriptionError, onNewNotification };
  };

  it.each(["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"])("reports %s once per outage and resets after recovery", (failure) => {
    const subscription = setupSubscription();
    subscription.status(failure);
    subscription.status("CHANNEL_ERROR");
    subscription.status("TIMED_OUT");
    expect(subscription.onSubscriptionError).toHaveBeenCalledExactlyOnceWith(failure);
    expect(subscription.onConnectionChange).toHaveBeenLastCalledWith(false);
    subscription.status("SUBSCRIBED");
    expect(subscription.onConnectionChange).toHaveBeenLastCalledWith(true);
    subscription.status(failure);
    expect(subscription.onSubscriptionError).toHaveBeenCalledTimes(2);
  });

  it("ignores callbacks during and after cleanup and removes the channel only once", () => {
    const subscription = setupSubscription();
    subscription.removeChannel.mockImplementation(() => subscription.status("CLOSED"));
    subscription.cleanup();
    subscription.cleanup();
    subscription.status("CHANNEL_ERROR");
    subscription.payload({ new: { id: "stale" } });
    expect(subscription.onSubscriptionError).not.toHaveBeenCalled();
    expect(subscription.onNewNotification).not.toHaveBeenCalled();
    expect(subscription.removeChannel).toHaveBeenCalledOnce();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deleguje desktop notification operace do platform adaptéru", async () => {
    desktopNotificationAdapterMock.requestPermission.mockResolvedValue(true);
    desktopNotificationAdapterMock.show.mockResolvedValue(undefined);

    await expect(notificationApi.requestDesktopPermission()).resolves.toBe(true);
    await notificationApi.showDesktopNotification("Titulek", "Tělo");

    expect(desktopNotificationAdapterMock.requestPermission).toHaveBeenCalledOnce();
    expect(desktopNotificationAdapterMock.show).toHaveBeenCalledWith("Titulek", "Tělo");
  });

  it("subscribes to user notifications and cleans up the realtime channel", () => {
    const channel = {};
    const on = vi.fn().mockReturnThis();
    const subscribe = vi.fn().mockReturnValue(channel);
    const removeChannel = vi.fn();
    const supabase = {
      channel: vi.fn().mockReturnValue({ on, subscribe }),
      removeChannel,
    };
    const notification = {
      id: "notification-1",
      type: "info",
      title: "Nová notifikace",
      body: null,
      created_at: "2026-05-06T10:00:00.000Z",
      read_at: null,
      category: "system",
      action_url: null,
      entity_type: null,
      entity_id: null,
      dismissed_at: null,
    } satisfies AppNotification;
    const onNewNotification = vi.fn();
    const onSubscriptionError = vi.fn();
    notificationServiceMock.getSupabaseClient.mockReturnValue(supabase);

    const cleanup = notificationApi.subscribeToUserNotifications({
      userId: "user-1",
      onNewNotification,
      onSubscriptionError,
    });

    expect(supabase.channel).toHaveBeenCalledWith("notifications:user-1");
    expect(on).toHaveBeenCalledWith(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: "user_id=eq.user-1",
      },
      expect.any(Function),
    );

    const onPayload = on.mock.calls[0][2] as (payload: { new: AppNotification }) => void;
    onPayload({ new: notification });
    expect(onNewNotification).toHaveBeenCalledWith(notification);

    const onStatus = subscribe.mock.calls[0][0] as (status: string) => void;
    onStatus("CHANNEL_ERROR");
    expect(onSubscriptionError).toHaveBeenCalledOnce();

    cleanup();
    expect(removeChannel).toHaveBeenCalledWith(channel);
  });
});
