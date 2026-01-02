-- Migration: Subscription feature matrix (plans -> features)
-- Purpose: Let admins manage which subscription tier includes which features
-- Date: 2026-01-02

-- 1) Feature definitions
CREATE TABLE IF NOT EXISTS public.subscription_features (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2) Tier -> feature flags
CREATE TABLE IF NOT EXISTS public.subscription_tier_features (
  tier VARCHAR(50) NOT NULL CHECK (tier IN ('free', 'pro', 'enterprise', 'admin')),
  feature_key TEXT NOT NULL REFERENCES public.subscription_features(key) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (tier, feature_key)
);

-- 3) RLS
ALTER TABLE public.subscription_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_tier_features ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read (for gating / UI)
DROP POLICY IF EXISTS "subscription_features_select" ON public.subscription_features;
CREATE POLICY "subscription_features_select" ON public.subscription_features
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "subscription_tier_features_select" ON public.subscription_tier_features;
CREATE POLICY "subscription_tier_features_select" ON public.subscription_tier_features
  FOR SELECT TO authenticated
  USING (true);

-- Admin-only management
DROP POLICY IF EXISTS "subscription_features_admin_insert" ON public.subscription_features;
CREATE POLICY "subscription_features_admin_insert" ON public.subscription_features
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "subscription_features_admin_update" ON public.subscription_features;
CREATE POLICY "subscription_features_admin_update" ON public.subscription_features
  FOR UPDATE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "subscription_features_admin_delete" ON public.subscription_features;
CREATE POLICY "subscription_features_admin_delete" ON public.subscription_features
  FOR DELETE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "subscription_tier_features_admin_insert" ON public.subscription_tier_features;
CREATE POLICY "subscription_tier_features_admin_insert" ON public.subscription_tier_features
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "subscription_tier_features_admin_update" ON public.subscription_tier_features;
CREATE POLICY "subscription_tier_features_admin_update" ON public.subscription_tier_features
  FOR UPDATE TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "subscription_tier_features_admin_delete" ON public.subscription_tier_features;
CREATE POLICY "subscription_tier_features_admin_delete" ON public.subscription_tier_features
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- 4) Grants
GRANT SELECT ON public.subscription_features TO authenticated;
GRANT SELECT ON public.subscription_tier_features TO authenticated;
GRANT ALL ON public.subscription_features TO service_role;
GRANT ALL ON public.subscription_tier_features TO service_role;

-- 5) Seed defaults (safe to edit/delete in UI)
INSERT INTO public.subscription_features (key, name, description, category, sort_order)
VALUES
  ('contacts', 'Kontakty', 'Správa kontaktů a jejich statusů', 'Základ', 10),
  ('contacts_import', 'Import kontaktů', 'Import kontaktů z XLSX/CSV', 'Kontakty', 20),
  ('export_pdf', 'Export do PDF', 'Export přehledů/projektu do PDF', 'Export', 30),
  ('export_excel', 'Export do Excelu', 'Export dat do XLSX/CSV', 'Export', 40),
  ('ai_insights', 'AI Insights', 'AI analýza (Dashboard)', 'AI', 50),
  ('doc_hub', 'DocHub', 'Správa projektové dokumentace (Drive/OneDrive)', 'Dokumenty', 60)
ON CONFLICT (key) DO NOTHING;

-- Free
INSERT INTO public.subscription_tier_features (tier, feature_key, enabled)
VALUES
  ('free', 'contacts', true),
  ('free', 'contacts_import', false),
  ('free', 'export_pdf', false),
  ('free', 'export_excel', false),
  ('free', 'ai_insights', false),
  ('free', 'doc_hub', false)
ON CONFLICT (tier, feature_key) DO NOTHING;

-- Pro
INSERT INTO public.subscription_tier_features (tier, feature_key, enabled)
VALUES
  ('pro', 'contacts', true),
  ('pro', 'contacts_import', true),
  ('pro', 'export_pdf', true),
  ('pro', 'export_excel', true),
  ('pro', 'ai_insights', true),
  ('pro', 'doc_hub', false)
ON CONFLICT (tier, feature_key) DO NOTHING;

-- Enterprise
INSERT INTO public.subscription_tier_features (tier, feature_key, enabled)
VALUES
  ('enterprise', 'contacts', true),
  ('enterprise', 'contacts_import', true),
  ('enterprise', 'export_pdf', true),
  ('enterprise', 'export_excel', true),
  ('enterprise', 'ai_insights', true),
  ('enterprise', 'doc_hub', true)
ON CONFLICT (tier, feature_key) DO NOTHING;

-- Admin (internal) – default everything enabled
INSERT INTO public.subscription_tier_features (tier, feature_key, enabled)
SELECT 'admin' AS tier, f.key AS feature_key, true AS enabled
FROM public.subscription_features f
ON CONFLICT (tier, feature_key) DO NOTHING;

