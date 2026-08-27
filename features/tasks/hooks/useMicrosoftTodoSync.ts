import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { microsoftAccountService } from "@/infra/auth/microsoftAccountService";
import { useAuthIdentity } from "@shared/auth/AuthIdentityContext";
import { runMicrosoftTodoSync } from "../api/microsoftTodoSyncApi";
import { MICROSOFT_TODO_LOCAL_CHANGE_EVENT } from "../model/microsoftTodoSyncEvents";
import { TODO_PROJECT_KEYS } from "./useTaskProjectsQuery";
import { TASK_KEYS } from "./useTasksQuery";

const SYNC_INTERVAL_MS = 60_000;
const LOCAL_CHANGE_DEBOUNCE_MS = 500;

export const useMicrosoftTodoSync = () => {
  const user = useAuthIdentity();
  const queryClient = useQueryClient();
  const busyRef = useRef(false);
  const connectedRef = useRef(false);
  const [connected, setConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const syncNow = useCallback(async (): Promise<void> => {
    if (!user || user.role === "demo" || busyRef.current) return;
    busyRef.current = true;
    setIsSyncing(true);
    try {
      const result = await runMicrosoftTodoSync();
      connectedRef.current = result.connected;
      setConnected(result.connected);
      if (result.connected && !result.busy) {
        setLastSyncedAt(new Date().toISOString());
        setSyncError(null);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: TASK_KEYS.all }),
          queryClient.invalidateQueries({ queryKey: TODO_PROJECT_KEYS.all }),
        ]);
      }
    } catch (cause) {
      setSyncError(cause instanceof Error ? cause.message : "Synchronizace Microsoft To Do selhala.");
    } finally {
      busyRef.current = false;
      setIsSyncing(false);
    }
  }, [queryClient, user]);

  const refreshStatus = useCallback(async (): Promise<boolean> => {
    if (!user || user.role === "demo") {
      connectedRef.current = false;
      setConnected(false);
      setIsChecking(false);
      return false;
    }
    try {
      const status = await microsoftAccountService.getTodoStatus();
      connectedRef.current = status.connected;
      setConnected(status.connected);
      setLastSyncedAt(status.lastSyncedAt);
      setSyncError(status.syncError);
      return status.connected;
    } catch (cause) {
      setSyncError(cause instanceof Error ? cause.message : "Stav Microsoft To Do není dostupný.");
      return false;
    } finally {
      setIsChecking(false);
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const initialize = async () => {
      const isConnected = await refreshStatus();
      if (active && isConnected) await syncNow();
    };
    void initialize();

    const handleFocus = async () => {
      const isConnected = await refreshStatus();
      if (active && isConnected) await syncNow();
    };
    const handleLocalChange = () => {
      if (!connectedRef.current) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => void syncNow(), LOCAL_CHANGE_DEBOUNCE_MS);
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener(MICROSOFT_TODO_LOCAL_CHANGE_EVENT, handleLocalChange);
    const interval = window.setInterval(() => {
      if (connectedRef.current) void syncNow();
    }, SYNC_INTERVAL_MS);

    return () => {
      active = false;
      if (debounceTimer) clearTimeout(debounceTimer);
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener(MICROSOFT_TODO_LOCAL_CHANGE_EVENT, handleLocalChange);
    };
  }, [refreshStatus, syncNow]);

  return {
    connected,
    isChecking,
    isSyncing,
    lastSyncedAt,
    syncError,
    syncNow,
  };
};
