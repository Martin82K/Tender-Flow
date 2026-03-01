-- Migration: ai_agent_usage_events + admin cost summary RPCs
-- Description: Token/cost telemetry for Viki agent and admin reporting.

CREATE TABLE IF NOT EXISTS public.ai_agent_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trace_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_mode TEXT NOT NULL CHECK (request_mode IN ('chat', 'tool')),
  response_source TEXT NOT NULL CHECK (response_source IN ('llm', 'tool', 'skill')),
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  tool_calls JSONB NOT NULL DEFAULT '[]'::jsonb,
  policy_decision TEXT NOT NULL CHECK (policy_decision IN ('auto_execute', 'require_confirmation', 'denied')),
  guard_triggered BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_agent_usage_events_org_idempotency
  ON public.ai_agent_usage_events(organization_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_ai_agent_usage_events_org_created
  ON public.ai_agent_usage_events(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_agent_usage_events_model_created
  ON public.ai_agent_usage_events(model, created_at DESC);

ALTER TABLE public.ai_agent_usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_agent_usage_events_select_admin" ON public.ai_agent_usage_events;
CREATE POLICY "ai_agent_usage_events_select_admin"
  ON public.ai_agent_usage_events
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

GRANT SELECT ON public.ai_agent_usage_events TO authenticated;
GRANT ALL ON public.ai_agent_usage_events TO service_role;

CREATE OR REPLACE FUNCTION public.get_viki_cost_overview_admin(
  target_organization_id UUID,
  days_back INTEGER DEFAULT 30
)
RETURNS TABLE(
  requests BIGINT,
  input_tokens BIGINT,
  output_tokens BIGINT,
  total_tokens BIGINT,
  estimated_cost_usd NUMERIC,
  voice_transcribe_seconds BIGINT,
  voice_tts_chars BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bounded_days INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  bounded_days := GREATEST(1, LEAST(COALESCE(days_back, 30), 365));

  RETURN QUERY
  WITH agent AS (
    SELECT
      COUNT(*)::BIGINT AS requests,
      COALESCE(SUM(input_tokens), 0)::BIGINT AS input_tokens,
      COALESCE(SUM(output_tokens), 0)::BIGINT AS output_tokens,
      COALESCE(SUM(total_tokens), 0)::BIGINT AS total_tokens,
      COALESCE(SUM(estimated_cost_usd), 0)::NUMERIC AS estimated_cost_usd
    FROM public.ai_agent_usage_events
    WHERE organization_id = target_organization_id
      AND created_at >= timezone('utc'::text, now()) - make_interval(days => bounded_days)
  ),
  voice AS (
    SELECT
      COALESCE(SUM(CASE WHEN event_type = 'transcribe' THEN duration_seconds ELSE 0 END), 0)::BIGINT AS voice_transcribe_seconds,
      COALESCE(SUM(CASE WHEN event_type = 'speak' THEN char_count ELSE 0 END), 0)::BIGINT AS voice_tts_chars
    FROM public.ai_voice_usage_events
    WHERE organization_id = target_organization_id
      AND created_at >= timezone('utc'::text, now()) - make_interval(days => bounded_days)
  )
  SELECT
    agent.requests,
    agent.input_tokens,
    agent.output_tokens,
    agent.total_tokens,
    agent.estimated_cost_usd,
    voice.voice_transcribe_seconds,
    voice.voice_tts_chars
  FROM agent, voice;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_viki_cost_daily_admin(
  target_organization_id UUID,
  days_back INTEGER DEFAULT 30
)
RETURNS TABLE(
  day DATE,
  requests BIGINT,
  input_tokens BIGINT,
  output_tokens BIGINT,
  total_tokens BIGINT,
  estimated_cost_usd NUMERIC,
  voice_transcribe_seconds BIGINT,
  voice_tts_chars BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bounded_days INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  bounded_days := GREATEST(1, LEAST(COALESCE(days_back, 30), 365));

  RETURN QUERY
  WITH days AS (
    SELECT generate_series(
      (timezone('utc'::text, now())::date - (bounded_days - 1)),
      timezone('utc'::text, now())::date,
      interval '1 day'
    )::date AS day
  ),
  agent AS (
    SELECT
      created_at::date AS day,
      COUNT(*)::BIGINT AS requests,
      COALESCE(SUM(input_tokens), 0)::BIGINT AS input_tokens,
      COALESCE(SUM(output_tokens), 0)::BIGINT AS output_tokens,
      COALESCE(SUM(total_tokens), 0)::BIGINT AS total_tokens,
      COALESCE(SUM(estimated_cost_usd), 0)::NUMERIC AS estimated_cost_usd
    FROM public.ai_agent_usage_events
    WHERE organization_id = target_organization_id
      AND created_at >= timezone('utc'::text, now()) - make_interval(days => bounded_days)
    GROUP BY created_at::date
  ),
  voice AS (
    SELECT
      created_at::date AS day,
      COALESCE(SUM(CASE WHEN event_type = 'transcribe' THEN duration_seconds ELSE 0 END), 0)::BIGINT AS voice_transcribe_seconds,
      COALESCE(SUM(CASE WHEN event_type = 'speak' THEN char_count ELSE 0 END), 0)::BIGINT AS voice_tts_chars
    FROM public.ai_voice_usage_events
    WHERE organization_id = target_organization_id
      AND created_at >= timezone('utc'::text, now()) - make_interval(days => bounded_days)
    GROUP BY created_at::date
  )
  SELECT
    days.day,
    COALESCE(agent.requests, 0) AS requests,
    COALESCE(agent.input_tokens, 0) AS input_tokens,
    COALESCE(agent.output_tokens, 0) AS output_tokens,
    COALESCE(agent.total_tokens, 0) AS total_tokens,
    COALESCE(agent.estimated_cost_usd, 0) AS estimated_cost_usd,
    COALESCE(voice.voice_transcribe_seconds, 0) AS voice_transcribe_seconds,
    COALESCE(voice.voice_tts_chars, 0) AS voice_tts_chars
  FROM days
  LEFT JOIN agent ON agent.day = days.day
  LEFT JOIN voice ON voice.day = days.day
  ORDER BY days.day DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_viki_cost_models_admin(
  target_organization_id UUID,
  days_back INTEGER DEFAULT 30
)
RETURNS TABLE(
  model TEXT,
  requests BIGINT,
  total_tokens BIGINT,
  estimated_cost_usd NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bounded_days INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  bounded_days := GREATEST(1, LEAST(COALESCE(days_back, 30), 365));

  RETURN QUERY
  SELECT
    ai.model,
    COUNT(*)::BIGINT AS requests,
    COALESCE(SUM(ai.total_tokens), 0)::BIGINT AS total_tokens,
    COALESCE(SUM(ai.estimated_cost_usd), 0)::NUMERIC AS estimated_cost_usd
  FROM public.ai_agent_usage_events ai
  WHERE ai.organization_id = target_organization_id
    AND ai.created_at >= timezone('utc'::text, now()) - make_interval(days => bounded_days)
  GROUP BY ai.model
  ORDER BY estimated_cost_usd DESC, requests DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_viki_cost_overview_admin(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_viki_cost_daily_admin(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_viki_cost_models_admin(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_viki_cost_overview_admin(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_viki_cost_daily_admin(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_viki_cost_models_admin(UUID, INTEGER) TO authenticated;
