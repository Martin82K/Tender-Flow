import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { desktopNotificationAdapter } from "@/services/platformAdapter";
import type { AppNotification } from "../types";
import { notificationApi } from "../api/notificationApi";
import { useNotificationSubscription } from "./useNotificationSubscription";

const POLL_INTERVAL = 30_000; // 30s fallback polling

interface UseNotificationsReturn {
  notifications: AppNotification[];
  isLoading: boolean;
  unreadCount: number;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  dismiss: (id: string) => Promise<void>;
}

export const useNotifications = (enabled: boolean = true): UseNotificationsReturn => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    try {
      const data = await notificationApi.getNotifications(30);
      setNotifications(data);
    } catch (error) {
      console.error("[useNotifications] Failed to load:", error);
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  // Initial load + polling fallback
  useEffect(() => {
    if (!enabled) return;
    loadNotifications();
    const interval = setInterval(loadNotifications, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [enabled, loadNotifications]);

  // Realtime subscription - also triggers desktop notification for important types
  useNotificationSubscription({
    userId: user?.id,
    enabled,
    onNewNotification: (notification) => {
      setNotifications((prev) => {
        if (prev.some((n) => n.id === notification.id)) return prev;
        return [notification, ...prev];
      });
      // Show desktop notification for warning/success/error types
      if (notification.type === "warning" || notification.type === "success" || notification.type === "error") {
        void desktopNotificationAdapter.show(notification.title, notification.body ?? undefined);
      }
    },
  });

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read_at).length,
    [notifications],
  );

  const markRead = useCallback(async (id: string) => {
    try {
      await notificationApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
      );
    } catch (error) {
      console.error("[useNotifications] Failed to mark read:", error);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await notificationApi.markAllRead();
      setNotifications((prev) =>
        prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })),
      );
    } catch (error) {
      console.error("[useNotifications] Failed to mark all read:", error);
    }
  }, []);

  const dismiss = useCallback(async (id: string) => {
    try {
      await notificationApi.dismiss(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (error) {
      console.error("[useNotifications] Failed to dismiss:", error);
    }
  }, []);

  return {
    notifications,
    isLoading,
    unreadCount,
    refresh: loadNotifications,
    markRead,
    markAllRead,
    dismiss,
  };
};
