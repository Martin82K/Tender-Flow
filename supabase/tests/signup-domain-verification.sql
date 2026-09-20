-- Synthetic accounts in an isolated schema only. No customer data.
BEGIN;
DO $$
DECLARE first_user uuid:=gen_random_uuid(); second_user uuid:=gen_random_uuid(); first_org uuid; second_org uuid; domain text;
BEGIN
  FOREACH domain IN ARRAY ARRAY['protonmail.ch','yahoo.de','mail.ru','unrecognized-provider.invalid'] LOOP
    first_user:=gen_random_uuid(); second_user:=gen_random_uuid();
    INSERT INTO auth.users(id,email,email_confirmed_at) VALUES(first_user,first_user||'@'||domain,now());
    SELECT organization_id INTO first_org FROM public.organization_members WHERE user_id=first_user;
    UPDATE public.organizations SET max_seats=5 WHERE id=first_org;
    INSERT INTO auth.users(id,email,email_confirmed_at) VALUES(second_user,second_user||'@'||domain,now());
    SELECT organization_id INTO second_org FROM public.organization_members WHERE user_id=second_user;
    IF second_org=first_org OR EXISTS(SELECT 1 FROM public.organization_members WHERE organization_id=first_org AND user_id=second_user) THEN
      RAISE EXCEPTION 'Unknown provider must not grant access to an unrelated tenant';
    END IF;
    IF EXISTS(SELECT 1 FROM public.organizations WHERE id IN(first_org,second_org) AND (type<>'personal' OR cardinality(domain_whitelist)>0)) THEN
      RAISE EXCEPTION 'Unverified domains must provision isolated personal workspaces';
    END IF;
  END LOOP;
END $$;
ROLLBACK;

BEGIN;
-- A historical whitelist is not proof; preserve its members but deny automatic joins.
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('96300000-0000-4000-8000-000000000001','owner@verified-company.invalid',now());
UPDATE public.organizations SET type='business',max_seats=4,domain_whitelist=ARRAY['verified-company.invalid']
 WHERE owner_user_id='96300000-0000-4000-8000-000000000001';
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('96300000-0000-4000-8000-000000000002','member@verified-company.invalid',now());
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.organization_members m JOIN public.organizations o ON o.id=m.organization_id WHERE m.user_id='96300000-0000-4000-8000-000000000002' AND o.type='business') THEN RAISE EXCEPTION 'Historical whitelist must not grant membership'; END IF;
END $$;
SELECT set_config('test.company_id',(SELECT id::text FROM public.organizations WHERE owner_user_id='96300000-0000-4000-8000-000000000001'),true);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"96300000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","email":"owner@verified-company.invalid"}',true);
DO $$ DECLARE denied boolean:=false; BEGIN
 BEGIN PERFORM public.admin_set_verified_org_domain(current_setting('test.company_id')::uuid,'verified-company.invalid','Synthetic DNS verification'); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Ordinary company owner cannot attest a domain'; END IF;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"96300000-0000-4000-8000-000000000002","role":"authenticated","email":"member@verified-company.invalid"}',true);
DO $$ DECLARE denied boolean:=false; BEGIN
 BEGIN PERFORM public.request_org_join_by_email('member@verified-company.invalid'); EXCEPTION WHEN OTHERS THEN denied:=SQLERRM='Organization not found for domain'; END;
 IF NOT denied THEN RAISE EXCEPTION 'Manual request must reject unverified domain'; END IF;
 denied:=false;
 BEGIN INSERT INTO public.organization_join_requests(organization_id,user_id,email) VALUES(current_setting('test.company_id')::uuid,auth.uid(),'member@verified-company.invalid'); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Direct RLS insert must reject unverified domain'; END IF;
END $$;
RESET ROLE;
INSERT INTO public.platform_admins(user_id) VALUES('96300000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"96300000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
DO $$ DECLARE denied boolean:=false; BEGIN
 BEGIN PERFORM public.admin_set_verified_org_domain(current_setting('test.company_id')::uuid,'verified-company.invalid','Synthetic DNS verification'); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Platform admin needs MFA'; END IF;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"96300000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
SELECT public.admin_set_verified_org_domain(current_setting('test.company_id')::uuid,' VERIFIED-COMPANY.INVALID ','Synthetic DNS verification');
RESET ROLE;
SELECT set_config('request.jwt.claims','{}',true);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM private.verified_organization_domains WHERE domain='verified-company.invalid' AND verified_by='96300000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'Verified domain must store normalized attestation'; END IF;
END $$;
-- Email-update trigger and explicit requests use the same registry.
UPDATE auth.users SET email='updated@verified-company.invalid' WHERE id='96300000-0000-4000-8000-000000000002';
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES('96300000-0000-4000-8000-000000000003','new@verified-company.invalid',now());
DO $$ BEGIN
 IF (SELECT count(*) FROM public.organization_members WHERE organization_id=current_setting('test.company_id')::uuid)<>3 THEN RAISE EXCEPTION 'Verified company must support initial and email-update joins'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"96300000-0000-4000-8000-000000000002","role":"authenticated","email":"updated@verified-company.invalid"}',true);
SELECT public.request_org_join_by_email('updated@verified-company.invalid');
DELETE FROM public.organization_join_requests WHERE user_id=auth.uid();
INSERT INTO public.organization_join_requests(organization_id,user_id,email) VALUES(current_setting('test.company_id')::uuid,auth.uid(),'updated@verified-company.invalid');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SELECT public.admin_set_verified_org_domain(current_setting('test.company_id')::uuid,'verified-company.invalid',NULL,false);
SELECT set_config('request.jwt.claims','{}',true);
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES('96300000-0000-4000-8000-000000000004','after-revoke@verified-company.invalid',now());
DO $$ BEGIN
 IF (SELECT count(*) FROM public.organization_members WHERE organization_id=current_setting('test.company_id')::uuid)<>3 THEN RAISE EXCEPTION 'Revocation must preserve existing membership and prevent new joins'; END IF;
 IF EXISTS(SELECT 1 FROM public.organization_join_requests WHERE user_id='96300000-0000-4000-8000-000000000004') THEN RAISE EXCEPTION 'Revoked domain must not create a legacy join request'; END IF;
END $$;
ROLLBACK;
