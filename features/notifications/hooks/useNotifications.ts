import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuthIdentity } from "@shared/auth/AuthIdentityContext";
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
  dismissAll: () => Promise<void>;
}

export const useNotifications = (enabled: boolean = true): UseNotificationsReturn => {
  const user = useAuthIdentity();
  const normalizedUserId = user?.id.trim();
  const activeUserId =
    enabled && user && user.role !== "demo" && normalizedUserId
      ? normalizedUserId
      : null;
  const activeUserIdRef = useRef<string | null>(activeUserId);
  activeUserIdRef.current = activeUserId;
  const seenNotificationIdsRef = useRef<{
    userId: string | null;
    ids: Set<string>;
  }>({ userId: null, ids: new Set() });
  const [state, setState] = useState<{
    userId: string | null;
    notifications: AppNotification[];
    isLoading: boolean;
  }>({ userId: null, notifications: [], isLoading: false });

  const notifications =
    state.userId === activeUserId ? state.notifications : [];
  const isLoading =
    activeUserId !== null && state.userId === activeUserId
      ? state.isLoading
      : false;

  const loadNotifications = useCallback(async () => {
    if (!activeUserId) return;
    const requestUserId = activeUserId;
    setState((previous) => ({
      userId: requestUserId,
      notifications:
        previous.userId === requestUserId ? previous.notifications : [],
      isLoading: true,
    }));
    try {
      const data = await notificationApi.getNotifications(30);
      if (activeUserIdRef.current !== requestUserId) return;
      seenNotificationIdsRef.current = {
        userId: requestUserId,
        ids: new Set(data.map((notification) => notification.id)),
      };
      setState({
        userId: requestUserId,
        notifications: data,
        isLoading: false,
      });
    } catch (error) {
      if (activeUserIdRef.current === requestUserId) {
        console.error("[useNotifications] Failed to load:", error);
      }
    } finally {
      if (activeUserIdRef.current === requestUserId) {
        setState((previous) =>
          previous.userId === requestUserId
            ? { ...previous, isLoading: false }
            : previous,
        );
      }
    }
  }, [activeUserId]);

  // Initial load + polling fallback
  useEffect(() => {
    if (!activeUserId) {
      seenNotificationIdsRef.current = { userId: null, ids: new Set() };
      setState({ userId: null, notifications: [], isLoading: false });
      return;
    }
    void loadNotifications();
    const interval = setInterval(loadNotifications, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [activeUserId, loadNotifications]);

  // Realtime subscription - also triggers desktop notification for important types
  useNotificationSubscription({
    userId: activeUserId ?? undefined,
    enabled: activeUserId !== null,
    onNewNotification: (notification, sourceUserId) => {
      if (activeUserIdRef.current !== sourceUserId) return;
      const seen = seenNotificationIdsRef.current;
      if (seen.userId !== sourceUserId) {
        seenNotificationIdsRef.current = {
          userId: sourceUserId,
          ids: new Set(),
        };
      }
      if (seenNotificationIdsRef.current.ids.has(notification.id)) return;
      seenNotificationIdsRef.current.ids.add(notification.id);
      setState((previous) => ({
        userId: sourceUserId,
        notifications:
          previous.userId === sourceUserId
            ? [notification, ...previous.notifications]
            : [notification],
        isLoading: false,
      }));
      // Show desktop notification for warning/success/error types
      if (notification.type === "warning" || notification.type === "success" || notification.type === "error") {
        void notificationApi.showDesktopNotification(notification.title, notification.body ?? undefined);
      }
    },
  });

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read_at).length,
    [notifications],
  );

  const markRead = useCallback(async (id: string) => {
    if (!activeUserId) return;
    const requestUserId = activeUserId;
    try {
      await notificationApi.markRead(id);
      if (activeUserIdRef.current !== requestUserId) return;
      setState((previous) =>
        previous.userId === requestUserId
          ? {
              ...previous,
              notifications: previous.notifications.map((notification) =>
                notification.id === id
                  ? { ...notification, read_at: new Date().toISOString() }
                  : notification,
              ),
            }
          : previous,
      );
    } catch (error) {
      if (activeUserIdRef.current === requestUserId) {
        console.error("[useNotifications] Failed to mark read:", error);
      }
    }
  }, [activeUserId]);

  const markAllRead = useCallback(async () => {
    if (!activeUserId) return;
    const requestUserId = activeUserId;
    try {
      await notificationApi.markAllRead();
      if (activeUserIdRef.current !== requestUserId) return;
      setState((previous) =>
        previous.userId === requestUserId
          ? {
              ...previous,
              notifications: previous.notifications.map((notification) =>
                notification.read_at
                  ? notification
                  : { ...notification, read_at: new Date().toISOString() },
              ),
            }
          : previous,
      );
    } catch (error) {
      if (activeUserIdRef.current === requestUserId) {
        console.error("[useNotifications] Failed to mark all read:", error);
      }
    }
  }, [activeUserId]);

  const dismiss = useCallback(async (id: string) => {
    if (!activeUserId) return;
    const requestUserId = activeUserId;
    try {
      await notificationApi.dismiss(id);
      if (activeUserIdRef.current !== requestUserId) return;
      setState((previous) =>
        previous.userId === requestUserId
          ? {
              ...previous,
              notifications: previous.notifications.filter(
                (notification) => notification.id !== id,
              ),
            }
          : previous,
      );
    } catch (error) {
      if (activeUserIdRef.current === requestUserId) {
        console.error("[useNotifications] Failed to dismiss:", error);
      }
    }
  }, [activeUserId]);

  const dismissAll = useCallback(async () => {
    if (!activeUserId) return;
    const requestUserId = activeUserId;
    try {
      await notificationApi.dismissAll();
      if (activeUserIdRef.current !== requestUserId) return;
      setState((previous) =>
        previous.userId === requestUserId
          ? { ...previous, notifications: [] }
          : previous,
      );
    } catch (error) {
      if (activeUserIdRef.current === requestUserId) {
        console.error("[useNotifications] Failed to dismiss all:", error);
      }
    }
  }, [activeUserId]);

  return {
    notifications,
    isLoading,
    unreadCount,
    refresh: loadNotifications,
    markRead,
    markAllRead,
    dismiss,
    dismissAll,
  };
};
