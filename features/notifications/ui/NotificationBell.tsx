import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useNotifications } from "../hooks/useNotifications";
import { NotificationCenter } from "./NotificationCenter";
import {
  getNotificationPanelPosition,
  type NotificationPanelPosition,
} from "./notificationCenterPosition";

/**
 * Self-contained notification bell button + dropdown.
 * Drop this into any Header via the notificationSlot prop.
 */
export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [anchor, setAnchor] = useState<NotificationPanelPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { notifications, isLoading, unreadCount, refresh } = useNotifications(true);

  const updateAnchor = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return null;

    const nextAnchor = getNotificationPanelPosition(rect, window.innerWidth);
    setAnchor(nextAnchor);
    return nextAnchor;
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setAnchor(null);
  }, []);

  const handleToggle = () => {
    if (isOpen) {
      handleClose();
      return;
    }

    updateAnchor();
    setIsOpen(true);
    refresh();
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    updateAnchor();
    window.addEventListener("resize", updateAnchor);
    window.addEventListener("scroll", updateAnchor, true);
    return () => {
      window.removeEventListener("resize", updateAnchor);
      window.removeEventListener("scroll", updateAnchor, true);
    };
  }, [isOpen, updateAnchor]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleToggle}
        data-help-id="notification-bell"
        aria-expanded={isOpen}
        aria-label="Notifikace"
        className="relative flex items-center justify-center size-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:shadow-md transition-all"
      >
        <span className="material-symbols-outlined text-[20px]">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-primary text-white text-[10px] font-bold">
            {unreadCount}
          </span>
        )}
      </button>
      <NotificationCenter
        isOpen={isOpen}
        onClose={handleClose}
        notifications={notifications}
        isLoading={isLoading}
        onRefresh={refresh}
        unreadCount={unreadCount}
        anchor={anchor}
        anchorRef={buttonRef}
      />
    </div>
  );
};
