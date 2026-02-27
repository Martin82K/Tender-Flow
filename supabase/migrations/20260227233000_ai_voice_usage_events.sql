-- Migration: ai_voice_usage_events
-- Description: Usage/budget tracking for Viki voice (transcribe + speak)

CREATE TABLE IF NOT EXISTS public.ai_voice_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('transcribe', 'speak')),
  provider TEXT NOT NULL,
  duration_seconds INTEGER,
  char_count INTEGER,
  cost_mode TEXT NOT NULL DEFAULT 'economy' CHECK (cost_mode IN ('economy', 'balanced', 'premium')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_ai_voice_usage_events_org_created
  ON public.ai_voice_usage_events(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_voice_usage_events_user_created
  ON public.ai_voice_usage_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_voice_usage_events_type_created
  ON public.ai_voice_usage_events(event_type, created_at DESC);

ALTER TABLE public.ai_voice_usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_voice_usage_events_select_admin" ON public.ai_voice_usage_events;
CREATE POLICY "ai_voice_usage_events_select_admin"
  ON public.ai_voice_usage_events
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "ai_voice_usage_events_insert_member" ON public.ai_voice_usage_events;
CREATE POLICY "ai_voice_usage_events_insert_member"
  ON public.ai_voice_usage_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_org_member(organization_id)
  );

GRANT SELECT, INSERT ON public.ai_voice_usage_events TO authenticated;
GRANT ALL ON public.ai_voice_usage_events TO service_role;
