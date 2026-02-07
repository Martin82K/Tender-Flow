-- Migration: org_unlocker_time_savings
-- Date: 2026-02-07
-- Description: Tenant-facing unlocker time-savings summary for organization members.

CREATE OR REPLACE FUNCTION public.get_org_unlocker_time_savings(
  org_id_input UUID,
  days_back INTEGER DEFAULT 30,
  minutes_per_sheet INTEGER DEFAULT 2
)
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT,
  unlocked_sheets_total BIGINT,
  unlocked_sheets_range BIGINT,
  unlock_events_total BIGINT,
  unlock_events_range BIGINT,
  minutes_saved_total BIGINT,
  minutes_saved_range BIGINT,
  last_unlock_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  normalized_days INTEGER;
  normalized_minutes INTEGER;
BEGIN
  IF org_id_input IS NULL THEN
    RAISE EXCEPTION 'org_id_input is required';
  END IF;

  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Access denied: Authentication required';
  END IF;

  IF NOT (public.is_admin() OR public.is_org_member(org_id_input)) THEN
    RAISE EXCEPTION 'Access denied: Organization member required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE o.id = org_id_input
  ) THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  normalized_days := LEAST(GREATEST(COALESCE(days_back, 30), 1), 365);
  normalized_minutes := LEAST(GREATEST(COALESCE(minutes_per_sheet, 2), 1), 60);

  RETURN QUERY
  WITH org AS (
    SELECT o.id, o.name
    FROM public.organizations o
    WHERE o.id = org_id_input
  ),
  events AS (
    SELECT
      fue.created_at,
      CASE
        WHEN COALESCE(fue.metadata->>'unlockedSheetsCount', '') ~ '^[0-9]+$'
          THEN (fue.metadata->>'unlockedSheetsCount')::BIGINT
        ELSE 0
      END AS unlocked_sheets
    FROM public.feature_usage_events fue
    WHERE fue.organization_id = org_id_input
      AND fue.feature_key = 'excel_unlocker'
      AND fue.event_key = 'success'
  ),
  aggregated AS (
    SELECT
      COALESCE(SUM(events.unlocked_sheets), 0)::BIGINT AS unlocked_sheets_total,
      COALESCE(
        SUM(events.unlocked_sheets) FILTER (
          WHERE events.created_at >= (current_date - (normalized_days - 1))::TIMESTAMPTZ
        ),
        0
      )::BIGINT AS unlocked_sheets_range,
      COUNT(*)::BIGINT AS unlock_events_total,
      COUNT(*) FILTER (
        WHERE events.created_at >= (current_date - (normalized_days - 1))::TIMESTAMPTZ
      )::BIGINT AS unlock_events_range,
      MAX(events.created_at) AS last_unlock_at
    FROM events
  )
  SELECT
    org.id AS organization_id,
    org.name::TEXT AS organization_name,
    aggregated.unlocked_sheets_total,
    aggregated.unlocked_sheets_range,
    aggregated.unlock_events_total,
    aggregated.unlock_events_range,
    (aggregated.unlocked_sheets_total * normalized_minutes)::BIGINT AS minutes_saved_total,
    (aggregated.unlocked_sheets_range * normalized_minutes)::BIGINT AS minutes_saved_range,
    aggregated.last_unlock_at
  FROM org
  CROSS JOIN aggregated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_org_unlocker_time_savings(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_unlocker_time_savings(UUID, INTEGER, INTEGER) TO service_role;
