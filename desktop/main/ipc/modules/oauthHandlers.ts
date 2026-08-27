import { ipcMain, shell } from "electron";
import * as crypto from "crypto";

interface OAuthHandlerDependencies {
  parseUrl: (rawUrl: string) => URL;
  isAllowedExternalUrl: (parsed: URL) => boolean;
  createCodeVerifier: () => string;
  createCodeChallenge: (verifier: string) => string;
  startLoopbackServer: (
    timeoutMs: number,
  ) => Promise<{ port: number; waitForCode: Promise<{ code: string; state: string | null }> }>;
  requireAuth: (sender: Electron.WebContents, channel?: string) => void;
  isTrustedSender: (sender: Electron.WebContents) => boolean;
  getSupabaseUrl: () => string;
}

const hasSingleSearchParam = (url: URL, name: string, expectedValue: string): boolean => {
  const values = url.searchParams.getAll(name);
  return values.length === 1 && values[0] === expectedValue;
};

const isAllowedSupabaseAuthorizeUrl = (
  authorizeUrl: URL,
  configuredOrigin: string,
  redirectTo: string,
): boolean => {
  const allowedAuthorizePaths = new Set([
    "/auth/v1/authorize",
    "/auth/v1/user/identities/authorize",
  ]);
  return authorizeUrl.protocol === "https:"
    && authorizeUrl.origin === configuredOrigin
    && allowedAuthorizePaths.has(authorizeUrl.pathname)
    && hasSingleSearchParam(authorizeUrl, "provider", "azure")
    && hasSingleSearchParam(authorizeUrl, "redirect_to", redirectTo);
};

const isAllowedMicrosoftIdentityAuthorizeUrl = (
  authorizeUrl: URL,
  configuredOrigin: string,
  redirectTo: string,
): boolean => {
  const tenantAuthorizePath = /^\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/oauth2\/v2\.0\/authorize$/i;
  const allowedScopes = new Set([
    "openid",
    "email",
    "offline_access",
    "https://graph.microsoft.com/.default",
  ]);
  const allowedParamNames = new Set([
    "client_id",
    "prompt",
    "redirect_to",
    "redirect_uri",
    "response_type",
    "scope",
    "skip_http_redirect",
  ]);
  const entries = [...authorizeUrl.searchParams.entries()];
  const scopes = (authorizeUrl.searchParams.get("scope") || "")
    .split(/\s+/)
    .filter(Boolean);
  const clientId = authorizeUrl.searchParams.get("client_id") || "";
  const expectedCallback = new URL("/auth/v1/callback", configuredOrigin).toString();

  return authorizeUrl.protocol === "https:"
    && authorizeUrl.origin === "https://login.microsoftonline.com"
    && tenantAuthorizePath.test(authorizeUrl.pathname)
    && entries.length === allowedParamNames.size
    && entries.every(([name]) => allowedParamNames.has(name))
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)
    && hasSingleSearchParam(authorizeUrl, "prompt", "select_account")
    && hasSingleSearchParam(authorizeUrl, "redirect_to", redirectTo)
    && hasSingleSearchParam(authorizeUrl, "redirect_uri", expectedCallback)
    && hasSingleSearchParam(authorizeUrl, "response_type", "code")
    && hasSingleSearchParam(authorizeUrl, "skip_http_redirect", "true")
    && scopes.length === allowedScopes.size
    && scopes.every((scope) => allowedScopes.has(scope));
};

