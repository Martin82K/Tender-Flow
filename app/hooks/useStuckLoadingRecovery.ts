import { useEffect, useRef } from "react";
import { clearStoredSessionData } from "@/services/supabase";

interface UseStuckLoadingRecoveryParams {
  shouldShowLoader: boolean;
  isDataLoading: boolean;
  isDesktop: boolean;
  logout: () => void;
}

const STUCK_LOADING_TIMEOUT_MS = 20000;

export const useStuckLoadingRecovery = ({
  shouldShowLoader,
  isDataLoading,
  isDesktop,
  logout,
}: UseStuckLoadingRecoveryParams): void => {
  const loadingStartTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (shouldShowLoader || isDataLoading) {
      if (!loadingStartTimeRef.current) {
        loadingStartTimeRef.current = Date.now();
      }
      return;
    }

    loadingStartTimeRef.current = null;
  }, [shouldShowLoader, isDataLoading]);

  useEffect(() => {
    if (!shouldShowLoader && !isDataLoading) return;
    if (!loadingStartTimeRef.current) return;

    const checkStuck = setInterval(() => {
      if (!loadingStartTimeRef.current) {
        clearInterval(checkStuck);
        return;
      }

      const elapsed = Date.now() - loadingStartTimeRef.current;
      if (elapsed <= STUCK_LOADING_TIMEOUT_MS) {
        return;
      }

      console.warn(`[App] Loading stuck for ${elapsed}ms, attempting recovery...`);
      clearInterval(checkStuck);
      loadingStartTimeRef.current = null;

      try {
        clearStoredSessionData();
      } catch {
        // ignore session cleanup errors
      }

      if (isDesktop && window.electronAPI?.session) {
        window.electronAPI.session.clearCredentials().catch(() => {});
      }

      logout();
    }, 2000);

    return () => clearInterval(checkStuck);
  }, [shouldShowLoader, isDataLoading, isDesktop, logout]);
};
