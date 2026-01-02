-- Migration: user_subscription_override
-- Date: 2026-01-02
-- Description: Allow admin to override a user's subscription tier and show it in user management.

-- 1) Add override column to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
      AND column_name = 'subscription_tier_override'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD COLUMN subscription_tier_override TEXT CHECK (subscription_tier_override IN ('free', 'pro', 'enterprise', 'admin'));
  END IF;
END $$;

-- 2) Extend admin user list RPC with subscription tiers
DROP FUNCTION IF EXISTS public.get_all_users_admin();
CREATE OR REPLACE FUNCTION public.get_all_users_admin()
RETURNS TABLE (
  user_id UUID,
  email VARCHAR(255),
  display_name VARCHAR(255),
  role_id VARCHAR(50),
  role_label VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE,
  last_sign_in TIMESTAMP WITH TIME ZONE,
  auth_provider TEXT,
  login_type TEXT,
  org_subscription_tier TEXT,
  subscription_tier_override TEXT,
  effective_subscription_tier TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  RETURN QUERY
  SELECT
    au.id as user_id,
    au.email::VARCHAR(255),
    COALESCE(up.display_name, '')::VARCHAR(255) as display_name,
    up.role_id,
    ur.label as role_label,
    au.created_at,
    au.last_sign_in_at as last_sign_in,
    COALESCE(
      NULLIF(au.raw_app_meta_data->>'provider', ''),
      NULLIF(au.raw_app_meta_data->'providers'->>0, ''),
      'email'
    ) as auth_provider,
    up.login_type,
    org.subscription_tier as org_subscription_tier,
    up.subscription_tier_override,
    COALESCE(up.subscription_tier_override, org.subscription_tier, 'free') as effective_subscription_tier
  FROM auth.users au
  LEFT JOIN public.user_profiles up ON au.id = up.user_id
  LEFT JOIN public.user_roles ur ON up.role_id = ur.id
  LEFT JOIN LATERAL (
    SELECT o.subscription_tier
    FROM public.organization_members om
    JOIN public.organizations o ON o.id = om.organization_id
    WHERE om.user_id = au.id
    ORDER BY om.created_at ASC
    LIMIT 1
  ) org ON true
  ORDER BY au.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_all_users_admin TO authenticated;

-- 3) Admin-only RPC to update subscription override (NULL = auto/org)
DROP FUNCTION IF EXISTS public.update_user_subscription_tier(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.update_user_subscription_tier(
  target_user_id UUID,
  new_subscription_tier TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  normalized := NULLIF(lower(trim(COALESCE(new_subscription_tier, ''))), '');
  IF normalized IS NOT NULL AND normalized NOT IN ('free', 'pro', 'enterprise', 'admin') THEN
    RAISE EXCEPTION 'Invalid subscription tier: %', normalized;
  END IF;

  INSERT INTO public.user_profiles (user_id, subscription_tier_override, updated_at)
  VALUES (target_user_id, normalized, now())
  ON CONFLICT (user_id) DO UPDATE SET
    subscription_tier_override = EXCLUDED.subscription_tier_override,
    updated_at = now();

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_user_subscription_tier TO authenticated;

