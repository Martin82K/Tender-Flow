-- Migration: app_usage_daily_stats
-- Date: 2026-05-18
-- Description: Aggregated application usage metrics without raw heartbeat/event storage.

CREATE TABLE IF NOT EXISTS public.usage_daily_stats (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stat_date DATE NOT NULL DEFAULT current_date,
  active_seconds INTEGER NOT NULL DEFAULT 0 CHECK (active_seconds >= 0 AND active_seconds <= 86400),
  session_count INTEGER NOT NULL DEFAULT 0 CHECK (session_count >= 0),
  action_count INTEGER NOT NULL DEFAULT 0 CHECK (action_count >= 0),
  uploaded_bytes BIGINT NOT NULL DEFAULT 0 CHECK (uploaded_bytes >= 0),
  created_records_count INTEGER NOT NULL DEFAULT 0 CHECK (created_records_count >= 0),
  updated_records_count INTEGER NOT NULL DEFAULT 0 CHECK (updated_records_count >= 0),
  deleted_records_count INTEGER NOT NULL DEFAULT 0 CHECK (deleted_records_count >= 0),
  last_seen_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (organization_id, user_id, stat_date)
);

CREATE INDEX IF NOT EXISTS idx_usage_daily_stats_org_date
  ON public.usage_daily_stats(organization_id, stat_date DESC);

CREATE INDEX IF NOT EXISTS idx_usage_daily_stats_user_date
  ON public.usage_daily_stats(user_id, stat_date DESC);

CREATE TABLE IF NOT EXISTS public.usage_session_state (
  session_id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  last_counted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()) + interval '7 days')
);

CREATE INDEX IF NOT EXISTS idx_usage_session_state_expires
  ON public.usage_session_state(expires_at);

CREATE INDEX IF NOT EXISTS idx_usage_session_state_user_last_heartbeat
  ON public.usage_session_state(user_id, last_heartbeat_at DESC);

ALTER TABLE public.usage_daily_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_session_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usage_daily_stats_select_admin" ON public.usage_daily_stats;
CREATE POLICY "usage_daily_stats_select_admin"
  ON public.usage_daily_stats
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "usage_session_state_no_direct_access" ON public.usage_session_state;

GRANT SELECT ON public.usage_daily_stats TO authenticated;
GRANT ALL ON public.usage_daily_stats TO service_role;
GRANT ALL ON public.usage_session_state TO service_role;

CREATE OR REPLACE FUNCTION public.resolve_current_usage_org_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  resolved_org_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT om.organization_id
  INTO resolved_org_id
  FROM public.organization_members om
  WHERE om.user_id = auth.uid()
    AND COALESCE(om.is_active, true) = true
  ORDER BY
    CASE om.role
      WHEN 'owner' THEN 0
      WHEN 'admin' THEN 1
      ELSE 2
    END,
    om.created_at,
    om.organization_id
  LIMIT 1;

  RETURN resolved_org_id;
END;
$$;

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
  WHERE user_id = current_user_id
    AND expires_at < now_utc;

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

