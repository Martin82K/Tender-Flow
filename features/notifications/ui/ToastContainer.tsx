import React, { useCallback } from "react";
import { navigate } from "@shared/routing/router";
import { useToast } from "../context/ToastContext";
import type { ToastNotification } from "../types";
import { Toast } from "./Toast";

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useToast();

  const handleClick = useCallback((toast: ToastNotification) => {
    if (toast.action_url) {
      dismissToast(toast.id);
      navigate(toast.action_url);
    }
  }, [dismissToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col-reverse gap-2 pointer-events-auto">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          toast={toast}
          onDismiss={dismissToast}
          onClick={handleClick}
        />
      ))}
    </div>
  );
};
