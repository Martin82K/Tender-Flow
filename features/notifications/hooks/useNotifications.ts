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

interface NotificationSession {
  userId: string | null;
  ids: Set<string>;
  bulkDismissedIds: Set<string>;
  inserts: Map<string, { notification: AppNotification; revision: number }>;
  insertRevision: number;
  mutationRevision: number;
  loading: Promise<void> | null;
  reloadRequested: boolean;
  disposed: boolean;
}

const createNotificationSession = (userId: string | null): NotificationSession => ({
  userId, ids: new Set(), bulkDismissedIds: new Set(), inserts: new Map(),
  insertRevision: 0, mutationRevision: 0, loading: null, reloadRequested: false, disposed: false,
});

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
  const hiddenRef = useRef<NotificationSession>(createNotificationSession(activeUserId));
  if (hiddenRef.current.userId !== activeUserId) {
    hiddenRef.current = createNotificationSession(activeUserId);
  }
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
    const session = hiddenRef.current;
    if (session.disposed) return;
    if (session.loading) {
      session.reloadRequested = true;
      return session.loading;
    }
    const isCurrent = () => !session.disposed && activeUserIdRef.current === activeUserId && hiddenRef.current === session;
    session.loading = (async () => {
      do {
        session.reloadRequested = false;
        const mutationRevision = session.mutationRevision;
        const insertRevision = session.insertRevision;
        setState((previous) => ({
          userId: activeUserId,
          notifications: previous.userId === activeUserId ? previous.notifications : [],
          isLoading: previous.userId !== activeUserId || previous.notifications.length === 0,
        }));
        try {
          const data = await notificationApi.getNotifications(30);
          if (!isCurrent()) return;
          if (session.mutationRevision !== mutationRevision) {
            session.reloadRequested = true;
            continue;
          }
          // Preserve INSERTs delivered while the database snapshot was in flight.
          const arrived = [...session.inserts.values()]
            .filter((entry) => entry.revision > insertRevision)
            .sort((a, b) => b.revision - a.revision)
            .map((entry) => entry.notification);
          const arrivedIds = new Set(arrived.map((notification) => notification.id));
          const merged = [...arrived, ...data.filter((notification) => !arrivedIds.has(notification.id))]
            .filter((notification) => !session.ids.has(notification.id));
          for (const [id, entry] of session.inserts) {
            if (entry.revision <= insertRevision) session.inserts.delete(id);
          }
          setFailedLoadUserId(null);
          setDismissFailure((previous) => previous?.userId === activeUserId
            && !merged.some((notification) => notification.id === previous.notificationId) ? null : previous);
          seenNotificationIdsRef.current = { userId: activeUserId, ids: new Set(merged.map((notification) => notification.id)) };
          setState({ userId: activeUserId, notifications: merged, isLoading: false });
        } catch (error) {
          if (isCurrent()) {
            setFailedLoadUserId(activeUserId);
            console.error("[useNotifications] Failed to load:", error);
          }
        } finally {
          if (isCurrent()) {
            setState((previous) => previous.userId === activeUserId ? { ...previous, isLoading: false } : previous);
          }
        }
      } while (session.reloadRequested && isCurrent());
    })().finally(() => {
      session.loading = null;
      if (session.reloadRequested && isCurrent()) void loadNotifications();
    });
    return session.loading;
  }, [activeUserId]);

  // Initial load for each identity
  useEffect(() => {
    if (!activeUserId) {
      seenNotificationIdsRef.current = { userId: null, ids: new Set() };
      setState({ userId: null, notifications: [], isLoading: false });
      return;
    }
    const session = hiddenRef.current;
    session.disposed = false;
    setFailedLoadUserId(null);
    connectionRef.current = null;
    setConnection(null);
    setDismissFailure(null);
    void loadNotifications();
    return () => { session.disposed = true; };
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
      const session = hiddenRef.current;
      session.inserts.set(notification.id, { notification, revision: ++session.insertRevision });
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
      if (hidden.bulkDismissedIds.has(id)) return;
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
    const startingIds = new Set([...notifications.map((notification) => notification.id), ...hidden.ids]);
    try {
      await notificationApi.dismissAll();
      if (activeUserIdRef.current !== requestUserId || hiddenRef.current !== hidden) return;
      hidden.mutationRevision += 1;
      for (const id of startingIds) {
        hidden.ids.add(id);
        hidden.bulkDismissedIds.add(id);
      }
      setDismissFailure(null);
      setState((previous) => previous.userId === requestUserId
        ? { ...previous, notifications: previous.notifications.filter((notification) => !startingIds.has(notification.id)), isLoading: false }
        : previous);
      // The server may have included some concurrent INSERTs; reconcile its actual result.
      void loadNotifications();
    } catch (error) {
      if (activeUserIdRef.current === requestUserId && hiddenRef.current === hidden) {
        console.error("[useNotifications] Failed to dismiss all:", error);
      }
    }
  }, [activeUserId, notifications, loadNotifications]);

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