CREATE OR REPLACE FUNCTION public.record_usage_action(
  action_count_input INTEGER DEFAULT 1,
  created_records_count_input INTEGER DEFAULT 0,
  updated_records_count_input INTEGER DEFAULT 0,
  deleted_records_count_input INTEGER DEFAULT 0,
  uploaded_bytes_input BIGINT DEFAULT 0
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
  action_count_value INTEGER;
  created_count_value INTEGER;
  updated_count_value INTEGER;
  deleted_count_value INTEGER;
  uploaded_bytes_value BIGINT;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  resolved_org_id := public.resolve_current_usage_org_id();
  IF resolved_org_id IS NULL THEN
    RETURN FALSE;
  END IF;

  action_count_value := LEAST(GREATEST(COALESCE(action_count_input, 1), 0), 1000);
  created_count_value := LEAST(GREATEST(COALESCE(created_records_count_input, 0), 0), 10000);
  updated_count_value := LEAST(GREATEST(COALESCE(updated_records_count_input, 0), 0), 10000);
  deleted_count_value := LEAST(GREATEST(COALESCE(deleted_records_count_input, 0), 0), 10000);
  uploaded_bytes_value := LEAST(GREATEST(COALESCE(uploaded_bytes_input, 0), 0), 10737418240);

  IF action_count_value = 0
    AND created_count_value = 0
    AND updated_count_value = 0
    AND deleted_count_value = 0
    AND uploaded_bytes_value = 0 THEN
    RETURN TRUE;
  END IF;

  INSERT INTO public.usage_daily_stats (
    organization_id,
    user_id,
    stat_date,
    action_count,
    uploaded_bytes,
    created_records_count,
    updated_records_count,
    deleted_records_count,
    last_seen_at,
    updated_at
  )
  VALUES (
    resolved_org_id,
    current_user_id,
    now_utc::DATE,
    action_count_value,
    uploaded_bytes_value,
    created_count_value,
    updated_count_value,
    deleted_count_value,
    now_utc,
    now_utc
  )
  ON CONFLICT (organization_id, user_id, stat_date)
  DO UPDATE SET
    action_count = public.usage_daily_stats.action_count + EXCLUDED.action_count,
    uploaded_bytes = public.usage_daily_stats.uploaded_bytes + EXCLUDED.uploaded_bytes,
    created_records_count = public.usage_daily_stats.created_records_count + EXCLUDED.created_records_count,
    updated_records_count = public.usage_daily_stats.updated_records_count + EXCLUDED.updated_records_count,
    deleted_records_count = public.usage_daily_stats.deleted_records_count + EXCLUDED.deleted_records_count,
    last_seen_at = GREATEST(COALESCE(public.usage_daily_stats.last_seen_at, EXCLUDED.last_seen_at), EXCLUDED.last_seen_at),
    updated_at = EXCLUDED.updated_at;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_app_usage_summary_admin(
  days_back INTEGER DEFAULT 30,
  target_organization_id UUID DEFAULT NULL
)
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT,
  user_id UUID,
  email TEXT,
  display_name TEXT,
  active_seconds BIGINT,
  active_days BIGINT,
  session_count BIGINT,
  action_count BIGINT,
  uploaded_bytes BIGINT,
  created_records_count BIGINT,
  updated_records_count BIGINT,
  deleted_records_count BIGINT,
  last_seen_at TIMESTAMPTZ,
  daily_stats JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  normalized_days INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  normalized_days := LEAST(GREATEST(COALESCE(days_back, 30), 1), 365);

  RETURN QUERY
  WITH filtered_stats AS (
    SELECT uds.*
    FROM public.usage_daily_stats uds
    WHERE uds.stat_date >= (current_date - (normalized_days - 1))
      AND (target_organization_id IS NULL OR uds.organization_id = target_organization_id)
  ),
  aggregated AS (
    SELECT
      fs.organization_id,
      fs.user_id,
      SUM(fs.active_seconds)::BIGINT AS active_seconds,
      COUNT(*) FILTER (
        WHERE fs.active_seconds > 0 OR fs.session_count > 0 OR fs.action_count > 0
      )::BIGINT AS active_days,
      SUM(fs.session_count)::BIGINT AS session_count,
      SUM(fs.action_count)::BIGINT AS action_count,
      SUM(fs.uploaded_bytes)::BIGINT AS uploaded_bytes,
      SUM(fs.created_records_count)::BIGINT AS created_records_count,
      SUM(fs.updated_records_count)::BIGINT AS updated_records_count,
      SUM(fs.deleted_records_count)::BIGINT AS deleted_records_count,
      MAX(fs.last_seen_at) AS last_seen_at,
      jsonb_agg(
        jsonb_build_object(
          'date', fs.stat_date,
          'activeSeconds', fs.active_seconds,
          'sessionCount', fs.session_count,
          'actionCount', fs.action_count,
          'uploadedBytes', fs.uploaded_bytes,
          'createdRecordsCount', fs.created_records_count,
          'updatedRecordsCount', fs.updated_records_count,
          'deletedRecordsCount', fs.deleted_records_count
        )
        ORDER BY fs.stat_date
      ) AS daily_stats
    FROM filtered_stats fs
    GROUP BY fs.organization_id, fs.user_id
  )
  SELECT
    a.organization_id,
    o.name::TEXT AS organization_name,
    a.user_id,
    au.email::TEXT AS email,
    up.display_name::TEXT AS display_name,
    a.active_seconds,
    a.active_days,
    a.session_count,
    a.action_count,
    a.uploaded_bytes,
    a.created_records_count,
    a.updated_records_count,
    a.deleted_records_count,
    a.last_seen_at,
    COALESCE(a.daily_stats, '[]'::jsonb) AS daily_stats
  FROM aggregated a
  JOIN public.organizations o ON o.id = a.organization_id
  JOIN auth.users au ON au.id = a.user_id
  LEFT JOIN public.user_profiles up ON up.user_id = a.user_id
  ORDER BY a.active_seconds DESC, a.action_count DESC, a.last_seen_at DESC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_current_usage_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_usage_heartbeat(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_usage_action(INTEGER, INTEGER, INTEGER, INTEGER, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_app_usage_summary_admin(INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_current_usage_org_id() TO service_role;
GRANT EXECUTE ON FUNCTION public.record_usage_heartbeat(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_usage_action(INTEGER, INTEGER, INTEGER, INTEGER, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_app_usage_summary_admin(INTEGER, UUID) TO service_role;
