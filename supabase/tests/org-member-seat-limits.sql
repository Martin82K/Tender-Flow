-- Run only against an isolated schema copy. Synthetic fixtures always roll back.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';
INSERT INTO auth.users(id,email,email_confirmed_at)
SELECT ('96300000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
       'seat-' || i || '@gmail.com', now() FROM generate_series(1,7) i;
INSERT INTO public.organizations(id,name,type,subscription_tier,subscription_status,max_seats)
VALUES ('96300000-0000-4000-8000-000000000010','RPC seat fixture','business','enterprise','trial',1);
INSERT INTO public.organization_members(organization_id,user_id,role,is_active,is_billable)
VALUES
 ('96300000-0000-4000-8000-000000000010','96300000-0000-4000-8000-000000000001','owner',true,true),
 ('96300000-0000-4000-8000-000000000010','96300000-0000-4000-8000-000000000003','member',false,true),
 ('96300000-0000-4000-8000-000000000010','96300000-0000-4000-8000-000000000004','member',true,false);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"96300000-0000-4000-8000-000000000001"}',true);
DO $$
DECLARE target uuid; denied boolean;
BEGIN
  denied := false;
  BEGIN
    PERFORM public.add_org_member('96300000-0000-4000-8000-000000000010','96300000-0000-4000-8000-000000000002');
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Seat limit reached' THEN RAISE; END IF;
    denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'UUID member RPC must reject a new billable seat at capacity'; END IF;

  -- Existing membership is a no-op even at capacity, not a role/activation change.
  FOREACH target IN ARRAY ARRAY[
    '96300000-0000-4000-8000-000000000001'::uuid,
    '96300000-0000-4000-8000-000000000003'::uuid,
    '96300000-0000-4000-8000-000000000004'::uuid
  ] LOOP
    IF NOT public.add_org_member('96300000-0000-4000-8000-000000000010',target,'admin') THEN
      RAISE EXCEPTION 'Existing member add must remain successful';
    END IF;
  END LOOP;

  FOREACH target IN ARRAY ARRAY[
    '96300000-0000-4000-8000-000000000003'::uuid,
    '96300000-0000-4000-8000-000000000004'::uuid
  ] LOOP
    denied := false;
    BEGIN
      PERFORM public.activate_org_member('96300000-0000-4000-8000-000000000010',target);
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM <> 'Seat limit reached' THEN RAISE; END IF;
      denied := true;
    END;
    IF NOT denied THEN RAISE EXCEPTION 'Activation must reserve both inactive and active nonbillable seats'; END IF;
  END LOOP;
  PERFORM public.activate_org_member('96300000-0000-4000-8000-000000000010','96300000-0000-4000-8000-000000000001');

  denied := false;
  BEGIN
    PERFORM public.add_org_member('96300000-0000-4000-8000-000000000010','96300000-0000-4000-8000-000000000002','invalid');
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Invalid role' THEN RAISE; END IF;
    denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Invalid member role must be rejected'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{}',true);
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.organization_members WHERE organization_id='96300000-0000-4000-8000-000000000010' AND user_id='96300000-0000-4000-8000-000000000002') THEN
    RAISE EXCEPTION 'Rejected reservation must not leave membership';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.organization_members WHERE organization_id='96300000-0000-4000-8000-000000000010' AND user_id='96300000-0000-4000-8000-000000000003' AND role='member' AND NOT is_active AND is_billable)
     OR NOT EXISTS(SELECT 1 FROM public.organization_members WHERE organization_id='96300000-0000-4000-8000-000000000010' AND user_id='96300000-0000-4000-8000-000000000004' AND role='member' AND is_active AND NOT is_billable) THEN
    RAISE EXCEPTION 'Duplicate add/rejected activation must preserve inactive and nonbillable membership';
  END IF;
END $$;
UPDATE public.organizations SET max_seats=4 WHERE id='96300000-0000-4000-8000-000000000010';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"96300000-0000-4000-8000-000000000001"}',true);
SELECT public.add_org_member('96300000-0000-4000-8000-000000000010','96300000-0000-4000-8000-000000000002','admin');
SELECT public.activate_org_member('96300000-0000-4000-8000-000000000010','96300000-0000-4000-8000-000000000003');
SELECT public.activate_org_member('96300000-0000-4000-8000-000000000010','96300000-0000-4000-8000-000000000004');
RESET ROLE;
SELECT set_config('request.jwt.claims','{}',true);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.organization_members WHERE organization_id='96300000-0000-4000-8000-000000000010' AND is_active AND is_billable) <> 4 THEN
    RAISE EXCEPTION 'Available capacity must permit add and both activation states';
  END IF;
