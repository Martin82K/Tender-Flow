import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Electron modules
const mockStorageData = new Map<string, string>();
const mockBiometricPrompt = vi.fn();

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  BrowserWindow: {
    fromWebContents: vi.fn(() => ({
      getNativeWindowHandle: vi.fn(() => Buffer.alloc(0)),
    })),
  },
}));

vi.mock('../desktop/main/services/biometricAuth', () => ({
  getBiometricAuthService: () => ({
    isAvailable: vi.fn().mockResolvedValue(true),
    prompt: mockBiometricPrompt,
  }),
}));

// Import after mocks
import { ipcMain } from 'electron';

const handlers = new Map<string, (...args: any[]) => any>();
vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: any) => {
  handlers.set(channel, handler);
  return undefined as any;
});

// Create a mock storage service
const mockStorageService = {
  get: vi.fn(async (key: string) => mockStorageData.get(key) ?? null),
  set: vi.fn(async (key: string, value: string) => { mockStorageData.set(key, value); }),
  delete: vi.fn(async (key: string) => { mockStorageData.delete(key); }),
};

const mockRequireAuth = vi.fn();

describe('Biometric bypass prevention', () => {
  beforeEach(async () => {
    handlers.clear();
    mockStorageData.clear();
    mockBiometricPrompt.mockReset();
    mockRequireAuth.mockReset();
    vi.mocked(ipcMain.handle).mockClear();

    // Register session handlers fresh
    const { registerSessionHandlers } = await import(
      '../desktop/main/ipc/modules/sessionHandlers'
    );
    registerSessionHandlers({
      storageService: mockStorageService as any,
      requireAuth: mockRequireAuth,
    });
  });

  it('getCredentials returns null when biometric is enabled (prevents bypass)', async () => {
    // Setup: biometric enabled + credentials stored
    mockStorageData.set('biometric_enabled', 'true');
    mockStorageData.set(
      'session_credentials',
      JSON.stringify({ refreshToken: 'secret-token-12345', email: 'user@test.com' }),
    );

    const handler = handlers.get('session:getCredentials');
    expect(handler).toBeDefined();

    // An attacker calls getCredentials directly — should get null
    const result = await handler!({} as any);
    expect(result).toBeNull();
  });

  it('getCredentials returns credentials when biometric is NOT enabled', async () => {
    // Setup: biometric disabled + credentials stored
    mockStorageData.set('biometric_enabled', 'false');
    mockStorageData.set(
      'session_credentials',
      JSON.stringify({ refreshToken: 'secret-token-12345', email: 'user@test.com' }),
    );

    const handler = handlers.get('session:getCredentials');
    const result = await handler!({} as any);
    expect(result).toEqual({ refreshToken: 'secret-token-12345', email: 'user@test.com' });
  });

  it('getCredentialsWithBiometric requires biometric verification before returning credentials', async () => {
    // Setup: biometric enabled + credentials stored
    mockStorageData.set('biometric_enabled', 'true');
    mockStorageData.set(
      'session_credentials',
      JSON.stringify({ refreshToken: 'secret-token-12345', email: 'user@test.com' }),
    );

    // Biometric succeeds
    mockBiometricPrompt.mockResolvedValue(true);

    const handler = handlers.get('session:getCredentialsWithBiometric');
    expect(handler).toBeDefined();

    const mockEvent = { sender: {} } as any;
    const result = await handler!(mockEvent, 'Test reason');
    expect(result).toEqual({ refreshToken: 'secret-token-12345', email: 'user@test.com' });
    expect(mockBiometricPrompt).toHaveBeenCalledTimes(1);
  });

  it('getCredentialsWithBiometric returns null when biometric fails', async () => {
    // Setup: biometric enabled + credentials stored
    mockStorageData.set('biometric_enabled', 'true');
    mockStorageData.set(
      'session_credentials',
      JSON.stringify({ refreshToken: 'secret-token-12345', email: 'user@test.com' }),
    );

    // Biometric fails/cancelled
    mockBiometricPrompt.mockResolvedValue(false);

    const handler = handlers.get('session:getCredentialsWithBiometric');
    const mockEvent = { sender: {} } as any;
    const result = await handler!(mockEvent, 'Test reason');
    expect(result).toBeNull();
    expect(mockBiometricPrompt).toHaveBeenCalledTimes(1);
  });

  it('getCredentialsWithBiometric skips biometric when biometric is not enabled', async () => {
    // Setup: biometric NOT enabled + credentials stored
    mockStorageData.set('biometric_enabled', 'false');
    mockStorageData.set(
      'session_credentials',
      JSON.stringify({ refreshToken: 'secret-token-12345', email: 'user@test.com' }),
    );

    const handler = handlers.get('session:getCredentialsWithBiometric');
    const mockEvent = { sender: {} } as any;
    const result = await handler!(mockEvent, 'Test reason');
    expect(result).toEqual({ refreshToken: 'secret-token-12345', email: 'user@test.com' });
    // Biometric should NOT have been called
    expect(mockBiometricPrompt).not.toHaveBeenCalled();
  });

  it('saveCredentials requires authentication', async () => {
    mockRequireAuth.mockImplementation(() => {
      throw new Error('IPC_AUTH_DENIED: not authenticated');
    });

    const handler = handlers.get('session:saveCredentials');
    const mockEvent = { sender: {} } as any;

    await expect(
      handler!(mockEvent, { refreshToken: 'malicious-token', email: 'attacker@evil.com' }),
    ).rejects.toThrow('IPC_AUTH_DENIED');
  });

  it('clearCredentials requires authentication', async () => {
    mockRequireAuth.mockImplementation(() => {
      throw new Error('IPC_AUTH_DENIED: not authenticated');
    });

    const handler = handlers.get('session:clearCredentials');
    const mockEvent = { sender: {} } as any;

    await expect(handler!(mockEvent)).rejects.toThrow('IPC_AUTH_DENIED');
  });
});
