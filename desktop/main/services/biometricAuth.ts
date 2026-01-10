import { systemPreferences } from 'electron';

/**
 * Biometric Authentication Service
 * Provides Touch ID / Face ID authentication for macOS
 */
export class BiometricAuthService {
    /**
     * Check if biometric authentication is available on this device
     * Works on macOS with Touch ID or Face ID
     */
    async isAvailable(): Promise<boolean> {
        if (process.platform !== 'darwin') {
            // Windows Hello support would require different implementation
            return false;
        }

        try {
            return systemPreferences.canPromptTouchID();
        } catch (error) {
            console.error('[BiometricAuth] Error checking availability:', error);
            return false;
        }
    }

    /**
     * Prompt user for biometric authentication
     * @param reason - Reason displayed to user (e.g., "unlock Tender Flow")
     * @returns true if authentication successful, false otherwise
     */
    async prompt(reason: string): Promise<boolean> {
        if (process.platform !== 'darwin') {
            return false;
        }

        try {
            await systemPreferences.promptTouchID(reason);
            return true;
        } catch (error) {
            // User cancelled or authentication failed
            console.log('[BiometricAuth] Authentication failed or cancelled:', error);
            return false;
        }
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