END $$;
-- Authentication, other-tenant owners, ordinary members and disabled owners.
UPDATE public.organizations SET max_seats=NULL WHERE id='96300000-0000-4000-8000-000000000010';
SET LOCAL ROLE authenticated;
DO $$ DECLARE actor uuid; denied boolean; BEGIN
  FOREACH actor IN ARRAY ARRAY['96300000-0000-4000-8000-000000000003'::uuid,'96300000-0000-4000-8000-000000000005'::uuid] LOOP
    PERFORM set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',actor)::text,true);
    denied := false;
    BEGIN PERFORM public.add_org_member('96300000-0000-4000-8000-000000000010','96300000-0000-4000-8000-000000000006');
    EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Not authorized' THEN RAISE; END IF; denied := true; END;
    IF NOT denied THEN RAISE EXCEPTION 'Non-owner cannot add to another organization'; END IF;
  END LOOP;
END $$;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"96300000-0000-4000-8000-000000000001"}',true);
SELECT public.add_org_member('96300000-0000-4000-8000-000000000010','96300000-0000-4000-8000-000000000005');
RESET ROLE;
SELECT set_config('request.jwt.claims','{}',true);
UPDATE public.organizations SET max_seats=0 WHERE id='96300000-0000-4000-8000-000000000010';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"96300000-0000-4000-8000-000000000001"}',true);
DO $$ DECLARE denied boolean := false; BEGIN
  BEGIN PERFORM public.add_org_member('96300000-0000-4000-8000-000000000010','96300000-0000-4000-8000-000000000006');
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Seat limit reached' THEN RAISE; END IF; denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Zero/overfull capacity must deny a new seat'; END IF;
  PERFORM public.add_org_member('96300000-0000-4000-8000-000000000010','96300000-0000-4000-8000-000000000005');
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{}',true);
-- Legitimate email add and verified request approval consume the remaining seats.
UPDATE auth.users SET email='seat-7@seat-approval.invalid' WHERE id='96300000-0000-4000-8000-000000000007';
INSERT INTO private.verified_organization_domains(domain,organization_id,evidence)
VALUES('seat-approval.invalid','96300000-0000-4000-8000-000000000010','Synthetic DNS verification');
UPDATE public.organizations SET max_seats=7 WHERE id='96300000-0000-4000-8000-000000000010';
INSERT INTO public.organization_join_requests(id,organization_id,user_id,email)
VALUES('96300000-0000-4000-8000-000000000020','96300000-0000-4000-8000-000000000010','96300000-0000-4000-8000-000000000007','seat-7@seat-approval.invalid');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"96300000-0000-4000-8000-000000000001"}',true);
SELECT public.add_org_member_by_email('96300000-0000-4000-8000-000000000010','seat-6@gmail.com');
SELECT public.approve_org_join_request('96300000-0000-4000-8000-000000000020');
SELECT public.add_org_member_by_email('96300000-0000-4000-8000-000000000010','seat-6@gmail.com','admin');
RESET ROLE;
SELECT set_config('request.jwt.claims','{}',true);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.organization_members WHERE organization_id='96300000-0000-4000-8000-000000000010' AND is_active AND is_billable) <> 7
     OR NOT EXISTS(SELECT 1 FROM public.organization_join_requests WHERE id='96300000-0000-4000-8000-000000000020' AND status='approved')
     OR NOT EXISTS(SELECT 1 FROM public.organization_members WHERE organization_id='96300000-0000-4000-8000-000000000010' AND user_id='96300000-0000-4000-8000-000000000006' AND role='member') THEN
    RAISE EXCEPTION 'Email add, approval and duplicate role preservation must remain supported';
  END IF;
END $$;
UPDATE public.organization_members SET is_active=false WHERE organization_id='96300000-0000-4000-8000-000000000010' AND user_id='96300000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"96300000-0000-4000-8000-000000000001"}',true);
DO $$ DECLARE denied boolean := false; BEGIN
  BEGIN PERFORM public.add_org_member('96300000-0000-4000-8000-000000000010','96300000-0000-4000-8000-000000000006');
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Not authorized' THEN RAISE; END IF; denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Disabled owner must not add members'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF has_function_privilege('anon','public.add_org_member(uuid,uuid,text)','EXECUTE')
     OR has_function_privilege('anon','public.activate_org_member(uuid,uuid)','EXECUTE')
     OR has_function_privilege('anon','public.add_org_member_by_email(uuid,text,text)','EXECUTE')
     OR has_function_privilege('anon','public.approve_org_join_request(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous roles must not execute member mutation RPCs';
  END IF;
END $$;
ROLLBACK;
