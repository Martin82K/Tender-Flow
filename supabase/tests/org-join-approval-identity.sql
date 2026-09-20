-- Isolated PostgreSQL only: synthetic identities, transactional rollback, no mail keys.
BEGIN;
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('96400000-0000-4000-8000-000000000001','approval-owner@gmail.com',now()),
 ('96400000-0000-4000-8000-000000000002','approval-candidate@gmail.com',now());
INSERT INTO public.organizations(id,name,type,owner_user_id,subscription_tier,subscription_status,max_seats)
VALUES('96400000-0000-4000-8000-000000000010','Approval identity fixture','business','96400000-0000-4000-8000-000000000001','enterprise','active',1);
INSERT INTO public.organization_members(organization_id,user_id,role)
VALUES('96400000-0000-4000-8000-000000000010','96400000-0000-4000-8000-000000000001','owner');
INSERT INTO private.verified_organization_domains(domain,organization_id,evidence)
VALUES('approval-fixture.invalid','96400000-0000-4000-8000-000000000010','Synthetic DNS verification');
UPDATE auth.users SET email='candidate@approval-fixture.invalid' WHERE id='96400000-0000-4000-8000-000000000002';
DO $$ DECLARE mode text; denied boolean; request_id uuid; BEGIN
 SELECT id INTO STRICT request_id FROM public.organization_join_requests WHERE organization_id='96400000-0000-4000-8000-000000000010' AND user_id='96400000-0000-4000-8000-000000000002';
 FOREACH mode IN ARRAY ARRAY['changed_email','same_domain_alias','revoked','reassigned','unconfirmed'] LOOP
  PERFORM set_config('request.jwt.claims','{}',true);
  UPDATE auth.users SET email='candidate@approval-fixture.invalid',email_confirmed_at=now() WHERE id='96400000-0000-4000-8000-000000000002';
  INSERT INTO private.verified_organization_domains(domain,organization_id,evidence) VALUES('approval-fixture.invalid','96400000-0000-4000-8000-000000000010','Synthetic DNS verification') ON CONFLICT(domain) DO UPDATE SET organization_id=EXCLUDED.organization_id;
  UPDATE public.organization_join_requests SET email='candidate@approval-fixture.invalid',status='pending' WHERE id=request_id;
  IF mode='changed_email' THEN UPDATE auth.users SET email='outside@gmail.com' WHERE id='96400000-0000-4000-8000-000000000002'; END IF;
  IF mode='same_domain_alias' THEN UPDATE auth.users SET email='alias@approval-fixture.invalid' WHERE id='96400000-0000-4000-8000-000000000002'; END IF;
  IF mode='revoked' THEN DELETE FROM private.verified_organization_domains WHERE domain='approval-fixture.invalid'; END IF;
  IF mode='reassigned' THEN UPDATE private.verified_organization_domains SET organization_id=(SELECT id FROM public.organizations WHERE owner_user_id='96400000-0000-4000-8000-000000000001' AND type='personal' LIMIT 1) WHERE domain='approval-fixture.invalid'; END IF;
  IF mode='unconfirmed' THEN UPDATE auth.users SET email_confirmed_at=NULL WHERE id='96400000-0000-4000-8000-000000000002'; END IF;
  UPDATE public.organizations SET max_seats=2 WHERE id='96400000-0000-4000-8000-000000000010';
  PERFORM set_config('request.jwt.claims','{"role":"authenticated","sub":"96400000-0000-4000-8000-000000000001"}',true);
  denied:=false;
  BEGIN PERFORM public.approve_org_join_request(request_id); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Stale approval must reject %',mode; END IF;
  denied:=false;
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN UPDATE public.organization_join_requests SET status='approved' WHERE id=request_id; EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
  EXECUTE 'RESET ROLE';
  IF NOT denied THEN RAISE EXCEPTION 'Shared approval trigger must reject %',mode; END IF;
  IF EXISTS(SELECT 1 FROM public.organization_members WHERE organization_id='96400000-0000-4000-8000-000000000010' AND user_id='96400000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'Rejected approval must not add a member'; END IF;
  UPDATE public.organizations SET max_seats=1 WHERE id='96400000-0000-4000-8000-000000000010';
 END LOOP;
END $$;
-- A refreshed valid request remains approvable; explicit owner additions stay independent of domains.
SELECT set_config('request.jwt.claims','{}',true);
UPDATE auth.users SET email='candidate@approval-fixture.invalid',email_confirmed_at=now() WHERE id='96400000-0000-4000-8000-000000000002';
UPDATE public.organization_join_requests SET status='rejected' WHERE user_id='96400000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"96400000-0000-4000-8000-000000000002","email":"candidate@approval-fixture.invalid"}',true);
SELECT public.request_org_join_by_email('candidate@approval-fixture.invalid');
RESET ROLE;
UPDATE public.organizations SET max_seats=3 WHERE id='96400000-0000-4000-8000-000000000010';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"96400000-0000-4000-8000-000000000001"}',true);
SELECT public.approve_org_join_request(id) FROM public.organization_join_requests WHERE user_id='96400000-0000-4000-8000-000000000002';
SELECT public.approve_org_join_request(id) FROM public.organization_join_requests WHERE user_id='96400000-0000-4000-8000-000000000002';
RESET ROLE;
SELECT set_config('request.jwt.claims','{}',true);
-- Closing an old pending snapshot for an existing member must not brick confirmation.
UPDATE public.organization_join_requests SET email='older@approval-fixture.invalid',status='pending' WHERE user_id='96400000-0000-4000-8000-000000000002';
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SELECT public.maybe_create_org_join_request('96400000-0000-4000-8000-000000000002','candidate@approval-fixture.invalid');
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.organization_join_requests WHERE user_id='96400000-0000-4000-8000-000000000002' AND status='approved' AND email='candidate@approval-fixture.invalid') THEN RAISE EXCEPTION 'Automatic closure must refresh verified address'; END IF;
END $$;
ROLLBACK;
