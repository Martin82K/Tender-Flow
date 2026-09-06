import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { FeatureKey, DEMO_FEATURES } from '../config/features';
import { useAuth } from './AuthContext';
import {
  getCurrentTier,
  getEnabledFeatures,
  getEffectiveUserTier,
  getEnabledFeaturesV2,
} from '@/features/subscription/api';

// Periodic refresh interval for subscription tier validation
const SUBSCRIPTION_REFRESH_INTERVAL = 1000 * 60; // Revalidate access while the application is open.

interface FeatureContextType {
  enabledFeatures: FeatureKey[];
  currentPlan: string;
  hasFeature: (feature: FeatureKey) => boolean;
  isLoading: boolean;
  refetchFeatures: () => Promise<void>;
  verificationError: boolean;
}

const FeatureContext = createContext<FeatureContextType | undefined>(undefined);

export const FeatureProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [verificationError, setVerificationError] = useState(false);
  const [validUntil, setValidUntil] = useState<number | null>(null);
  const requestVersion = useRef(0);
  const [currentPlan, setCurrentPlan] = useState<string>('free');
  const [enabledFeatures, setEnabledFeatures] = useState<FeatureKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Tracks which user the current enabledFeatures/currentPlan actually belong to.
  // Used to derive an "effective" isLoading that correctly reports true during
  // the render window between an auth transition and the first completed fetch
  // for the new user — otherwise consumers (e.g. desktop plan blocker) would see
  // stale state (`currentPlan='free'` left over from a prior logout cleanup).
  const [fetchedForUserId, setFetchedForUserId] = useState<string | null>(null);
  const lastRefreshRef = useRef<number>(0);
  const hasFetchedRef = useRef(false);
  const lastFetchedUserRef = useRef<string | null>(null);

  const userId = user?.id;
  const userRole = user?.role;

  // Fetch features from backend
  const fetchFeatures = useCallback(async () => {
    const version = ++requestVersion.current;
    // While auth is still resolving (e.g. right after a desktop reload),
    // keep isLoading=true so gates that depend on currentPlan don't fire
    // with a stale 'free' value before the real tier is fetched.
    if (authLoading) {
      setIsLoading(true);
      return;
    }

    if (!isAuthenticated || !userId) {
      setValidUntil(null);
      setVerificationError(false);
      setEnabledFeatures([]);
      setCurrentPlan('free');
      setIsLoading(false);
      hasFetchedRef.current = true;
      lastFetchedUserRef.current = null;
      setFetchedForUserId(null);
      return;
    }

    // Detect user switch — force a fresh loading gate and drop stale features
    // from the previous identity so RequireFeature cannot briefly render the
    // other user's entitlements.
    const isUserSwitch =
      lastFetchedUserRef.current !== null && lastFetchedUserRef.current !== userId;
    if (isUserSwitch) {
      setValidUntil(null);
      setVerificationError(false);
      setEnabledFeatures([]);
      setCurrentPlan('free');
    }

    // Demo mode has no Supabase auth session, so backend RPC feature checks will fail.
    // Use a local "demo plan" feature set (acts like a subscription tier for demo).
    if (userRole === 'demo') {
      setIsLoading(false);
      setEnabledFeatures([...DEMO_FEATURES] as FeatureKey[]);
      setCurrentPlan('demo');
      hasFetchedRef.current = true;
      lastFetchedUserRef.current = userId;
      setFetchedForUserId(userId);
      return;
    }

    // Only show the loading gate on the very first fetch or after a user switch.
    // Background refreshes for the same user keep the previous feature set so
    // RequireFeature doesn't flash through the "Ověřuji dostupnost funkce..."
    // placeholder on every preference save.
    if (!hasFetchedRef.current || isUserSwitch) {
      setIsLoading(true);
    }
    try {
      let features: { key: string; name: string; description: string | null; category: string | null }[];
      let tier: string;

      let deadline: number | null = null;
      try {
        const tierResult = await getEffectiveUserTier();
        features = await getEnabledFeaturesV2();
        tier = tierResult.tier;
        deadline = tierResult.validUntil ? Date.parse(tierResult.validUntil) : null;
        if (deadline !== null && !Number.isFinite(deadline)) throw new Error('Invalid subscription expiration');
      } catch (error) {
        // Only a missing RPC permits compatibility fallback. Authorization/network
        // failures must not retry through an older, less restrictive path.
        const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
        if (code !== 'PGRST202' && code !== '42883') throw error;
        [features, tier] = await Promise.all([getEnabledFeatures(), getCurrentTier()]);
      }
      if (version !== requestVersion.current) return;
      setVerificationError(false);
      // Even unlimited subscriptions need fresh server verification. A request
      // that never finishes must not keep stale access alive indefinitely.
      setValidUntil(Math.min(deadline ?? Infinity, Date.now() + 90_000));
      const featureKeys = features.map(f => f.key as FeatureKey);
      setEnabledFeatures(featureKeys);
      setCurrentPlan(tier);
      lastRefreshRef.current = Date.now();
    } catch (error) {
      if (version !== requestVersion.current) return;
      setVerificationError(true);
      setValidUntil(null);
      console.error('[FeatureContext] Failed to load features from backend:', error);
      // Fail closed on backend errors to prevent stale or spoofed feature access.
      setEnabledFeatures([]);
      setCurrentPlan('free');
    } finally {
      if (version !== requestVersion.current) return;
      setIsLoading(false);
      hasFetchedRef.current = true;
      lastFetchedUserRef.current = userId;
      setFetchedForUserId(userId);
    }
  }, [authLoading, isAuthenticated, userId, userRole]);

  // Fetch features when auth state changes
  useEffect(() => {
    void fetchFeatures();
    return () => { requestVersion.current += 1; };
  }, [fetchFeatures]);

  useEffect(() => {
    if (!isAuthenticated || userRole === 'demo' || validUntil === null) return;
    const timeout = window.setTimeout(() => {
      // Invalidate an in-flight response before clearing access at the deadline.
      requestVersion.current += 1;
      setEnabledFeatures([]);
      setCurrentPlan('free');
      setIsLoading(false);
      void fetchFeatures();
    }, Math.max(0, validUntil - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [validUntil, isAuthenticated, userRole, fetchFeatures]);

  // Periodic refresh to keep subscription tier validated against database
  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    // Skip for demo mode
    if (userRole === 'demo') return;

    const interval = setInterval(() => {
      const timeSinceLastRefresh = Date.now() - lastRefreshRef.current;
      if (timeSinceLastRefresh >= SUBSCRIPTION_REFRESH_INTERVAL) {
        console.debug('[FeatureContext] Periodic subscription tier refresh');
        fetchFeatures();
      }
    }, SUBSCRIPTION_REFRESH_INTERVAL);

    const onFocus = () => { void fetchFeatures(); };
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [isAuthenticated, userId, userRole, fetchFeatures]);

  // Check if user has a specific feature (checks against backend-loaded list)
  const hasFeature = useCallback((feature: FeatureKey): boolean => {
    if (!['starter', 'pro', 'enterprise', 'admin', 'demo'].includes(currentPlan)) return false;
    // Admin tier always has access to everything
    if (currentPlan === 'admin') return true;
    return enabledFeatures.includes(feature);
  }, [enabledFeatures, currentPlan]);

  // Derive the effective loading flag during render.  When the authenticated
  // user doesn't match the user the current feature set was fetched for, the
  // data is stale (e.g. leftover "free" plan from a prior logout cleanup) and
  // we must report isLoading=true until the fresh fetch completes.  Without
  // this gate the AppContent desktop plan blocker can fire with a stale plan
  // and redirect the user to the subscription page right after login.
  const isFeatureDataStale = isAuthenticated && !!userId && userId !== fetchedForUserId;
  const effectiveIsLoading = isLoading || isFeatureDataStale;

  return (
    <FeatureContext.Provider value={{
      enabledFeatures,
      verificationError,
      currentPlan,
      hasFeature,
      isLoading: effectiveIsLoading,
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
