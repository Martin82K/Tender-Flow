-- Prevent non-admin users from setting subscription tier overrides on their own profile.
-- This preserves self-service profile edits while protecting authorization/billing tier controls.

CREATE OR REPLACE FUNCTION public.guard_user_profile_subscription_override()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Service role and admins are allowed to manage overrides.
  IF auth.role() = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.subscription_tier_override IS NOT NULL THEN
      RAISE EXCEPTION 'Only admins can set subscription_tier_override';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.subscription_tier_override IS DISTINCT FROM OLD.subscription_tier_override THEN
    RAISE EXCEPTION 'Only admins can change subscription_tier_override';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_user_profile_subscription_override ON public.user_profiles;
CREATE TRIGGER trg_guard_user_profile_subscription_override
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_user_profile_subscription_override();
