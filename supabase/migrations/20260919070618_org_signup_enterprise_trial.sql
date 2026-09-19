-- New personal and business organizations start with a 14-day Enterprise trial
-- counted from organizations.created_at. After that deadline the existing
-- no-subscription wall applies. Paid, overridden and Stripe-billed orgs stay unchanged.

CREATE OR REPLACE FUNCTION public._org_signup_trial_deadline(p_created_at timestamptz)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT p_created_at + interval '14 days';
$$;
REVOKE ALL ON FUNCTION public._org_signup_trial_deadline(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._org_signup_trial_deadline(timestamptz) TO authenticated, service_role;

-- Union of is_public_email_domain and is_free_email_provider so consumer
-- mailboxes never become a shared company tenant with a domain whitelist.
CREATE OR REPLACE FUNCTION public.is_public_email_domain(domain_input text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
  IF domain_input IS NULL OR btrim(domain_input) = '' THEN
    RETURN true;
  END IF;

  RETURN lower(btrim(domain_input)) = ANY(ARRAY[
    'aol.com',
    'atlas.cz',
    'centrum.cz',
    'email.cz',
    'gmail.com',
    'gmx.com',
    'gmx.net',
    'googlemail.com',
    'hotmail.com',
    'hotmail.cz',
    'icloud.com',
    'live.com',
    'mac.com',
    'mail.com',
    'me.com',
    'msn.com',
    'outlook.com',
    'pm.me',
    'post.cz',
    'proton.me',
    'protonmail.com',
    'quick.cz',
    'seznam.cz',
    'seznam.sk',
    'tiscali.cz',
    'volny.cz',
    'yahoo.co.uk',
    'yahoo.com',
    'yahoo.cz',
    'ymail.com',
    'zoho.com'
  ]);
END;
$$;

CREATE OR REPLACE FUNCTION public.is_free_email_provider(email text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  v_domain text;
BEGIN
  IF email IS NULL OR btrim(email) = '' THEN
    RETURN true;
  END IF;

  v_domain := split_part(lower(btrim(email)), '@', 2);
  RETURN public.is_public_email_domain(NULLIF(v_domain, ''));
END;
$$;

-- Shared seat reservation lock for domain-join, invite, approve and activate.
CREATE OR REPLACE FUNCTION public._org_billable_seats_available(target_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_available boolean;
BEGIN
  IF target_org_id IS NULL THEN
    RETURN false;
  END IF;

  PERFORM 1
  FROM public.organizations
  WHERE id = target_org_id
  FOR UPDATE;

  SELECT o.max_seats IS NULL OR COUNT(om.user_id) < o.max_seats
  INTO v_available
  FROM public.organizations o
  LEFT JOIN public.organization_members om
    ON om.organization_id = o.id
   AND om.is_active = true
   AND om.is_billable = true
  WHERE o.id = target_org_id
  GROUP BY o.max_seats;

  RETURN COALESCE(v_available, false);
END;
$$;
REVOKE ALL ON FUNCTION public._org_billable_seats_available(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._org_billable_seats_available(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_or_create_user_organization_internal(
  p_user_id uuid,
  p_email text,
  p_display_name text DEFAULT NULL::text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id uuid;
  v_domain text;
  v_org_name text;
  v_created_at timestamptz;
  v_trial_end timestamptz;
BEGIN
  IF p_user_id IS NULL OR p_email IS NULL OR p_email = '' THEN
    RAISE EXCEPTION 'user_id and email are required';
  END IF;

  v_domain := public.normalize_email_domain(p_email);

  SELECT organization_id INTO v_org_id
  FROM public.organization_members
  WHERE user_id = p_user_id
  LIMIT 1;

  IF v_org_id IS NOT NULL THEN
    RETURN v_org_id;
  END IF;

  v_created_at := now();
  v_trial_end := public._org_signup_trial_deadline(v_created_at);

  IF v_domain IS NULL OR public.is_public_email_domain(v_domain) THEN
    v_org_name := COALESCE(NULLIF(TRIM(p_display_name), ''), split_part(p_email, '@', 1));

    INSERT INTO public.organizations (
      name, type, owner_user_id, subscription_tier, subscription_status,
      created_at, billing_period_start, billing_period_end, expires_at
    ) VALUES (
      v_org_name, 'personal', p_user_id, 'enterprise', 'trial',
      v_created_at, v_created_at, v_trial_end, v_trial_end
    )
    RETURNING id INTO v_org_id;

    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (v_org_id, p_user_id, 'owner')
    ON CONFLICT (organization_id, user_id) DO NOTHING;

    RETURN v_org_id;
  END IF;

  SELECT id INTO v_org_id
  FROM public.organizations
  WHERE v_domain = ANY (domain_whitelist)
  ORDER BY id
  LIMIT 1
  FOR UPDATE;

  IF v_org_id IS NOT NULL THEN
    IF public._org_billable_seats_available(v_org_id) THEN
      INSERT INTO public.organization_members (organization_id, user_id, role)
      VALUES (v_org_id, p_user_id, 'member')
      ON CONFLICT (organization_id, user_id) DO NOTHING;

      -- Signup still seeds a personal Pro trial on user_profiles. Joining an
      -- existing organization inherits that org's entitlement, including the wall.
      -- Authenticated recovery cannot write protected profile columns; the
      -- resolver already ignores personal trials for org members.
      IF auth.role() IS DISTINCT FROM 'authenticated' OR auth.uid() IS NULL THEN
        UPDATE public.user_profiles
        SET
          subscription_status = 'expired',
          trial_ends_at = LEAST(COALESCE(trial_ends_at, now()), now() - interval '1 second'),
          updated_at = now()
        WHERE user_id = p_user_id
          AND subscription_status = 'trial'
          AND subscription_tier_override IS NULL;
      END IF;

      RETURN v_org_id;
    END IF;

    -- Seat limit reached: do not exceed licensed seats and do not clone the
    -- company tenant. The user gets a personal 14-day trial instead.
    v_org_name := COALESCE(NULLIF(TRIM(p_display_name), ''), split_part(p_email, '@', 1));

    INSERT INTO public.organizations (
      name, type, owner_user_id, subscription_tier, subscription_status,
      created_at, billing_period_start, billing_period_end, expires_at
    ) VALUES (
      v_org_name, 'personal', p_user_id, 'enterprise', 'trial',
      v_created_at, v_created_at, v_trial_end, v_trial_end
    )
    RETURNING id INTO v_org_id;

    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (v_org_id, p_user_id, 'owner')
    ON CONFLICT (organization_id, user_id) DO NOTHING;

    RETURN v_org_id;
  END IF;

  v_org_name := initcap(split_part(v_domain, '.', 1));

  INSERT INTO public.organizations (
    name, type, domain_whitelist, owner_user_id, subscription_tier, subscription_status,
    created_at, billing_period_start, billing_period_end, expires_at
  ) VALUES (
    v_org_name, 'business', ARRAY[v_domain], p_user_id, 'enterprise', 'trial',
    v_created_at, v_created_at, v_trial_end, v_trial_end
  )
  RETURNING id INTO v_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (v_org_id, p_user_id, 'owner')
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN v_org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_user_organization_internal(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_user_organization_internal(uuid, text, text) TO service_role;

-- Recent unused signups still inside created_at + 14 days get the remaining trial.
-- Paid, overridden and Stripe-billed organizations are left untouched.
UPDATE public.organizations o
SET
  subscription_tier = 'enterprise',
  subscription_status = 'trial',
  billing_period_start = COALESCE(o.billing_period_start, o.created_at),
  billing_period_end = public._org_signup_trial_deadline(o.created_at),
  expires_at = public._org_signup_trial_deadline(o.created_at)
WHERE o.subscription_tier = 'free'
  AND o.subscription_status = 'expired'
  AND o.override_tier IS NULL
  AND (o.billing_customer_id IS NULL OR o.billing_customer_id = '')
  AND public._org_signup_trial_deadline(o.created_at) > now()
  AND (
    o.max_seats IS NULL
    OR (
      SELECT COUNT(*)
      FROM public.organization_members om
      WHERE om.organization_id = o.id
        AND om.is_active = true
        AND om.is_billable = true
    ) <= o.max_seats
  );

CREATE OR REPLACE FUNCTION public.get_effective_user_tier(target_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  result_tier text;
  result_source text;
  result_end timestamptz;
  result_status text;
BEGIN
  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object('tier', 'free', 'source', 'default', 'status', 'expired');
  END IF;
  IF public.is_platform_admin(target_user_id) THEN
    RETURN jsonb_build_object('tier', 'admin', 'source', 'platform_admin', 'status', 'active');
  END IF;

  SELECT e.tier, e.source, e.valid_until, e.status INTO result_tier, result_source, result_end, result_status
  FROM (
    SELECT
      CASE WHEN o.override_tier IS NOT NULL AND (o.override_expires_at IS NULL OR o.override_expires_at > now())
        THEN o.override_tier ELSE o.subscription_tier END AS tier,
      CASE WHEN o.override_tier IS NOT NULL AND (o.override_expires_at IS NULL OR o.override_expires_at > now())
        THEN 'org_override' ELSE 'org_subscription' END AS source,
      CASE WHEN o.override_tier IS NOT NULL AND (o.override_expires_at IS NULL OR o.override_expires_at > now())
        THEN o.override_expires_at ELSE o.access_end END AS valid_until,
      CASE WHEN o.override_tier IS NOT NULL AND (o.override_expires_at IS NULL OR o.override_expires_at > now())
        THEN 'active' ELSE o.subscription_status END AS status
    FROM (SELECT org.*, CASE WHEN left(org.billing_customer_id, 4) = 'cus_' THEN org.expires_at
      ELSE COALESCE(org.billing_period_end, org.expires_at) END AS access_end
      FROM public.organizations org) o
    JOIN public.organization_members om ON om.organization_id = o.id
    WHERE om.user_id = target_user_id AND om.is_active = true
      AND (
        o.type IS DISTINCT FROM 'personal'
        OR o.subscription_status IS DISTINCT FROM 'trial'
        OR (
          o.override_tier IS NOT NULL
          AND (o.override_expires_at IS NULL OR o.override_expires_at > now())
        )
        OR NOT EXISTS (
          SELECT 1
          FROM public.organization_members bm
          JOIN public.organizations bo ON bo.id = bm.organization_id
          WHERE bm.user_id = target_user_id
            AND bm.is_active = true
            AND bo.type = 'business'
        )
      )
      AND (
        (o.override_tier IS NOT NULL AND (o.override_expires_at IS NULL OR o.override_expires_at > now()))
        OR (o.subscription_status = 'active' AND (o.access_end IS NULL OR o.access_end > now()))
        OR (o.subscription_status IN ('trial', 'cancelled', 'canceled', 'pending', 'past_due') AND o.access_end > now())
      )
  ) e
  WHERE e.tier IN ('starter', 'pro', 'enterprise')
  ORDER BY public._tier_rank(e.tier) DESC, e.valid_until DESC NULLS FIRST
  LIMIT 1;

  IF result_tier IS NOT NULL THEN
    RETURN jsonb_build_object('tier', result_tier, 'source', result_source, 'validUntil', result_end, 'status', result_status);
  END IF;

  SELECT COALESCE(up.subscription_tier_override, up.stripe_subscription_tier),
    CASE WHEN up.subscription_status = 'trial' THEN least(up.trial_ends_at, up.subscription_expires_at)
      ELSE up.subscription_expires_at END,
    up.subscription_status
  INTO result_tier, result_end, result_status
  FROM public.user_profiles up
  WHERE up.user_id = target_user_id
    AND (
      (up.subscription_status = 'active' AND (up.subscription_expires_at IS NULL OR up.subscription_expires_at > now()))
      OR (
        up.subscription_status = 'trial'
        AND up.trial_ends_at > now()
        AND (up.subscription_expires_at IS NULL OR up.subscription_expires_at > now())
        AND NOT EXISTS (
          SELECT 1
          FROM public.organization_members om
          JOIN public.organizations o ON o.id = om.organization_id
          WHERE om.user_id = target_user_id
            AND om.is_active = true
            AND o.type = 'business'
        )
      )
      OR (up.subscription_status IN ('cancelled', 'canceled') AND up.subscription_expires_at > now())
    );
  IF result_tier IN ('starter', 'pro', 'enterprise') THEN
    RETURN jsonb_build_object('tier', result_tier, 'source', 'user_legacy', 'validUntil', result_end, 'status', result_status);
  END IF;
  RETURN jsonb_build_object('tier', 'free', 'source', 'default', 'status', 'expired');
END;
$$;

-- Profile insert runs after org bootstrap. Do not seed a parallel Pro trial
-- when the user already joined a business organization.
CREATE OR REPLACE FUNCTION public.handle_new_user_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.subscription_tier_override IS NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.organization_members om
      JOIN public.organizations o ON o.id = om.organization_id
      WHERE om.user_id = NEW.user_id
        AND om.is_active = true
        AND o.type = 'business'
    ) THEN
      NEW.subscription_status := 'expired';
      NEW.subscription_tier_override := NULL;
      NEW.trial_ends_at := now() - interval '1 second';
    ELSE
      NEW.subscription_status := 'trial';
      NEW.subscription_tier_override := NULL;
      NEW.stripe_subscription_tier := 'pro';
      NEW.trial_ends_at := now() + interval '14 days';
      NEW.subscription_started_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.org_owner_update_seats(
  target_org_id uuid,
  new_max_seats integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role text;
  v_status text;
  v_billable integer;
BEGIN
  SELECT om.role, o.subscription_status
  INTO v_role, v_status
  FROM public.organization_members om
  JOIN public.organizations o ON o.id = om.organization_id
  WHERE om.organization_id = target_org_id
    AND om.user_id = auth.uid()
    AND om.is_active = true
  FOR UPDATE OF o;

  IF v_role IS NULL OR v_role <> 'owner' THEN
    RAISE EXCEPTION 'Only the organization owner can update seats';
  END IF;

  IF v_status = 'trial' THEN
    RAISE EXCEPTION 'Trial organizations cannot change the seat limit';
  END IF;

  IF new_max_seats IS NULL OR new_max_seats < 1 THEN
    RAISE EXCEPTION 'Minimum seat count is 1';
  END IF;

  SELECT COUNT(*) INTO v_billable
  FROM public.organization_members
  WHERE organization_id = target_org_id
    AND is_billable = true
    AND is_active = true;

  IF new_max_seats < v_billable THEN
    RAISE EXCEPTION 'Cannot reduce seats below current billable members (%)', v_billable;
  END IF;

  UPDATE public.organizations
  SET max_seats = new_max_seats
  WHERE id = target_org_id;
END;
$$;
REVOKE ALL ON FUNCTION public.org_owner_update_seats(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_owner_update_seats(uuid, integer) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
