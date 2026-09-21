import { useEffect, useRef } from "react";
import { notificationApi } from "../api/notificationApi";
import type { AppNotification } from "../types";

interface UseNotificationSubscriptionOptions {
  userId: string | undefined;
  enabled: boolean;
  onNotificationsChanged?: (userId: string) => void;
  onConnectionChange?: (connected: boolean, userId: string) => void;
  onNewNotification: (
    notification: AppNotification,
    sourceUserId: string,
  ) => void;
}

/**
 * Subscribes to Supabase Realtime for INSERT and UPDATE events on the notifications table.
 * Falls back gracefully if subscription fails.
 */
export const useNotificationSubscription = ({
  userId,
  enabled,
  onNewNotification,
  onConnectionChange,
  onNotificationsChanged,
}: UseNotificationSubscriptionOptions) => {
  const changeRef = useRef(onNotificationsChanged);
  changeRef.current = onNotificationsChanged;
  const connectionRef = useRef(onConnectionChange);
  connectionRef.current = onConnectionChange;
  const callbackRef = useRef(onNewNotification);
  callbackRef.current = onNewNotification;

  useEffect(() => {
    if (!enabled || !userId) return;

    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = notificationApi.subscribeToUserNotifications({
      userId,
      onNewNotification: (notification) => {
        callbackRef.current(notification, userId);
      },
      onNotificationsChanged: () => {
        if (refreshTimer !== undefined) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
          refreshTimer = undefined;
          changeRef.current?.(userId);
        }, 250);
      },
      onConnectionChange: (connected) => connectionRef.current?.(connected, userId),
      onSubscriptionError: (status) => {
        // Log only the status, never transport errors that may contain credentials.
        console.warn(`[notifications] Spojení pro okamžité notifikace není dostupné (${status}); pravidelné načítání pokračuje každých 5 minut.`);
      },
    });
    return () => {
      if (refreshTimer !== undefined) clearTimeout(refreshTimer);
      cleanup();
    };
  }, [userId, enabled]);
};
