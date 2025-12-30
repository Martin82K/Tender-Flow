import React, { createContext, useContext, useState, useEffect } from 'react';
import { FEATURES, PLANS, FeatureKey, PlanKey } from '../config/features';
import { useAuth } from './AuthContext';

interface FeatureContextType {
  enabledFeatures: FeatureKey[];
  currentPlan: string;
  hasFeature: (feature: FeatureKey) => boolean;
  setPlan: (plan: PlanKey) => void; // For dev toggling
  isLoading: boolean;
}

const FeatureContext = createContext<FeatureContextType | undefined>(undefined);

export const FeatureProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  
  // Default to PRO plan for now to keep everything working for existing users
  // In a real verification step, we would fetch the plan from Supabase (user_subscriptions table)
  const [currentPlanId, setCurrentPlanId] = useState<PlanKey>('PRO'); 
  const [enabledFeatures, setEnabledFeatures] = useState<FeatureKey[]>([...PLANS.PRO.features]);
  const [isLoading, setIsLoading] = useState(false);

  // Effect to update features when plan changes
  useEffect(() => {
    // Logic to simulate fetching plan from backend based on user
    // For now, we trust the local state or default
    const plan = PLANS[currentPlanId] || PLANS.FREE;
    setEnabledFeatures([...plan.features]);
  }, [currentPlanId]);

  // Expose a helper to check features efficiently
  const hasFeature = (feature: FeatureKey): boolean => {
    return enabledFeatures.includes(feature);
  };
  
  // Helper for development/demo purposes to switch plans
  const setPlan = (planKey: PlanKey) => {
    if (PLANS[planKey]) {
      setCurrentPlanId(planKey);
      console.log(`[FeatureContext] Switched to plan: ${planKey}`);
    }
  };

  return (
    <FeatureContext.Provider value={{ enabledFeatures, currentPlan: currentPlanId, hasFeature, setPlan, isLoading }}>
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
