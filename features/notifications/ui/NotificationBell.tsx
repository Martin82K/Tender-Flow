import React, { useLayoutEffect, useRef, useState } from "react";
import { useNotifications } from "../hooks/useNotifications";
import { NotificationCenter } from "./NotificationCenter";

/**
 * Self-contained notification bell button + dropdown.
 * Drop this into any Header via the notificationSlot prop.
 */
export const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { notifications, isLoading, unreadCount, refresh } = useNotifications(true);

  const handleToggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) refresh();
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    const updatePos = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setAnchor({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      });
    };
    updatePos();
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
    };
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleToggle}
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
        onClose={() => setIsOpen(false)}
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
