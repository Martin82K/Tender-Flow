import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { FeatureKey, PLANS } from '../config/features';
import { useAuth } from './AuthContext';
import {
  getCurrentTier,
  getEnabledFeatures,
  getEffectiveUserTier,
  getEnabledFeaturesV2,
} from '@/features/subscription/api';

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

// Persist v2 RPC availability across page navigations within the same browser
// session.  This avoids repeated red 400 POST errors in the console when the
// v2 Supabase RPCs have not been deployed yet.
const V2_STORAGE_KEY = 'tf_v2_rpcs_available';
let v2RpcsAvailable = (() => {
  try {
    return sessionStorage.getItem(V2_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
})();

export const FeatureProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [currentPlan, setCurrentPlan] = useState<string>('free');
  const [enabledFeatures, setEnabledFeatures] = useState<FeatureKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const lastRefreshRef = useRef<number>(0);

  // Fetch features from backend
  const fetchFeatures = useCallback(async () => {
    // While auth is still resolving (e.g. right after a desktop reload),
    // keep isLoading=true so gates that depend on currentPlan don't fire
    // with a stale 'free' value before the real tier is fetched.
    if (authLoading) {
      setIsLoading(true);
      return;
    }

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
      let features: { key: string; name: string; description: string | null; category: string | null }[];
      let tier: string;

      if (v2RpcsAvailable) {
        try {
          // Probe with a single call first to avoid two parallel 400 errors
          // if the v2 RPCs have not been deployed yet.
          const tierResult = await getEffectiveUserTier();
          const v2Features = await getEnabledFeaturesV2();
          features = v2Features;
          tier = tierResult.tier;
        } catch {
          // v2 RPCs not deployed — remember for the rest of this browser session
          v2RpcsAvailable = false;
          try { sessionStorage.setItem(V2_STORAGE_KEY, 'false'); } catch { /* SSR / sandbox */ }
          console.debug('[FeatureContext] v2 RPCs not available, using v1');
          const [v1Features, v1Tier] = await Promise.all([
            getEnabledFeatures(),
            getCurrentTier(),
          ]);
          features = v1Features;
          tier = v1Tier;
        }
      } else {
        const [v1Features, v1Tier] = await Promise.all([
          getEnabledFeatures(),
          getCurrentTier(),
        ]);
        features = v1Features;
        tier = v1Tier;
      }

      const featureKeys = features.map(f => f.key as FeatureKey);
      setEnabledFeatures(featureKeys);
      setCurrentPlan(tier);
      lastRefreshRef.current = Date.now();
    } catch (error) {
      console.error('[FeatureContext] Failed to load features from backend:', error);
      // Fail closed on backend errors to prevent stale or spoofed feature access.
      setEnabledFeatures([]);
      setCurrentPlan('free');
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, isAuthenticated, user]);

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
        console.debug('[FeatureContext] Periodic subscription tier refresh');
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
