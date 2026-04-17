import React from "react";
import type { ToastNotification } from "../types";

interface ToastProps {
  toast: ToastNotification;
  onDismiss: (id: string) => void;
  onClick?: (toast: ToastNotification) => void;
}

const TYPE_STYLES: Record<string, { bg: string; border: string; icon: string; iconColor: string }> = {
  success: {
    bg: "bg-white/90 dark:bg-slate-800/90",
    border: "border-emerald-200 dark:border-emerald-800",
    icon: "check_circle",
    iconColor: "text-emerald-500",
  },
  warning: {
    bg: "bg-white/90 dark:bg-slate-800/90",
    border: "border-amber-200 dark:border-amber-800",
    icon: "warning",
    iconColor: "text-amber-500",
  },
  error: {
    bg: "bg-white/90 dark:bg-slate-800/90",
    border: "border-red-200 dark:border-red-800",
    icon: "error",
    iconColor: "text-red-500",
  },
  info: {
    bg: "bg-white/90 dark:bg-slate-800/90",
    border: "border-blue-200 dark:border-blue-800",
    icon: "info",
    iconColor: "text-blue-500",
  },
};

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss, onClick }) => {
  const style = TYPE_STYLES[toast.type] ?? TYPE_STYLES.info;

  return (
    <div
      className={`flex items-start gap-3 w-80 px-4 py-3 rounded-xl border ${style.border} ${style.bg} backdrop-blur-sm shadow-lg animate-in slide-in-from-right-5 fade-in duration-200 ${
        toast.action_url ? "cursor-pointer" : ""
      }`}
      onClick={() => onClick?.(toast)}
    >
      <span className={`material-symbols-outlined text-[20px] shrink-0 mt-0.5 ${style.iconColor}`}>
        {style.icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-slate-900 dark:text-white leading-tight truncate">
          {toast.title}
        </div>
        {toast.body && (
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
            {toast.body}
          </div>
        )}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(toast.id);
        }}
        className="shrink-0 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
      >
        <span className="material-symbols-outlined text-[14px] text-slate-400">close</span>
      </button>
    </div>
  );
};
