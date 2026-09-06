-- Stripe owns its stored expiry; stale manual dates cannot shorten or extend it.
-- Pending preserves only a dated period. The webhook clears incomplete payments
-- and retains (never extends) the previous period for past_due retries.
-- No Free account: 'free' remains only a backwards-compatible no-access sentinel.
-- Resolve both RPC generations from the same, read-only entitlement rules.
CREATE OR REPLACE FUNCTION public.get_effective_user_tier(target_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  result_tier text;
  result_source text;
  result_end timestamptz;
BEGIN
  IF target_user_id IS NULL THEN
    RETURN jsonb_build_object('tier', 'free', 'source', 'default');
  END IF;
  IF public.is_platform_admin(target_user_id) THEN
    RETURN jsonb_build_object('tier', 'admin', 'source', 'platform_admin');
  END IF;

  SELECT e.tier, e.source, e.valid_until INTO result_tier, result_source, result_end
  FROM (
    SELECT
      CASE WHEN o.override_tier IS NOT NULL AND (o.override_expires_at IS NULL OR o.override_expires_at > now())
        THEN o.override_tier ELSE o.subscription_tier END AS tier,
      CASE WHEN o.override_tier IS NOT NULL AND (o.override_expires_at IS NULL OR o.override_expires_at > now())
        THEN 'org_override' ELSE 'org_subscription' END AS source,
      CASE WHEN o.override_tier IS NOT NULL AND (o.override_expires_at IS NULL OR o.override_expires_at > now())
        THEN o.override_expires_at ELSE o.access_end END AS valid_until
    FROM (SELECT org.*, CASE WHEN left(org.billing_customer_id, 4) = 'cus_' THEN org.expires_at
      ELSE COALESCE(org.billing_period_end, org.expires_at) END AS access_end
      FROM public.organizations org) o
    JOIN public.organization_members om ON om.organization_id = o.id
    WHERE om.user_id = target_user_id AND om.is_active = true
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
    RETURN jsonb_build_object('tier', result_tier, 'source', result_source, 'validUntil', result_end);
  END IF;

  -- Legacy personal subscriptions remain valid only for their actual paid/trial period.
  -- Never fall back to an unchecked organization's tier (the old v1 RPC did so).
  SELECT COALESCE(up.subscription_tier_override, up.stripe_subscription_tier),
    CASE WHEN up.subscription_status = 'trial' THEN least(up.trial_ends_at, up.subscription_expires_at)
      ELSE up.subscription_expires_at END
  INTO result_tier, result_end
  FROM public.user_profiles up
  WHERE up.user_id = target_user_id
    AND (
      (up.subscription_status = 'active' AND (up.subscription_expires_at IS NULL OR up.subscription_expires_at > now()))
      OR (up.subscription_status = 'trial' AND up.trial_ends_at > now() AND (up.subscription_expires_at IS NULL OR up.subscription_expires_at > now()))
      OR (up.subscription_status IN ('cancelled', 'canceled') AND up.subscription_expires_at > now())
    );
  IF result_tier IN ('starter', 'pro', 'enterprise') THEN
    RETURN jsonb_build_object('tier', result_tier, 'source', 'user_legacy', 'validUntil', result_end);
  END IF;
  RETURN jsonb_build_object('tier', 'free', 'source', 'default');
END;
$$;

NOTIFY pgrst, 'reload schema';
