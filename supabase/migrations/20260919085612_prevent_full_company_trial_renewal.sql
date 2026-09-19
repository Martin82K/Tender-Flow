-- Existing full company domains must not mint new trials for additional addresses.
-- Existing entitlements are preserved; only future seat-limited fallbacks change.

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

  -- Unverified signups must not claim a company domain or reserve a seat.
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = p_user_id AND email_confirmed_at IS NOT NULL
  ) THEN
    RETURN NULL;
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

  -- A missing row cannot be locked with FOR UPDATE. Serialize the first
  -- company creation and all subsequent joins by normalized domain.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('tenderflow.org-domain:' || v_domain, 0));

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

      -- Legacy profiles can still carry a personal Pro trial. Joining an
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
    -- company tenant or mint another trial. Keep a personal workspace behind the licence wall.
    v_org_name := COALESCE(NULLIF(TRIM(p_display_name), ''), split_part(p_email, '@', 1));

    INSERT INTO public.organizations (
      name, type, owner_user_id, subscription_tier, subscription_status,
      created_at, billing_period_start, billing_period_end, expires_at
    ) VALUES (
      v_org_name, 'personal', p_user_id, 'free', 'expired',
      v_created_at, v_created_at, v_created_at, v_created_at
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

