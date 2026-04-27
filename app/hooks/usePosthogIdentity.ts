import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { dbAdapter } from "@/services/dbAdapter";
import {
  identifyPosthog,
  initPosthog,
  resetPosthog,
  setPosthogConsent,
  type PosthogConfig,
} from "@infra/diagnostics/posthog";
import {
  COOKIE_CONSENT_CHANGE_EVENT,
  getCookieConsentDecision,
  type CookieConsentDecision,
} from "@/shared/privacy/cookieConsent";

const COOKIE_CONSENT_STORAGE_KEY = "tf_cookie_consent_v1";

interface AppSettingsRow {
  posthog_enabled?: boolean | null;
  posthog_project_key?: string | null;
  posthog_api_host?: string | null;
  posthog_ui_host?: string | null;
}

const loadPosthogConfig = async (): Promise<PosthogConfig> => {
  try {
    const { data, error } = await dbAdapter
      .from("app_settings")
      .select(
        "posthog_enabled, posthog_project_key, posthog_api_host, posthog_ui_host",
      )
      .eq("id", "default")
      .maybeSingle();

    if (error || !data) {
      return {
        enabled: false,
        projectKey: null,
        apiHost: "https://eu.i.posthog.com",
        uiHost: "https://eu.posthog.com",
      };
    }

    const row = data as AppSettingsRow;
    return {
      enabled: row.posthog_enabled === true,
      projectKey: row.posthog_project_key ?? null,
      apiHost: row.posthog_api_host ?? "https://eu.i.posthog.com",
      uiHost: row.posthog_ui_host ?? "https://eu.posthog.com",
    };
  } catch (e) {
    console.warn("[posthog] failed to load config from app_settings", e);
    return {
      enabled: false,
      projectKey: null,
      apiHost: "https://eu.i.posthog.com",
      uiHost: "https://eu.posthog.com",
    };
  }
};

export const usePosthogIdentity = (): void => {
  const { user } = useAuth();
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const config = await loadPosthogConfig();
      if (cancelled) return;
      await initPosthog(config);
      if (cancelled) return;
      setBootstrapped(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!bootstrapped) return;
    if (user && user.role !== "demo") {
      identifyPosthog(user);
    } else {
      resetPosthog();
    }
  }, [
    bootstrapped,
    user?.id,
    user?.role,
    user?.subscriptionTier,
    user?.subscriptionStatus,
    user?.organizationId,
  ]);

  useEffect(() => {
    if (!bootstrapped) return;

    setPosthogConsent(getCookieConsentDecision());

    const handleConsentEvent = (event: Event) => {
      const detail = (event as CustomEvent<CookieConsentDecision | null>).detail;
      setPosthogConsent(detail ?? getCookieConsentDecision());
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== COOKIE_CONSENT_STORAGE_KEY) return;
      setPosthogConsent(getCookieConsentDecision());
    };

    window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, handleConsentEvent);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, handleConsentEvent);
      window.removeEventListener("storage", handleStorage);
    };
  }, [bootstrapped]);
};
