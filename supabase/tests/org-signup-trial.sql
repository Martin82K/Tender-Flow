-- Run only against an isolated schema copy; all identities below are synthetic.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';
-- Inject a transient provisioning failure; confirmation must roll back and retry.
CREATE FUNCTION pg_temp.reject_trial_fixture() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('test.provisioning_fail', true) = 'on' THEN
    RAISE EXCEPTION 'synthetic transient provisioning failure';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER reject_trial_fixture BEFORE INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION pg_temp.reject_trial_fixture();
DO $$
DECLARE fixture uuid := gen_random_uuid(); rejected boolean := false;
BEGIN
  INSERT INTO auth.users(id,email) VALUES(fixture,'retry-'||fixture||'@gmail.com');
  PERFORM set_config('test.provisioning_fail','on',true);
  BEGIN
    UPDATE auth.users SET email_confirmed_at=now() WHERE id=fixture;
  EXCEPTION WHEN OTHERS THEN rejected := true;
  END;
  PERFORM set_config('test.provisioning_fail','off',true);
  IF NOT rejected OR EXISTS(SELECT 1 FROM auth.users WHERE id=fixture AND email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Failed provisioning must roll back confirmation for a retry';
  END IF;
  UPDATE auth.users SET email_confirmed_at=now() WHERE id=fixture;
  IF NOT EXISTS(SELECT 1 FROM public.organization_members WHERE user_id=fixture) THEN
    RAISE EXCEPTION 'Retry must provision the confirmed account';
  END IF;
END $$;
DO $$
DECLARE
  u uuid := gen_random_uuid();
  u2 uuid := gen_random_uuid();
  org_id uuid;
  personal_org_id uuid;
  test_email text;
  trial_end timestamptz;
  created timestamptz;
  effective jsonb;
  member_count integer;
  seat_denied boolean := false;
BEGIN
  IF has_function_privilege('anon', 'public._org_billable_seats_available(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.org_owner_update_seats(uuid,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous callers must not reserve or update organization seats';
  END IF;
  -- Exercise the actual signup hooks, including org-before-profile ordering.
  INSERT INTO auth.users(id,email) VALUES
    (u, 'signup-' || u || '@fixture.invalid'),
    (u2, 'signup-' || u2 || '@gmail.com');
  IF EXISTS (SELECT 1 FROM public.organization_members WHERE user_id IN (u,u2))
     OR EXISTS (SELECT 1 FROM public.organizations WHERE owner_user_id IN (u,u2)) THEN
    RAISE EXCEPTION 'Unverified signup must not own a domain or reserve seats';
  END IF;
  IF public.get_or_create_user_organization_internal(u, 'signup-' || u || '@fixture.invalid', 'Recovery') IS NOT NULL THEN
    RAISE EXCEPTION 'Recovery must not provision an unverified account';
  END IF;
  UPDATE auth.users SET email_confirmed_at=now() WHERE id IN (u,u2);
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id=u AND subscription_status='expired') THEN
    RAISE EXCEPTION 'Business signup must not seed a parallel profile trial';
  END IF;

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

  -- Domain join must inherit an expired organization's wall, not the personal signup trial.
  DELETE FROM public.organization_members WHERE user_id = u;
  UPDATE public.user_profiles
  SET subscription_tier_override = NULL,
      stripe_subscription_tier = 'pro',
      subscription_status = 'trial',
      trial_ends_at = now() + interval '14 days',
      subscription_expires_at = NULL
  WHERE user_id = u;

  INSERT INTO public.organizations (
    name, type, domain_whitelist, owner_user_id, subscription_tier, subscription_status,
    billing_period_end, expires_at
  ) VALUES (
    'Expired domain fixture',
    'business',
    ARRAY['expired-join-' || u || '.invalid'],
    u,
    'enterprise',
    'expired',
    now() - interval '1 day',
    now() - interval '1 day'
  )
  RETURNING id INTO org_id;

  IF public.get_or_create_user_organization_internal(
    u,
    'member@expired-join-' || u || '.invalid',
    'Domain join fixture'
  ) IS DISTINCT FROM org_id THEN
    RAISE EXCEPTION 'Domain join must attach the existing organization';
  END IF;

  IF public.get_user_subscription_tier(u) IS DISTINCT FROM 'free'
     OR public.get_effective_user_tier(u)->>'tier' IS DISTINCT FROM 'free' THEN
    RAISE EXCEPTION 'Personal signup trial must not reopen an expired organization';
  END IF;

  DELETE FROM public.organization_members WHERE user_id IN (u, u2);
  UPDATE public.organizations
  SET max_seats = 1,
      domain_whitelist = ARRAY['seat-limit-' || u || '.invalid'],
      subscription_tier = 'enterprise',
      subscription_status = 'trial',
      billing_period_end = now() + interval '14 days',
      expires_at = now() + interval '14 days'
  WHERE id = org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role, is_billable, is_active)
  VALUES (org_id, u2, 'owner', true, true)
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET is_billable = true, is_active = true, role = 'owner';

  personal_org_id := public.get_or_create_user_organization_internal(
    u,
    'second@seat-limit-' || u || '.invalid',
    'Seat limit fixture'
  );

  IF personal_org_id = org_id THEN
    RAISE EXCEPTION 'Domain join must not exceed the organization seat limit';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id AND user_id = u
  ) THEN
    RAISE EXCEPTION 'Seat-limited domain join must not insert company membership';
  END IF;

  SELECT COUNT(*) INTO STRICT member_count
  FROM public.organization_members
  WHERE organization_id = org_id AND is_active = true AND is_billable = true;

  IF member_count <> 1 THEN
    RAISE EXCEPTION 'Company seat occupancy must stay at 1, got %', member_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = personal_org_id
      AND type = 'personal'
      AND subscription_tier = 'enterprise'
      AND subscription_status = 'trial'
  ) THEN
    RAISE EXCEPTION 'User over the seat limit must receive a personal trial organization';
  END IF;

  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', u2, 'role', 'authenticated')::text,
    true
  );
  BEGIN
    PERFORM public.org_owner_update_seats(org_id, 9);
  EXCEPTION WHEN OTHERS THEN
    seat_denied := SQLERRM LIKE 'Trial organizations cannot change the seat limit%';
  END;
  IF NOT seat_denied THEN
    RAISE EXCEPTION 'Trial owners must not raise the seat limit';
  END IF;
  PERFORM set_config('request.jwt.claims', '{}', true);

  UPDATE public.organizations
  SET subscription_status = 'expired',
      billing_period_end = now() - interval '1 day',
      expires_at = now() - interval '1 day',
      max_seats = 5
  WHERE id = org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role, is_billable, is_active)
  VALUES (org_id, u, 'member', true, true)
  ON CONFLICT (organization_id, user_id) DO UPDATE
    SET is_billable = true, is_active = true;

  IF public.get_user_subscription_tier(u) IS DISTINCT FROM 'free'
     OR public.get_effective_user_tier(u)->>'tier' IS DISTINCT FROM 'free' THEN
    RAISE EXCEPTION 'Personal organization trial must not unlock an expired company tenant';
  END IF;

  UPDATE public.organizations
  SET subscription_tier = 'enterprise',
      subscription_status = 'active',
      billing_period_end = now() + interval '30 days',
      expires_at = now() + interval '30 days',
      override_tier = NULL
  WHERE id = personal_org_id;

  IF public.get_user_subscription_tier(u) IS DISTINCT FROM 'enterprise' THEN
    RAISE EXCEPTION 'Paid personal organization must remain available after joining a company';
  END IF;

  UPDATE public.organizations
  SET subscription_status = 'trial',
      billing_period_end = now() + interval '14 days',
      expires_at = now() + interval '14 days'
  WHERE id = personal_org_id;

  DELETE FROM public.organization_members
  WHERE user_id = u AND organization_id = org_id;

  UPDATE public.organizations
  SET subscription_status = 'expired',
      billing_period_end = now() - interval '1 day',
      expires_at = now() - interval '1 day'
  WHERE id = personal_org_id;

  UPDATE public.user_profiles
  SET subscription_tier_override = NULL,
      stripe_subscription_tier = 'pro',
      subscription_status = 'trial',
      trial_ends_at = now() + interval '7 days',
      subscription_expires_at = NULL
  WHERE user_id = u;

  IF public.get_user_subscription_tier(u) IS DISTINCT FROM 'pro' THEN
    RAISE EXCEPTION 'Manual personal trial must remain available without a business membership';
  END IF;

  -- Null must never turn a paid organization's finite limit into unlimited seats.
  UPDATE public.organizations SET subscription_status='active' WHERE id=org_id;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub',u2,'role','authenticated')::text,true);
  seat_denied := false;
  BEGIN
    PERFORM public.org_owner_update_seats(org_id, NULL);
  EXCEPTION WHEN OTHERS THEN
    seat_denied := SQLERRM LIKE 'Minimum seat count is 1%';
  END;
  IF NOT seat_denied THEN RAISE EXCEPTION 'Null seat limit must be rejected'; END IF;
  PERFORM set_config('request.jwt.claims','{}',true);

  FOREACH test_email IN ARRAY ARRAY[
    'signup@seznam.sk',
    'signup@aol.com',
    'signup@post.cz',
    'signup@pm.me',
    'signup@gmx.com',
    'signup@mail.com',
    'signup@ymail.com'
  ]
  LOOP
    DELETE FROM public.organization_members WHERE user_id = u;
    personal_org_id := public.get_or_create_user_organization_internal(
      u,
      test_email,
      'Public domain fixture'
    );

    IF NOT EXISTS (
      SELECT 1 FROM public.organizations
      WHERE id = personal_org_id
        AND type = 'personal'
        AND (
          domain_whitelist IS NULL
          OR NOT (public.normalize_email_domain(test_email) = ANY (domain_whitelist))
        )
    ) THEN
      RAISE EXCEPTION 'Public email domain % must create a personal organization without a company whitelist', test_email;
    END IF;
  END LOOP;
END;
$$;
ROLLBACK;
SELECT 'passed; signup trial fixtures rolled back' AS regression_result;
