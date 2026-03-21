-- Migration: harden_platform_admin_and_org_security
-- Date: 2026-03-20
-- Description: Phase 1 critical hardening for platform admin authority,
--              historical Baustav incident auditing, and safe organization bootstrap.

-- ============================================================================
-- 1. PLATFORM ADMIN SOURCE OF TRUTH
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platform_admins (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    grant_source TEXT NOT NULL DEFAULT 'manual_grant'
        CHECK (grant_source IN ('migration_seed', 'manual_grant', 'break_glass')),
    reason TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins can view own grant" ON public.platform_admins;
CREATE POLICY "Platform admins can view own grant" ON public.platform_admins
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;

INSERT INTO public.platform_admins (user_id, granted_by, grant_source, reason, is_active)
SELECT
    au.id,
    au.id,
    'migration_seed',
    'Seeded from legacy admin email allowlist during 2026-03-20 hardening',
    TRUE
FROM auth.users au
WHERE au.email IN ('martinkalkus82@gmail.com', 'kalkus@baustav.cz')
ON CONFLICT (user_id) DO UPDATE
SET
    is_active = TRUE,
    grant_source = EXCLUDED.grant_source,
    reason = EXCLUDED.reason,
    updated_at = NOW();

CREATE OR REPLACE FUNCTION public.is_platform_admin(target_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
    IF target_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.platform_admins pa
        WHERE pa.user_id = target_user_id
          AND pa.is_active = TRUE
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    fallback_enabled BOOLEAN;
BEGIN
    IF public.is_platform_admin(auth.uid()) THEN
        RETURN TRUE;
    END IF;

    -- Temporary phase-1 fallback: only for bootstrapping environments where no
    -- explicit platform admin grant exists yet.
    SELECT NOT EXISTS (
        SELECT 1
        FROM public.platform_admins
        WHERE is_active = TRUE
    )
    INTO fallback_enabled;

    IF fallback_enabled THEN
        RETURN COALESCE(
            (auth.jwt() ->> 'email') IN ('martinkalkus82@gmail.com', 'kalkus@baustav.cz'),
            FALSE
        );
    END IF;

    RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
    RETURN public.is_admin();
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_platform_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated;

-- Remove legacy auth coupling from subscription override and preserve the
-- broadest paid feature set for affected users until phase 2 is complete.
UPDATE public.user_profiles
SET subscription_tier_override = 'enterprise',
    updated_at = NOW()
WHERE subscription_tier_override = 'admin';

ALTER TABLE public.user_profiles
DROP CONSTRAINT IF EXISTS user_profiles_subscription_tier_override_check;

ALTER TABLE public.user_profiles
ADD CONSTRAINT user_profiles_subscription_tier_override_check
CHECK (
    subscription_tier_override IS NULL
    OR subscription_tier_override IN ('free', 'starter', 'pro', 'enterprise')
);

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
    old_tier TEXT;
    admin_user_id UUID;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access denied: Admin only';
    END IF;

    admin_user_id := auth.uid();
    normalized := NULLIF(lower(trim(COALESCE(new_subscription_tier, ''))), '');

    IF normalized IS NOT NULL AND normalized NOT IN ('free', 'starter', 'pro', 'enterprise') THEN
        RAISE EXCEPTION 'Invalid subscription tier: %', normalized;
    END IF;

    SELECT subscription_tier_override
    INTO old_tier
    FROM public.user_profiles
    WHERE user_id = target_user_id;

    INSERT INTO public.user_profiles (user_id, subscription_tier_override, updated_at)
    VALUES (target_user_id, normalized, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
        subscription_tier_override = EXCLUDED.subscription_tier_override,
        updated_at = NOW();

    BEGIN
        INSERT INTO public.subscription_audit_log (
            user_id,
            changed_by,
            old_tier,
            new_tier,
            change_type,
            notes
        ) VALUES (
            target_user_id,
            admin_user_id,
            old_tier,
            normalized,
            'manual_override',
            CASE
                WHEN normalized IS NULL THEN 'Removed manual override, reverted to organization tier'
                ELSE format('Manual tier override set to %s by platform admin', normalized)
            END
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Audit log insert failed (non-critical): %', SQLERRM;
    END;

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_user_subscription_tier(UUID, TEXT) TO authenticated;

DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
CREATE POLICY "Users can insert own profile" ON public.user_profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = user_id
        AND role_id IS NULL
        AND login_type IS NULL
        AND subscription_tier_override IS NULL
        AND stripe_customer_id IS NULL
        AND stripe_subscription_id IS NULL
        AND payment_method_last4 IS NULL
        AND payment_method_brand IS NULL
    );

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can update any profile subscription" ON public.user_profiles;
DROP POLICY IF EXISTS "Superadmin can update any profile" ON public.user_profiles;

CREATE OR REPLACE FUNCTION public.guard_user_profiles_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    allowed_self_service_columns TEXT[] := ARRAY[
        'user_id',
        'display_name',
        'signature_name',
        'signature_role',
        'signature_phone',
        'signature_phone_secondary',
        'signature_email',
        'signature_greeting',
        'terms_version',
        'terms_accepted_at',
        'privacy_version',
        'privacy_accepted_at',
        'created_at',
        'updated_at'
    ];
BEGIN
    IF auth.role() <> 'authenticated' OR auth.uid() IS NULL OR public.is_admin() THEN
        RETURN NEW;
    END IF;

    IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'Users may only manage their own profile';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF (to_jsonb(NEW) - allowed_self_service_columns) IS DISTINCT FROM (to_jsonb(OLD) - allowed_self_service_columns) THEN
            RAISE EXCEPTION 'Protected profile fields cannot be changed by the profile owner';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_user_profiles_sensitive_columns ON public.user_profiles;
CREATE TRIGGER guard_user_profiles_sensitive_columns
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.guard_user_profiles_sensitive_columns();

-- ============================================================================
-- 2. SAFE AUTO-ORGANIZATION BOOTSTRAP
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_or_create_user_organization_internal(
    p_user_id UUID,
    p_email TEXT,
    p_display_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_org_id UUID;
    v_domain TEXT;
    v_org_name TEXT;
BEGIN
    IF p_user_id IS NULL OR p_email IS NULL OR p_email = '' THEN
        RAISE EXCEPTION 'user_id and email are required';
    END IF;

    v_domain := lower(split_part(p_email, '@', 2));

    SELECT organization_id INTO v_org_id
    FROM public.organization_members
    WHERE user_id = p_user_id
    LIMIT 1;

    IF v_org_id IS NOT NULL THEN
        RETURN v_org_id;
    END IF;

    IF public.is_free_email_provider(p_email) THEN
        v_org_name := COALESCE(NULLIF(TRIM(p_display_name), ''), split_part(p_email, '@', 1));

        INSERT INTO public.organizations (name, type, owner_user_id, subscription_tier)
        VALUES (v_org_name, 'personal', p_user_id, 'starter')
        RETURNING id INTO v_org_id;

        INSERT INTO public.organization_members (organization_id, user_id, role)
        VALUES (v_org_id, p_user_id, 'owner')
        ON CONFLICT (organization_id, user_id) DO NOTHING;

        RETURN v_org_id;
    END IF;

    SELECT id INTO v_org_id
    FROM public.organizations
    WHERE v_domain = ANY(domain_whitelist)
    LIMIT 1;

    IF v_org_id IS NOT NULL THEN
        INSERT INTO public.organization_members (organization_id, user_id, role)
        VALUES (v_org_id, p_user_id, 'member')
        ON CONFLICT (organization_id, user_id) DO NOTHING;

        RETURN v_org_id;
    END IF;

    v_org_name := initcap(split_part(v_domain, '.', 1));

    INSERT INTO public.organizations (name, type, domain_whitelist, owner_user_id, subscription_tier)
    VALUES (v_org_name, 'business', ARRAY[v_domain], p_user_id, 'starter')
    RETURNING id INTO v_org_id;

    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (v_org_id, p_user_id, 'owner')
    ON CONFLICT (organization_id, user_id) DO NOTHING;

    RETURN v_org_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_user_organization(
    p_user_id UUID DEFAULT NULL,
    p_email TEXT DEFAULT NULL,
    p_display_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_auth_user_id UUID;
    v_auth_email TEXT;
BEGIN
    v_auth_user_id := auth.uid();
    IF v_auth_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    SELECT email
    INTO v_auth_email
    FROM auth.users
    WHERE id = v_auth_user_id;

    IF v_auth_email IS NULL OR v_auth_email = '' THEN
        RAISE EXCEPTION 'Authenticated user email not available';
    END IF;

    IF p_user_id IS NOT NULL AND p_user_id <> v_auth_user_id THEN
        RAISE EXCEPTION 'user_id must match auth.uid()';
    END IF;

    IF p_email IS NOT NULL AND lower(trim(p_email)) <> lower(trim(v_auth_email)) THEN
        RAISE EXCEPTION 'email must match authenticated user';
    END IF;

    RETURN public.get_or_create_user_organization_internal(
        v_auth_user_id,
        v_auth_email,
        p_display_name
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_display_name TEXT;
BEGIN
    v_display_name := NEW.raw_user_meta_data->>'name';

    BEGIN
        PERFORM public.get_or_create_user_organization_internal(
            NEW.id,
            NEW.email,
            v_display_name
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Could not create organization for user %: %', NEW.email, SQLERRM;
    END;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_user_organization_internal(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_or_create_user_organization_internal(UUID, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_user_organization_internal(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_or_create_user_organization(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_user_organization(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user_organization() TO service_role;

-- ============================================================================
-- 3. BAUSTAV INCIDENT AUDIT + SAFE TENANT POLICIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.security_baustav_subcontractor_audit (
    subcontractor_id VARCHAR(36) PRIMARY KEY,
    organization_id UUID,
    owner_id UUID,
    audit_reason TEXT NOT NULL,
    captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.security_baustav_membership_audit (
    organization_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role VARCHAR(50),
    audit_reason TEXT NOT NULL,
    captured_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    PRIMARY KEY (organization_id, user_id)
);

ALTER TABLE public.security_baustav_subcontractor_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_baustav_membership_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Baustav subcontractor audit admin select" ON public.security_baustav_subcontractor_audit;
CREATE POLICY "Baustav subcontractor audit admin select" ON public.security_baustav_subcontractor_audit
    FOR SELECT
    TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS "Baustav membership audit admin select" ON public.security_baustav_membership_audit;
CREATE POLICY "Baustav membership audit admin select" ON public.security_baustav_membership_audit
    FOR SELECT
    TO authenticated
    USING (public.is_admin());

GRANT SELECT ON public.security_baustav_subcontractor_audit TO authenticated;
GRANT SELECT ON public.security_baustav_membership_audit TO authenticated;
GRANT ALL ON public.security_baustav_subcontractor_audit TO service_role;
GRANT ALL ON public.security_baustav_membership_audit TO service_role;

INSERT INTO public.security_baustav_subcontractor_audit (
    subcontractor_id,
    organization_id,
    owner_id,
    audit_reason
)
SELECT
    s.id,
    s.organization_id,
    s.owner_id,
    'Captured during 2026-03-20 review of Baustav reassignment incident'
FROM public.subcontractors s
JOIN public.organizations o ON o.id = s.organization_id
WHERE o.name = 'Baustav'
ON CONFLICT (subcontractor_id) DO NOTHING;

INSERT INTO public.security_baustav_membership_audit (
    organization_id,
    user_id,
    role,
    audit_reason
)
SELECT
    om.organization_id,
    om.user_id,
    om.role,
    'Captured during 2026-03-20 review of Baustav owner/admin memberships'
FROM public.organization_members om
JOIN public.organizations o ON o.id = om.organization_id
WHERE o.name = 'Baustav'
  AND om.role IN ('owner', 'admin')
ON CONFLICT (organization_id, user_id) DO NOTHING;

DROP POLICY IF EXISTS "Users can view own or public subcontractors" ON public.subcontractors;
DROP POLICY IF EXISTS "Allow all authenticated users" ON public.subcontractors;
DROP POLICY IF EXISTS "Subcontractors visible to owner or org" ON public.subcontractors;
DROP POLICY IF EXISTS "Manage own or org subcontractors" ON public.subcontractors;
DROP POLICY IF EXISTS "Strict Subcontractor Visibility" ON public.subcontractors;
DROP POLICY IF EXISTS "Strict Subcontractor Update" ON public.subcontractors;
DROP POLICY IF EXISTS "Strict Subcontractor Delete" ON public.subcontractors;
DROP POLICY IF EXISTS "Users can update own or public subcontractors" ON public.subcontractors;
DROP POLICY IF EXISTS "Users can delete own or public subcontractors" ON public.subcontractors;

CREATE POLICY "Subcontractors visible to owner or org"
ON public.subcontractors
FOR SELECT
TO authenticated
USING (
    owner_id = auth.uid()
    OR (organization_id IS NOT NULL AND organization_id = ANY(public.get_my_org_ids()))
);

CREATE POLICY "Subcontractors insert restricted to owner or org"
ON public.subcontractors
FOR INSERT
TO authenticated
WITH CHECK (
    owner_id = auth.uid()
    OR (organization_id IS NOT NULL AND organization_id = ANY(public.get_my_org_ids()))
);

CREATE POLICY "Manage own or org subcontractors"
ON public.subcontractors
FOR UPDATE
TO authenticated
USING (
    owner_id = auth.uid()
    OR (organization_id IS NOT NULL AND organization_id = ANY(public.get_my_org_ids()))
)
WITH CHECK (
    owner_id = auth.uid()
    OR (organization_id IS NOT NULL AND organization_id = ANY(public.get_my_org_ids()))
);

CREATE POLICY "Strict Subcontractor Delete"
ON public.subcontractors
FOR DELETE
TO authenticated
USING (
    owner_id = auth.uid()
    OR (organization_id IS NOT NULL AND organization_id = ANY(public.get_my_org_ids()))
);

DO $$
BEGIN
    RAISE NOTICE 'Critical hardening complete: platform admin authority, safe auto-org bootstrap, and Baustav audit artifacts created.';
END $$;
