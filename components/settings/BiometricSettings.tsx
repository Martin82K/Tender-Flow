import React, { useState, useEffect } from 'react';
import { isDesktop, platformAdapter } from '../../services/platformAdapter';
import { Shield, Fingerprint, AlertCircle } from 'lucide-react';

interface BiometricSettingsProps {
    className?: string;
}

/**
 * Biometric Authentication Settings Component
 * Allows users to enable/disable Touch ID / Face ID unlock
 */
export function BiometricSettings({ className = '' }: BiometricSettingsProps) {
    const [isAvailable, setIsAvailable] = useState(false);
    const [isEnabled, setIsEnabled] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null);

    useEffect(() => {
        const init = async () => {
            if (!isDesktop) {
                setIsLoading(false);
                return;
            }

            const available = await platformAdapter.biometric.isAvailable();
            setIsAvailable(available);

            if (available) {
                const enabled = await platformAdapter.session.isBiometricEnabled();
                setIsEnabled(enabled);
            }

            setIsLoading(false);
        };

        init();
    }, []);

    const handleToggle = async () => {
        if (!isAvailable) return;

        const newValue = !isEnabled;

        // If enabling, test biometric first
        if (newValue) {
            const success = await platformAdapter.biometric.prompt('Potvrďte svou identitu pro aktivaci biometrického přihlášení');
            if (!success) {
                setTestResult('failed');
                setTimeout(() => setTestResult(null), 3000);
                return;
            }
        }

        await platformAdapter.session.setBiometricEnabled(newValue);
        setIsEnabled(newValue);
        setTestResult(newValue ? 'success' : null);
        setTimeout(() => setTestResult(null), 3000);
    };

    const handleTest = async () => {
        const success = await platformAdapter.biometric.prompt('Testování biometrického ověření');
        setTestResult(success ? 'success' : 'failed');
        setTimeout(() => setTestResult(null), 3000);
    };

    // Don't show on web
    if (!isDesktop) {
        return null;
    }

    if (isLoading) {
        return (
            <div className={`p-4 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse ${className}`}>
                <div className="h-6 w-48 bg-slate-200 dark:bg-slate-700 rounded"></div>
            </div>
        );
    }

    return (
        <div className={`p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 ${className}`}>
            <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <Fingerprint className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>

                <div className="flex-1">
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                        Biometrické přihlášení
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Použijte Touch ID nebo Face ID pro rychlé odemknutí aplikace.
                    </p>

                    {!isAvailable ? (
                        <div className="flex items-center gap-2 mt-3 text-amber-600 dark:text-amber-400">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-sm">
                                Biometrické ověření není na tomto zařízení dostupné.
                            </span>
                        </div>
                    ) : (
                        <div className="mt-4 space-y-3">
                            {/* Toggle */}
                            <label className="flex items-center gap-3 cursor-pointer">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        checked={isEnabled}
                                        onChange={handleToggle}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-200 dark:bg-slate-600 rounded-full peer peer-checked:bg-blue-500 transition-colors"></div>
                                    <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
                                </div>
                                <span className="text-sm text-slate-700 dark:text-slate-300">
                                    {isEnabled ? 'Zapnuto' : 'Vypnuto'}
                                </span>
                            </label>

                            {/* Test button */}
                            {isEnabled && (
                                <button
                                    onClick={handleTest}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                >
                                    <Shield className="w-4 h-4" />
                                    Otestovat
                                </button>
                            )}

                            {/* Result message */}
                            {testResult && (
                                <div className={`text-sm p-2 rounded-lg ${testResult === 'success'
                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                    }`}>
                                    {testResult === 'success' ? 'Ověření úspěšné!' : 'Ověření selhalo.'}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default BiometricSettings;
