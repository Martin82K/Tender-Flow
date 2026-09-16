BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';
DO $$
DECLARE
  u uuid;
  org_id uuid;
  test_email text;
  trial_end timestamptz;
  created timestamptz;
  effective jsonb;
BEGIN
  SELECT user_id INTO STRICT u
  FROM public.user_profiles
  WHERE NOT public.is_platform_admin(user_id)
  ORDER BY user_id
  LIMIT 1;

  UPDATE public.user_profiles
  SET subscription_tier_override = NULL,
      stripe_subscription_tier = NULL,
      subscription_status = 'expired',
      trial_ends_at = now() - interval '1 day'
  WHERE user_id = u;

  FOREACH test_email IN ARRAY ARRAY[
    'signup-trial-' || u || '@gmail.com',
    'test@signup-trial-' || u || '.invalid'
  ] LOOP
    DELETE FROM public.organization_members WHERE user_id = u;
    org_id := public.get_or_create_user_organization_internal(u, test_email, 'Trial fixture');

    SELECT created_at, expires_at
    INTO STRICT created, trial_end
    FROM public.organizations
    WHERE id = org_id;

    IF NOT EXISTS (
      SELECT 1 FROM public.organizations
      WHERE id = org_id
        AND subscription_tier = 'enterprise'
        AND subscription_status = 'trial'
        AND expires_at = public._org_signup_trial_deadline(created_at)
        AND billing_period_end = public._org_signup_trial_deadline(created_at)
    ) THEN
      RAISE EXCEPTION 'New organizations must start with a 14-day Enterprise trial from created_at';
    END IF;

    IF public.get_user_subscription_tier(u) IS DISTINCT FROM 'enterprise' THEN
      RAISE EXCEPTION 'Active signup trial must grant Enterprise access';
    END IF;

    effective := public.get_effective_user_tier(u);
    IF effective->>'status' IS DISTINCT FROM 'trial'
       OR (effective->>'validUntil')::timestamptz IS DISTINCT FROM trial_end THEN
      RAISE EXCEPTION 'Effective tier must expose trial status and deadline';
    END IF;

    UPDATE public.organizations
    SET created_at = now() - interval '15 days',
        billing_period_start = now() - interval '15 days',
        billing_period_end = public._org_signup_trial_deadline(now() - interval '15 days'),
        expires_at = public._org_signup_trial_deadline(now() - interval '15 days')
    WHERE id = org_id;

    IF public.get_user_subscription_tier(u) IS DISTINCT FROM 'free'
       OR public.get_effective_user_tier(u)->>'tier' IS DISTINCT FROM 'free' THEN
      RAISE EXCEPTION 'Expired created_at trial must fall back to the no-licence wall';
    END IF;

    UPDATE public.organizations
    SET subscription_tier = 'enterprise',
        subscription_status = 'active',
        billing_period_end = NULL,
        expires_at = NULL
    WHERE id = org_id;

    IF public.get_user_subscription_tier(u) IS DISTINCT FROM 'enterprise' THEN
      RAISE EXCEPTION 'Admin conversion from trial to Enterprise must restore access';
    END IF;
  END LOOP;
END;
$$;
ROLLBACK;
SELECT 'passed; signup trial fixtures rolled back' AS regression_result;
