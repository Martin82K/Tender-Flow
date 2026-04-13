import { ipcMain } from "electron";
import { getMcpStatus, setMcpAuthToken, setMcpCurrentProjectId } from "../../services/mcpServer";

interface McpHandlerDependencies {
  requireAuth: (sender: Electron.WebContents, channel?: string) => void;
}

export const registerMcpHandlers = ({ requireAuth }: McpHandlerDependencies): void => {
  ipcMain.handle("mcp:setCurrentProject", async (event, projectId: string | null): Promise<void> => {
    requireAuth(event.sender, 'mcp:setCurrentProject');
    setMcpCurrentProjectId(projectId || null);
  });

  ipcMain.handle("mcp:setAuthToken", async (event, token: string | null): Promise<void> => {
    requireAuth(event.sender, 'mcp:setAuthToken');
    setMcpAuthToken(token || null);
  });

  ipcMain.handle("mcp:getStatus", async (event): Promise<{
    port: number | null;
    sseUrl: string | null;
    currentProjectId: string | null;
    hasAuthToken: boolean;
    isConfigured: boolean;
  }> => {
    requireAuth(event.sender, 'mcp:getStatus');
    return getMcpStatus();
  });
};
