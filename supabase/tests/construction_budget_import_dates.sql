-- Run in BEGIN/ROLLBACK. Only synthetic source/version records are created.
CREATE TEMP TABLE budget_dates_context AS SELECT p.id AS project_id,p.owner_id,p.organization_id
FROM public.projects p JOIN public.organization_members m ON m.organization_id=p.organization_id AND m.user_id=p.owner_id AND m.is_active AND m.role IN ('owner','admin') WHERE p.status<>'archived' LIMIT 1;
GRANT SELECT ON budget_dates_context TO authenticated;
SELECT set_config('request.jwt.claim.sub',(SELECT owner_id::text FROM budget_dates_context),true);
SET LOCAL ROLE authenticated;
DO $$
DECLARE p text; src jsonb; rev jsonb; doc jsonb; stamp timestamptz; denied boolean; org uuid;
BEGIN
 SELECT project_id,organization_id INTO p,org FROM budget_dates_context;
 IF NOT private.budget_access(p,'edit') THEN RAISE EXCEPTION 'No licensed fixture'; END IF;
 src:=public.construction_budget_source(p,'dates-synthetic.xlsx',repeat('d',64));
 IF (src->>'first_converted_at') IS NOT NULL THEN RAISE EXCEPTION 'Attachment already converted'; END IF;
 doc:='{"schemaVersion":1,"origin":"copy","sheets":[],"issues":[],"figures":{},"nodes":[]}'::jsonb;
 rev:=public.construction_budget_save(p,(src->>'id')::uuid,NULL,0,'Copy fixture',doc,'[]',false);
 SELECT first_converted_at INTO stamp FROM public.construction_budget_sources WHERE id=(src->>'id')::uuid;
 IF stamp IS NOT NULL THEN RAISE EXCEPTION 'Copy changed conversion date'; END IF;
 doc:=jsonb_set(doc,'{origin}','"import"');
 rev:=public.construction_budget_save(p,(src->>'id')::uuid,NULL,0,'Import fixture',doc,'[]',false);
 SELECT first_converted_at INTO stamp FROM public.construction_budget_sources WHERE id=(src->>'id')::uuid;
 IF stamp IS DISTINCT FROM (rev->>'created_at')::timestamptz THEN RAISE EXCEPTION 'Conversion timestamp missing'; END IF;
 IF NOT public.is_active_org_admin_or_owner(org) THEN RAISE EXCEPTION 'Catalog permission mismatch'; END IF;
 INSERT INTO public.construction_budget_catalog(organization_id,kind,name,color) VALUES(org,'tag','__budget_dates_rls_fixture__','#64748b');
 PERFORM set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
 IF EXISTS(SELECT 1 FROM public.construction_budget_catalog WHERE organization_id=org) THEN RAISE EXCEPTION 'Foreign catalog visible'; END IF;
 denied:=false;
 BEGIN INSERT INTO public.construction_budget_catalog(organization_id,kind,name,color) VALUES(org,'tag','__foreign_fixture__','#64748b'); EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Foreign catalog insert accepted'; END IF;
END $$;
RESET ROLE;
SELECT 'conversion dates, copy exclusion and catalog tenant isolation passed' AS result;
