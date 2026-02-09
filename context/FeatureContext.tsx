import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { FeatureKey, PLANS } from '../config/features';
import { useAuth } from './AuthContext';
import { subscriptionFeaturesService } from '../services/subscriptionFeaturesService';

// Periodic refresh interval for subscription tier validation
const SUBSCRIPTION_REFRESH_INTERVAL = 1000 * 60 * 30; // 30 minutes

interface FeatureContextType {
  enabledFeatures: FeatureKey[];
  currentPlan: string;
  hasFeature: (feature: FeatureKey) => boolean;
  isLoading: boolean;
  refetchFeatures: () => Promise<void>;
}

const FeatureContext = createContext<FeatureContextType | undefined>(undefined);

export const FeatureProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();

  const [currentPlan, setCurrentPlan] = useState<string>('free');
  const [enabledFeatures, setEnabledFeatures] = useState<FeatureKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const lastRefreshRef = useRef<number>(0);

  // Fetch features from backend
  const fetchFeatures = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setEnabledFeatures([]);
      setCurrentPlan('free');
      setIsLoading(false);
      return;
    }

    // Demo mode has no Supabase auth session, so backend RPC feature checks will fail.
    // Use a local "demo plan" feature set (acts like a subscription tier for demo).
    if (user.role === 'demo') {
      setIsLoading(false);
      setEnabledFeatures([...PLANS.FREE.features] as FeatureKey[]);
      setCurrentPlan('demo');
      return;
    }

    setIsLoading(true);
    try {
      // Fetch enabled features from backend RPC (cannot be bypassed)
      const [features, tier] = await Promise.all([
        subscriptionFeaturesService.getUserEnabledFeatures(),
        subscriptionFeaturesService.getUserSubscriptionTier(),
      ]);

      // Map feature keys to FeatureKey type
      const featureKeys = features.map(f => f.key as FeatureKey);
      setEnabledFeatures(featureKeys);
      setCurrentPlan(tier);

      console.log(`[FeatureContext] Loaded ${featureKeys.length} features for tier: ${tier}`);
      lastRefreshRef.current = Date.now();
    } catch (error) {
      console.error('[FeatureContext] Failed to load features from backend:', error);
      // On error, keep current plan instead of reverting to free
      // This prevents transient network errors from downgrading users
      console.warn('[FeatureContext] Keeping current plan due to error:', currentPlan);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user, currentPlan]);

  // Fetch features when auth state changes
  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  // Periodic refresh to keep subscription tier validated against database
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    // Skip for demo mode
    if (user.role === 'demo') return;

    const interval = setInterval(() => {
      const timeSinceLastRefresh = Date.now() - lastRefreshRef.current;
      if (timeSinceLastRefresh >= SUBSCRIPTION_REFRESH_INTERVAL) {
        console.log('[FeatureContext] Periodic subscription tier refresh');
        fetchFeatures();
      }
    }, SUBSCRIPTION_REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [isAuthenticated, user, fetchFeatures]);

  // Check if user has a specific feature (checks against backend-loaded list)
  const hasFeature = useCallback((feature: FeatureKey): boolean => {
    // Admin tier always has access to everything
    if (currentPlan === 'admin') return true;
    return enabledFeatures.includes(feature);
  }, [enabledFeatures, currentPlan]);

  return (
    <FeatureContext.Provider value={{
      enabledFeatures,
      currentPlan,
      hasFeature,
      isLoading,
      refetchFeatures: fetchFeatures
    }}>
      {children}
    </FeatureContext.Provider>
  );
};

export const useFeatures = () => {
  const context = useContext(FeatureContext);
  if (context === undefined) {
    throw new Error('useFeatures must be used within a FeatureProvider');
  }
  return context;
};
