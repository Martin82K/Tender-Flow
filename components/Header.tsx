import React, { useEffect, useMemo, useState } from "react";
import { notificationService, type AppNotification } from "../services/notificationService";

interface HeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  showSearch?: boolean;
  showNotifications?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  children,
  onSearchChange,
  searchPlaceholder = "Search...",
  showSearch = true,
  showNotifications = true,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isNotifLoading, setIsNotifLoading] = useState(false);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearchChange?.(query);
  };

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read_at).length,
    [notifications],
  );

  const loadNotifications = async () => {
    setIsNotifLoading(true);
    try {
      const data = await notificationService.getMyNotifications(20);
      setNotifications(data);
    } catch (error) {
      console.error("Failed to load notifications:", error);
    } finally {
      setIsNotifLoading(false);
    }
  };

  useEffect(() => {
    if (!showNotifications) return;
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, [showNotifications]);

  const handleToggleNotifications = async () => {
    const next = !isNotifOpen;
    setIsNotifOpen(next);
    if (next) {
      await loadNotifications();
      if (unreadCount > 0) {
        try {
          await notificationService.markAllRead();
          setNotifications((prev) =>
            prev.map((n) => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })),
          );
        } catch (error) {
          console.error("Failed to mark notifications read:", error);
        }
      }
    }
  };

  return (
    <header
      className="flex items-center justify-between whitespace-nowrap border-b border-slate-200 dark:border-slate-800 pl-14 pr-6 md:px-8 py-4 bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl sticky top-0 z-30 shrink-0 select-none shadow-sm"
      style={{ WebkitAppRegion: "drag" } as any}
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <h1 className="text-slate-900 dark:text-white text-lg font-extrabold tracking-tight leading-tight truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-slate-500 dark:text-slate-400 text-xs font-medium leading-normal truncate">
            {subtitle}
          </p>
        )}
      </div>
      <div
        className="flex items-center gap-4"
        style={{ WebkitAppRegion: "no-drag" } as any}
      >
        {children}
        <div className="flex items-center gap-3">
          {showSearch && (
            <div className="hidden md:flex h-10 w-64 items-center rounded-xl bg-slate-100/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 px-3 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
              <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder={searchPlaceholder}
                className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-slate-900 dark:text-slate-200 placeholder-slate-400/70 ml-2"
              />
            </div>
          )}
          {showNotifications && (
            <div className="relative">
              <button
                onClick={handleToggleNotifications}
                className="relative flex items-center justify-center size-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:shadow-md transition-all"
              >
                <span className="material-symbols-outlined text-[20px]">
                  notifications
                </span>
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-primary text-white text-[10px] font-bold">
                    {unreadCount}
                  </span>
                )}
              </button>
              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl z-50">
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Notifikace
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {isNotifLoading ? (
                      <div className="p-4 text-sm text-slate-500">Načítám...</div>
                    ) : notifications.length === 0 ? (
                      <div className="p-4 text-sm text-slate-500">Žádné nové notifikace.</div>
                    ) : (
                      notifications.map((notification) => (
                        <div key={notification.id} className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                          <div className="text-sm font-medium text-slate-900 dark:text-white">
                            {notification.title}
                          </div>
                          {notification.body ? (
                            <div className="text-xs text-slate-500 mt-1">{notification.body}</div>
                          ) : null}
                          <div className="text-[10px] text-slate-400 mt-1">
                            {new Date(notification.created_at).toLocaleString("cs-CZ")}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
