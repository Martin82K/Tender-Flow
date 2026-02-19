import { ipcMain } from "electron";
import { getMcpStatus, setMcpAuthToken, setMcpCurrentProjectId } from "../../services/mcpServer";

export const registerMcpHandlers = (): void => {
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
