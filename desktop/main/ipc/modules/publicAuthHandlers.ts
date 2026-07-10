import { ipcMain, net } from "electron";

type PublicAuthFunctionName = "request-password-reset" | "confirm-password-reset";

interface PublicAuthHandlerDependencies {
  getSupabasePublicConfig: () => { url: string; anonKey: string };
  isTrustedSender: (sender: Electron.WebContents) => boolean;
}

const ALLOWED_PUBLIC_AUTH_FUNCTIONS = new Set<PublicAuthFunctionName>([
  "request-password-reset",
  "confirm-password-reset",
]);
const MAX_REQUEST_BODY_BYTES = 16 * 1024;
const MAX_RESPONSE_BODY_BYTES = 64 * 1024;

const isJwtLikeKey = (value: string): boolean => /^eyJ[A-Za-z0-9_-]+\./.test(value.trim());

const buildFunctionUrl = (baseUrl: string, functionName: PublicAuthFunctionName): string => {
  const parsedBaseUrl = new URL(baseUrl);
  const isLocalDevelopment =
    parsedBaseUrl.protocol === "http:" &&
    (parsedBaseUrl.hostname === "localhost" || parsedBaseUrl.hostname === "127.0.0.1");

  if (parsedBaseUrl.protocol !== "https:" && !isLocalDevelopment) {
    throw new Error("Invalid Supabase URL protocol for public auth request");
  }

  return `${parsedBaseUrl.origin}/functions/v1/${functionName}`;
};

export const registerPublicAuthHandlers = ({
  getSupabasePublicConfig,
  isTrustedSender,
}: PublicAuthHandlerDependencies): void => {
  ipcMain.handle(
    "auth:invokePublicFunction",
    async (
      event,
      functionName: PublicAuthFunctionName,
      body: unknown,
    ) => {
      if (!isTrustedSender(event.sender)) {
        throw new Error("IPC_AUTH_DENIED: untrusted sender for public auth request");
      }
      if (!ALLOWED_PUBLIC_AUTH_FUNCTIONS.has(functionName)) {
        throw new Error("Public auth function is not allowed");
      }

      const { url, anonKey } = getSupabasePublicConfig();
      if (!url || !anonKey) {
        throw new Error("Missing Supabase public configuration");
      }

      const serializedBody = JSON.stringify(body ?? {});
      if (Buffer.byteLength(serializedBody, "utf8") > MAX_REQUEST_BODY_BYTES) {
        throw new Error("Public auth request body is too large");
      }

      const headers: Record<string, string> = {
        apikey: anonKey,
        "content-type": "application/json",
      };
      if (isJwtLikeKey(anonKey)) {
        headers.Authorization = `Bearer ${anonKey}`;
      }

      const response = await net.fetch(buildFunctionUrl(url, functionName), {
        method: "POST",
        headers,
        body: serializedBody,
      });
      const text = await response.text();
      if (Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BODY_BYTES) {
        throw new Error("Public auth response body is too large");
      }

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        text,
        headers: responseHeaders,
      };
    },
  );
};
