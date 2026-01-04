-- Diagnostický skript pro kontrolu uživatelů, jejich projektů a sdílení
-- Spustit v Supabase SQL Editor

-- ============================================================================
-- 1. PŘEHLED VŠECH UŽIVATELŮ S JEJICH SUBSCRIPTION TIER
-- ============================================================================
SELECT 
    au.id as user_id,
    au.email,
    COALESCE(up.display_name, au.email) as display_name,
    up.subscription_tier_override,
    org.subscription_tier as org_subscription_tier,
    COALESCE(up.subscription_tier_override, org.subscription_tier, 'free') as effective_tier,
    au.created_at
FROM auth.users au
LEFT JOIN public.user_profiles up ON au.id = up.user_id
LEFT JOIN LATERAL (
    SELECT o.subscription_tier
    FROM public.organization_members om
    JOIN public.organizations o ON o.id = om.organization_id
    WHERE om.user_id = au.id
    ORDER BY om.created_at ASC
    LIMIT 1
) org ON true
ORDER BY au.email;

-- ============================================================================
-- 2. PŘEHLED VŠECH PROJEKTŮ S JEJICH VLASTNÍKY
-- ============================================================================
SELECT 
    p.id as project_id,
    p.name as project_name,
    p.location,
    p.status,
    p.owner_id,
    owner_u.email as owner_email,
    p.is_demo,
    p.created_at
FROM public.projects p
LEFT JOIN auth.users owner_u ON p.owner_id = owner_u.id
ORDER BY p.name;

-- ============================================================================
-- 3. PŘEHLED VŠECH SDÍLENÍ PROJEKTŮ
-- ============================================================================
SELECT 
    ps.project_id,
    p.name as project_name,
    owner_u.email as owner_email,
    ps.user_id as shared_to_user_id,
    shared_u.email as shared_to_email,
    ps.permission,
    ps.created_at as shared_at
FROM public.project_shares ps
JOIN public.projects p ON p.id = ps.project_id
LEFT JOIN auth.users owner_u ON p.owner_id = owner_u.id
LEFT JOIN auth.users shared_u ON ps.user_id = shared_u.id
ORDER BY p.name, shared_u.email;

-- ============================================================================
-- 4. KTERÁ PROJEKTY VIDÍ KAŽDÝ UŽIVATEL (simulace RLS)
-- ============================================================================
SELECT 
    au.email as user_email,
    p.id as project_id,
    p.name as project_name,
    CASE 
        WHEN p.owner_id IS NULL THEN 'PUBLIC'
        WHEN p.owner_id = au.id THEN 'OWNER'
        WHEN EXISTS (
            SELECT 1 FROM public.project_shares ps 
            WHERE ps.project_id = p.id AND ps.user_id = au.id
        ) THEN 'SHARED'
        ELSE 'NO_ACCESS'
    END as access_type,
    (SELECT ps.permission FROM public.project_shares ps WHERE ps.project_id = p.id AND ps.user_id = au.id) as share_permission
FROM auth.users au
CROSS JOIN public.projects p
WHERE 
    -- Pouze záznamy kde má uživatel přístup
    p.owner_id IS NULL 
    OR p.owner_id = au.id
    OR EXISTS (
        SELECT 1 FROM public.project_shares ps 
        WHERE ps.project_id = p.id AND ps.user_id = au.id
    )
ORDER BY au.email, p.name;

-- ============================================================================
-- 5. KONTROLA FUNKCÍ is_project_shared_with_user
-- ============================================================================
-- Zkontrolujte zda existuje a funguje správně
SELECT 
    p.name as project_name,
    au.email,
    public.is_project_shared_with_user(p.id, au.id) as has_share
FROM public.projects p
CROSS JOIN auth.users au
WHERE p.owner_id != au.id  -- Vyloučit vlastníky
ORDER BY p.name, au.email;

-- ============================================================================
-- 6. KONTROLA get_projects_metadata pro konkrétního uživatele
-- ============================================================================
-- Musí být spuštěno jako daný uživatel (nebo použijte set role)
-- Tato funkce je SECURITY DEFINER a filtruje podle auth.uid()
SELECT * FROM public.get_projects_metadata();

-- ============================================================================
-- 7. DETAILNÍ ANALÝZA - projekty které by měl uživatel vidět vs. které vidí
-- ============================================================================
-- Pro každého uživatele spočítejte kolik projektů vlastní a kolik má sdílených
SELECT 
    au.email,
    COUNT(DISTINCT CASE WHEN p.owner_id = au.id THEN p.id END) as owned_projects,
    COUNT(DISTINCT CASE WHEN ps.user_id = au.id THEN ps.project_id END) as shared_projects,
    COUNT(DISTINCT CASE WHEN p.owner_id IS NULL THEN p.id END) as public_projects
FROM auth.users au
LEFT JOIN public.projects p ON p.owner_id = au.id
LEFT JOIN public.project_shares ps ON ps.user_id = au.id
LEFT JOIN public.projects p_public ON p_public.owner_id IS NULL
GROUP BY au.id, au.email
ORDER BY au.email;

-- ============================================================================
-- 8. KONTROLA FEATURE GATING - zda subscription tier neblokuje přístup
-- ============================================================================
-- Zkontrolujte zda existují nějaké RLS politiky které kontrolují subscription
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual  -- Toto je USING clause
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'projects';

