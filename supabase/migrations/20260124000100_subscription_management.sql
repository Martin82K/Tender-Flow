-- Migration: Subscription Management System
-- Purpose: Add time-based subscription lifecycle, trial periods, and billing preparation
-- Date: 2026-01-24

-- ============================================================================
-- 1) Add subscription lifecycle columns to user_profiles
-- ============================================================================

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'active'
    CHECK (subscription_status IN ('active', 'trial', 'cancelled', 'expired', 'pending')),
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  -- Billing fields for future payment gateway (Stripe, etc.)
  ADD COLUMN IF NOT EXISTS billing_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS billing_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS billing_provider TEXT CHECK (billing_provider IN ('stripe', 'paddle', 'manual', NULL));

-- Index for efficient expiration queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription_expires_at
  ON public.user_profiles (subscription_expires_at)
  WHERE subscription_expires_at IS NOT NULL;

-- Index for billing lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_billing_customer_id
  ON public.user_profiles (billing_customer_id)
  WHERE billing_customer_id IS NOT NULL;

-- ============================================================================
-- 2) Update get_user_subscription_tier to consider expiration
-- ============================================================================

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
    -- Update status to expired (side effect, but necessary for consistency)
    UPDATE public.user_profiles
    SET subscription_status = 'expired'
    WHERE id = target_user_id AND subscription_status = 'trial';
    RETURN 'free';
  END IF;

  -- Check if paid subscription has expired
  IF v_expires_at IS NOT NULL AND v_expires_at < NOW() THEN
    -- Update status to expired
    UPDATE public.user_profiles
    SET subscription_status = 'expired'
    WHERE id = target_user_id AND subscription_status IN ('active', 'cancelled');
    RETURN 'free';
  END IF;

  -- Active subscription - return the tier
  RETURN v_tier;
END;
$$;

-- ============================================================================
-- 3) RPC: Get current user's full subscription status
-- ============================================================================

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

-- ============================================================================
-- 4) RPC: Cancel subscription (set cancel_at_period_end)
-- ============================================================================

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

-- ============================================================================
-- 5) RPC: Reactivate cancelled subscription
-- ============================================================================

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

-- ============================================================================
-- 6) RPC: Request tier upgrade (creates pending request for admin approval or payment)
-- ============================================================================

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

  -- Validate tier
  IF requested_tier NOT IN ('free', 'pro', 'enterprise') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid tier');
  END IF;

  SELECT subscription_tier INTO v_current_tier
  FROM public.user_profiles
  WHERE id = v_user_id;

  -- For now, just log the request (future: integrate with billing)
  -- In production, this would create a checkout session or admin notification
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Upgrade request received',
    'currentTier', v_current_tier,
    'requestedTier', requested_tier,
    'action', 'pending_payment' -- or 'admin_approval' for enterprise
  );
END;
$$;

-- ============================================================================
-- 7) Grant execute permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_user_subscription_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_subscription() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reactivate_subscription() TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_tier_upgrade(TEXT) TO authenticated;
