import { ipcMain } from "electron";

interface NetHandlerDependencies {
  isAllowedProxyUrl: (parsed: URL) => boolean;
  requireAuth: (sender: Electron.WebContents, channel?: string) => void;
}

const sanitizeProxyError = (error: unknown): Record<string, unknown> => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      code: "code" in error ? (error as { code?: unknown }).code ?? null : null,
    };
  }

  return {
    message: String(error),
  };
};

export const registerNetHandlers = ({ isAllowedProxyUrl, requireAuth }: NetHandlerDependencies): void => {
  ipcMain.handle("net:request", async (event, url: string, options?: any) => {
    requireAuth(event.sender, 'net:request');
    try {
      const parsedUrl = new URL(url);
      if (!isAllowedProxyUrl(parsedUrl)) {
        throw new Error(`Proxy target not allowed: ${parsedUrl.hostname}`);
      }

      console.log(`[Proxy] Fetching ${parsedUrl.origin} (Main Process) via electron.net.fetch`);

      if (options?.headers) {
        const hasAuth = !!options.headers.Authorization;
        const hasKey = !!options.headers.apikey;
        console.log(`[Proxy] Request Headers Check - Auth: ${hasAuth}, Key: ${hasKey}`);
      }

      const { net } = require("electron");
      const response = await net.fetch(parsedUrl.toString(), options);
      const text = await response.text();

      console.log(`[Proxy] Response: ${response.status} ${response.statusText}`);

      const headers: Record<string, string> = {};
      response.headers.forEach((val, key) => {
        headers[key] = val;
      });

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        text,
        headers,
      };
    } catch (error: any) {
      console.error("[Proxy] Error fetching URL via proxy:", sanitizeProxyError(error));
      throw error;
    }
  });
};
