import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { FeatureKey, PLANS } from '../config/features';
import { useAuth } from './AuthContext';
import { subscriptionFeaturesService } from '../services/subscriptionFeaturesService';

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

  // Fetch features from backend
  const fetchFeatures = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setEnabledFeatures([]);
      setCurrentPlan('free');
      setIsLoading(false);
      return;
    }

    // Demo mode has no Supabase auth session, so backend RPC feature checks will fail.
    // Provide a sane local feature set so core navigation is visible.
    if (user.role === 'demo') {
      setIsLoading(false);
      setEnabledFeatures(PLANS.PRO.features as FeatureKey[]);
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
    } catch (error) {
      console.error('[FeatureContext] Failed to load features from backend:', error);
      // Fallback: No features enabled on error (fail-secure)
      setEnabledFeatures([]);
      setCurrentPlan('free');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user]);

  // Fetch features when auth state changes
  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

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
