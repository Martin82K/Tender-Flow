-- Migration: fix_user_profiles_auto_creation
-- Date: 2026-02-06
-- Description: Fixes subscription check issue on Windows. Adds automatic user_profiles 
--              creation, updates trial trigger, and backfills existing users.
-- Issue: Users on Windows are redirected to subscription page despite having valid subscription
--        because user_profiles row was never created automatically on registration.

-- ============================================================================
-- 1. CREATE TRIGGER TO AUTO-CREATE user_profiles ON NEW USER REGISTRATION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create user_profiles row for new user
  -- The handle_new_user_trial() BEFORE INSERT trigger will set trial fields
  INSERT INTO public.user_profiles (user_id, display_name, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't fail user creation if profile creation fails
  RAISE WARNING '[handle_new_user_profile] Could not create profile for %: %', NEW.email, SQLERRM;
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users - runs AFTER insert to ensure user exists
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile();

GRANT EXECUTE ON FUNCTION public.handle_new_user_profile() TO service_role;

-- ============================================================================
-- 2. FIX handle_new_user_trial() TO SET subscription_tier_override = 'pro'
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_trial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Start trial for new users (except admins)
  -- If no override is present, or it's not 'admin', set them to PRO trial
  IF NEW.subscription_tier_override IS NULL OR NEW.subscription_tier_override != 'admin' THEN
    NEW.subscription_status := 'trial';
    NEW.subscription_tier_override := 'pro'; -- CRITICAL: Explicitly set to PRO
    NEW.trial_ends_at := NOW() + INTERVAL '14 days';
    NEW.subscription_started_at := NOW();
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_user_profile_created_start_trial ON public.user_profiles;
CREATE TRIGGER on_user_profile_created_start_trial
  BEFORE INSERT ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_trial();

-- ============================================================================
-- 3. BACKFILL: Create user_profiles for existing users who don't have one
--              and set trial/subscription status for those with incomplete data
-- ============================================================================

DO $$
DECLARE
  r RECORD;
  v_count_created INTEGER := 0;
  v_count_updated INTEGER := 0;
BEGIN
  -- Create missing user_profiles
  FOR r IN 
    SELECT au.id, au.email, au.raw_user_meta_data->>'name' as display_name
    FROM auth.users au
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_profiles up WHERE up.user_id = au.id
    )
  LOOP
    BEGIN
      INSERT INTO public.user_profiles (
        user_id, 
        display_name, 
        subscription_status,
        subscription_tier_override,
        trial_ends_at,
        subscription_started_at,
        created_at, 
        updated_at
      ) VALUES (
        r.id,
        r.display_name,
        'trial',
        'pro',
        NOW() + INTERVAL '14 days',
        NOW(),
        NOW(),
        NOW()
      );
      v_count_created := v_count_created + 1;
      RAISE NOTICE 'Created user_profiles for user %', r.email;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to create profile for %: %', r.email, SQLERRM;
    END;
  END LOOP;
  
  -- Update existing user_profiles that DON'T have a desktop-allowed tier
  -- Desktop allowed tiers are: 'pro', 'enterprise', 'admin'
  -- This will fix users stuck on 'free', 'starter', or NULL tier
  UPDATE public.user_profiles
  SET 
    subscription_tier_override = 'pro',
    subscription_status = CASE 
      WHEN subscription_status IS NULL THEN 'trial'
      WHEN subscription_status = 'expired' THEN 'trial'
      ELSE subscription_status
    END,
    trial_ends_at = COALESCE(trial_ends_at, NOW() + INTERVAL '14 days'),
    subscription_started_at = COALESCE(subscription_started_at, NOW()),
    updated_at = NOW()
  WHERE (
    subscription_tier_override IS NULL 
    OR subscription_tier_override NOT IN ('pro', 'enterprise', 'admin')
  )
  AND NOT EXISTS (
    SELECT 1 FROM auth.users au 
    WHERE au.id = user_profiles.user_id 
    AND au.email IN ('martinkalkus82@gmail.com', 'kalkus@baustav.cz')
  );
  
  GET DIAGNOSTICS v_count_updated = ROW_COUNT;
  
  RAISE NOTICE 'Backfill complete: % profiles created, % profiles updated to PRO tier', v_count_created, v_count_updated;
END $$;


-- ============================================================================
-- 4. VERIFY: Add helpful query to check status (run manually to verify)
-- ============================================================================

-- Run this query to verify the fix worked:
/*
SELECT 
  au.email,
  up.subscription_tier_override,
  up.subscription_status,
  up.trial_ends_at,
  up.subscription_started_at,
  public.get_user_subscription_tier(au.id) as effective_tier
FROM auth.users au
LEFT JOIN public.user_profiles up ON up.user_id = au.id
ORDER BY au.created_at DESC
LIMIT 20;
*/