export const registerOAuthHandlers = ({
  parseUrl,
  isAllowedExternalUrl,
  createCodeVerifier,
  createCodeChallenge,
  startLoopbackServer,
  requireAuth,
  isTrustedSender,
  getSupabaseUrl,
}: OAuthHandlerDependencies): void => {
  type SupabaseFlow = {
    redirectTo: string;
    waitForCode: Promise<{ code: string; state: string | null }>;
    sender: Electron.WebContents;
    completing: boolean;
  };
  const supabaseFlows = new Map<string, SupabaseFlow>();
  let pendingFlowCreation: {
    sender: Electron.WebContents;
    result: Promise<{ flowId: string; redirectTo: string }>;
  } | null = null;

  ipcMain.handle("oauth:startSupabaseFlow", async (event) => {
    if (!isTrustedSender(event.sender)) throw new Error("OAuth request from untrusted renderer");
    const activeEntry = supabaseFlows.entries().next().value as [string, SupabaseFlow] | undefined;
    if (activeEntry) {
      const [flowId, flow] = activeEntry;
      if (flow.sender === event.sender && !flow.completing) {
        return { flowId, redirectTo: flow.redirectTo };
      }
      if (flow.sender === event.sender) {
        throw new Error("Přihlášení Microsoft již probíhá. Dokončete jej v otevřeném okně.");
      }
      throw new Error("Přihlášení Microsoft již probíhá v jiném okně.");
    }

    if (pendingFlowCreation) {
      if (pendingFlowCreation.sender === event.sender) return pendingFlowCreation.result;
      throw new Error("Přihlášení Microsoft již probíhá v jiném okně.");
    }

    const result = (async () => {
      const { port, waitForCode } = await startLoopbackServer(120_000);
      const flowId = crypto.randomUUID();
      const redirectTo = `http://127.0.0.1:${port}/oauth2/callback`;
      supabaseFlows.set(flowId, {
        redirectTo,
        waitForCode,
        sender: event.sender,
        completing: false,
      });
      void waitForCode.finally(() => supabaseFlows.delete(flowId)).catch(() => undefined);
      return { flowId, redirectTo };
    })();
    pendingFlowCreation = { sender: event.sender, result };
    try {
      return await result;
    } finally {
      if (pendingFlowCreation?.result === result) pendingFlowCreation = null;
    }
  });

  ipcMain.handle(
    "oauth:completeSupabaseFlow",
    async (event, args: { flowId: string; authorizeUrl: string }) => {
      if (!isTrustedSender(event.sender)) throw new Error("OAuth request from untrusted renderer");
      const flow = supabaseFlows.get(args?.flowId || "");
      if (!flow) throw new Error("OAuth flow not found or expired");
      if (flow.sender !== event.sender) throw new Error("OAuth flow nepatří tomuto oknu");

      const configuredUrl = getSupabaseUrl();
      const configuredOrigin = new URL(configuredUrl).origin;
      const authorizeUrl = new URL(args?.authorizeUrl || "");
      const isAllowedAuthorizeUrl = isAllowedSupabaseAuthorizeUrl(
        authorizeUrl,
        configuredOrigin,
        flow.redirectTo,
      ) || isAllowedMicrosoftIdentityAuthorizeUrl(
        authorizeUrl,
        configuredOrigin,
        flow.redirectTo,
      );
      if (!isAllowedAuthorizeUrl) {
        throw new Error("Blocked Supabase OAuth authorize URL");
      }
      if (flow.completing) {
        throw new Error("Přihlášení Microsoft již probíhá. Dokončete jej v otevřeném okně.");
      }

      flow.completing = true;
      try {
        await shell.openExternal(authorizeUrl.toString());
        const expectedState = authorizeUrl.searchParams.get("state");
        const result = await flow.waitForCode;
        if (expectedState && result.state !== expectedState) {
          throw new Error("Invalid OAuth state");
        }
        return { code: result.code };
      } catch (error) {
        if (supabaseFlows.get(args.flowId) === flow) flow.completing = false;
        throw error;
      }
    },
  );

  ipcMain.handle(
    "oauth:googleLogin",
    async (
      _event,
      args: { clientId: string; scopes: string[] },
    ) => {
      requireAuth(_event.sender, 'oauth:googleLogin');
      const clientId = (args?.clientId || "").trim();
      // Security: client secret is read from environment, never from renderer IPC
      const clientSecret = (process.env.GOOGLE_OAUTH_CLIENT_SECRET || "").trim();
      if (!clientId) {
        throw new Error("Missing Google OAuth clientId");
      }
      const scopes =
        Array.isArray(args?.scopes) && args.scopes.length > 0
          ? args.scopes
          : ["https://www.googleapis.com/auth/drive.file"];

      const codeVerifier = createCodeVerifier();
      const codeChallenge = createCodeChallenge(codeVerifier);
      const { port, waitForCode } = await startLoopbackServer(120_000);
      const redirectUri = `http://127.0.0.1:${port}/oauth2/callback`;
      const state = crypto.randomUUID();

      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", scopes.join(" "));
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("include_granted_scopes", "true");
      authUrl.searchParams.set("code_challenge", codeChallenge);
      authUrl.searchParams.set("code_challenge_method", "S256");
      authUrl.searchParams.set("state", state);

      const parsedAuthUrl = parseUrl(authUrl.toString());
      if (!isAllowedExternalUrl(parsedAuthUrl)) {
        throw new Error("Blocked OAuth URL host");
      }
      await shell.openExternal(parsedAuthUrl.toString());
      const { code, state: returnedState } = await waitForCode;
      if (returnedState !== state) {
        throw new Error("Invalid OAuth state");
      }

      const body = new URLSearchParams();
      body.set("code", code);
      body.set("client_id", clientId);
      if (clientSecret) {
        body.set("client_secret", clientSecret);
      }
      body.set("code_verifier", codeVerifier);
      body.set("redirect_uri", redirectUri);
      body.set("grant_type", "authorization_code");

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      });
      const tokenJson = (await tokenRes.json()) as any;
      if (!tokenRes.ok) {
        throw new Error(tokenJson?.error_description || "Google token exchange failed");
      }

      return {
        accessToken: tokenJson.access_token,
        refreshToken: tokenJson.refresh_token || null,
        expiresIn: tokenJson.expires_in,
        scope: tokenJson.scope || null,
        tokenType: tokenJson.token_type,
        idToken: tokenJson.id_token || null,
      };
    },
  );
};
