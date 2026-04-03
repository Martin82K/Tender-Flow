import React from "react";
import type { AppNotification } from "../types";

interface NotificationItemProps {
  notification: AppNotification;
  onDismiss: (id: string) => void;
  onClick: (notification: AppNotification) => void;
}

const TYPE_ICON: Record<string, string> = {
  success: "check_circle",
  warning: "warning",
  error: "error",
  info: "info",
};

const TYPE_COLOR: Record<string, string> = {
  success: "text-emerald-500",
  warning: "text-amber-500",
  error: "text-red-500",
  info: "text-blue-500",
};

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "právě teď";
  if (diffMin < 60) return `před ${diffMin} min`;
  if (diffHours < 24) return `před ${diffHours}h`;
  if (diffDays === 1) return "včera";
  if (diffDays < 7) return `před ${diffDays} dny`;
  return new Date(dateStr).toLocaleDateString("cs-CZ");
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onDismiss,
  onClick,
}) => {
  const isUnread = !notification.read_at;
  const icon = TYPE_ICON[notification.type] ?? "info";
  const color = TYPE_COLOR[notification.type] ?? "text-slate-400";

  return (
    <div
      className={`group flex items-start gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800 transition-colors ${
        notification.action_url ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50" : ""
      } ${isUnread ? "bg-primary/5" : ""}`}
      onClick={() => onClick(notification)}
    >
      <span className={`material-symbols-outlined text-[18px] mt-0.5 shrink-0 ${color}`}>
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div
          className={`text-sm leading-tight truncate ${
            isUnread
              ? "font-semibold text-slate-900 dark:text-white"
              : "font-medium text-slate-700 dark:text-slate-300"
          }`}
        >
          {notification.title}
        </div>
        {notification.body && (
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
            {notification.body}
          </div>
        )}
        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
          {formatRelativeTime(notification.created_at)}
        </div>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(notification.id);
        }}
        className="opacity-0 group-hover:opacity-100 shrink-0 mt-0.5 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
        title="Skrýt"
      >
        <span className="material-symbols-outlined text-[14px] text-slate-400">close</span>
      </button>
    </div>
  );
};
