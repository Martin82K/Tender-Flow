import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { navigate } from "@shared/routing/router";
import type { AppNotification, NotificationCategory } from "../types";
import { NOTIFICATION_CATEGORY_LABELS } from "../types";
import { notificationApi } from "../api/notificationApi";
import { NotificationItem } from "./NotificationItem";

const FILTER_TABS: Array<NotificationCategory | "all"> = [
  "all",
  "bid",
  "deadline",
  "project",
  "team",
  "system",
];

function groupByDate(notifications: AppNotification[]): Record<string, AppNotification[]> {
  const groups: Record<string, AppNotification[]> = {};
  const now = new Date();
  const todayStr = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  for (const n of notifications) {
    const dateStr = new Date(n.created_at).toDateString();
    let label: string;
    if (dateStr === todayStr) label = "Dnes";
    else if (dateStr === yesterdayStr) label = "Včera";
    else label = "Starší";

    if (!groups[label]) groups[label] = [];
    groups[label].push(n);
  }
  return groups;
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  isLoading: boolean;
  onRefresh: () => void;
  unreadCount: number;
  anchor?: { top: number; right: number } | null;
  anchorRef?: React.RefObject<HTMLButtonElement | null>;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  notifications,
  isLoading,
  onRefresh,
  unreadCount,
  anchor,
  anchorRef,
}) => {
  const [activeFilter, setActiveFilter] = useState<NotificationCategory | "all">("all");
  const [confirmDismissAll, setConfirmDismissAll] = useState(false);
  const [isDismissingAll, setIsDismissingAll] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const confirmResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current && panelRef.current.contains(target)) return;
      if (anchorRef?.current && anchorRef.current.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose, anchorRef]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  const filtered = useMemo(() => {
    if (activeFilter === "all") return notifications;
    return notifications.filter((n) => n.category === activeFilter);
  }, [notifications, activeFilter]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);

  const handleDismiss = useCallback(async (id: string) => {
    try {
      await notificationApi.dismiss(id);
      onRefresh();
    } catch (error) {
      console.error("Failed to dismiss notification:", error);
    }
  }, [onRefresh]);

  const handleClick = useCallback(async (notification: AppNotification) => {
    // Mark as read
    if (!notification.read_at) {
      try {
        await notificationApi.markRead(notification.id);
      } catch {
        // silent
      }
    }
    // Navigate to action URL
    if (notification.action_url) {
      onClose();
      navigate(notification.action_url);
    }
  }, [onClose]);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await notificationApi.markAllRead();
      onRefresh();
    } catch (error) {
      console.error("Failed to mark all read:", error);
    }
  }, [onRefresh]);

  const clearConfirmResetTimer = useCallback(() => {
    if (confirmResetTimerRef.current) {
      clearTimeout(confirmResetTimerRef.current);
      confirmResetTimerRef.current = null;
    }
  }, []);

  const handleDismissAll = useCallback(async () => {
    if (!confirmDismissAll) {
      setConfirmDismissAll(true);
      clearConfirmResetTimer();
      confirmResetTimerRef.current = setTimeout(() => {
        setConfirmDismissAll(false);
        confirmResetTimerRef.current = null;
      }, 4000);
      return;
    }
    clearConfirmResetTimer();
    setIsDismissingAll(true);
    try {
      await notificationApi.dismissAll();
      onRefresh();
    } catch (error) {
      console.error("Failed to dismiss all notifications:", error);
    } finally {
      setIsDismissingAll(false);
      setConfirmDismissAll(false);
    }
  }, [confirmDismissAll, clearConfirmResetTimer, onRefresh]);

  // Reset confirm state when panel closes and cleanup timer on unmount
  useEffect(() => {
    if (!isOpen) {
      clearConfirmResetTimer();
      setConfirmDismissAll(false);
    }
  }, [isOpen, clearConfirmResetTimer]);

  useEffect(() => clearConfirmResetTimer, [clearConfirmResetTimer]);

  if (!isOpen) return null;

  const panel = (
    <div
      ref={panelRef}
      style={
        anchor
          ? { position: "fixed", top: anchor.top, right: anchor.right }
          : undefined
      }
      className="w-96 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl z-[100] animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Notifikace
        </span>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Označit vše jako přečtené
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={handleDismissAll}
              disabled={isDismissingAll}
              className={`text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                confirmDismissAll
                  ? "text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  : "text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
              }`}
              title={confirmDismissAll ? "Klikněte znovu pro potvrzení" : "Odstranit všechny notifikace"}
            >
              {isDismissingAll
                ? "Odstraňuji…"
                : confirmDismissAll
                  ? "Opravdu odstranit?"
                  : "Odstranit vše"}
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-3 py-2 border-b border-slate-100 dark:border-slate-800 overflow-x-auto">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveFilter(tab)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              activeFilter === tab
                ? "bg-primary/10 text-primary"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            {NOTIFICATION_CATEGORY_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="p-6 text-center text-sm text-slate-500">
            <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <span className="material-symbols-outlined text-[32px] text-slate-300 dark:text-slate-600">
              notifications_off
            </span>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
              Žádné notifikace
            </p>
          </div>
        ) : (
          (Object.entries(grouped) as [string, AppNotification[]][]).map(([label, items]) => (
            <div key={label}>
              <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50">
                {label}
              </div>
              {items.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onDismiss={handleDismiss}
                  onClick={handleClick}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );

  if (anchor && typeof document !== "undefined") {
    return createPortal(panel, document.body);
  }
  return panel;
};
