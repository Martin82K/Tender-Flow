-- Run with an administrative database connection. All fixture updates roll back.
-- No identifiers, credentials or customer data are emitted.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';
DO $$
DECLARE u uuid; actual text; deny_seen boolean := false;
BEGIN
  SELECT up.user_id INTO STRICT u FROM public.user_profiles up
  WHERE NOT public.is_platform_admin(up.user_id)
    AND EXISTS (SELECT 1 FROM public.organization_members om WHERE om.user_id=up.user_id AND om.is_active)
  ORDER BY up.user_id LIMIT 1;
  UPDATE public.user_profiles SET subscription_tier_override = NULL, stripe_subscription_tier = NULL,
    subscription_status = 'expired', subscription_expires_at = now() - interval '1 day', trial_ends_at = now() - interval '1 day'
    WHERE user_id=u;
  UPDATE public.organizations SET subscription_tier='enterprise', override_tier = NULL, subscription_status = 'expired',
    billing_period_end = now() - interval '1 day', expires_at = now() - interval '1 day'
    WHERE id IN (SELECT organization_id FROM public.organization_members WHERE user_id=u);
  IF public.get_effective_user_tier(u)->>'tier' IS DISTINCT FROM 'free' OR public.get_user_subscription_tier(u) IS DISTINCT FROM 'free' THEN
    RAISE EXCEPTION 'Expired subscriptions must not fall back to an unchecked organization';
  END IF;

  -- Feature flags and individual feature grants cannot resurrect an unpaid account.
  UPDATE public.subscription_tier_features SET enabled=true WHERE tier='free';
  INSERT INTO public.user_feature_overrides(user_id, feature_key, expires_at) VALUES(u,'module_projects',NULL)
    ON CONFLICT(user_id,feature_key) DO UPDATE SET expires_at=NULL;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub',u,'role','authenticated')::text, true);
  IF public.has_active_subscription() OR public.user_has_feature('module_projects') OR public.user_id_has_feature(u,'module_projects') THEN
    RAISE EXCEPTION 'Free flags must never grant application access';
  END IF;
  IF EXISTS(SELECT 1 FROM public.get_user_enabled_features()) OR EXISTS(SELECT 1 FROM public.get_user_enabled_features_v2()) THEN
    RAISE EXCEPTION 'Individual feature overrides require an active subscription';
  END IF;

  PERFORM set_config('request.path','/projects',true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM public.enforce_subscription_boundary();
  EXCEPTION WHEN SQLSTATE 'PT402' THEN deny_seen := true;
  END;
  IF NOT deny_seen THEN RAISE EXCEPTION 'Unpaid REST calls must be denied'; END IF;
  IF EXISTS(SELECT 1 FROM public.projects) OR EXISTS(SELECT 1 FROM storage.objects) THEN
    RAISE EXCEPTION 'RLS must deny unpaid project and storage reads';
  END IF;
  PERFORM set_config('request.path','/rpc/get_effective_user_tier',true);
  PERFORM public.enforce_subscription_boundary(); -- Recovery remains reachable.
  EXECUTE 'SET LOCAL ROLE tenderflow_mcp_client';
  IF public.has_active_subscription() THEN RAISE EXCEPTION 'MCP must not retain unpaid access'; END IF;
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims','{}',true);

  UPDATE public.organizations SET subscription_status='cancelled',billing_period_end=now()+interval '1 day'
    WHERE id IN (SELECT organization_id FROM public.organization_members WHERE user_id=u);
  IF public.get_user_subscription_tier(u) IS DISTINCT FROM 'enterprise' THEN RAISE EXCEPTION 'Paid-through cancellation must retain access'; END IF;
  UPDATE public.organizations SET subscription_status='active',billing_period_end=now()
    WHERE id IN (SELECT organization_id FROM public.organization_members WHERE user_id=u);
  IF public.get_user_subscription_tier(u) IS DISTINCT FROM 'free' THEN RAISE EXCEPTION 'Access expires at the exact deadline'; END IF;
  UPDATE public.organizations SET subscription_status='active',billing_period_end=now()+interval '1 day'
    WHERE id IN (SELECT organization_id FROM public.organization_members WHERE user_id=u);
  UPDATE public.organization_members SET is_active=false WHERE user_id=u;
  IF public.get_user_subscription_tier(u) IS DISTINCT FROM 'free' THEN RAISE EXCEPTION 'Inactive membership must not grant a plan'; END IF;
  UPDATE public.organization_members SET is_active=true WHERE user_id=u;
  UPDATE public.organizations SET subscription_status='expired',billing_period_end=now()-interval '1 day',
    override_tier='pro',override_expires_at=now()+interval '1 day'
    WHERE id IN (SELECT organization_id FROM public.organization_members WHERE user_id=u);
  IF public.get_user_subscription_tier(u) IS DISTINCT FROM 'pro' THEN RAISE EXCEPTION 'Valid manual subscription must retain access'; END IF;
  UPDATE public.organizations SET override_expires_at=now()-interval '1 day'
    WHERE id IN (SELECT organization_id FROM public.organization_members WHERE user_id=u);
  IF public.get_user_subscription_tier(u) IS DISTINCT FROM 'free' THEN RAISE EXCEPTION 'Expired manual subscription must not grant access'; END IF;

  UPDATE public.user_profiles SET stripe_subscription_tier='pro',subscription_status='trial',
    trial_ends_at=now()+interval '1 day',subscription_expires_at=NULL WHERE user_id=u;
  IF public.get_user_subscription_tier(u) IS DISTINCT FROM 'pro' THEN RAISE EXCEPTION 'Valid legacy trial must retain access'; END IF;
  UPDATE public.user_profiles SET trial_ends_at=now()-interval '1 day' WHERE user_id=u;
  IF public.get_user_subscription_tier(u) IS DISTINCT FROM 'free' THEN RAISE EXCEPTION 'Expired legacy trial must not grant access'; END IF;
  UPDATE public.user_profiles SET subscription_status='cancelled',subscription_expires_at=now()+interval '1 day' WHERE user_id=u;
  IF public.get_user_subscription_tier(u) IS DISTINCT FROM 'pro' THEN RAISE EXCEPTION 'Legacy paid-through period must retain access'; END IF;
  UPDATE public.user_profiles SET subscription_expires_at=NULL WHERE user_id=u;
  IF public.get_user_subscription_tier(u) IS DISTINCT FROM 'free' THEN RAISE EXCEPTION 'Cancellation without a paid-through date must not grant access'; END IF;

  IF EXISTS(SELECT 1 FROM public.platform_admins pa WHERE pa.is_active AND public.get_user_subscription_tier(pa.user_id) IS DISTINCT FROM 'admin') THEN
    RAISE EXCEPTION 'Platform administrators must retain recovery access';
  END IF;
END;
$$;
ROLLBACK;
SELECT 'passed; all fixture changes rolled back' AS regression_result;
