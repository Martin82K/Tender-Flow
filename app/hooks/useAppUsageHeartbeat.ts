import { useEffect, useRef } from "react";
import { recordUsageHeartbeat } from "@/infra/usage/appUsageService";

const HEARTBEAT_INTERVAL_MS = 120_000;
const HEARTBEAT_SECONDS = HEARTBEAT_INTERVAL_MS / 1000;
const IDLE_TIMEOUT_MS = 5 * 60_000;

interface UseAppUsageHeartbeatInput {
  enabled: boolean;
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

const createSessionId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const useAppUsageHeartbeat = ({ enabled }: UseAppUsageHeartbeatInput): void => {
  const sessionIdRef = useRef<string>(createSessionId());
  const lastActivityAtRef = useRef<number>(Date.now());
  const isWindowFocusedRef = useRef<boolean>(
    typeof document === "undefined" ? true : document.hasFocus(),
  );

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || typeof document === "undefined") {
      return undefined;
    }

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

    const sendHeartbeatIfActive = () => {
      const now = Date.now();
      if (!shouldRecordUsageHeartbeat({
        now,
        lastActivityAt: lastActivityAtRef.current,
        isDocumentVisible: document.visibilityState === "visible",
        isWindowFocused: isWindowFocusedRef.current,
      })) {
        return;
      }

      void recordUsageHeartbeat(sessionIdRef.current, HEARTBEAT_SECONDS);
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

    const intervalId = window.setInterval(sendHeartbeatIfActive, HEARTBEAT_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, markActivity);
      });
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", markActivity);
    };
  }, [enabled]);
};
