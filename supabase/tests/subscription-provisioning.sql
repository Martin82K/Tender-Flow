BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';
DO $$
DECLARE u uuid; org_id uuid; test_email text;
BEGIN
  SELECT user_id INTO STRICT u FROM public.user_profiles WHERE NOT public.is_platform_admin(user_id) ORDER BY user_id LIMIT 1;
  UPDATE public.user_profiles SET subscription_tier_override=NULL,stripe_subscription_tier=NULL,
    subscription_status='expired',trial_ends_at=now()-interval '1 day' WHERE user_id=u;
  FOREACH test_email IN ARRAY ARRAY['subscription-test-'||u||'@gmail.com','test@subscription-'||u||'.invalid'] LOOP
    DELETE FROM public.organization_members WHERE user_id=u;
    org_id := public.get_or_create_user_organization_internal(u,test_email,'Subscription regression fixture');
    IF NOT EXISTS(SELECT 1 FROM public.organizations WHERE id=org_id AND subscription_tier='enterprise' AND subscription_status='trial') THEN
      RAISE EXCEPTION 'New organizations must start with a 14-day Enterprise trial';
    END IF;
    IF public.get_user_subscription_tier(u) IS DISTINCT FROM 'enterprise' THEN
      RAISE EXCEPTION 'Provisioning must grant trial application access';
    END IF;
  END LOOP;
END;
$$;
ROLLBACK;
SELECT 'passed; personal/business provisioning fixtures rolled back' AS regression_result;
