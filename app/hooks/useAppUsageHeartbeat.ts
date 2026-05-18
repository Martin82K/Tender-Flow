import { useEffect, useRef } from "react";
import { recordUsageHeartbeat } from "@/infra/usage/appUsageService";

const HEARTBEAT_INTERVAL_MS = 120_000;
const HEARTBEAT_SECONDS = HEARTBEAT_INTERVAL_MS / 1000;
const INITIAL_HEARTBEAT_SECONDS = 1;
const IDLE_TIMEOUT_MS = 5 * 60_000;

interface UseAppUsageHeartbeatInput {
  enabled: boolean;
  sessionKey?: string | null;
}

export const shouldRecordUsageHeartbeat = ({
  now,
  lastActivityAt,
  isDocumentVisible,
  isWindowFocused,
}: {
  now: number;
  lastActivityAt: number;
  isDocumentVisible: boolean;
  isWindowFocused: boolean;
}): boolean => (
  isDocumentVisible &&
  isWindowFocused &&
  now - lastActivityAt <= IDLE_TIMEOUT_MS
);

const formatUuidFromBytes = (bytes: Uint8Array): string => {
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
};

export const createUsageSessionId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  return formatUuidFromBytes(bytes);
};

export const useAppUsageHeartbeat = ({ enabled, sessionKey }: UseAppUsageHeartbeatInput): void => {
  const sessionIdRef = useRef<string | null>(null);
  const lastActivityAtRef = useRef<number>(Date.now());
  const isWindowFocusedRef = useRef<boolean>(
    typeof document === "undefined" ? true : document.hasFocus(),
  );

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof document === "undefined") {
      sessionIdRef.current = null;
      return undefined;
    }

    sessionIdRef.current = createUsageSessionId();
    lastActivityAtRef.current = Date.now();
    isWindowFocusedRef.current = document.hasFocus();

    const markActivity = () => {
      lastActivityAtRef.current = Date.now();
    };

    const handleFocus = () => {
      isWindowFocusedRef.current = true;
      markActivity();
    };

    const handleBlur = () => {
      isWindowFocusedRef.current = false;
    };

    const sendHeartbeatIfActive = (activeSeconds: number = HEARTBEAT_SECONDS) => {
      const now = Date.now();
      if (!shouldRecordUsageHeartbeat({
        now,
        lastActivityAt: lastActivityAtRef.current,
        isDocumentVisible: document.visibilityState === "visible",
        isWindowFocused: isWindowFocusedRef.current,
      })) {
        return;
      }

      if (!sessionIdRef.current) {
        return;
      }

      void recordUsageHeartbeat(sessionIdRef.current, activeSeconds);
    };

    const activityEvents: Array<keyof WindowEventMap> = [
      "click",
      "keydown",
      "mousemove",
      "pointerdown",
      "scroll",
      "touchstart",
    ];

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, markActivity, { passive: true });
    });
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", markActivity);

    sendHeartbeatIfActive(INITIAL_HEARTBEAT_SECONDS);
    const intervalId = window.setInterval(sendHeartbeatIfActive, HEARTBEAT_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
      sessionIdRef.current = null;
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, markActivity);
      });
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", markActivity);
    };
  }, [enabled, sessionKey]);
};
