-- Migration: fix_usage_session_cleanup
-- Date: 2026-05-18
-- Description: Ensure heartbeat writes purge expired usage sessions across all users.

CREATE OR REPLACE FUNCTION public.record_usage_heartbeat(
  session_id_input UUID,
  active_seconds_input INTEGER DEFAULT 120
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  resolved_org_id UUID;
  now_utc TIMESTAMPTZ := timezone('utc'::text, now());
  normalized_seconds INTEGER;
  counted_seconds INTEGER;
  elapsed_seconds INTEGER;
  existing_session public.usage_session_state%ROWTYPE;
  session_increment INTEGER := 0;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL OR session_id_input IS NULL THEN
    RETURN FALSE;
  END IF;

  resolved_org_id := public.resolve_current_usage_org_id();
  IF resolved_org_id IS NULL THEN
    RETURN FALSE;
  END IF;

  normalized_seconds := LEAST(GREATEST(COALESCE(active_seconds_input, 120), 1), 300);

  DELETE FROM public.usage_session_state
  WHERE expires_at < now_utc;

  SELECT *
  INTO existing_session
  FROM public.usage_session_state
  WHERE session_id = session_id_input
  FOR UPDATE;

  IF NOT FOUND THEN
    counted_seconds := normalized_seconds;
    session_increment := 1;

    INSERT INTO public.usage_session_state (
      session_id,
      organization_id,
      user_id,
      started_at,
      last_heartbeat_at,
      last_counted_at,
      expires_at
    )
    VALUES (
      session_id_input,
      resolved_org_id,
      current_user_id,
      now_utc,
      now_utc,
      now_utc,
      now_utc + interval '7 days'
    );
  ELSE
    IF existing_session.user_id <> current_user_id THEN
      RETURN FALSE;
    END IF;

    elapsed_seconds := FLOOR(EXTRACT(EPOCH FROM (now_utc - existing_session.last_counted_at)))::INTEGER;
    counted_seconds := LEAST(normalized_seconds, GREATEST(elapsed_seconds, 0));

    UPDATE public.usage_session_state
    SET
      organization_id = resolved_org_id,
      last_heartbeat_at = now_utc,
      last_counted_at = now_utc,
      expires_at = now_utc + interval '7 days'
    WHERE session_id = session_id_input;
  END IF;

  INSERT INTO public.usage_daily_stats (
    organization_id,
    user_id,
    stat_date,
    active_seconds,
    session_count,
    last_seen_at,
    updated_at
  )
  VALUES (
    resolved_org_id,
    current_user_id,
    now_utc::DATE,
    counted_seconds,
    session_increment,
    now_utc,
    now_utc
  )
  ON CONFLICT (organization_id, user_id, stat_date)
  DO UPDATE SET
    active_seconds = LEAST(86400, public.usage_daily_stats.active_seconds + EXCLUDED.active_seconds),
    session_count = public.usage_daily_stats.session_count + EXCLUDED.session_count,
    last_seen_at = GREATEST(COALESCE(public.usage_daily_stats.last_seen_at, EXCLUDED.last_seen_at), EXCLUDED.last_seen_at),
    updated_at = EXCLUDED.updated_at;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_usage_heartbeat(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_usage_heartbeat(UUID, INTEGER) TO service_role;
