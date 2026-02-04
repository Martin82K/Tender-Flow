import { systemPreferences } from 'electron';

type WinHelloApi = {
    isHelloAvailable: () => Promise<boolean>;
    requestHello: (message?: string, windowHandle?: Buffer) => Promise<string>;
};

let winHelloApi: WinHelloApi | null = null;

const getWinHelloApi = async (): Promise<WinHelloApi> => {
    if (!winHelloApi) {
        const { default: createWinHello } = await import('win-hello');
        winHelloApi = createWinHello();
    }
    if (!winHelloApi) {
        throw new Error('Windows Hello API unavailable');
    }
    return winHelloApi;
};

/**
 * Biometric Authentication Service
 * Provides Touch ID / Face ID authentication for macOS and Windows Hello on Windows
 */
export class BiometricAuthService {
    /**
     * Check if biometric authentication is available on this device
     * Works on macOS with Touch ID or Face ID, Windows Hello on Windows
     */
    async isAvailable(): Promise<boolean> {
        if (process.platform === 'darwin') {
            try {
                return systemPreferences.canPromptTouchID();
            } catch (error) {
                console.error('[BiometricAuth] Error checking macOS availability:', error);
                return false;
            }
        }

        if (process.platform === 'win32') {
            try {
                const api = await getWinHelloApi();
                return await api.isHelloAvailable();
            } catch (error) {
                console.error('[BiometricAuth] Error checking Windows Hello availability:', error);
                return false;
            }
        }

        return false;
    }

    /**
     * Prompt user for biometric authentication
     * @param reason - Reason displayed to user (e.g., "unlock Tender Flow")
     * @returns true if authentication successful, false otherwise
     */
     async prompt(reason: string): Promise<boolean> {
        if (process.platform === 'darwin') {
            try {
                await systemPreferences.promptTouchID(reason);
                return true;
            } catch (error) {
                // User cancelled or authentication failed
                console.log('[BiometricAuth] macOS authentication failed or cancelled:', error);
                return false;
            }
        }

        if (process.platform === 'win32') {
            try {
                const api = await getWinHelloApi();
                await api.requestHello(reason);
                return true;
            } catch (error) {
                // User cancelled or authentication failed
                console.log('[BiometricAuth] Windows Hello authentication failed or cancelled:', error);
                return false;
            }
        }

        return false;
    }
}

// Singleton instance
let biometricService: BiometricAuthService | null = null;

export function getBiometricAuthService(): BiometricAuthService {
    if (!biometricService) {
        biometricService = new BiometricAuthService();
    }
    return biometricService;
}
