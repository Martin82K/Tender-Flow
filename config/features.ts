/**
 * Feature Definitions
 * Defines all available feature flags in the application.
 */
export const FEATURES = {
  // Core Modules
  MODULE_DASHBOARD: 'module_dashboard',
  MODULE_PROJECTS: 'module_projects',
  MODULE_CONTACTS: 'module_contacts',
  MODULE_PIPELINE: 'module_pipeline',
  MODULE_INVOICING: 'module_invoicing', // Planned
  MODULE_DOCUMENTS: 'module_documents', // Planned
  
  // Advanced Features
  FEATURE_AI_INSIGHTS: 'feature_ai_insights',
  FEATURE_ADVANCED_REPORTING: 'feature_advanced_reporting',
  FEATURE_TEAM_COLLABORATION: 'feature_team_collaboration',
  FEATURE_API_ACCESS: 'feature_api_access',
} as const;

export type FeatureKey = typeof FEATURES[keyof typeof FEATURES];

/**
 * Subscription Plans
 * Defines sets of features available for different tiers.
 */
export const PLANS = {
  FREE: {
    id: 'free',
    label: 'Free',
    features: [
      FEATURES.MODULE_DASHBOARD,
      FEATURES.MODULE_PROJECTS, // Limited probably in real SaaS logic
      FEATURES.MODULE_CONTACTS,
    ]
  },
  PRO: {
    id: 'pro',
    label: 'Professional',
    features: [
      FEATURES.MODULE_DASHBOARD,
      FEATURES.MODULE_PROJECTS,
      FEATURES.MODULE_CONTACTS,
      FEATURES.MODULE_PIPELINE,
      FEATURES.FEATURE_AI_INSIGHTS,
      FEATURES.FEATURE_ADVANCED_REPORTING,
    ]
  },
  ENTERPRISE: {
    id: 'enterprise',
    label: 'Enterprise',
    features: Object.values(FEATURES)
  }
} as const;

export type PlanKey = keyof typeof PLANS;

/**
 * Helper to check if a feature is enabled given a list of enabled features
 */
export const isFeatureEnabled = (enabledFeatures: FeatureKey[], featureToCheck: FeatureKey): boolean => {
  return enabledFeatures.includes(featureToCheck);
};
