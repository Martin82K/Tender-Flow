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
      // Without a valid session, don't touch the main-process MCP state.
      // The IPC guard would reject this call (renderer hasn't authenticated yet)
      // and the error would surface as an incident dialog on cold start.
      if (!token) {
        lastPushedToken = null;
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
