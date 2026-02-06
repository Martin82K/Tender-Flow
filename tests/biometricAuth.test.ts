/** @vitest-environment node */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type MockedPreferences = {
    canPromptTouchID: ReturnType<typeof vi.fn>;
    promptTouchID: ReturnType<typeof vi.fn>;
};

const mockIsHelloAvailable = vi.fn();
const mockRequestHello = vi.fn();

vi.mock('win-hello', () => ({
    default: () => ({
        isHelloAvailable: mockIsHelloAvailable,
        requestHello: mockRequestHello,
    }),
}));

const mockedPreferences: MockedPreferences = {
    canPromptTouchID: vi.fn(),
    promptTouchID: vi.fn(),
};

vi.mock('electron', () => ({
    systemPreferences: mockedPreferences,
}));

const setPlatform = (value: NodeJS.Platform) => {
    Object.defineProperty(process, 'platform', { value, configurable: true });
};

describe('BiometricAuthService', () => {
    const originalPlatform = process.platform;

    beforeEach(() => {
        mockIsHelloAvailable.mockReset();
        mockRequestHello.mockReset();
        mockedPreferences.canPromptTouchID.mockReset();
        mockedPreferences.promptTouchID.mockReset();
    });

    afterEach(() => {
        setPlatform(originalPlatform);
    });

    it('uses Touch ID on macOS', async () => {
        setPlatform('darwin');
        mockedPreferences.canPromptTouchID.mockReturnValue(true);
        mockedPreferences.promptTouchID.mockResolvedValue(undefined);

        const { getBiometricAuthService } = await import('../desktop/main/services/biometricAuth');
        const available = await getBiometricAuthService().isAvailable();
        const success = await getBiometricAuthService().prompt('Test Touch ID');

        expect(available).toBe(true);
        expect(success).toBe(true);
        expect(mockedPreferences.canPromptTouchID).toHaveBeenCalled();
        expect(mockedPreferences.promptTouchID).toHaveBeenCalledWith('Test Touch ID');
    });

    it('uses Windows Hello with native handle', async () => {
        setPlatform('win32');
        mockIsHelloAvailable.mockResolvedValue(true);
        mockRequestHello.mockResolvedValue('ok');

        const { getBiometricAuthService } = await import('../desktop/main/services/biometricAuth');
        const available = await getBiometricAuthService().isAvailable();
        const handle = Buffer.from('handle');
        const success = await getBiometricAuthService().prompt('Unlock', handle);

        expect(available).toBe(true);
        expect(success).toBe(true);
        expect(mockIsHelloAvailable).toHaveBeenCalled();
        expect(mockRequestHello).toHaveBeenCalledWith('Unlock', handle);
    });

    it('returns false when Windows Hello fails', async () => {
        setPlatform('win32');
        mockRequestHello.mockRejectedValue(new Error('fail'));

        const { getBiometricAuthService } = await import('../desktop/main/services/biometricAuth');
        const success = await getBiometricAuthService().prompt('Unlock');

        expect(success).toBe(false);
        expect(mockRequestHello).toHaveBeenCalledWith('Unlock');
    });
});
