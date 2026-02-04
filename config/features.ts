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
  MODULE_CONTRACTS: 'module_contracts',
  MODULE_INVOICING: 'module_invoicing', // Planned
  MODULE_DOCUMENTS: 'module_documents', // Planned

  
  // Advanced Features
  FEATURE_AI_INSIGHTS: 'feature_ai_insights',
  FEATURE_ADVANCED_REPORTING: 'feature_advanced_reporting',
  FEATURE_TEAM_COLLABORATION: 'feature_team_collaboration',
  FEATURE_API_ACCESS: 'feature_api_access',

  // Subscription-gated Tools (keys match subscription_features.key in Supabase)
  CONTACTS_IMPORT: 'contacts_import',
  EXCEL_UNLOCKER: 'excel_unlocker',
  EXCEL_MERGER: 'excel_merger',
  PROJECT_SCHEDULE: 'project_schedule',
  EXPORT_PDF: 'export_pdf',
  EXPORT_EXCEL: 'export_excel',
  DOC_HUB: 'doc_hub',
  AI_INSIGHTS: 'ai_insights',
  URL_SHORTENER: 'url_shortener',
  EXCEL_INDEXER: 'excel_indexer',
  DYNAMIC_TEMPLATES: 'dynamic_templates',
  DEMAND_GENERATION: 'demand_generation',
  LOSER_EMAIL: 'loser_email',
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
      FEATURES.URL_SHORTENER,
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
      FEATURES.CONTACTS_IMPORT,
      FEATURES.EXCEL_UNLOCKER,
      FEATURES.EXCEL_MERGER,
      FEATURES.PROJECT_SCHEDULE,
      FEATURES.EXPORT_PDF,
      FEATURES.EXPORT_EXCEL,
      FEATURES.AI_INSIGHTS,
      FEATURES.URL_SHORTENER,
      FEATURES.EXCEL_INDEXER,
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
