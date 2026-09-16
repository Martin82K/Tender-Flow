import { useEffect, useRef } from "react";
import { notificationApi } from "../api/notificationApi";
import type { AppNotification } from "../types";

interface UseNotificationSubscriptionOptions {
  userId: string | undefined;
  enabled: boolean;
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
}: UseNotificationSubscriptionOptions) => {
  const callbackRef = useRef(onNewNotification);
  callbackRef.current = onNewNotification;

  useEffect(() => {
    if (!enabled || !userId) return;

    return notificationApi.subscribeToUserNotifications({
      userId,
      onNewNotification: (notification) => {
        callbackRef.current(notification, userId);
      },
      onSubscriptionError: (status) => {
        // Log only the status, never transport errors that may contain credentials.
        console.warn(`[notifications] Spojení pro okamžité notifikace není dostupné (${status}); pravidelné načítání pokračuje každých 30 sekund.`);
      },
    });
  }, [userId, enabled]);
};
