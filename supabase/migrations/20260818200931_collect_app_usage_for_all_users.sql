-- Collect privacy-minimized operational usage for every authenticated app user.
-- Optional product analytics remain consent-gated; these daily aggregates are
-- part of operating the authenticated B2B service and contain no work content.

INSERT INTO public.compliance_retention_policies (
  id,
  category,
  purpose,
  retention_days,
  status,
  notes
)
VALUES (
  'app-usage-daily-stats',
  'Agregované provozní využití aplikace',
  'Správa a kapacitní vyhodnocení poskytované B2B služby',
  365,
  'implemented',
  'Denní agregace bez obsahu práce a bez historie jednotlivých heartbeatů.'
)
ON CONFLICT (id) DO UPDATE
SET
  category = EXCLUDED.category,
  purpose = EXCLUDED.purpose,
  retention_days = EXCLUDED.retention_days,
  status = EXCLUDED.status,
  notes = EXCLUDED.notes,
  updated_at = timezone('utc'::TEXT, now());

INSERT INTO public.processing_activities (
  id,
  activity_name,
  purpose,
  legal_basis,
  data_categories,
  retention_policy_id,
  notes
)
VALUES (
  'ropa-app-usage-operations',
  'Agregované provozní využití přihlášené aplikace',
  'Správa, podpora a kapacitní vyhodnocení poskytované B2B služby',
  'plnění smlouvy / oprávněný zájem',
  ARRAY[
    'identifikátor uživatele a organizace',
    'aktivní čas',
    'souhrnné počty relací a změn',
    'objem přenesených dat',
    'čas poslední aktivity'
  ],
  'app-usage-daily-stats',
  'Bez obsahu práce, jednotlivých vstupů a historie jednotlivých heartbeatů.'
)
ON CONFLICT (id) DO UPDATE
SET
  activity_name = EXCLUDED.activity_name,
  purpose = EXCLUDED.purpose,
  legal_basis = EXCLUDED.legal_basis,
  data_categories = EXCLUDED.data_categories,
  retention_policy_id = EXCLUDED.retention_policy_id,
  notes = EXCLUDED.notes,
  updated_at = timezone('utc'::TEXT, now());

CREATE OR REPLACE FUNCTION public.purge_app_usage_stats_admin()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  retention_days INTEGER := 365;
  deleted_count BIGINT := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  SELECT crp.retention_days
  INTO retention_days
  FROM public.compliance_retention_policies crp
  WHERE crp.id = 'app-usage-daily-stats';

  DELETE FROM public.usage_daily_stats uds
  WHERE uds.stat_date < CURRENT_DATE - (GREATEST(COALESCE(retention_days, 365), 1) - 1);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  DELETE FROM public.usage_session_state uss
  WHERE uss.expires_at < timezone('utc'::TEXT, now());

  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_app_usage_stats_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_app_usage_stats_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_app_usage_stats_admin() TO service_role;

DROP FUNCTION IF EXISTS public.get_app_usage_summary_admin(INTEGER, UUID);

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
  range_start TIMESTAMPTZ;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  normalized_days := LEAST(GREATEST(COALESCE(days_back, 30), 1), 365);
  range_start := ((CURRENT_DATE - (normalized_days - 1))::TIMESTAMP AT TIME ZONE 'UTC');

  RETURN QUERY
  WITH ranked_members AS (
    SELECT
      om.organization_id,
      o.name::TEXT AS organization_name,
      om.user_id,
      au.email::TEXT AS email,
      au.last_sign_in_at,
      up.display_name::TEXT AS display_name,
      ROW_NUMBER() OVER (
        PARTITION BY om.user_id
        ORDER BY
          CASE om.role
            WHEN 'owner' THEN 0
            WHEN 'admin' THEN 1
            ELSE 2
          END,
          om.created_at,
          om.organization_id
      ) AS usage_org_rank
    FROM public.organization_members om
    JOIN public.organizations o ON o.id = om.organization_id
    JOIN auth.users au ON au.id = om.user_id
    LEFT JOIN public.user_profiles up ON up.user_id = om.user_id
    WHERE COALESCE(om.is_active, TRUE) = TRUE
  ),
  filtered_members AS (
    SELECT rm.*
    FROM ranked_members rm
    WHERE target_organization_id IS NULL
      OR rm.organization_id = target_organization_id
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
      MAX(fs.last_seen_at) AS measured_last_seen_at,
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
  ),
  session_activity AS (
    SELECT
      s.user_id,
      MAX(s.refreshed_at AT TIME ZONE 'UTC') AS last_refreshed_at
    FROM auth.sessions s
    WHERE EXISTS (
      SELECT 1 FROM filtered_members fm WHERE fm.user_id = s.user_id
    )
    GROUP BY s.user_id
  ),
  device_activity AS (
    SELECT
      d.user_id,
      MAX(d.last_seen_at) AS last_device_seen_at
    FROM public.user_auth_devices d
    WHERE EXISTS (
      SELECT 1 FROM filtered_members fm WHERE fm.user_id = d.user_id
    )
    GROUP BY d.user_id
  ),
  combined AS (
    SELECT
      fm.organization_id,
      fm.organization_name,
      fm.user_id,
      fm.email,
      fm.display_name,
      a.active_seconds,
      a.active_days,
      a.session_count,
      a.action_count,
      a.uploaded_bytes,
      a.created_records_count,
      a.updated_records_count,
      a.deleted_records_count,
      (a.user_id IS NOT NULL) AS has_measured_usage,
      GREATEST(
        a.measured_last_seen_at,
        CASE WHEN fm.usage_org_rank = 1 THEN fm.last_sign_in_at END,
        CASE WHEN fm.usage_org_rank = 1 THEN sa.last_refreshed_at END,
        CASE WHEN fm.usage_org_rank = 1 THEN da.last_device_seen_at END
      ) AS operational_last_seen_at,
      a.daily_stats
    FROM filtered_members fm
    LEFT JOIN aggregated a
      ON a.organization_id = fm.organization_id
     AND a.user_id = fm.user_id
    LEFT JOIN session_activity sa ON sa.user_id = fm.user_id
    LEFT JOIN device_activity da ON da.user_id = fm.user_id
  )
  SELECT
    c.organization_id,
    c.organization_name,
    c.user_id,
    c.email,
    c.display_name,
    COALESCE(c.active_seconds, 0)::BIGINT,
    COALESCE(c.active_days, 0)::BIGINT,
    COALESCE(c.session_count, 0)::BIGINT,
    COALESCE(c.action_count, 0)::BIGINT,
    COALESCE(c.uploaded_bytes, 0)::BIGINT,
    COALESCE(c.created_records_count, 0)::BIGINT,
    COALESCE(c.updated_records_count, 0)::BIGINT,
    COALESCE(c.deleted_records_count, 0)::BIGINT,
    c.has_measured_usage,
    CASE
      WHEN c.operational_last_seen_at >= range_start THEN c.operational_last_seen_at
      ELSE NULL
    END,
    COALESCE(c.daily_stats, '[]'::JSONB)
  FROM combined c
  ORDER BY
    CASE WHEN c.operational_last_seen_at >= range_start THEN 0 ELSE 1 END,
    c.operational_last_seen_at DESC NULLS LAST,
    COALESCE(c.active_seconds, 0) DESC,
    c.organization_name,
    c.email;
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
