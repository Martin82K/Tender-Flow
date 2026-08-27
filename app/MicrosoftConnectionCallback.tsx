import React, { useEffect } from "react";

import { authSessionStore } from "@/infra/auth/authSessionStore";
import { microsoftAccountService } from "@/infra/auth/microsoftAccountService";
import { navigate } from "@/shared/routing/router";

const hasPendingMicrosoftConnection = (): boolean => {
  const url = new URL(window.location.href);
  return url.searchParams.get("microsoft_provider") === "connected";
};

export const MicrosoftConnectionCallback: React.FC = () => {
  useEffect(() => {
    if (!hasPendingMicrosoftConnection()) return;

    const currentUrl = new URL(window.location.href);
    if (currentUrl.pathname === "/app/settings") return;

    let active = true;
    let completing = false;
    authSessionStore.start();
    const unsubscribe = authSessionStore.subscribe(({ session }) => {
      if (!active || completing || !session) return;
      completing = true;
      void microsoftAccountService.completeMicrosoftAccountConnection().catch(() => {
        if (!active) return;
        const settingsUrl = new URL("/app/settings", window.location.origin);
        settingsUrl.searchParams.set("tab", "user");
        settingsUrl.searchParams.set("subTab", "profile");
        settingsUrl.searchParams.set("microsoft_provider", "connected");
        navigate(`${settingsUrl.pathname}${settingsUrl.search}`, { replace: true });
      });
    });
    void authSessionStore.syncSession();

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return null;
};
