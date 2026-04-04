import { useState, useCallback } from "react";
import { APP_VERSION } from "@/config/version";

const STORAGE_KEY = "tf_whatsNew_lastSeen";

export function useWhatsNew() {
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const lastSeen = localStorage.getItem(STORAGE_KEY);
      return lastSeen !== APP_VERSION;
    } catch {
      return false;
    }
  });

  const dismiss = useCallback(() => {
    setIsOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, APP_VERSION);
    } catch {
      // ignore storage errors
    }
  }, []);

  return { isOpen, dismiss };
}
