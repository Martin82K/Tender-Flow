import type { Session, UserIdentity } from "@supabase/supabase-js";

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

const identityReturnTo = (): string => {
  const url = new URL(settingsReturnTo());
  url.searchParams.set("microsoft_provider", "connected");
  return url.toString();
};

const microsoftProviderReturnTo = (nextPath: string): string => {
  const url = new URL(nextPath, window.location.origin);
  url.searchParams.set("microsoft_provider", "connected");
  url.searchParams.set("microsoft_login", "1");
  return url.toString();
};

const MICROSOFT_GRAPH_SCOPES = "email offline_access https://graph.microsoft.com/.default";

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

const persistProviderSession = async (session: Session | null): Promise<boolean> => {
  const accessToken = session?.provider_token?.trim();
  const refreshToken = session?.provider_refresh_token?.trim();
  if (!accessToken || !refreshToken) return false;

  const connection = await invokeAuthedFunction<{ connected: boolean }>("microsoft-graph-connection", {
    body: { action: "connect", accessToken, refreshToken },
    retries: 0,
  });
  if (!connection.connected) {
    throw new Error("Microsoft Graph připojení se nepodařilo aktivovat.");
  }

  try {
    const initialSync = await invokeAuthedFunction<{ connected: boolean }>("microsoft-todo-sync", {
      body: {},
      retries: 1,
      timeoutMs: 90_000,
    });
    if (!initialSync.connected) {
      throw new Error("Microsoft To Do synchronizaci se nepodařilo aktivovat.");
    }
  } catch (cause) {
    await invokeAuthedFunction("microsoft-graph-connection", {
      body: { action: "disconnect" },
      retries: 0,
    }).catch(() => undefined);
    throw cause;
  }
  return true;
};

const startIdentityLink = async (): Promise<void> => {
  const desktopFlow = await oauthAdapter.startSupabaseFlow();
  const redirectTo = desktopFlow?.redirectTo ?? identityReturnTo();

  const { data, error } = await supabase.auth.linkIdentity({
    provider: "azure",
    options: {
      redirectTo,
      scopes: MICROSOFT_GRAPH_SCOPES,
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
    const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
    if (!await persistProviderSession(exchangeData.session)) {
      throw new Error("Microsoft neposkytl token pro dlouhodobé propojení.");
    }
    return;
  }

  await completeOAuth(data.url);
};

const startMicrosoftLogin = async (
  nextPath: string,
  requireProviderSession = false,
  rollbackLoginOnFailure = false,
): Promise<void> => {
  const desktopFlow = await oauthAdapter.startSupabaseFlow();
  const redirectTo = desktopFlow?.redirectTo ?? microsoftProviderReturnTo(nextPath);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "azure",
    options: {
      redirectTo,
      scopes: MICROSOFT_GRAPH_SCOPES,
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
    const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
    try {
      const stored = await persistProviderSession(exchangeData.session);
      if (requireProviderSession && !stored) {
        throw new Error("Microsoft neposkytl token pro dlouhodobé propojení.");
      }
    } catch (cause) {
      if (rollbackLoginOnFailure) {
        await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      }
      throw cause;
    }
    return;
  }
  await completeOAuth(data.url);
};

export const microsoftAccountService = {
  async getGraphStatus(): Promise<{ connected: boolean }> {
    return invokeAuthedFunction<{ connected: boolean }>("microsoft-graph-connection", {
      body: { action: "status" },
      retries: 1,
    });
  },

  async connectMicrosoftAccount(): Promise<void> {
    const { data, error } = await supabase.auth.getUserIdentities();
    if (error) throw error;
    const hasAzureIdentity = data?.identities.some(isAzureIdentity) ?? false;
    if (!hasAzureIdentity) {
      await startIdentityLink();
      return;
    }
    await startMicrosoftLogin(identityReturnTo(), true);
  },

  async completeMicrosoftAccountConnection(): Promise<boolean> {
    const url = new URL(window.location.href);
    if (url.searchParams.get("microsoft_provider") !== "connected") return false;
    const rollbackLoginOnFailure = url.searchParams.get("microsoft_login") === "1";
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    try {
      const stored = await persistProviderSession(data.session);
      if (!stored) throw new Error("Microsoft neposkytl token pro dlouhodobé propojení.");
    } catch (cause) {
      if (rollbackLoginOnFailure) {
        await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      }
      throw cause;
    }
    url.searchParams.delete("microsoft_provider");
    url.searchParams.delete("microsoft_login");
    window.history.replaceState(window.history.state, "", url.toString());
    return true;
  },

  async disconnectMicrosoftAccount(): Promise<void> {
    await invokeAuthedFunction("microsoft-graph-connection", {
      body: { action: "disconnect" },
      retries: 0,
    });

    const { data, error } = await supabase.auth.getUserIdentities();
    if (error) throw error;
    const identity = data?.identities.find(isAzureIdentity);
    if (!identity || (data?.identities.length ?? 0) < 2) return;
    const { error: unlinkError } = await supabase.auth.unlinkIdentity(identity);
    if (unlinkError) throw unlinkError;
  },

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
    return startMicrosoftLogin(nextPath, true, true);
  },
};
