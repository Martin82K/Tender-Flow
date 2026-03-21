-- Migration: harden_org_join_and_subscription_rpc
-- Date: 2026-03-20
-- Description: Fixes organization join email spoofing and closes unsafe subscription RPC grants.

-- ============================================================================
-- 1. HARDEN ORGANIZATION JOIN REQUESTS
-- ============================================================================

DROP POLICY IF EXISTS "org_join_requests_insert" ON public.organization_join_requests;
CREATE POLICY "org_join_requests_insert"
ON public.organization_join_requests
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND lower(trim(email)) = lower(trim(COALESCE(auth.jwt() ->> 'email', '')))
  AND EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE o.id = organization_id
      AND public.normalize_email_domain(email) = ANY(o.domain_whitelist)
      AND NOT public.is_public_email_domain(public.normalize_email_domain(email))
  )
);

CREATE OR REPLACE FUNCTION public.request_org_join_by_email(email_input TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_auth_email TEXT;
  v_domain TEXT;
  target_org UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT lower(trim(email))
  INTO v_auth_email
  FROM auth.users
  WHERE id = v_user_id;

  IF v_auth_email IS NULL OR v_auth_email = '' THEN
    RAISE EXCEPTION 'Authenticated user email not available';
  END IF;

  IF email_input IS NOT NULL AND lower(trim(email_input)) <> v_auth_email THEN
    RAISE EXCEPTION 'email must match authenticated user';
  END IF;

  v_domain := public.normalize_email_domain(v_auth_email);
  IF v_domain IS NULL OR public.is_public_email_domain(v_domain) THEN
    RAISE EXCEPTION 'Public or invalid domain';
  END IF;

  SELECT id INTO target_org
  FROM public.organizations
  WHERE v_domain = ANY(domain_whitelist)
  LIMIT 1;

  IF target_org IS NULL THEN
    RAISE EXCEPTION 'Organization not found for domain';
  END IF;

  INSERT INTO public.organization_join_requests (organization_id, user_id, email)
  VALUES (target_org, v_user_id, v_auth_email)
  ON CONFLICT (organization_id, user_id) DO UPDATE SET
    email = EXCLUDED.email,
    status = 'pending',
    decided_at = NULL,
    decided_by = NULL;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_org_join_by_email(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.maybe_create_org_join_request(user_id_input UUID, email_input TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  domain TEXT;
  target_org UUID;
  normalized_email TEXT;
BEGIN
  normalized_email := lower(trim(email_input));
  domain := public.normalize_email_domain(normalized_email);
  IF user_id_input IS NULL OR normalized_email IS NULL OR normalized_email = '' THEN
    RETURN;
  END IF;

  IF domain IS NULL OR public.is_public_email_domain(domain) THEN
    RETURN;
  END IF;

  SELECT id INTO target_org
  FROM public.organizations
  WHERE domain = ANY(domain_whitelist)
  LIMIT 1;

  IF target_org IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.organization_join_requests (organization_id, user_id, email)
  VALUES (target_org, user_id_input, normalized_email)
  ON CONFLICT (organization_id, user_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.maybe_create_org_join_request(UUID, TEXT) TO service_role;

-- ============================================================================
-- 2. HARDEN SUBSCRIPTION RPCS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.start_user_trial(
  p_user_id UUID,
  p_plan_id TEXT DEFAULT 'starter',
  p_trial_days INTEGER DEFAULT 14
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.subscription_plans%ROWTYPE;
  v_trial_ends_at TIMESTAMPTZ;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = p_plan_id;

  IF v_plan.id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Plan not found');
  END IF;

  v_trial_ends_at := NOW() + (COALESCE(p_trial_days, v_plan.trial_days, 14) || ' days')::INTERVAL;

  UPDATE public.user_profiles SET
    subscription_status = 'trial',
    subscription_tier_override = v_plan.tier,
    trial_ends_at = v_trial_ends_at,
    subscription_started_at = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO public.subscription_history (user_id, action, new_tier, new_status, notes, created_by)
  VALUES (p_user_id, 'trial_started', v_plan.tier, 'trial', 'Trial started for plan: ' || p_plan_id, auth.uid());

  RETURN jsonb_build_object(
    'success', TRUE,
    'trial_ends_at', v_trial_ends_at,
    'tier', v_plan.tier
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.activate_subscription(
  p_user_id UUID,
  p_plan_id TEXT,
  p_billing_period TEXT DEFAULT 'monthly',
  p_seats INTEGER DEFAULT 1,
  p_stripe_customer_id TEXT DEFAULT NULL,
  p_stripe_subscription_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.subscription_plans%ROWTYPE;
  v_expires_at TIMESTAMPTZ;
  v_previous_tier TEXT;
  v_previous_status TEXT;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = p_plan_id;

  IF v_plan.id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Plan not found');
  END IF;

  IF p_billing_period = 'yearly' THEN
    v_expires_at := NOW() + INTERVAL '1 year';
  ELSE
    v_expires_at := NOW() + INTERVAL '1 month';
  END IF;

  SELECT subscription_tier_override, subscription_status
  INTO v_previous_tier, v_previous_status
  FROM public.user_profiles WHERE user_id = p_user_id;

  UPDATE public.user_profiles SET
    subscription_status = 'active',
    subscription_tier_override = v_plan.tier,
    billing_period = p_billing_period,
    subscription_started_at = COALESCE(subscription_started_at, NOW()),
    subscription_expires_at = v_expires_at,
    next_billing_date = v_expires_at,
    seats_count = p_seats,
    stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
    stripe_subscription_id = COALESCE(p_stripe_subscription_id, stripe_subscription_id),
    trial_ends_at = NULL,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  INSERT INTO public.subscription_history (
    user_id, action,
    previous_tier, new_tier,
    previous_status, new_status,
    new_billing_period, new_seats,
    created_by
  )
  VALUES (
    p_user_id, 'subscription_created',
    v_previous_tier, v_plan.tier,
    v_previous_status, 'active',
    p_billing_period, p_seats,
    auth.uid()
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'expires_at', v_expires_at,
    'tier', v_plan.tier,
    'billing_period', p_billing_period
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.start_user_trial(UUID, TEXT, INTEGER) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.activate_subscription(UUID, TEXT, TEXT, INTEGER, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.start_user_trial(UUID, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.activate_subscription(UUID, TEXT, TEXT, INTEGER, TEXT, TEXT) TO service_role;

-- Self-service subscription controls stay available without arbitrary user_id.
CREATE OR REPLACE FUNCTION public.cancel_subscription()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_current_tier TEXT;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Not authenticated');
  END IF;

  SELECT subscription_expires_at, subscription_tier_override
  INTO v_expires_at, v_current_tier
  FROM public.user_profiles
  WHERE user_id = v_user_id;

  UPDATE public.user_profiles SET
    subscription_cancel_at_period_end = TRUE,
    subscription_status = 'cancelled',
    cancellation_requested_at = NOW(),
    updated_at = NOW()
  WHERE user_id = v_user_id
    AND subscription_status IN ('active', 'trial');

  INSERT INTO public.subscription_history (user_id, action, previous_tier, new_status, notes, created_by)
  VALUES (v_user_id, 'subscription_cancelled', v_current_tier, 'cancelled', 'Self-service cancellation', v_user_id);

  RETURN jsonb_build_object(
    'success', TRUE,
    'access_until', v_expires_at,
    'message', 'Subscription cancelled. Access continues until ' || v_expires_at::DATE
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reactivate_subscription()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_current_status TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Not authenticated');
  END IF;

  SELECT subscription_status, subscription_expires_at
  INTO v_current_status, v_expires_at
  FROM public.user_profiles
  WHERE user_id = v_user_id;

  IF v_current_status != 'cancelled' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Subscription is not cancelled');
  END IF;

  IF v_expires_at < NOW() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Subscription has already expired');
  END IF;

  UPDATE public.user_profiles SET
    subscription_cancel_at_period_end = FALSE,
    subscription_status = 'active',
    cancellation_requested_at = NULL,
    updated_at = NOW()
  WHERE user_id = v_user_id;

  INSERT INTO public.subscription_history (user_id, action, new_status, created_by)
  VALUES (v_user_id, 'subscription_reactivated', 'active', v_user_id);

  RETURN jsonb_build_object('success', TRUE, 'message', 'Subscription reactivated');
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_subscription() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_subscription() TO authenticated;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;
