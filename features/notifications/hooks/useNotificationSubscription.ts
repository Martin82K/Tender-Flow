import { useEffect, useRef } from "react";
import { notificationApi } from "../api/notificationApi";
import type { AppNotification } from "../types";

interface UseNotificationSubscriptionOptions {
  userId: string | undefined;
  enabled: boolean;
  onConnectionChange?: (connected: boolean, userId: string) => void;
  onNewNotification: (
    notification: AppNotification,
    sourceUserId: string,
  ) => void;
}

/**
 * Subscribes to Supabase Realtime for INSERT events on the notifications table.
 * Falls back gracefully if subscription fails.
 */
export const useNotificationSubscription = ({
  userId,
  enabled,
  onNewNotification,
  onConnectionChange,
}: UseNotificationSubscriptionOptions) => {
  const connectionRef = useRef(onConnectionChange);
  connectionRef.current = onConnectionChange;
  const callbackRef = useRef(onNewNotification);
  callbackRef.current = onNewNotification;

  useEffect(() => {
    if (!enabled || !userId) return;

    return notificationApi.subscribeToUserNotifications({
      userId,
      onNewNotification: (notification) => {
        callbackRef.current(notification, userId);
      },
      onConnectionChange: (connected) => connectionRef.current?.(connected, userId),
      onSubscriptionError: (status) => {
        // Log only the status, never transport errors that may contain credentials.
        console.warn(`[notifications] Spojení pro okamžité notifikace není dostupné (${status}); pravidelné načítání pokračuje každých 5 minut.`);
      },
    });
  }, [userId, enabled]);
};
