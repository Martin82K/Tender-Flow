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
}

export const registerOAuthHandlers = ({
  parseUrl,
  isAllowedExternalUrl,
  createCodeVerifier,
  createCodeChallenge,
  startLoopbackServer,
  requireAuth,
}: OAuthHandlerDependencies): void => {
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
