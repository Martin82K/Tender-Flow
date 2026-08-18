-- Preserve historical report rows after organization membership ends and make
-- a zero-day retention policy explicitly disable deletion.

ALTER FUNCTION public.get_app_usage_summary_admin(INTEGER, UUID)
  RENAME TO get_app_usage_summary_active_members_admin;

REVOKE ALL ON FUNCTION public.get_app_usage_summary_active_members_admin(INTEGER, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_app_usage_summary_active_members_admin(INTEGER, UUID)
  TO service_role;

CREATE FUNCTION public.get_app_usage_summary_admin(
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
  has_measured_usage BOOLEAN,
  last_seen_at TIMESTAMPTZ,
  daily_stats JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  normalized_days INTEGER;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  normalized_days := LEAST(GREATEST(COALESCE(days_back, 30), 1), 365);

  RETURN QUERY
  WITH active_rows AS (
    SELECT *
    FROM public.get_app_usage_summary_active_members_admin(
      normalized_days,
      target_organization_id
    )
  ),
  filtered_stats AS (
    SELECT uds.*
    FROM public.usage_daily_stats uds
    WHERE uds.stat_date >= (CURRENT_DATE - (normalized_days - 1))
      AND (
        target_organization_id IS NULL
        OR uds.organization_id = target_organization_id
      )
  ),
  historical_members AS (
    SELECT
      fs.organization_id,
      o.name::TEXT AS organization_name,
      fs.user_id,
      au.email::TEXT AS email,
      up.display_name::TEXT AS display_name,
      SUM(fs.active_seconds)::BIGINT AS active_seconds,
      COUNT(*) FILTER (
        WHERE fs.active_seconds > 0
           OR fs.session_count > 0
           OR fs.action_count > 0
      )::BIGINT AS active_days,
      SUM(fs.session_count)::BIGINT AS session_count,
      SUM(fs.action_count)::BIGINT AS action_count,
      SUM(fs.uploaded_bytes)::BIGINT AS uploaded_bytes,
      SUM(fs.created_records_count)::BIGINT AS created_records_count,
      SUM(fs.updated_records_count)::BIGINT AS updated_records_count,
      SUM(fs.deleted_records_count)::BIGINT AS deleted_records_count,
      TRUE AS has_measured_usage,
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
    JOIN public.organizations o ON o.id = fs.organization_id
    JOIN auth.users au ON au.id = fs.user_id
    LEFT JOIN public.user_profiles up ON up.user_id = fs.user_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = fs.organization_id
        AND om.user_id = fs.user_id
        AND COALESCE(om.is_active, TRUE) = TRUE
    )
    GROUP BY
      fs.organization_id,
      o.name,
      fs.user_id,
      au.email,
      up.display_name
  ),
  combined_rows AS (
    SELECT * FROM active_rows
    UNION ALL
    SELECT * FROM historical_members
  )
  SELECT cr.*
  FROM combined_rows cr
  ORDER BY
    CASE WHEN cr.last_seen_at IS NULL THEN 1 ELSE 0 END,
    cr.last_seen_at DESC NULLS LAST,
    cr.active_seconds DESC,
    cr.organization_name,
    cr.email;
END;
$$;

REVOKE ALL ON FUNCTION public.get_app_usage_summary_admin(INTEGER, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_app_usage_summary_admin(INTEGER, UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_app_usage_summary_admin(INTEGER, UUID)
  TO service_role;

CREATE OR REPLACE FUNCTION public.purge_app_usage_stats_admin()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  retention_days INTEGER;
  deleted_count BIGINT := 0;
BEGIN
  SELECT crp.retention_days
  INTO retention_days
  FROM public.compliance_retention_policies crp
  WHERE crp.id = 'app-usage-daily-stats';

  DELETE FROM public.usage_session_state uss
  WHERE uss.expires_at < timezone('utc'::TEXT, now());

  IF retention_days IS NULL OR retention_days <= 0 THEN
    RETURN 0;
  END IF;

  DELETE FROM public.usage_daily_stats uds
  WHERE uds.stat_date < CURRENT_DATE - (retention_days - 1);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_app_usage_stats_admin()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_app_usage_stats_admin()
  TO service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;
