import { useEffect } from "react";
import { authSessionStore } from "@infra/auth/authSessionStore";
import { isDesktop, mcpAdapter, platformAdapter } from "@/services/platformAdapter";

export const useDesktopMcpTokenSync = (): void => {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isDesktop) return;

    let isMounted = true;
    let lastPushedToken: string | null = null;

    const pushToken = async (token: string | null) => {
      if (!isMounted) return;
      if (token === lastPushedToken) return;
      if (!token) {
        try {
          // Clear main-process MCP auth context on logout.
          // setAuthToken is a guarded IPC call, so temporarily mark renderer as
          // authenticated to clear the token and then reset auth back to false.
          await platformAdapter.auth.setAuthenticated(true);
          await mcpAdapter.setAuthToken(null);
          lastPushedToken = null;
        } catch (err) {
          console.warn("[useDesktopMcpTokenSync] Failed to clear MCP token:", err);
        } finally {
          await platformAdapter.auth.setAuthenticated(false);
        }
        return;
      }
      try {
        // Ensure main process knows we're authenticated before invoking guarded IPC.
        await platformAdapter.auth.setAuthenticated(true);
        await mcpAdapter.setAuthToken(token);
        lastPushedToken = token;
      } catch (err) {
        console.warn("[useDesktopMcpTokenSync] Failed to sync MCP token:", err);
      }
    };

    authSessionStore.start();

    const unsubscribe = authSessionStore.subscribe((snapshot) => {
      void pushToken(snapshot.accessToken);
    });

    void authSessionStore.syncSession();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);
};
