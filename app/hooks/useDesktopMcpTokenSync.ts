import { useEffect } from "react";
import { authSessionStore } from "@infra/auth/authSessionStore";
import { isDesktop, mcpAdapter, updaterAdapter } from "@/services/platformAdapter";

export const useDesktopMcpTokenSync = (): void => {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isDesktop) return;

    let isMounted = true;

    const pushToken = async (token: string | null) => {
      if (!isMounted) return;
      await Promise.all([
        mcpAdapter.setAuthToken(token),
        updaterAdapter.setAuthToken(token),
      ]);
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
