-- Follow-up to the already deployed signup trial migration.
-- No backfill or entitlement changes: serialize company creation and scope reads.

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

CREATE OR REPLACE FUNCTION public.get_effective_user_tier(target_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  result_tier text;
  result_source text;
  result_end timestamptz;
  result_status text;
BEGIN
  -- PostgREST callers may inspect themselves; platform admins and trusted
  -- server/database roles retain cross-user operational access.
  IF (
    auth.role() = 'service_role'
    OR (auth.role() IS NULL AND current_setting('role', true) IN ('none', 'postgres', 'supabase_admin', 'service_role'))
    OR (auth.uid() IS NOT NULL AND (target_user_id = auth.uid() OR public.is_platform_admin(auth.uid())))
  ) IS NOT TRUE THEN
    RAISE EXCEPTION 'Not authorized to inspect this subscription' USING ERRCODE = '42501';
  END IF;
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

REVOKE ALL ON FUNCTION public.get_effective_user_tier(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_effective_user_tier(uuid) TO authenticated, service_role, tenderflow_mcp_client;
-- Only SECURITY DEFINER membership operations reserve seats; clients never call this helper.
REVOKE ALL ON FUNCTION public._org_billable_seats_available(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._org_billable_seats_available(uuid) TO service_role;
