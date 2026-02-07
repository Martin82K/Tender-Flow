-- Migration: feature_usage_tracking
-- Date: 2026-02-07
-- Description: Tenant-level usage tracking for selected features (MVP)

CREATE TABLE IF NOT EXISTS public.feature_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL REFERENCES public.subscription_features(key) ON DELETE RESTRICT,
  event_key TEXT NOT NULL DEFAULT 'success' CHECK (event_key IN ('success')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_feature_usage_events_org_feature_created
  ON public.feature_usage_events(organization_id, feature_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feature_usage_events_org_created
  ON public.feature_usage_events(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feature_usage_events_created
  ON public.feature_usage_events(created_at DESC);

ALTER TABLE public.feature_usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feature_usage_events_insert_authenticated" ON public.feature_usage_events;
CREATE POLICY "feature_usage_events_insert_authenticated"
  ON public.feature_usage_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND event_key = 'success'
    AND public.is_org_member(organization_id)
  );

DROP POLICY IF EXISTS "feature_usage_events_select_admin" ON public.feature_usage_events;
CREATE POLICY "feature_usage_events_select_admin"
  ON public.feature_usage_events
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

GRANT INSERT ON public.feature_usage_events TO authenticated;
GRANT SELECT ON public.feature_usage_events TO authenticated;
GRANT ALL ON public.feature_usage_events TO service_role;

CREATE OR REPLACE FUNCTION public.track_feature_usage(
  feature_key_input TEXT,
  metadata_input JSONB DEFAULT '{}'::jsonb
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  resolved_org_id UUID;
  normalized_feature_key TEXT;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  normalized_feature_key := lower(trim(COALESCE(feature_key_input, '')));
  IF normalized_feature_key = '' THEN
    RETURN FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.subscription_features sf
    WHERE sf.key = normalized_feature_key
  ) THEN
    RETURN FALSE;
  END IF;

  SELECT om.organization_id
  INTO resolved_org_id
  FROM public.organization_members om
  WHERE om.user_id = current_user_id
  ORDER BY
    CASE om.role
      WHEN 'owner' THEN 0
      WHEN 'admin' THEN 1
      ELSE 2
    END,
    om.created_at,
    om.organization_id
  LIMIT 1;

  IF resolved_org_id IS NULL THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.feature_usage_events (
    organization_id,
    user_id,
    feature_key,
    event_key,
    metadata
  )
  VALUES (
    resolved_org_id,
    current_user_id,
    normalized_feature_key,
    'success',
    COALESCE(metadata_input, '{}'::jsonb)
  );

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_feature_usage_tenants_admin()
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  RETURN QUERY
  SELECT
    o.id AS organization_id,
    o.name::TEXT AS organization_name
  FROM public.organizations o
  ORDER BY o.name ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_feature_usage_summary_admin(
  target_organization_id UUID,
  days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  feature_key TEXT,
  feature_name TEXT,
  total_count BIGINT,
  range_count BIGINT,
  last_used_at TIMESTAMPTZ,
  daily_counts JSONB
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

  IF target_organization_id IS NULL THEN
    RAISE EXCEPTION 'target_organization_id is required';
  END IF;

  normalized_days := LEAST(GREATEST(COALESCE(days_back, 30), 1), 365);

  RETURN QUERY
  WITH selected_features AS (
    SELECT
      sf.key,
      sf.name
    FROM public.subscription_features sf
    WHERE sf.key IN ('excel_unlocker', 'excel_merger', 'excel_indexer')
  ),
  date_window AS (
    SELECT generate_series(
      (current_date - (normalized_days - 1))::date,
      current_date::date,
      interval '1 day'
    )::date AS day
  ),
  aggregated_daily AS (
    SELECT
      sfe.key AS agg_feature_key,
      dw.day,
      COUNT(fue.id)::BIGINT AS day_count
    FROM selected_features sfe
    CROSS JOIN date_window dw
    LEFT JOIN public.feature_usage_events fue
      ON fue.organization_id = target_organization_id
      AND fue.feature_key = sfe.key
      AND fue.event_key = 'success'
      AND fue.created_at >= dw.day::TIMESTAMPTZ
      AND fue.created_at < (dw.day + 1)::TIMESTAMPTZ
    GROUP BY sfe.key, dw.day
  ),
  totals AS (
    SELECT
      sfe.key AS totals_feature_key,
      COUNT(fue.id)::BIGINT AS total_count,
      COUNT(fue.id) FILTER (
        WHERE fue.created_at >= (current_date - (normalized_days - 1))::TIMESTAMPTZ
      )::BIGINT AS range_count,
      MAX(fue.created_at) AS last_used_at
    FROM selected_features sfe
    LEFT JOIN public.feature_usage_events fue
      ON fue.organization_id = target_organization_id
      AND fue.feature_key = sfe.key
      AND fue.event_key = 'success'
    GROUP BY sfe.key
  )
  SELECT
    sfe.key AS feature_key,
    sfe.name::TEXT AS feature_name,
    COALESCE(t.total_count, 0)::BIGINT AS total_count,
    COALESCE(t.range_count, 0)::BIGINT AS range_count,
    t.last_used_at,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object('date', ad.day, 'count', ad.day_count)
          ORDER BY ad.day
        )
        FROM aggregated_daily ad
        WHERE ad.agg_feature_key = sfe.key
      ),
      '[]'::jsonb
    ) AS daily_counts
  FROM selected_features sfe
  LEFT JOIN totals t ON t.totals_feature_key = sfe.key
  ORDER BY sfe.key;
END;
$$;

GRANT EXECUTE ON FUNCTION public.track_feature_usage(TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_feature_usage_tenants_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_feature_usage_summary_admin(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_feature_usage(TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_feature_usage_tenants_admin() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_feature_usage_summary_admin(UUID, INTEGER) TO service_role;
