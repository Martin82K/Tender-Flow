-- Retire the removed Command Center and its paid subfeatures from the
-- subscription administration catalog. Historical usage and explicit user
-- overrides must be removed first because feature_usage_events has an
-- ON DELETE RESTRICT foreign key and user_feature_overrides has no FK.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DELETE FROM public.feature_usage_events
WHERE feature_key IN (
  'module_command_center',
  'cc_matrix_health',
  'cc_advanced_kpi'
);

DELETE FROM public.user_feature_overrides
WHERE feature_key IN (
  'module_command_center',
  'cc_matrix_health',
  'cc_advanced_kpi'
);

DELETE FROM public.subscription_tier_features
WHERE feature_key IN (
  'module_command_center',
  'cc_matrix_health',
  'cc_advanced_kpi'
);

DELETE FROM public.subscription_features
WHERE key IN (
  'module_command_center',
  'cc_matrix_health',
  'cc_advanced_kpi'
);

UPDATE public.subscription_features
SET description = 'Osobní úkoly, podúkoly, připomínky a kalendář'
WHERE key = 'module_tasks';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.subscription_features
    WHERE key IN (
      'module_command_center',
      'cc_matrix_health',
      'cc_advanced_kpi'
    )
  ) OR EXISTS (
    SELECT 1
    FROM public.subscription_tier_features
    WHERE feature_key IN (
      'module_command_center',
      'cc_matrix_health',
      'cc_advanced_kpi'
    )
  ) OR EXISTS (
    SELECT 1
    FROM public.feature_usage_events
    WHERE feature_key IN (
      'module_command_center',
      'cc_matrix_health',
      'cc_advanced_kpi'
    )
  ) OR EXISTS (
    SELECT 1
    FROM public.user_feature_overrides
    WHERE feature_key IN (
      'module_command_center',
      'cc_matrix_health',
      'cc_advanced_kpi'
    )
  ) THEN
    RAISE EXCEPTION 'Command Center subscription data was not fully removed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.subscription_features
    WHERE key = 'module_tasks'
      AND description = 'Osobní úkoly, podúkoly, připomínky a kalendář'
  ) THEN
    RAISE EXCEPTION 'TODO subscription feature description was not updated';
  END IF;
END;
$$;

COMMIT;
