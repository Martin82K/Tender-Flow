import { useState, useCallback } from "react";
import { APP_VERSION } from "@/config/version";

const STORAGE_KEY = "tf_whatsNew_lastSeen";
const SKIPPED_WHATS_NEW_VERSIONS = new Set(["1.7.0", "1.7.2", "1.8.0", "1.8.4", "1.8.5", "1.8.6", "1.8.7", "1.8.8", "1.8.9", "1.8.10", "1.8.11", "1.8.12"]);

export const shouldShowWhatsNew = (
  appVersion: string,
  lastSeenVersion: string | null,
) => !SKIPPED_WHATS_NEW_VERSIONS.has(appVersion) && lastSeenVersion !== appVersion;

export function useWhatsNew() {
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const lastSeen = localStorage.getItem(STORAGE_KEY);
      return shouldShowWhatsNew(APP_VERSION, lastSeen);
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
