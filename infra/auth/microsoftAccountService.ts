import type { UserIdentity } from "@supabase/supabase-js";

import { oauthAdapter, shellAdapter } from "@/infra/platform/platformAdapter";
import { getPublicEnvValue } from "@/shared/config/publicEnv";
import { invokeAuthedFunction } from "@/services/functionsClient";
import { supabase } from "@/services/supabase";

type MicrosoftIdentityStatus = {
  available: boolean;
  linked: boolean;
  email: string | null;
};

export type MicrosoftTodoConnectionStatus = {
  connected: boolean;
  lastSyncedAt: string | null;
  syncError: string | null;
};

const settingsReturnTo = (): string => {
  const url = new URL("/app/settings", window.location.origin);
  url.searchParams.set("tab", "user");
  url.searchParams.set("subTab", "profile");
  url.searchParams.set("microsoft", "connected");
  return url.toString();
};

const isAzureIdentity = (identity: UserIdentity): boolean =>
  identity.provider === "azure";

const getIdentityEmail = (identity: UserIdentity): string | null => {
  const raw = identity.identity_data?.email
    ?? identity.identity_data?.preferred_username
    ?? identity.identity_data?.upn;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
};

const isAzureProviderAvailable = async (): Promise<boolean> => {
  const supabaseUrl = getPublicEnvValue("VITE_SUPABASE_URL", import.meta.env.VITE_SUPABASE_URL);
  const anonKey = getPublicEnvValue("VITE_SUPABASE_ANON_KEY", import.meta.env.VITE_SUPABASE_ANON_KEY);
  if (!supabaseUrl || !anonKey) return false;

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      headers: { apikey: anonKey },
    });
    if (!response.ok) return false;
    const settings = await response.json() as { external?: { azure?: boolean } };
    return settings.external?.azure === true;
  } catch {
    return false;
  }
};

const completeOAuth = async (authorizeUrl: string): Promise<void> => {
  window.location.assign(authorizeUrl);
};

const startIdentityLink = async (): Promise<void> => {
  const desktopFlow = await oauthAdapter.startSupabaseFlow();
  const redirectTo = desktopFlow?.redirectTo ?? settingsReturnTo();

  const { data, error } = await supabase.auth.linkIdentity({
    provider: "azure",
    options: {
      redirectTo,
      scopes: "email offline_access",
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("Microsoft autorizační adresa není dostupná.");

  if (desktopFlow) {
    const { code } = await oauthAdapter.completeSupabaseFlow({
      flowId: desktopFlow.flowId,
      authorizeUrl: data.url,
    });
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
    return;
  }

  await completeOAuth(data.url);
};

const startMicrosoftLogin = async (nextPath: string): Promise<void> => {
  const desktopFlow = await oauthAdapter.startSupabaseFlow();
  const redirectTo = desktopFlow?.redirectTo ?? new URL(nextPath, window.location.origin).toString();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "azure",
    options: {
      redirectTo,
      scopes: "email offline_access",
      skipBrowserRedirect: true,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("Microsoft autorizační adresa není dostupná.");

  if (desktopFlow) {
    const { code } = await oauthAdapter.completeSupabaseFlow({
      flowId: desktopFlow.flowId,
      authorizeUrl: data.url,
    });
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
    return;
  }
  await completeOAuth(data.url);
};

export const microsoftAccountService = {
  async getStatus(): Promise<{ connected: boolean }> {
    return invokeAuthedFunction<{ connected: boolean }>("dochub-personal-microsoft", {
      body: { action: "status" },
      retries: 1,
    });
  },

  async connectDocumentAccess(): Promise<void> {
    const result = await invokeAuthedFunction<{ url?: string }>("dochub-auth-url", {
      body: {
        provider: "onedrive",
        mode: "user",
        accessKind: "personal_read",
        returnTo: settingsReturnTo(),
      },
      retries: 0,
    });
    if (!result.url) throw new Error("Microsoft autorizační adresa není dostupná.");
    await shellAdapter.openExternal(result.url);
  },

  async disconnectDocumentAccess(): Promise<void> {
    await invokeAuthedFunction("dochub-personal-microsoft", {
      body: { action: "disconnect" },
      retries: 0,
    });
  },

  async getTodoStatus(): Promise<MicrosoftTodoConnectionStatus> {
    return invokeAuthedFunction<MicrosoftTodoConnectionStatus>("microsoft-todo-connection", {
      body: { action: "status" },
      retries: 1,
    });
  },

  async connectTodoAccess(): Promise<void> {
    const result = await invokeAuthedFunction<{ url?: string }>("dochub-auth-url", {
      body: {
        provider: "onedrive",
        mode: "user",
        accessKind: "todo_sync",
        returnTo: settingsReturnTo(),
      },
      retries: 0,
    });
    if (!result.url) throw new Error("Microsoft autorizační adresa není dostupná.");
    await shellAdapter.openExternal(result.url);
  },

  async disconnectTodoAccess(): Promise<void> {
    await invokeAuthedFunction("microsoft-todo-connection", {
      body: { action: "disconnect" },
      retries: 0,
    });
  },

  async getLoginIdentity(): Promise<MicrosoftIdentityStatus> {
    const [available, identitiesResult] = await Promise.all([
      isAzureProviderAvailable(),
      supabase.auth.getUserIdentities(),
    ]);
    if (identitiesResult.error) throw identitiesResult.error;
    const identity = identitiesResult.data?.identities.find(isAzureIdentity) ?? null;
    return {
      available,
      linked: Boolean(identity),
      email: identity ? getIdentityEmail(identity) : null,
    };
  },

  async linkLoginIdentity(): Promise<void> {
    await startIdentityLink();
  },

  async unlinkLoginIdentity(): Promise<void> {
    const { data, error } = await supabase.auth.getUserIdentities();
    if (error) throw error;
    const identity = data?.identities.find(isAzureIdentity);
    if (!identity) return;
    if ((data?.identities.length ?? 0) < 2) {
      throw new Error("Nelze odebrat jediný způsob přihlášení k účtu.");
    }
    const { error: unlinkError } = await supabase.auth.unlinkIdentity(identity);
    if (unlinkError) throw unlinkError;
  },
};

export const microsoftLoginService = {
  async isAvailable(): Promise<boolean> {
    const enabled = getPublicEnvValue(
      "VITE_MICROSOFT_LOGIN_ENABLED",
      import.meta.env.VITE_MICROSOFT_LOGIN_ENABLED,
    ).toLowerCase() === "true";
    return enabled && await isAzureProviderAvailable();
  },

  login(nextPath: string): Promise<void> {
    return startMicrosoftLogin(nextPath);
  },
};
