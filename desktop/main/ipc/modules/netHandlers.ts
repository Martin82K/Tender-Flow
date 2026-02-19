import { ipcMain } from "electron";

interface NetHandlerDependencies {
  isAllowedProxyUrl: (parsed: URL) => boolean;
}

export const registerNetHandlers = ({ isAllowedProxyUrl }: NetHandlerDependencies): void => {
  ipcMain.handle("net:request", async (_, url: string, options?: any) => {
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
        if (hasKey) console.log(`[Proxy] Key prefix: ${options.headers.apikey.substring(0, 5)}...`);
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
      console.error("[Proxy] Error fetching URL via proxy:", error);
      console.error("[Proxy] Error Details:", {
        message: error.message,
        code: error.code,
        cause: error.cause,
        stack: error.stack,
      });
      throw error;
    }
  });
};
