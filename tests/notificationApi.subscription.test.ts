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
vi.mock("@/services/platformAdapter", () => ({
  desktopNotificationAdapter: desktopNotificationAdapterMock,
}));

import { notificationApi } from "../features/notifications/api/notificationApi";
import type { AppNotification } from "../features/notifications/types";

describe("notificationApi realtime subscriptions", () => {
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
