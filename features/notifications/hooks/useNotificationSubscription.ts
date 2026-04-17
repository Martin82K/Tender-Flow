import { useEffect, useRef } from "react";
import { notificationService } from "@/services/notificationService";
import type { AppNotification } from "../types";

interface UseNotificationSubscriptionOptions {
  userId: string | undefined;
  enabled: boolean;
  onNewNotification: (notification: AppNotification) => void;
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

    const supabase = notificationService.getSupabaseClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotification = payload.new as AppNotification;
          callbackRef.current(newNotification);
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.warn("[notifications] Realtime subscription error, falling back to polling");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, enabled]);
};
