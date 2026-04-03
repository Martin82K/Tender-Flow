import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import type { NotificationType, ToastNotification } from "../types";

interface ToastContextType {
  toasts: ToastNotification[];
  showToast: (toast: Omit<ToastNotification, "id">) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const MAX_TOASTS = 3;

const DEFAULT_DURATIONS: Record<NotificationType, number> = {
  info: 5000,
  success: 5000,
  warning: 8000,
  error: 8000,
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<ToastNotification, "id">) => {
      const id = crypto.randomUUID();
      const duration = toast.duration ?? DEFAULT_DURATIONS[toast.type] ?? 5000;

      setToasts((prev) => {
        const next = [...prev, { ...toast, id }];
        // Keep only latest MAX_TOASTS
        if (next.length > MAX_TOASTS) {
          const removed = next.splice(0, next.length - MAX_TOASTS);
          for (const r of removed) {
            const timer = timers.current.get(r.id);
            if (timer) {
              clearTimeout(timer);
              timers.current.delete(r.id);
            }
          }
        }
        return next;
      });

      const timer = setTimeout(() => {
        timers.current.delete(id);
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
      timers.current.set(id, timer);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
};
