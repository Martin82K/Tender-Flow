import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Electron modules before importing the guard
vi.mock('electron', () => ({
  BrowserWindow: {
    fromWebContents: vi.fn(),
  },
}));

import { ipcAuthGuard } from '../desktop/main/services/ipcAuthGuard';
import { BrowserWindow } from 'electron';

const mockFromWebContents = vi.mocked(BrowserWindow.fromWebContents);

const createMockSender = (windowId?: number) => {
  const sender = {} as Electron.WebContents;
  if (windowId !== undefined) {
    mockFromWebContents.mockReturnValue({ id: windowId } as any);
  } else {
    mockFromWebContents.mockReturnValue(null);
  }
  return sender;
};

describe('IPC Auth Guard security', () => {
  beforeEach(() => {
    // Reset auth state
    ipcAuthGuard.setAuthenticated(false);
    mockFromWebContents.mockReset();
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
    expect(ipcAuthGuard.isPreAuthChannel('session:isBiometricEnabled')).toBe(true);
    expect(ipcAuthGuard.isPreAuthChannel('app:getVersion')).toBe(true);
    expect(ipcAuthGuard.isPreAuthChannel('dialog:showMessage')).toBe(true);
    expect(ipcAuthGuard.isPreAuthChannel('auth:setAuthenticated')).toBe(true);
  });

  it('protected channels are NOT pre-auth', () => {
    expect(ipcAuthGuard.isPreAuthChannel('fs:readFile')).toBe(false);
    expect(ipcAuthGuard.isPreAuthChannel('fs:writeFile')).toBe(false);
    expect(ipcAuthGuard.isPreAuthChannel('fs:deleteFolder')).toBe(false);
    expect(ipcAuthGuard.isPreAuthChannel('session:saveCredentials')).toBe(false);
    expect(ipcAuthGuard.isPreAuthChannel('session:clearCredentials')).toBe(false);
    expect(ipcAuthGuard.isPreAuthChannel('storage:get')).toBe(false);
    expect(ipcAuthGuard.isPreAuthChannel('storage:set')).toBe(false);
    expect(ipcAuthGuard.isPreAuthChannel('python:runTool')).toBe(false);
    expect(ipcAuthGuard.isPreAuthChannel('shell:openExternal')).toBe(false);
    expect(ipcAuthGuard.isPreAuthChannel('oauth:googleLogin')).toBe(false);
    expect(ipcAuthGuard.isPreAuthChannel('mcp:setAuthToken')).toBe(false);
    expect(ipcAuthGuard.isPreAuthChannel('net:request')).toBe(false);
    expect(ipcAuthGuard.isPreAuthChannel('backup:save')).toBe(false);
  });

  it('setAuthenticated toggles state correctly', () => {
    expect(ipcAuthGuard.isAuthenticated()).toBe(false);

    ipcAuthGuard.setAuthenticated(true);
    expect(ipcAuthGuard.isAuthenticated()).toBe(true);

    ipcAuthGuard.setAuthenticated(false);
    expect(ipcAuthGuard.isAuthenticated()).toBe(false);
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
