import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  notifications,
  isLoading,
  onRefresh,
  unreadCount,
}) => {
  const [activeFilter, setActiveFilter] = useState<NotificationCategory | "all">("all");
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

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

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="absolute right-0 mt-2 w-96 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Notifikace
        </span>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
          >
            Označit vše jako přečtené
          </button>
        )}
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
};
