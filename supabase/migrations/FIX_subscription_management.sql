-- Fix script: Run this in Supabase Dashboard SQL Editor
-- This fixes the remaining parts of the subscription_management migration

-- Drop existing function first to avoid parameter default conflicts
DROP FUNCTION IF EXISTS public.get_user_subscription_tier(UUID);

CREATE OR REPLACE FUNCTION public.get_user_subscription_tier(target_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_tier TEXT;
  v_expires_at TIMESTAMPTZ;
  v_status TEXT;
  v_trial_ends_at TIMESTAMPTZ;
BEGIN
  -- Get user's subscription info
  SELECT 
    COALESCE(subscription_tier, 'free'),
    subscription_expires_at,
    subscription_status,
    trial_ends_at
  INTO v_tier, v_expires_at, v_status, v_trial_ends_at
  FROM public.user_profiles
  WHERE id = target_user_id;

  -- If no user found, return free
  IF v_tier IS NULL THEN
    RETURN 'free';
  END IF;

  -- Admin tier never expires
  IF v_tier = 'admin' THEN
    RETURN 'admin';
  END IF;

  -- Check if subscription is expired
  IF v_status = 'expired' THEN
    RETURN 'free';
  END IF;

  -- Check if trial has ended
  IF v_status = 'trial' AND v_trial_ends_at IS NOT NULL AND v_trial_ends_at < NOW() THEN
    UPDATE public.user_profiles
    SET subscription_status = 'expired'
    WHERE id = target_user_id AND subscription_status = 'trial';
    RETURN 'free';
  END IF;

  -- Check if paid subscription has expired
  IF v_expires_at IS NOT NULL AND v_expires_at < NOW() THEN
    UPDATE public.user_profiles
    SET subscription_status = 'expired'
    WHERE id = target_user_id AND subscription_status IN ('active', 'cancelled');
    RETURN 'free';
  END IF;

  RETURN v_tier;
END;
$$;

-- RPC: Get current user's full subscription status
CREATE OR REPLACE FUNCTION public.get_user_subscription_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_user_id UUID;
  v_result JSONB;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT jsonb_build_object(
    'tier', COALESCE(subscription_tier, 'free'),
    'effectiveTier', public.get_user_subscription_tier(v_user_id),
    'status', COALESCE(subscription_status, 'active'),
    'expiresAt', subscription_expires_at,
    'startedAt', subscription_started_at,
    'trialEndsAt', trial_ends_at,
    'cancelAtPeriodEnd', COALESCE(subscription_cancel_at_period_end, false),
    'billingCustomerId', billing_customer_id,
    'billingProvider', billing_provider,
    'daysRemaining', 
      CASE 
        WHEN subscription_expires_at IS NOT NULL THEN
          GREATEST(0, EXTRACT(DAY FROM subscription_expires_at - NOW())::INTEGER)
        WHEN trial_ends_at IS NOT NULL AND subscription_status = 'trial' THEN
          GREATEST(0, EXTRACT(DAY FROM trial_ends_at - NOW())::INTEGER)
        ELSE NULL
      END
  )
  INTO v_result
  FROM public.user_profiles
  WHERE id = v_user_id;

  RETURN COALESCE(v_result, jsonb_build_object('tier', 'free', 'status', 'active'));
END;
$$;

-- RPC: Cancel subscription
CREATE OR REPLACE FUNCTION public.cancel_subscription()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  UPDATE public.user_profiles
  SET 
    subscription_cancel_at_period_end = true,
    subscription_status = 'cancelled',
    updated_at = NOW()
  WHERE id = v_user_id
    AND subscription_status IN ('active', 'trial');

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Subscription will be cancelled at the end of the billing period'
  );
END;
$$;

-- RPC: Reactivate cancelled subscription
CREATE OR REPLACE FUNCTION public.reactivate_subscription()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT subscription_expires_at INTO v_expires_at
  FROM public.user_profiles
  WHERE id = v_user_id;

  IF v_expires_at IS NOT NULL AND v_expires_at < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Subscription has already expired');
  END IF;

  UPDATE public.user_profiles
  SET 
    subscription_cancel_at_period_end = false,
    subscription_status = 'active',
    updated_at = NOW()
  WHERE id = v_user_id
    AND subscription_status = 'cancelled';

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Subscription reactivated'
  );
END;
$$;

-- RPC: Request tier upgrade
CREATE OR REPLACE FUNCTION public.request_tier_upgrade(requested_tier TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_current_tier TEXT;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF requested_tier NOT IN ('free', 'pro', 'enterprise') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid tier');
  END IF;

  SELECT subscription_tier INTO v_current_tier
  FROM public.user_profiles
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Upgrade request received',
    'currentTier', v_current_tier,
    'requestedTier', requested_tier,
    'action', 'pending_payment'
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_user_subscription_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_subscription() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_subscription() TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_tier_upgrade(TEXT) TO authenticated;

-- Done! All RPC functions created successfully.
SELECT 'Migration fix complete!' as status;
