import { useEffect } from "react";
import { supabase } from "@/services/supabase";

export const useDesktopMcpTokenSync = (): void => {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const api = window.electronAPI;
    if (!api?.platform?.isDesktop || !api?.mcp?.setAuthToken) return;

    let isMounted = true;

    const pushToken = async (token: string | null) => {
      if (!isMounted) return;
      await api.mcp.setAuthToken(token);
    };

    supabase.auth.getSession().then(({ data }) => {
      void pushToken(data.session?.access_token ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      void pushToken(session?.access_token ?? null);
    });

    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);
};
