import { beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = new Map<string, (...args: any[]) => any>();

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: any[]) => any) => {
      handlers.set(channel, handler);
    }),
  },
}));

const mockGetMcpStatus = vi.fn(() => ({
  port: 4040,
  sseUrl: 'http://localhost:4040/sse',
  currentProjectId: 'project-1',
  hasAuthToken: true,
  isConfigured: true,
}));
const mockSetMcpAuthToken = vi.fn();
const mockSetMcpCurrentProjectId = vi.fn();

vi.mock('../desktop/main/services/mcpServer', () => ({
  getMcpStatus: mockGetMcpStatus,
  setMcpAuthToken: mockSetMcpAuthToken,
  setMcpCurrentProjectId: mockSetMcpCurrentProjectId,
}));

describe('mcp IPC handlers security', () => {
  const mockRequireAuth = vi.fn();
  const sender = {} as Electron.WebContents;
  const event = { sender } as Electron.IpcMainInvokeEvent;

  beforeEach(async () => {
    handlers.clear();
    mockRequireAuth.mockReset();
    mockGetMcpStatus.mockClear();
    mockSetMcpAuthToken.mockClear();
    mockSetMcpCurrentProjectId.mockClear();

    const { registerMcpHandlers } = await import('../desktop/main/ipc/modules/mcpHandlers');
    registerMcpHandlers({ requireAuth: mockRequireAuth });
  });

  it('requires auth before setting MCP auth token', async () => {
    await handlers.get('mcp:setAuthToken')?.(event, 'token-123');

    expect(mockRequireAuth).toHaveBeenCalledWith(sender, 'mcp:setAuthToken');
    expect(mockSetMcpAuthToken).toHaveBeenCalledWith('token-123');
  });

  it('requires auth before setting MCP project context', async () => {
    await handlers.get('mcp:setCurrentProject')?.(event, 'project-abc');

    expect(mockRequireAuth).toHaveBeenCalledWith(sender, 'mcp:setCurrentProject');
    expect(mockSetMcpCurrentProjectId).toHaveBeenCalledWith('project-abc');
  });

  it('requires auth before reading MCP status', async () => {
    const result = await handlers.get('mcp:getStatus')?.(event);

    expect(mockRequireAuth).toHaveBeenCalledWith(sender, 'mcp:getStatus');
    expect(mockGetMcpStatus).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      port: 4040,
      sseUrl: 'http://localhost:4040/sse',
      currentProjectId: 'project-1',
      hasAuthToken: true,
      isConfigured: true,
    });
  });
});
