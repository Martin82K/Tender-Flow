-- Fix: remove ambiguous column references in Viki cost RPC functions

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
  WITH agent_stats AS (
    SELECT
      COUNT(*)::BIGINT AS requests,
      COALESCE(SUM(ev.input_tokens), 0)::BIGINT AS input_tokens,
      COALESCE(SUM(ev.output_tokens), 0)::BIGINT AS output_tokens,
      COALESCE(SUM(ev.total_tokens), 0)::BIGINT AS total_tokens,
      COALESCE(SUM(ev.estimated_cost_usd), 0)::NUMERIC AS estimated_cost_usd
    FROM public.ai_agent_usage_events ev
    WHERE ev.organization_id = target_organization_id
      AND ev.created_at >= timezone('utc'::text, now()) - make_interval(days => bounded_days)
  ),
  voice_stats AS (
    SELECT
      COALESCE(SUM(CASE WHEN vv.event_type = 'transcribe' THEN vv.duration_seconds ELSE 0 END), 0)::BIGINT AS voice_transcribe_seconds,
      COALESCE(SUM(CASE WHEN vv.event_type = 'speak' THEN vv.char_count ELSE 0 END), 0)::BIGINT AS voice_tts_chars
    FROM public.ai_voice_usage_events vv
    WHERE vv.organization_id = target_organization_id
      AND vv.created_at >= timezone('utc'::text, now()) - make_interval(days => bounded_days)
  )
  SELECT
    agent_stats.requests,
    agent_stats.input_tokens,
    agent_stats.output_tokens,
    agent_stats.total_tokens,
    agent_stats.estimated_cost_usd,
    voice_stats.voice_transcribe_seconds,
    voice_stats.voice_tts_chars
  FROM agent_stats, voice_stats;
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
  agent_stats AS (
    SELECT
      ev.created_at::date AS day,
      COUNT(*)::BIGINT AS requests,
      COALESCE(SUM(ev.input_tokens), 0)::BIGINT AS input_tokens,
      COALESCE(SUM(ev.output_tokens), 0)::BIGINT AS output_tokens,
      COALESCE(SUM(ev.total_tokens), 0)::BIGINT AS total_tokens,
      COALESCE(SUM(ev.estimated_cost_usd), 0)::NUMERIC AS estimated_cost_usd
    FROM public.ai_agent_usage_events ev
    WHERE ev.organization_id = target_organization_id
      AND ev.created_at >= timezone('utc'::text, now()) - make_interval(days => bounded_days)
    GROUP BY ev.created_at::date
  ),
  voice_stats AS (
    SELECT
      vv.created_at::date AS day,
      COALESCE(SUM(CASE WHEN vv.event_type = 'transcribe' THEN vv.duration_seconds ELSE 0 END), 0)::BIGINT AS voice_transcribe_seconds,
      COALESCE(SUM(CASE WHEN vv.event_type = 'speak' THEN vv.char_count ELSE 0 END), 0)::BIGINT AS voice_tts_chars
    FROM public.ai_voice_usage_events vv
    WHERE vv.organization_id = target_organization_id
      AND vv.created_at >= timezone('utc'::text, now()) - make_interval(days => bounded_days)
    GROUP BY vv.created_at::date
  )
  SELECT
    d.day,
    COALESCE(a.requests, 0) AS requests,
    COALESCE(a.input_tokens, 0) AS input_tokens,
    COALESCE(a.output_tokens, 0) AS output_tokens,
    COALESCE(a.total_tokens, 0) AS total_tokens,
    COALESCE(a.estimated_cost_usd, 0) AS estimated_cost_usd,
    COALESCE(v.voice_transcribe_seconds, 0) AS voice_transcribe_seconds,
    COALESCE(v.voice_tts_chars, 0) AS voice_tts_chars
  FROM days d
  LEFT JOIN agent_stats a ON a.day = d.day
  LEFT JOIN voice_stats v ON v.day = d.day
  ORDER BY d.day DESC;
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
    ev.model,
    COUNT(*)::BIGINT AS requests,
    COALESCE(SUM(ev.total_tokens), 0)::BIGINT AS total_tokens,
    COALESCE(SUM(ev.estimated_cost_usd), 0)::NUMERIC AS estimated_cost_usd
  FROM public.ai_agent_usage_events ev
  WHERE ev.organization_id = target_organization_id
    AND ev.created_at >= timezone('utc'::text, now()) - make_interval(days => bounded_days)
  GROUP BY ev.model
  ORDER BY COALESCE(SUM(ev.estimated_cost_usd), 0) DESC, COUNT(*) DESC;
END;
$$;
