-- ============================================================================
-- SUBSCRIPTION BILLING & TIME-BASED ACCESS
-- ============================================================================
-- This migration adds support for:
-- 1. Time-based subscription expiration
-- 2. Trial periods (14 days)
-- 3. Billing periods (monthly/yearly)
-- 4. Subscription status tracking
-- 5. Cancellation with grace period
-- 6. Payment gateway preparation (Stripe-ready)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ADD SUBSCRIPTION COLUMNS TO USER_PROFILES
-- ----------------------------------------------------------------------------

-- Subscription status enum-like check
-- 'trial' - User is in trial period
-- 'active' - Subscription is active and paid
-- 'cancelled' - User cancelled but still has access until expires_at
-- 'expired' - Subscription expired, downgrade to free
-- 'past_due' - Payment failed, grace period
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial'
  CHECK (subscription_status IN ('trial', 'active', 'cancelled', 'expired', 'past_due'));

-- Billing period
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS billing_period TEXT DEFAULT 'monthly'
  CHECK (billing_period IN ('monthly', 'yearly'));

-- Key dates
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMPTZ;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMPTZ;

-- Seats management (for per-seat pricing)
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS seats_count INTEGER DEFAULT 1
  CHECK (seats_count >= 1);

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS seats_used INTEGER DEFAULT 1
  CHECK (seats_used >= 0);

-- Payment gateway fields (Stripe-ready)
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS payment_method_last4 TEXT;

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS payment_method_brand TEXT;

-- ----------------------------------------------------------------------------
-- 2. CREATE SUBSCRIPTION HISTORY TABLE (for audit trail)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS subscription_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,

  -- What changed
  action TEXT NOT NULL CHECK (action IN (
    'trial_started',
    'trial_extended',
    'subscription_created',
    'subscription_renewed',
    'subscription_upgraded',
    'subscription_downgraded',
    'subscription_cancelled',
    'subscription_expired',
    'subscription_reactivated',
    'payment_failed',
    'payment_succeeded',
    'seats_changed'
  )),

  -- Previous and new values
  previous_tier TEXT,
  new_tier TEXT,
  previous_status TEXT,
  new_status TEXT,
  previous_billing_period TEXT,
  new_billing_period TEXT,
  previous_seats INTEGER,
  new_seats INTEGER,

  -- Financial
  amount_cents INTEGER, -- Amount in cents (for payment events)
  currency TEXT DEFAULT 'CZK',

  -- Payment gateway reference
  stripe_invoice_id TEXT,
  stripe_payment_intent_id TEXT,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Index for querying user history
