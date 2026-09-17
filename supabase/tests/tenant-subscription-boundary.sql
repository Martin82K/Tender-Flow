-- Run with psql -v ON_ERROR_STOP=1 against an isolated database, never production.
BEGIN;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '2s';
-- Synthetic identities: bypass signup provisioning while building the fixture.
SET LOCAL session_replication_role = replica;
INSERT INTO auth.users(id, email) VALUES
 ('10000000-0000-4000-8000-000000000001', 'license-fixture@example.invalid');
INSERT INTO public.user_profiles(user_id, subscription_status, stripe_subscription_tier)
VALUES ('10000000-0000-4000-8000-000000000001', 'expired', 'free');
INSERT INTO public.organizations(id, name, type, owner_user_id, subscription_tier, subscription_status, expires_at, billing_period_end)
VALUES
 ('20000000-0000-4000-8000-000000000001', 'Licensed A', 'business', '10000000-0000-4000-8000-000000000001', 'enterprise', 'trial', now()+interval '7 days', now()+interval '7 days'),
 ('20000000-0000-4000-8000-000000000002', 'Expired B', 'business', '10000000-0000-4000-8000-000000000001', 'enterprise', 'expired', now()-interval '1 day', now()-interval '1 day');
INSERT INTO public.organization_members(organization_id, user_id, role, is_active)
SELECT id, '10000000-0000-4000-8000-000000000001', 'owner', true
FROM public.organizations WHERE id IN ('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002');
INSERT INTO public.projects(id,name,status,owner_id,organization_id)
VALUES
 ('license-active', 'Licensed project', 'tender', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001'),
 ('license-expired', 'Expired project', 'tender', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002');
INSERT INTO public.subscription_tier_features(tier,feature_key,enabled) VALUES ('enterprise','module_projects',true),('enterprise','module_contracts',true) ON CONFLICT DO NOTHING;
INSERT INTO public.subcontractors(id,company_name,owner_id,organization_id) VALUES
 ('license-contact-a','Contact A','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001'),
 ('license-contact-b','Contact B','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002');
INSERT INTO public.demand_categories(id,project_id,title) VALUES ('license-category-b','license-expired','Expired category');
INSERT INTO public.bids(id,category_id,demand_category_id,company_name) VALUES ('license-bid-b','license-category-b','license-category-b','Hidden bid');
INSERT INTO public.bid_tags(bid_id,tag) VALUES ('license-bid-b','Hidden tag');
INSERT INTO storage.buckets(id,name,public) VALUES ('contract-documents','contract-documents',false) ON CONFLICT DO NOTHING;
INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES
 ('contract-documents','projects/license-active/contracts/test.pdf','10000000-0000-4000-8000-000000000001'),
 ('contract-documents','projects/license-expired/contracts/test.pdf','10000000-0000-4000-8000-000000000001');
INSERT INTO public.subcontractor_statuses(id,label,organization_id) VALUES ('license-global-status','Global status',NULL);
INSERT INTO public.project_access_audit_events(organization_id,project_id,event_type) VALUES ('20000000-0000-4000-8000-000000000002','license-expired','project_created');
INSERT INTO auth.users(id,email) VALUES ('10000000-0000-4000-8000-000000000002','shared-fixture@example.invalid');
INSERT INTO public.user_profiles(user_id,subscription_status,stripe_subscription_tier) VALUES ('10000000-0000-4000-8000-000000000002','active','pro');
INSERT INTO public.project_shares(project_id,user_id,permission,legacy_external) VALUES
 ('license-active','10000000-0000-4000-8000-000000000002','view',true),
 ('license-expired','10000000-0000-4000-8000-000000000002','view',true);
INSERT INTO auth.oauth_clients(id,registration_type,redirect_uris,grant_types,token_endpoint_auth_method) VALUES ('30000000-0000-4000-8000-000000000001','manual','https://example.invalid','authorization_code','client_secret_post');
INSERT INTO auth.oauth_consents(id,user_id,client_id,scopes) VALUES ('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','openid');
INSERT INTO public.mcp_oauth_client_resources(client_id,resource,enabled) VALUES ('30000000-0000-4000-8000-000000000001','https://www.tenderflow.cz/api/mcp',true);
INSERT INTO mcp_private.mcp_backend_proof(singleton,proof_hash) VALUES (true,repeat('a',64)) ON CONFLICT(singleton) DO UPDATE SET proof_hash=excluded.proof_hash;
INSERT INTO public.subcontractors(id,company_name,owner_id,organization_id) VALUES ('license-legacy-contact','Legacy contact','10000000-0000-4000-8000-000000000001',NULL);
SET LOCAL session_replication_role = origin;
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF NOT public.has_active_subscription() THEN RAISE EXCEPTION 'control: account must retain its active A licence'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.projects WHERE id='license-active') THEN RAISE EXCEPTION 'control: licensed A must remain readable'; END IF;
  IF EXISTS(SELECT 1 FROM public.projects WHERE id='license-expired') THEN RAISE EXCEPTION 'REGRESSION: A licence unlocks expired B through project RLS'; END IF;
  IF public.can_project_action('license-expired','view') THEN RAISE EXCEPTION 'REGRESSION: privileged project helper unlocks B'; END IF;
END $$;
DO $$ DECLARE n integer; command text; denied boolean; BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.subcontractors WHERE id='license-legacy-contact') THEN RAISE EXCEPTION 'Legacy owner contact lost'; END IF;
  IF EXISTS(SELECT 1 FROM public.subcontractors WHERE id='license-contact-b') THEN RAISE EXCEPTION 'Expired contact readable'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.subcontractors WHERE id='license-contact-a') THEN RAISE EXCEPTION 'Licensed contact hidden'; END IF;
  IF EXISTS(SELECT 1 FROM public.bids WHERE id='license-bid-b') OR EXISTS(SELECT 1 FROM public.bid_tags WHERE bid_id='license-bid-b') THEN RAISE EXCEPTION 'Indirect child bypass'; END IF;
  IF EXISTS(SELECT 1 FROM storage.objects WHERE name='projects/license-expired/contracts/test.pdf') THEN RAISE EXCEPTION 'Storage bypass'; END IF;
  IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE name='projects/license-active/contracts/test.pdf') THEN RAISE EXCEPTION 'Licensed storage hidden'; END IF;
  UPDATE public.projects SET name='Still licensed' WHERE id='license-active'; GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>1 THEN RAISE EXCEPTION 'Licensed write blocked'; END IF;
  UPDATE public.projects SET name='Must not write' WHERE id='license-expired'; GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>0 THEN RAISE EXCEPTION 'Expired write bypass'; END IF;
  FOREACH command IN ARRAY ARRAY[
    'SELECT public.export_user_backup(''20000000-0000-4000-8000-000000000002'')',
    'SELECT public.export_tenant_backup(''20000000-0000-4000-8000-000000000002'')',
    'SELECT public.restore_user_backup(''{}'',''20000000-0000-4000-8000-000000000002'')',
    'SELECT public.restore_tenant_backup(''{}'',''20000000-0000-4000-8000-000000000002'')',
    'SELECT public.clone_tender_project_to_realization(''license-expired'')',
    'SELECT public.create_project_with_team(''blocked-create'',''x'',''x'',''tender'',''20000000-0000-4000-8000-000000000002'',''[]'')'
  ] LOOP
    denied:=false;
    BEGIN EXECUTE command; EXCEPTION WHEN SQLSTATE 'PT402' THEN denied:=true; END;
    IF NOT denied THEN RAISE EXCEPTION 'Privileged RPC bypass: %',command; END IF;
  END LOOP;
  IF has_function_privilege(current_user,'public.has_project_subscription_for_user(text,uuid)','EXECUTE') THEN RAISE EXCEPTION 'Actor spoofing RPC exposed'; END IF;
  denied:=false; BEGIN PERFORM public.get_contract_overview('20000000-0000-4000-8000-000000000002',false); EXCEPTION WHEN OTHERS THEN denied:=SQLERRM='Přístup ke smluvnímu přehledu nebyl udělen'; END;
  IF NOT denied THEN RAISE EXCEPTION 'Overview bypass or unexpected error'; END IF;
  IF EXISTS(SELECT 1 FROM public.project_access_audit_events WHERE project_id='license-expired') THEN RAISE EXCEPTION 'Expired audit readable'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.subcontractor_statuses WHERE id='license-global-status') THEN RAISE EXCEPTION 'Global status hidden for business user'; END IF;
  -- Expired organizations still remain visible to billing/bootstrap.
  IF NOT EXISTS(SELECT 1 FROM public.organizations WHERE id='20000000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'Billing recovery blocked'; END IF;
END $$;
RESET ROLE;
-- A valid override on the target organization restores access; another org never does.
UPDATE public.organizations SET override_tier='enterprise',override_expires_at=now()+interval '1 day' WHERE id='20000000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.projects WHERE id='license-expired') THEN RAISE EXCEPTION 'Target override rejected'; END IF;
END $$;
RESET ROLE;
UPDATE public.organizations SET override_expires_at=now()-interval '1 second' WHERE id='20000000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.projects WHERE id='license-expired') THEN RAISE EXCEPTION 'Expired override accepted'; END IF;
END $$;
RESET ROLE;
-- Legacy personal licence remains usable and cannot revive a business tenant.
SELECT set_config('request.jwt.claims','{}',true);
UPDATE public.user_profiles SET subscription_status='active',stripe_subscription_tier='pro',subscription_expires_at=now()+interval '30 days' WHERE user_id='10000000-0000-4000-8000-000000000001';
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF NOT public.has_resource_subscription(NULL) THEN RAISE EXCEPTION 'Legacy personal licence lost'; END IF;
  IF public.has_resource_subscription('20000000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'Personal licence unlocks business tenant'; END IF;
END $$;
RESET ROLE;
-- The trusted callback uses the same target licence with its server-side identity.
SET LOCAL ROLE service_role;
DO $$ BEGIN
  IF public.has_project_subscription_for_user('license-expired','10000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'OAuth project boundary bypass'; END IF;
  IF NOT public.has_project_subscription_for_user('license-active','10000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'OAuth licensed control blocked'; END IF;
END $$;
RESET ROLE;
-- Legacy external shares are still governed by the target project licence.
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.projects WHERE id='license-active') THEN RAISE EXCEPTION 'Licensed external share lost'; END IF;
  IF EXISTS(SELECT 1 FROM public.projects WHERE id='license-expired') THEN RAISE EXCEPTION 'External share bypasses expiry'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.headers',jsonb_build_object('x-tenderflow-mcp-proof',repeat('a',64))::text,true);
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"tenderflow_mcp_client","client_id":"30000000-0000-4000-8000-000000000001"}',true);
SET LOCAL ROLE tenderflow_mcp_client;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.projects WHERE id='license-active') THEN RAISE EXCEPTION 'Licensed MCP access lost'; END IF;
  IF EXISTS(SELECT 1 FROM public.projects WHERE id='license-expired') THEN RAISE EXCEPTION 'MCP bypasses tenant expiry'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{}',true);
INSERT INTO public.platform_admins(user_id,reason) VALUES ('10000000-0000-4000-8000-000000000001','Synthetic licence control');
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF NOT public.has_project_subscription('license-expired') THEN RAISE EXCEPTION 'Platform admin licence exemption lost'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'tenant subscription regression passed' AS result;
