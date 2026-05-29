import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Electron modules before importing the guard
vi.mock('electron', () => ({
  BrowserWindow: {
    fromWebContents: vi.fn(),
  },
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'userData') return '/Users/tester/Library/Application Support/TenderFlow';
      return '/tmp';
    }),
  },
}));

import { ipcAuthGuard } from '../desktop/main/services/ipcAuthGuard';
import { BrowserWindow } from 'electron';

const mockFromWebContents = vi.mocked(BrowserWindow.fromWebContents);

const createMockSender = (windowId?: number) => {
  const sender = {
    executeJavaScript: vi.fn(),
  } as unknown as Electron.WebContents;
  if (windowId !== undefined) {
    mockFromWebContents.mockReturnValue({ id: windowId } as any);
  } else {
    mockFromWebContents.mockReturnValue(null);
  }
  return sender;
};

describe('IPC Auth Guard security', () => {
  const originalFetch = global.fetch;
  const originalSupabaseUrl = process.env.VITE_SUPABASE_URL;
  const originalSupabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  beforeEach(() => {
    ipcAuthGuard.resetForTest();
    mockFromWebContents.mockReset();
    process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
    process.env.VITE_SUPABASE_ANON_KEY = 'anon-key';
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalSupabaseUrl === undefined) {
      delete process.env.VITE_SUPABASE_URL;
    } else {
      process.env.VITE_SUPABASE_URL = originalSupabaseUrl;
    }
    if (originalSupabaseAnonKey === undefined) {
      delete process.env.VITE_SUPABASE_ANON_KEY;
    } else {
      process.env.VITE_SUPABASE_ANON_KEY = originalSupabaseAnonKey;
    }
  });

  it('starts in unauthenticated state', () => {
    expect(ipcAuthGuard.isAuthenticated()).toBe(false);
  });

  it('requireAuth throws when not authenticated', () => {
    const sender = createMockSender(1);
    ipcAuthGuard.setMainWindow({ id: 1 } as any);

    expect(() => ipcAuthGuard.requireAuth(sender)).toThrow('IPC_AUTH_DENIED: not authenticated');
  });

  it('requireAuth passes when authenticated and trusted sender', () => {
    const sender = createMockSender(1);
    ipcAuthGuard.setMainWindow({ id: 1 } as any);
    ipcAuthGuard.setAuthenticated(true);

    expect(() => ipcAuthGuard.requireAuth(sender)).not.toThrow();
  });

  it('requireAuth throws for untrusted sender (wrong window)', () => {
    const sender = createMockSender(999); // Different window ID
    ipcAuthGuard.setMainWindow({ id: 1 } as any);
    ipcAuthGuard.setAuthenticated(true);

    expect(() => ipcAuthGuard.requireAuth(sender)).toThrow('IPC_AUTH_DENIED: untrusted sender');
  });

  it('requireAuth throws for null sender (no window)', () => {
    const sender = createMockSender(undefined); // No window found
    ipcAuthGuard.setMainWindow({ id: 1 } as any);
    ipcAuthGuard.setAuthenticated(true);

    expect(() => ipcAuthGuard.requireAuth(sender)).toThrow('IPC_AUTH_DENIED: untrusted sender');
  });

  it('requireAuth includes channel name in error message', () => {
    const sender = createMockSender(1);
    ipcAuthGuard.setMainWindow({ id: 1 } as any);

    expect(() => ipcAuthGuard.requireAuth(sender, 'fs:deleteFolder'))
      .toThrow('IPC_AUTH_DENIED: not authenticated for fs:deleteFolder');
  });

  it('pre-auth channels are correctly identified', () => {
    expect(ipcAuthGuard.isPreAuthChannel('biometric:isAvailable')).toBe(true);
    expect(ipcAuthGuard.isPreAuthChannel('biometric:prompt')).toBe(true);
    expect(ipcAuthGuard.isPreAuthChannel('session:getCredentials')).toBe(true);
    expect(ipcAuthGuard.isPreAuthChannel('session:getCredentialsWithBiometric')).toBe(true);
    expect(ipcAuthGuard.isPreAuthChannel('session:getCredentialsWithPin')).toBe(true);
    expect(ipcAuthGuard.isPreAuthChannel('session:isBiometricEnabled')).toBe(true);
    expect(ipcAuthGuard.isPreAuthChannel('session:isPinEnabled')).toBe(true);
    expect(ipcAuthGuard.isPreAuthChannel('session:clearCredentials')).toBe(true);
    expect(ipcAuthGuard.isPreAuthChannel('app:getVersion')).toBe(true);
    expect(ipcAuthGuard.isPreAuthChannel('dialog:showMessage')).toBe(true);
    expect(ipcAuthGuard.isPreAuthChannel('auth:setAuthenticated')).toBe(true);
  });

  it('protected channels are NOT pre-auth', () => {
    expect(ipcAuthGuard.isPreAuthChannel('fs:readFile')).toBe(false);
    expect(ipcAuthGuard.isPreAuthChannel('fs:writeFile')).toBe(false);
    expect(ipcAuthGuard.isPreAuthChannel('fs:deleteFolder')).toBe(false);
    expect(ipcAuthGuard.isPreAuthChannel('session:saveCredentials')).toBe(false);
    expect(ipcAuthGuard.isPreAuthChannel('session:setBiometricEnabled')).toBe(false);
    expect(ipcAuthGuard.isPreAuthChannel('session:setPin')).toBe(false);
    expect(ipcAuthGuard.isPreAuthChannel('session:clearPin')).toBe(false);
    expect(ipcAuthGuard.isPreAuthChannel('storage:get')).toBe(false);
    expect(ipcAuthGuard.isPreAuthChannel('storage:set')).toBe(false);
    expect(ipcAuthGuard.isPreAuthChannel('python:runTool')).toBe(false);
    expect(ipcAuthGuard.isPreAuthChannel('shell:openExternal')).toBe(false);
    expect(ipcAuthGuard.isPreAuthChannel('oauth:googleLogin')).toBe(false);
    expect(ipcAuthGuard.isPreAuthChannel('net:request')).toBe(false);
    expect(ipcAuthGuard.isPreAuthChannel('backup:save')).toBe(false);
    expect(ipcAuthGuard.isPreAuthChannel('mcp:setAuthToken')).toBe(false);
    expect(ipcAuthGuard.isPreAuthChannel('mcp:setCurrentProject')).toBe(false);
    expect(ipcAuthGuard.isPreAuthChannel('mcp:getStatus')).toBe(false);
  });

  it('setAuthenticated toggles state correctly', () => {
    expect(ipcAuthGuard.isAuthenticated()).toBe(false);

    ipcAuthGuard.setAuthenticated(true);
    expect(ipcAuthGuard.isAuthenticated()).toBe(true);

    ipcAuthGuard.setAuthenticated(false);
    expect(ipcAuthGuard.isAuthenticated()).toBe(false);
  });

  it('renderer nemuze nastavit auth pouze boolean true bez overitelne session', async () => {
    const sender = createMockSender(1);
    ipcAuthGuard.setMainWindow({ id: 1 } as any);
    vi.mocked(sender.executeJavaScript).mockResolvedValue(null);

    await expect(ipcAuthGuard.setAuthenticatedFromRenderer(sender, true))
      .rejects.toThrow('IPC_AUTH_DENIED: missing verifiable renderer session');

    expect(ipcAuthGuard.isAuthenticated()).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('renderer auth true projde pouze s mainem overenou Supabase session', async () => {
    const sender = createMockSender(1);
    ipcAuthGuard.setMainWindow({ id: 1 } as any);
    vi.mocked(sender.executeJavaScript).mockResolvedValue({
      accessToken: 'valid-token',
      expiresAt: Math.floor(Date.now() / 1000) + 60,
    });
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);

    await ipcAuthGuard.setAuthenticatedFromRenderer(sender, true);

    expect(ipcAuthGuard.isAuthenticated()).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith('https://example.supabase.co/auth/v1/user', {
      headers: {
        apikey: 'anon-key',
        authorization: 'Bearer valid-token',
      },
    });
  });

  it('renderer auth true umi overit session predanou primo z auth eventu', async () => {
    const sender = createMockSender(1);
    ipcAuthGuard.setMainWindow({ id: 1 } as any);
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);

    await ipcAuthGuard.setAuthenticatedFromRenderer(sender, true, {
      accessToken: 'event-token',
      expiresAt: Math.floor(Date.now() / 1000) + 60,
    });

    expect(ipcAuthGuard.isAuthenticated()).toBe(true);
    expect(sender.executeJavaScript).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith('https://example.supabase.co/auth/v1/user', {
      headers: {
        apikey: 'anon-key',
        authorization: 'Bearer event-token',
      },
    });
  });

  it('renderer session verifier hleda app storage key i sessionStorage', async () => {
    const sender = createMockSender(1);
    ipcAuthGuard.setMainWindow({ id: 1 } as any);
    vi.mocked(sender.executeJavaScript).mockImplementation(async (script: string) => {
      expect(script).toContain('crm-auth-token');
      expect(script).toContain('sessionStorage');
      expect(script).toContain('value.data && value.data.session');
      return {
        accessToken: 'valid-token',
        expiresAt: Math.floor(Date.now() / 1000) + 60,
      };
    });
    vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);

    await ipcAuthGuard.setAuthenticatedFromRenderer(sender, true);

    expect(ipcAuthGuard.isAuthenticated()).toBe(true);
  });

  it('renderer auth true odmitne expirovanou session pred citlivym IPC odemcenim', async () => {
    const sender = createMockSender(1);
    ipcAuthGuard.setMainWindow({ id: 1 } as any);
    vi.mocked(sender.executeJavaScript).mockResolvedValue({
      accessToken: 'expired-token',
      expiresAt: Math.floor(Date.now() / 1000) - 1,
    });

    await expect(ipcAuthGuard.setAuthenticatedFromRenderer(sender, true))
      .rejects.toThrow('IPC_AUTH_DENIED: renderer session expired');

    expect(ipcAuthGuard.isAuthenticated()).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('isTrustedSender validates against main window', () => {
    ipcAuthGuard.setMainWindow({ id: 42 } as any);

    const trustedSender = createMockSender(42);
    expect(ipcAuthGuard.isTrustedSender(trustedSender)).toBe(true);

    const untrustedSender = createMockSender(99);
    expect(ipcAuthGuard.isTrustedSender(untrustedSender)).toBe(false);

    const noWindowSender = createMockSender(undefined);
    expect(ipcAuthGuard.isTrustedSender(noWindowSender)).toBe(false);
  });
});