CREATE INDEX IF NOT EXISTS idx_subscription_history_user
  ON subscription_history(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscription_history_org
  ON subscription_history(organization_id, created_at DESC);

-- RLS for subscription_history
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;

-- Users can read their own history
CREATE POLICY "Users can view own subscription history"
  ON subscription_history FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all
CREATE POLICY "Admins can view all subscription history"
  ON subscription_history FOR SELECT
  USING (is_admin());

-- Only system/admin can insert
CREATE POLICY "System can insert subscription history"
  ON subscription_history FOR INSERT
  WITH CHECK (is_admin() OR auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 3. CREATE PRICING PLANS TABLE (configurable pricing)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS subscription_plans (
  id TEXT PRIMARY KEY, -- 'starter', 'pro', 'enterprise'
  name TEXT NOT NULL,
  description TEXT,

  -- Pricing
  monthly_price_cents INTEGER NOT NULL, -- Price per seat per month in cents
  yearly_price_cents INTEGER NOT NULL,  -- Price per seat per year in cents

  -- Features
  tier TEXT NOT NULL CHECK (tier IN ('free', 'pro', 'enterprise')),
  max_projects INTEGER, -- NULL = unlimited
  max_seats INTEGER,    -- NULL = unlimited

  -- Trial
  trial_days INTEGER DEFAULT 14,

  -- Display
  is_featured BOOLEAN DEFAULT FALSE,
  is_visible BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default plans
INSERT INTO subscription_plans (id, name, description, monthly_price_cents, yearly_price_cents, tier, max_projects, max_seats, trial_days, is_featured, sort_order)
VALUES
  ('starter', 'Starter', 'Pro malé týmy a jednotlivce', 29900, 299000, 'free', 5, NULL, 14, FALSE, 1),
  ('pro', 'Professional', 'Pro rostoucí firmy', 49900, 499000, 'pro', NULL, NULL, 14, TRUE, 2),
  ('enterprise', 'Enterprise', 'Pro velké organizace', 0, 0, 'enterprise', NULL, NULL, 0, FALSE, 3)
ON CONFLICT (id) DO UPDATE SET
  monthly_price_cents = EXCLUDED.monthly_price_cents,
  yearly_price_cents = EXCLUDED.yearly_price_cents,
  tier = EXCLUDED.tier,
  max_projects = EXCLUDED.max_projects,
  trial_days = EXCLUDED.trial_days,
  updated_at = NOW();

-- RLS for plans (public read)
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view plans"
  ON subscription_plans FOR SELECT
  USING (is_visible = TRUE);

CREATE POLICY "Admins can manage plans"
  ON subscription_plans FOR ALL
  USING (is_admin());

-- ----------------------------------------------------------------------------
-- 4. UPDATE get_user_subscription_tier() TO RESPECT EXPIRATION
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_user_subscription_tier(target_user_id UUID DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_user_id UUID;
  v_tier TEXT;
  v_status TEXT;
  v_expires_at TIMESTAMPTZ;
  v_trial_ends_at TIMESTAMPTZ;
BEGIN
  -- Use provided user_id or current user
  v_user_id := COALESCE(target_user_id, auth.uid());

  IF v_user_id IS NULL THEN
    RETURN 'free';
  END IF;

  -- Get subscription info
  SELECT
    COALESCE(up.subscription_tier_override, org.subscription_tier, 'free'),
    up.subscription_status,
    up.subscription_expires_at,
    up.trial_ends_at
  INTO v_tier, v_status, v_expires_at, v_trial_ends_at
  FROM user_profiles up
  LEFT JOIN organization_members om ON om.user_id = up.user_id
  LEFT JOIN organizations org ON org.id = om.organization_id
  WHERE up.user_id = v_user_id;

  -- If no profile found, return free
  IF v_tier IS NULL THEN
    RETURN 'free';
  END IF;

  -- Admin tier is always active
  IF v_tier = 'admin' THEN
    RETURN 'admin';
  END IF;

  -- Check trial expiration
  IF v_status = 'trial' THEN
    IF v_trial_ends_at IS NOT NULL AND v_trial_ends_at < NOW() THEN
      -- Trial expired, return free
      RETURN 'free';
    END IF;
    -- Trial still active, return the tier
    RETURN v_tier;
  END IF;

  -- Check subscription expiration for cancelled/expired status
  IF v_status IN ('cancelled', 'expired') THEN
    IF v_expires_at IS NOT NULL AND v_expires_at < NOW() THEN
      -- Subscription expired
      RETURN 'free';
    END IF;
    -- Still within grace period
    RETURN v_tier;
  END IF;

  -- Check past_due - give 7 day grace period
  IF v_status = 'past_due' THEN
    IF v_expires_at IS NOT NULL AND v_expires_at < (NOW() - INTERVAL '7 days') THEN
      RETURN 'free';
    END IF;
    RETURN v_tier;
  END IF;

  -- Active subscription
  RETURN v_tier;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. SUBSCRIPTION MANAGEMENT FUNCTIONS
-- ----------------------------------------------------------------------------

-- Start a trial for a user
CREATE OR REPLACE FUNCTION start_user_trial(
  p_user_id UUID,
  p_plan_id TEXT DEFAULT 'starter',
  p_trial_days INTEGER DEFAULT 14
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_plan subscription_plans%ROWTYPE;
  v_trial_ends_at TIMESTAMPTZ;
BEGIN
  -- Get plan info
  SELECT * INTO v_plan FROM subscription_plans WHERE id = p_plan_id;

  IF v_plan.id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Plan not found');
  END IF;

  -- Calculate trial end date
  v_trial_ends_at := NOW() + (COALESCE(p_trial_days, v_plan.trial_days, 14) || ' days')::INTERVAL;

  -- Update user profile
  UPDATE user_profiles SET
    subscription_status = 'trial',
    subscription_tier_override = v_plan.tier,
    trial_ends_at = v_trial_ends_at,
    subscription_started_at = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Log history
  INSERT INTO subscription_history (user_id, action, new_tier, new_status, notes)
  VALUES (p_user_id, 'trial_started', v_plan.tier, 'trial', 'Trial started for plan: ' || p_plan_id);

  RETURN jsonb_build_object(
    'success', TRUE,
    'trial_ends_at', v_trial_ends_at,
    'tier', v_plan.tier
  );
END;
$$;

-- Activate subscription (after payment)
CREATE OR REPLACE FUNCTION activate_subscription(
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
AS $$
DECLARE
  v_plan subscription_plans%ROWTYPE;
  v_expires_at TIMESTAMPTZ;
  v_previous_tier TEXT;
  v_previous_status TEXT;
BEGIN
  -- Get plan info
  SELECT * INTO v_plan FROM subscription_plans WHERE id = p_plan_id;

  IF v_plan.id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Plan not found');
  END IF;

  -- Calculate expiration
  IF p_billing_period = 'yearly' THEN
    v_expires_at := NOW() + INTERVAL '1 year';
  ELSE
    v_expires_at := NOW() + INTERVAL '1 month';
  END IF;

  -- Get previous values for history
  SELECT subscription_tier_override, subscription_status
  INTO v_previous_tier, v_previous_status
  FROM user_profiles WHERE user_id = p_user_id;

  -- Update user profile
  UPDATE user_profiles SET
    subscription_status = 'active',
    subscription_tier_override = v_plan.tier,
    billing_period = p_billing_period,
    subscription_started_at = COALESCE(subscription_started_at, NOW()),
    subscription_expires_at = v_expires_at,
    next_billing_date = v_expires_at,
    seats_count = p_seats,
    stripe_customer_id = COALESCE(p_stripe_customer_id, stripe_customer_id),
    stripe_subscription_id = COALESCE(p_stripe_subscription_id, stripe_subscription_id),
    trial_ends_at = NULL, -- Clear trial
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Log history
  INSERT INTO subscription_history (
    user_id, action,
    previous_tier, new_tier,
    previous_status, new_status,
    new_billing_period, new_seats
  )
  VALUES (
    p_user_id, 'subscription_created',
    v_previous_tier, v_plan.tier,
    v_previous_status, 'active',
    p_billing_period, p_seats
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'expires_at', v_expires_at,
    'tier', v_plan.tier,
    'billing_period', p_billing_period
  );
END;
$$;

-- Cancel subscription (effective at period end)
CREATE OR REPLACE FUNCTION cancel_subscription(p_user_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expires_at TIMESTAMPTZ;
  v_current_tier TEXT;
BEGIN
  -- Get current expiration
  SELECT subscription_expires_at, subscription_tier_override
  INTO v_expires_at, v_current_tier
  FROM user_profiles WHERE user_id = p_user_id;

  -- Update status to cancelled
  UPDATE user_profiles SET
    subscription_status = 'cancelled',
    cancellation_requested_at = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Log history
  INSERT INTO subscription_history (user_id, action, previous_tier, new_status, notes)
  VALUES (p_user_id, 'subscription_cancelled', v_current_tier, 'cancelled', p_reason);

  RETURN jsonb_build_object(
    'success', TRUE,
    'access_until', v_expires_at,
    'message', 'Subscription cancelled. Access continues until ' || v_expires_at::DATE
  );
END;
$$;

-- Reactivate cancelled subscription
CREATE OR REPLACE FUNCTION reactivate_subscription(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_status TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  SELECT subscription_status, subscription_expires_at
  INTO v_current_status, v_expires_at
  FROM user_profiles WHERE user_id = p_user_id;

  -- Can only reactivate if cancelled and not yet expired
  IF v_current_status != 'cancelled' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Subscription is not cancelled');
  END IF;

  IF v_expires_at < NOW() THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Subscription has already expired');
  END IF;

  -- Reactivate
  UPDATE user_profiles SET
    subscription_status = 'active',
    cancellation_requested_at = NULL,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Log history
  INSERT INTO subscription_history (user_id, action, new_status)
  VALUES (p_user_id, 'subscription_reactivated', 'active');

  RETURN jsonb_build_object('success', TRUE, 'message', 'Subscription reactivated');
END;
$$;

-- Get user subscription details
CREATE OR REPLACE FUNCTION get_user_subscription_details(p_user_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_user_id UUID;
  v_result JSONB;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  SELECT jsonb_build_object(
    'user_id', up.user_id,
    'effective_tier', get_user_subscription_tier(up.user_id),
    'subscription_status', up.subscription_status,
    'billing_period', up.billing_period,
    'subscription_started_at', up.subscription_started_at,
    'subscription_expires_at', up.subscription_expires_at,
    'trial_ends_at', up.trial_ends_at,
    'cancellation_requested_at', up.cancellation_requested_at,
    'next_billing_date', up.next_billing_date,
    'seats_count', up.seats_count,
    'seats_used', up.seats_used,
    'days_remaining', CASE
      WHEN up.subscription_status = 'trial' AND up.trial_ends_at IS NOT NULL
        THEN GREATEST(0, EXTRACT(DAY FROM up.trial_ends_at - NOW())::INTEGER)
      WHEN up.subscription_expires_at IS NOT NULL
        THEN GREATEST(0, EXTRACT(DAY FROM up.subscription_expires_at - NOW())::INTEGER)
      ELSE NULL
    END,
    'is_trial', up.subscription_status = 'trial',
    'is_cancelled', up.subscription_status = 'cancelled',
    'has_payment_method', up.stripe_customer_id IS NOT NULL,
    'payment_method_last4', up.payment_method_last4,
    'payment_method_brand', up.payment_method_brand
  ) INTO v_result
  FROM user_profiles up
  WHERE up.user_id = v_user_id;

  RETURN COALESCE(v_result, jsonb_build_object('error', 'User not found'));
END;
$$;

-- Get available plans
CREATE OR REPLACE FUNCTION get_subscription_plans()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', id,
        'name', name,
        'description', description,
        'monthly_price_cents', monthly_price_cents,
        'yearly_price_cents', yearly_price_cents,
        'tier', tier,
        'max_projects', max_projects,
        'max_seats', max_seats,
        'trial_days', trial_days,
        'is_featured', is_featured
      ) ORDER BY sort_order
    )
    FROM subscription_plans
    WHERE is_visible = TRUE
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. GRANT PERMISSIONS
-- ----------------------------------------------------------------------------

-- Grant execute on functions to authenticated users
GRANT EXECUTE ON FUNCTION get_user_subscription_tier(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_subscription_details(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_subscription_plans() TO authenticated;

-- These should only be called by backend/webhooks, but grant for now
GRANT EXECUTE ON FUNCTION start_user_trial(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION activate_subscription(UUID, TEXT, TEXT, INTEGER, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_subscription(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION reactivate_subscription(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 7. TRIGGER TO AUTO-START TRIAL ON NEW USER
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION handle_new_user_trial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Start trial for new users (except admins)
  IF NEW.subscription_tier_override IS NULL OR NEW.subscription_tier_override != 'admin' THEN
    NEW.subscription_status := 'trial';
    NEW.trial_ends_at := NOW() + INTERVAL '14 days';
    NEW.subscription_started_at := NOW();
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_user_profile_created_start_trial ON user_profiles;

-- Create trigger
CREATE TRIGGER on_user_profile_created_start_trial
  BEFORE INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_trial();

-- ----------------------------------------------------------------------------
-- 8. COMMENTS FOR DOCUMENTATION
-- ----------------------------------------------------------------------------

COMMENT ON TABLE subscription_history IS 'Audit trail for all subscription changes';
COMMENT ON TABLE subscription_plans IS 'Configurable pricing plans';
COMMENT ON FUNCTION get_user_subscription_tier IS 'Returns effective tier respecting expiration';
COMMENT ON FUNCTION get_user_subscription_details IS 'Returns full subscription info for UI';
COMMENT ON FUNCTION start_user_trial IS 'Starts a trial period for a user';
COMMENT ON FUNCTION activate_subscription IS 'Activates paid subscription';
COMMENT ON FUNCTION cancel_subscription IS 'Cancels subscription (effective at period end)';
COMMENT ON FUNCTION reactivate_subscription IS 'Reactivates a cancelled subscription';
