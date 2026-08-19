-- Include every active organization member in the admin usage overview.
-- Members without consented analytics remain visible with zero activity.

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
  WITH active_members AS (
    SELECT
      om.organization_id,
      o.name::TEXT AS organization_name,
      om.user_id,
      au.email::TEXT AS email,
      up.display_name::TEXT AS display_name
    FROM public.organization_members om
    JOIN public.organizations o ON o.id = om.organization_id
    JOIN auth.users au ON au.id = om.user_id
    LEFT JOIN public.user_profiles up ON up.user_id = om.user_id
    WHERE COALESCE(om.is_active, TRUE) = TRUE
  ),
  filtered_members AS (
    SELECT am.*
    FROM active_members am
    WHERE target_organization_id IS NULL
      OR am.organization_id = target_organization_id
  ),
  filtered_stats AS (
    SELECT uds.*
    FROM public.usage_daily_stats uds
    WHERE uds.stat_date >= (CURRENT_DATE - (normalized_days - 1))
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
    rm.organization_id,
    rm.organization_name,
    rm.user_id,
    rm.email,
    rm.display_name,
    COALESCE(a.active_seconds, 0)::BIGINT AS active_seconds,
    COALESCE(a.active_days, 0)::BIGINT AS active_days,
    COALESCE(a.session_count, 0)::BIGINT AS session_count,
    COALESCE(a.action_count, 0)::BIGINT AS action_count,
    COALESCE(a.uploaded_bytes, 0)::BIGINT AS uploaded_bytes,
    COALESCE(a.created_records_count, 0)::BIGINT AS created_records_count,
    COALESCE(a.updated_records_count, 0)::BIGINT AS updated_records_count,
    COALESCE(a.deleted_records_count, 0)::BIGINT AS deleted_records_count,
    a.last_seen_at,
    COALESCE(a.daily_stats, '[]'::JSONB) AS daily_stats
  FROM filtered_members rm
  LEFT JOIN aggregated a
    ON a.organization_id = rm.organization_id
   AND a.user_id = rm.user_id
  ORDER BY
    COALESCE(a.active_seconds, 0) DESC,
    COALESCE(a.action_count, 0) DESC,
    a.last_seen_at DESC NULLS LAST,
    rm.organization_name,
    rm.email;
END;
$$;

REVOKE ALL ON FUNCTION public.get_app_usage_summary_admin(INTEGER, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_app_usage_summary_admin(INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_app_usage_summary_admin(INTEGER, UUID) TO service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;
