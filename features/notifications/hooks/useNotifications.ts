import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuthIdentity } from "@shared/auth/AuthIdentityContext";
import type { AppNotification } from "../types";
import { notificationApi } from "../api/notificationApi";
import { useNotificationSubscription } from "./useNotificationSubscription";

const RECONCILE_INTERVAL = 3_600_000; // Silent hourly reconciliation covers server-side deletion
const POLL_INTERVAL = 300_000; // Five-minute fallback when Realtime is unavailable

interface UseNotificationsReturn {
  notifications: AppNotification[];
  isLoading: boolean;
  dismissError: string | null;
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
  const [connection, setConnection] = useState<{ userId: string; connected: boolean } | null>(null);
  const [failedLoadUserId, setFailedLoadUserId] = useState<string | null>(null);
  const connectionRef = useRef<typeof connection>(null);
  const [dismissFailure, setDismissFailure] = useState<{ userId: string; notificationId: string; message: string } | null>(null);
  const hiddenRef = useRef<{ userId: string | null; ids: Set<string> }>({ userId: activeUserId, ids: new Set() });
  if (hiddenRef.current.userId !== activeUserId) {
    hiddenRef.current = { userId: activeUserId, ids: new Set() };
  }
  const loadRevisionRef = useRef(0);
  const dismissAllGenerationRef = useRef(0);
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
    if (!activeUserId || activeUserIdRef.current !== activeUserId) return;
    const requestUserId = activeUserId;
    const requestRevision = ++loadRevisionRef.current;
    setState((previous) => ({
      userId: requestUserId,
      notifications:
        previous.userId === requestUserId ? previous.notifications : [],
      isLoading: previous.userId !== requestUserId || previous.isLoading,
    }));
    try {
      const data = await notificationApi.getNotifications(30);
      if (activeUserIdRef.current !== requestUserId || loadRevisionRef.current !== requestRevision) return;
      setFailedLoadUserId(null);
      setDismissFailure((previous) => previous?.userId === requestUserId
        && !data.some((notification) => notification.id === previous.notificationId) ? null : previous);
      seenNotificationIdsRef.current = {
        userId: requestUserId,
        ids: new Set(data.map((notification) => notification.id)),
      };
      setState({
        userId: requestUserId,
        notifications: data.filter((notification) => !hiddenRef.current.ids.has(notification.id)),
        isLoading: false,
      });
    } catch (error) {
      if (activeUserIdRef.current === requestUserId && loadRevisionRef.current === requestRevision) {
        setFailedLoadUserId(requestUserId);
        console.error("[useNotifications] Failed to load:", error);
      }
    } finally {
      if (activeUserIdRef.current === requestUserId && loadRevisionRef.current === requestRevision) {
        setState((previous) =>
          previous.userId === requestUserId
            ? { ...previous, isLoading: false }
            : previous,
        );
      }
    }
  }, [activeUserId]);

  // Initial load for each identity
  useEffect(() => {
    if (!activeUserId) {
      seenNotificationIdsRef.current = { userId: null, ids: new Set() };
      setState({ userId: null, notifications: [], isLoading: false });
      return;
    }
    setFailedLoadUserId(null);
    connectionRef.current = null;
    setConnection(null);
    setDismissFailure(null);
    void loadNotifications();
  }, [activeUserId, loadNotifications]);

  const connected = connection?.userId === activeUserId && connection.connected;
  useEffect(() => {
    if (!activeUserId) return;
    const delay = connected && failedLoadUserId !== activeUserId ? RECONCILE_INTERVAL : POLL_INTERVAL;
    const interval = setInterval(() => { void loadNotifications(); }, delay);
    return () => clearInterval(interval);
  }, [activeUserId, connected, failedLoadUserId, loadNotifications]);

  // Realtime subscription - also triggers desktop notification for important types
  useNotificationSubscription({
    userId: activeUserId ?? undefined,
    enabled: activeUserId !== null,
    onNotificationsChanged: (sourceUserId) => {
      if (activeUserIdRef.current === sourceUserId) void loadNotifications();
    },
    onConnectionChange: (connected, sourceUserId) => {
      if (activeUserIdRef.current !== sourceUserId) return;
      const needsSnapshot = connected && (connectionRef.current?.userId !== sourceUserId
        || connectionRef.current.connected !== true);
      connectionRef.current = { userId: sourceUserId, connected };
      setConnection(connectionRef.current);
      if (needsSnapshot) void loadNotifications();
    },
    onNewNotification: (notification, sourceUserId) => {
      if (activeUserIdRef.current !== sourceUserId) return;
      if (hiddenRef.current.ids.has(notification.id)) return;
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
      // Interrupt only for warnings and errors
      if (notification.type === "warning" || notification.type === "error") {
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
    if (!activeUserId || activeUserIdRef.current !== activeUserId || hiddenRef.current.ids.has(id)) return;
    const requestUserId = activeUserId;
    const hidden = hiddenRef.current;
    const dismissAllGeneration = dismissAllGenerationRef.current;
    const removedIndex = notifications.findIndex((notification) => notification.id === id);
    const removed = notifications[removedIndex];
    if (!removed) return;
    hidden.ids.add(id);
    setDismissFailure(null);
    setState((previous) => previous.userId === requestUserId
      ? { ...previous, notifications: previous.notifications.filter((notification) => notification.id !== id) }
      : previous);
    try {
      // false means no active owned row matched (already dismissed or removed).
      await notificationApi.dismiss(id);
    } catch {
      if (dismissAllGenerationRef.current !== dismissAllGeneration) return;
      hidden.ids.delete(id);
      if (activeUserIdRef.current !== requestUserId || hiddenRef.current !== hidden) return;
      console.error("[useNotifications] Failed to dismiss notification");
      setDismissFailure({ userId: requestUserId, notificationId: id, message: "Notifikaci se nepodařilo skrýt. Zkuste to znovu." });
      setState((previous) => {
        if (previous.userId !== requestUserId) return previous;
        const restored = previous.notifications.filter((notification) => notification.id !== id);
        restored.splice(Math.min(removedIndex, restored.length), 0, removed);
        return { ...previous, notifications: restored };
      });
      // A lost response does not prove the write failed; reconcile before leaving a rollback visible.
      await loadNotifications();
    }
  }, [activeUserId, notifications, loadNotifications]);

  const dismissAll = useCallback(async () => {
    if (!activeUserId || activeUserIdRef.current !== activeUserId) return;
    const requestUserId = activeUserId;
    const hidden = hiddenRef.current;
    try {
      await notificationApi.dismissAll();
      if (activeUserIdRef.current !== requestUserId || hiddenRef.current !== hidden) return;
      dismissAllGenerationRef.current += 1;
      loadRevisionRef.current += 1;
      setDismissFailure(null);
      setState((previous) =>
        previous.userId === requestUserId
          ? { ...previous, notifications: [], isLoading: false }
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
    dismissError: dismissFailure?.userId === activeUserId ? dismissFailure.message : null,
    unreadCount,
    refresh: loadNotifications,
    markRead,
    markAllRead,
    dismiss,
    dismissAll,
  };
};
