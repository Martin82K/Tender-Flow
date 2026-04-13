import { ipcMain } from "electron";
import { getMcpStatus, setMcpAuthToken, setMcpCurrentProjectId } from "../../services/mcpServer";

interface McpHandlerDependencies {
  requireAuth: (sender: Electron.WebContents, channel?: string) => void;
}

export const registerMcpHandlers = (_deps: McpHandlerDependencies): void => {
  // Pre-auth: MCP state sync happens on auth state changes including SIGNED_OUT/INITIAL_SESSION.
  // Risk: minimal — MCP server is localhost-only and validates tokens against Supabase.
  ipcMain.handle("mcp:setCurrentProject", async (_event, projectId: string | null): Promise<void> => {
    setMcpCurrentProjectId(projectId || null);
  });

  ipcMain.handle("mcp:setAuthToken", async (_event, token: string | null): Promise<void> => {
    setMcpAuthToken(token || null);
  });

  ipcMain.handle("mcp:getStatus", async (): Promise<{
    port: number | null;
    sseUrl: string | null;
    currentProjectId: string | null;
    hasAuthToken: boolean;
    isConfigured: boolean;
  }> => {
    return getMcpStatus();
  });
};
