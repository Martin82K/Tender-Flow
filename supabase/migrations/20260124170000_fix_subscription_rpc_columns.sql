-- Migration: Fix cancel and reactivate subscription functions
-- Purpose: Fix 'column "id" does not exist' error by using 'user_id' instead of 'id'
-- Date: 2026-01-24

-- 1. Fix cancel_subscription
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

  -- FIXED: user_profiles uses 'user_id' not 'id'
  UPDATE public.user_profiles
  SET 
    subscription_cancel_at_period_end = true,
    subscription_status = 'cancelled',
    updated_at = NOW()
  WHERE user_id = v_user_id
    AND subscription_status IN ('active', 'trial');

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Subscription will be cancelled at the end of the billing period'
  );
END;
$$;

-- 2. Fix reactivate_subscription
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

  -- Check if subscription is still valid (not yet expired)
  -- FIXED: user_profiles uses 'user_id' not 'id'
  SELECT subscription_expires_at INTO v_expires_at
  FROM public.user_profiles
  WHERE user_id = v_user_id;

  IF v_expires_at IS NOT NULL AND v_expires_at < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Subscription has already expired');
  END IF;

  -- FIXED: user_profiles uses 'user_id' not 'id'
  UPDATE public.user_profiles
  SET 
    subscription_cancel_at_period_end = false,
    subscription_status = 'active',
    updated_at = NOW()
  WHERE user_id = v_user_id
    AND subscription_status = 'cancelled';

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Subscription reactivated'
  );
END;
$$;
