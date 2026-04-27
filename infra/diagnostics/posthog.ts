import type { PostHog } from "posthog-js";
import type { User } from "@/types";
import {
  getCookieConsentDecision,
  type CookieConsentDecision,
} from "@/shared/privacy/cookieConsent";

export interface PosthogConfig {
  enabled: boolean;
  projectKey: string | null;
  apiHost: string;
  uiHost: string;
}

const DEFAULT_API_HOST = "https://eu.i.posthog.com";
const DEFAULT_UI_HOST = "https://eu.posthog.com";

let client: PostHog | null = null;
let initPromise: Promise<void> | null = null;

const isEnabled = (): boolean => client !== null;

export const initPosthog = (config: PosthogConfig): Promise<void> => {
  if (initPromise) return initPromise;
  if (typeof window === "undefined") return Promise.resolve();
  if (!config.enabled) return Promise.resolve();

  const key = (config.projectKey ?? "").trim();
  if (!key) return Promise.resolve();

  const apiHost = config.apiHost?.trim() || DEFAULT_API_HOST;
  const uiHost = config.uiHost?.trim() || DEFAULT_UI_HOST;

  initPromise = (async () => {
    try {
      const mod = await import("posthog-js");
      const ph = mod.default;
      ph.init(key, {
        api_host: apiHost,
        ui_host: uiHost,
        persistence: "localStorage",
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
        opt_out_capturing_by_default: true,
        loaded: (instance) => {
          if (getCookieConsentDecision() === "accepted_all") {
            instance.opt_in_capturing();
          }
        },
      });
      client = ph;
    } catch (error) {
      console.warn("[posthog] init failed", error);
    }
  })();

  return initPromise;
};

export const setPosthogConsent = (decision: CookieConsentDecision | null): void => {
  if (!isEnabled() || !client) return;
  if (decision === "accepted_all") {
    client.opt_in_capturing();
  } else {
    client.opt_out_capturing();
  }
};

export const identifyPosthog = (user: User | null): void => {
  if (!isEnabled() || !client) return;
  if (!user || user.role === "demo") return;
  client.identify(user.id, {
    email: user.email,
    role: user.role,
    subscription_tier: user.subscriptionTier ?? null,
    subscription_status: user.subscriptionStatus ?? null,
    organization_id: user.organizationId ?? null,
    organization_type: user.organizationType ?? null,
  });
};

export const resetPosthog = (): void => {
  if (!isEnabled() || !client) return;
  client.reset();
};

export const capturePosthog = (
  event: string,
  properties?: Record<string, unknown>,
): void => {
  if (!isEnabled() || !client) return;
  client.capture(event, properties);
};

export const capturePosthogPageview = (path?: string): void => {
  if (!isEnabled() || !client || typeof window === "undefined") return;
  client.capture("$pageview", {
    $current_url: path ?? window.location.href,
  });
};

export const __resetPosthogForTests = (): void => {
  client = null;
  initPromise = null;
};
