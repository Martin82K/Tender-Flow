BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';
-- Preserve the existing signed project payload/legacy restore contract in private helpers.
DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('private.budget_backup_export(jsonb)'::regprocedure) INTO definition;
 IF position('''catalog'',COALESCE(' IN definition)=0 THEN RAISE EXCEPTION 'Unexpected budget exporter'; END IF;
 definition:=replace(definition,'FUNCTION private.budget_backup_export(', 'FUNCTION private.budget_backup_export_projects(');
 definition:=replace(definition,'''catalog'',COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.id) FROM public.construction_budget_catalog c WHERE c.organization_id=(manifest->>''organization_id'')::uuid),''[]''),', '''catalog'',''[]''::jsonb,');
 IF position('FROM public.construction_budget_catalog' IN definition)>0 THEN RAISE EXCEPTION 'Catalog must be exported exactly once'; END IF;
 EXECUTE definition;
 SELECT pg_get_functiondef('private.budget_backup_restore(jsonb,uuid,text)'::regprocedure) INTO definition;
 definition:=replace(definition,'FUNCTION private.budget_backup_restore(', 'FUNCTION private.budget_backup_restore_projects(');
 EXECUTE definition;
END $migration$;
REVOKE ALL ON FUNCTION private.budget_backup_export_projects(jsonb),private.budget_backup_restore_projects(jsonb,uuid,text) FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION private.budget_backup_export(manifest jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb; payload text; org_id uuid:=(manifest->>'organization_id')::uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_org_member(org_id) OR NOT public.has_resource_subscription(org_id)
 THEN RAISE EXCEPTION 'Catalog backup denied' USING ERRCODE='42501'; END IF;
 result:=private.budget_backup_export_projects(manifest);
 SELECT jsonb_build_object('version',1,'kind','organization-budget-catalog','organization_id',org_id,
   'items',COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.id),'[]'::jsonb))::text INTO payload
 FROM public.construction_budget_catalog c WHERE c.organization_id=org_id;
 RETURN result || jsonb_build_object('construction_budget_catalog',jsonb_build_object('payload',payload,'signature',private.budget_backup_signature(payload)));
END $$;

CREATE OR REPLACE FUNCTION private.budget_backup_restore(manifest jsonb,org_id uuid,scope text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE envelope jsonb; snapshot jsonb; item jsonb; catalog public.construction_budget_catalog;
BEGIN
 IF manifest ? 'construction_budget_catalog' THEN
   IF auth.uid() IS NULL OR scope IS NULL OR scope NOT IN ('user','tenant')
      OR (scope='tenant' AND NOT public.is_org_admin(org_id)) OR NOT public.is_org_member(org_id)
      OR NOT public.has_resource_subscription(org_id)
   THEN RAISE EXCEPTION 'Catalog restore denied' USING ERRCODE='42501'; END IF;
   envelope:=manifest->'construction_budget_catalog';
   IF envelope->>'payload' IS NULL OR envelope->>'signature' IS NULL
      OR private.budget_backup_signature(envelope->>'payload') IS DISTINCT FROM envelope->>'signature'
   THEN RAISE EXCEPTION 'Invalid catalog backup signature' USING ERRCODE='42501'; END IF;
   snapshot:=(envelope->>'payload')::jsonb;
   IF snapshot->>'version' IS DISTINCT FROM '1' OR snapshot->>'kind' IS DISTINCT FROM 'organization-budget-catalog'
      OR (snapshot->>'organization_id')::uuid IS DISTINCT FROM org_id
      OR jsonb_typeof(snapshot->'items') IS DISTINCT FROM 'array'
   THEN RAISE EXCEPTION 'Foreign catalog backup' USING ERRCODE='42501'; END IF;
   FOR item IN SELECT value FROM jsonb_array_elements(snapshot->'items') LOOP
     catalog:=jsonb_populate_record(NULL::public.construction_budget_catalog,item);
     IF catalog.organization_id IS DISTINCT FROM org_id
        OR EXISTS(SELECT 1 FROM public.construction_budget_catalog c WHERE c.id=catalog.id AND c.organization_id<>org_id)
     THEN RAISE EXCEPTION 'Foreign catalog item' USING ERRCODE='42501'; END IF;
     IF NOT EXISTS(SELECT 1 FROM public.construction_budget_catalog c WHERE c.id=catalog.id) THEN
       IF NOT public.is_active_org_admin_or_owner(org_id)
       THEN RAISE EXCEPTION 'Obnova chybějícího firemního číselníku vyžaduje správce organizace.' USING ERRCODE='42501'; END IF;
       INSERT INTO public.construction_budget_catalog SELECT catalog.* ON CONFLICT(id) DO NOTHING;
     END IF;
   END LOOP;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(snapshot->'items') s
     WHERE NOT EXISTS(SELECT 1 FROM public.construction_budget_catalog c WHERE c.id=(s->>'id')::uuid AND c.organization_id=org_id))
   THEN RAISE EXCEPTION 'Incomplete catalog restore'; END IF;
 END IF;
 RETURN private.budget_backup_restore_projects(manifest,org_id,scope);
END $$;
REVOKE ALL ON FUNCTION private.budget_backup_export(jsonb),private.budget_backup_restore(jsonb,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
