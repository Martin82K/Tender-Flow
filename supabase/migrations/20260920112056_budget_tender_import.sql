BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';

ALTER TABLE public.demand_categories ADD COLUMN external_code text
  CHECK (external_code IS NULL OR length(external_code) <= 100);
COMMENT ON COLUMN public.demand_categories.external_code IS 'Optional project-local tender code; text preserves leading zeros. Never an internal category ID.';

-- Serialize catalog snapshots with ordinary category edits as well as imports.
CREATE FUNCTION private.budget_tender_catalog_lock() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='UPDATE' AND NEW.project_id IS DISTINCT FROM OLD.project_id THEN
   PERFORM pg_advisory_xact_lock(hashtextextended('budget-categories:'||p,0))
   FROM (SELECT OLD.project_id p UNION SELECT NEW.project_id) projects ORDER BY p;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('budget-categories:'||CASE WHEN TG_OP='DELETE' THEN OLD.project_id ELSE NEW.project_id END,0));
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.budget_tender_catalog_lock() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER budget_tender_catalog_lock BEFORE INSERT OR UPDATE OR DELETE ON public.demand_categories
 FOR EACH ROW EXECUTE FUNCTION private.budget_tender_catalog_lock();

CREATE TABLE private.budget_tender_import_operations (
 project_id text NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
 operation_id uuid NOT NULL,
 actor_id uuid NOT NULL,
 request_hash text NOT NULL,
 revision_id uuid REFERENCES public.construction_budget_revisions(id) ON DELETE SET NULL,
 created_category_ids jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(project_id,operation_id)
);
ALTER TABLE private.budget_tender_import_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.budget_tender_import_operations FROM PUBLIC,anon,authenticated,service_role;
CREATE INDEX budget_tender_import_revision_idx ON private.budget_tender_import_operations(revision_id);

CREATE FUNCTION private.budget_tender_import(project_input text,request_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 operation uuid; request_hash text; previous_operation private.budget_tender_import_operations;
 mode text; base public.construction_budget_revisions; saved jsonb; document jsonb; allocations jsonb;
 catalog jsonb; definition jsonb; created_ids jsonb := '[]'; source_id uuid; revision_id uuid;
 assignments jsonb; new_categories jsonb; invalid boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT private.budget_access(project_input,'read') OR NOT private.budget_access(project_input,'edit')
    OR NOT private.budget_access(project_input,'prices') OR NOT private.budget_access(project_input,'allocate')
    OR NOT public.can_project_module_action(project_input,'module_pipeline',true)
 THEN RAISE EXCEPTION 'Import VŘ není povolen.' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(request_input) IS DISTINCT FROM 'object' OR pg_column_size(request_input)>100000000
 THEN RAISE EXCEPTION 'Neplatný požadavek importu.'; END IF;
 operation := (request_input->>'operationId')::uuid;
 mode := request_input->>'mode';
 IF operation IS NULL OR mode IS NULL OR mode NOT IN ('assignments','revision','template') THEN RAISE EXCEPTION 'Neplatný režim importu.'; END IF;
 request_hash := md5(request_input::text);
 PERFORM pg_advisory_xact_lock(hashtextextended('budget-categories:'||project_input,0));
 SELECT * INTO previous_operation FROM private.budget_tender_import_operations WHERE project_id=project_input AND operation_id=operation;
 IF FOUND THEN
   IF previous_operation.actor_id<>auth.uid() OR previous_operation.request_hash<>request_hash THEN RAISE EXCEPTION 'Klíč importu již patří jiné operaci.'; END IF;
   IF mode<>'template' AND previous_operation.revision_id IS NULL THEN RAISE EXCEPTION 'Výsledek importu již byl odstraněn.'; END IF;
   IF previous_operation.revision_id IS NOT NULL THEN
     SELECT to_jsonb(r) INTO saved FROM public.construction_budget_revisions r WHERE r.id=previous_operation.revision_id AND r.project_id=project_input AND r.deleted_at IS NULL;
     IF saved IS NULL THEN RAISE EXCEPTION 'Výsledek importu již není dostupný.'; END IF;
   END IF;
   RETURN jsonb_build_object('revision',saved,'createdCategoryIds',previous_operation.created_category_ids);
 END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',c.id,'title',c.title,'externalCode',COALESCE(c.external_code,'')) ORDER BY c.id),'[]')
 INTO catalog FROM public.demand_categories c WHERE c.project_id=project_input;
 IF catalog IS DISTINCT FROM request_input->'expectedCatalog' THEN RAISE EXCEPTION 'Seznam VŘ se změnil. Obnovte náhled.' USING ERRCODE='40001'; END IF;
 new_categories := request_input->'newCategories'; assignments := request_input->'assignments';
 IF jsonb_typeof(new_categories) IS DISTINCT FROM 'array' OR jsonb_array_length(new_categories)>1000
    OR jsonb_typeof(assignments) IS DISTINCT FROM 'array' OR jsonb_array_length(assignments)>250000
 THEN RAISE EXCEPTION 'Neplatný rozsah importu.'; END IF;
 IF jsonb_array_length(new_categories)>0 AND NOT EXISTS(SELECT 1 FROM public.projects p WHERE p.id=project_input
   AND (p.owner_id=auth.uid() OR public.has_project_share_permission(p.id,auth.uid(),'edit')))
 THEN RAISE EXCEPTION 'Vytváření VŘ není povoleno.' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(new_categories) c WHERE jsonb_typeof(c) IS DISTINCT FROM 'object'
   OR jsonb_typeof(c->'id') IS DISTINCT FROM 'string' OR length(c->>'id') NOT BETWEEN 1 AND 100
   OR jsonb_typeof(c->'title') IS DISTINCT FROM 'string' OR length(btrim(c->>'title')) NOT BETWEEN 1 AND 255
   OR jsonb_typeof(c->'externalCode') IS DISTINCT FROM 'string' OR length(c->>'externalCode')>100)
 THEN RAISE EXCEPTION 'Neplatná definice VŘ.'; END IF;
 -- Each new definition is checked against earlier inserts in this same transaction too.
 FOR definition IN SELECT value FROM jsonb_array_elements(new_categories) LOOP
   IF EXISTS(SELECT 1 FROM public.demand_categories c WHERE c.project_id=project_input
     AND (lower(regexp_replace(btrim(c.title),'\s+',' ','g'))=lower(regexp_replace(btrim(definition->>'title'),'\s+',' ','g'))
       OR NULLIF(btrim(definition->>'externalCode'),'') IS NOT NULL AND c.external_code=btrim(definition->>'externalCode')))
   THEN RAISE EXCEPTION 'Duplicitní název nebo číslo VŘ. Vyberte existující řízení.'; END IF;
   INSERT INTO public.demand_categories(id,project_id,title,external_code,status,description,budget_display,sod_budget,plan_budget)
   VALUES(definition->>'id',project_input,btrim(definition->>'title'),NULLIF(btrim(definition->>'externalCode'),''),'open','','',0,0);
   created_ids := created_ids || jsonb_build_array(definition->>'id');
 END LOOP;
 IF mode='template' THEN
   IF jsonb_array_length(assignments)<>0 THEN RAISE EXCEPTION 'Vzor nesmí obsahovat alokace.'; END IF;
 ELSE
   source_id := (request_input->>'sourceId')::uuid;
   IF NOT EXISTS(SELECT 1 FROM public.construction_budget_sources WHERE id=source_id AND project_id=project_input AND deleted_at IS NULL FOR SHARE)
   THEN RAISE EXCEPTION 'Neplatný zdroj importu.'; END IF;
   IF request_input->>'revisionId' IS NOT NULL THEN
     SELECT * INTO base FROM public.construction_budget_revisions WHERE id=(request_input->>'revisionId')::uuid AND project_id=project_input FOR UPDATE;
     IF NOT FOUND OR base.deleted_at IS NOT NULL OR base.version IS DISTINCT FROM (request_input->>'version')::integer THEN
       RAISE EXCEPTION 'Rozpočet se změnil. Obnovte náhled.' USING ERRCODE='40001';
     END IF;
   END IF;
   IF mode='assignments' THEN
     IF base.id IS NULL THEN RAISE EXCEPTION 'Vyberte cílovou revizi.'; END IF;
     -- The client cannot provide document/prices/quantities in mapping-only mode.
     IF request_input ? 'document' OR request_input ? 'allocations' THEN RAISE EXCEPTION 'Přiřazení nesmí přepisovat rozpočet.'; END IF;
     document := base.document; allocations := base.allocations; source_id := base.source_id;
     IF base.status='draft' THEN revision_id:=base.id;
     ELSE document:=document||jsonb_build_object('origin','copy','importKey',operation); END IF;
   ELSE
     document:=request_input->'document'; allocations:=request_input->'allocations';
     document:=document||jsonb_build_object('importKey',operation);
     IF jsonb_typeof(document->'sheets') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Neplatné soupisy.'; END IF;
     document:=jsonb_set(document,'{sheets}',COALESCE((SELECT jsonb_agg(s-'sourcePreview') FROM jsonb_array_elements(document->'sheets') s),'[]'));
     IF jsonb_typeof(allocations) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Neplatné alokace.'; END IF;
   END IF;
   IF jsonb_typeof(document->'nodes') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Neplatné položky.'; END IF;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(assignments) a WHERE jsonb_typeof(a) IS DISTINCT FROM 'object'
     OR jsonb_typeof(a->'itemId') IS DISTINCT FROM 'string' OR jsonb_typeof(a->'categoryId') IS DISTINCT FROM 'string'
     OR a->>'action' IS NULL OR a->>'action' NOT IN ('keep','remaining','replace'))
     OR EXISTS(SELECT 1 FROM jsonb_array_elements(assignments) a GROUP BY a->>'itemId' HAVING count(*)>1)
   THEN RAISE EXCEPTION 'Vyřešte duplicitní položky a konflikty přiřazení.'; END IF;
   WITH nodes AS MATERIALIZED (SELECT n->>'id' id,n FROM jsonb_array_elements(document->'nodes') n),
   changes AS MATERIALIZED (SELECT a->>'itemId' item_id,a->>'categoryId' category_id FROM jsonb_array_elements(assignments) a)
   SELECT EXISTS(SELECT 1 FROM changes a LEFT JOIN nodes n ON n.id=a.item_id
     LEFT JOIN public.demand_categories c ON c.id=a.category_id AND c.project_id=project_input
     WHERE n.id IS NULL OR c.id IS NULL OR n.n->>'kind' NOT IN ('K','M') OR n.n->>'quantity' IS NULL) INTO invalid;
   IF invalid THEN RAISE EXCEPTION 'Neplatná položka nebo VŘ jiného projektu.'; END IF;
   -- Set-based allocation planning. All quantities come from the authoritative target document.
   WITH changes AS MATERIALIZED (SELECT a->>'itemId' item_id,a->>'categoryId' category_id,a->>'action' action FROM jsonb_array_elements(assignments) a),
   kept AS MATERIALIZED (
     SELECT a FROM jsonb_array_elements(allocations) a LEFT JOIN changes c ON c.item_id=a->>'itemId' WHERE c.action IS DISTINCT FROM 'replace'
   ), totals AS (SELECT a->>'itemId' item_id,sum((a->>'quantity')::numeric) used FROM kept GROUP BY a->>'itemId'),
   additions AS (
     SELECT jsonb_build_object('itemId',c.item_id,'categoryId',c.category_id,'quantity',((n->>'quantity')::numeric-COALESCE(t.used,0))::text) a
     FROM jsonb_array_elements(document->'nodes') n JOIN changes c ON c.item_id=n->>'id'
     LEFT JOIN totals t ON t.item_id=c.item_id
     WHERE c.action<>'keep' AND (n->>'quantity')::numeric-COALESCE(t.used,0)<>0
   ), combined AS (SELECT a FROM kept UNION ALL SELECT a FROM additions)
   SELECT COALESCE(jsonb_agg(jsonb_build_object('itemId',item_id,'categoryId',category_id,'quantity',quantity::text) ORDER BY item_id,category_id),'[]') INTO allocations
   FROM (SELECT a->>'itemId' item_id,a->>'categoryId' category_id,sum((a->>'quantity')::numeric) quantity FROM combined GROUP BY a->>'itemId',a->>'categoryId') grouped;
   saved:=private.budget_save(project_input,source_id,revision_id,COALESCE(base.version,0),
     CASE WHEN mode='assignments' THEN CASE WHEN base.status='confirmed' THEN left(base.title,180)||' · přiřazení VŘ' ELSE base.title END ELSE request_input->>'title' END,
     document,allocations,false);
   UPDATE public.construction_budget_sources SET status='ready'
   WHERE id=(request_input->>'sourceId')::uuid AND project_id=project_input;
 END IF;
 INSERT INTO private.budget_tender_import_operations(project_id,operation_id,actor_id,request_hash,revision_id,created_category_ids)
 VALUES(project_input,operation,auth.uid(),request_hash,(saved->>'id')::uuid,created_ids);
 RETURN jsonb_build_object('revision',saved,'createdCategoryIds',created_ids);
END $$;
REVOKE ALL ON FUNCTION private.budget_tender_import(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION private.budget_tender_import(text,jsonb) TO authenticated;
CREATE FUNCTION public.construction_budget_import_tenders(project_input text,request_input jsonb) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.budget_tender_import(project_input,request_input) $$;
REVOKE ALL ON FUNCTION public.construction_budget_import_tenders(text,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.construction_budget_import_tenders(text,jsonb) TO authenticated;

-- Existing backup exporters serialize whole category rows. Restore the new field
-- only inside their existing authorized category block; old backups keep the code.
DO $migration$
DECLARE scope text; definition text;
BEGIN
 FOREACH scope IN ARRAY ARRAY['user','tenant'] LOOP
   SELECT pg_get_functiondef(format('public.restore_%s_backup_without_offer_deadline_20260817(jsonb,uuid)',scope)::regprocedure) INTO definition;
   IF position('cnt_categories := cnt_categories + 1;' IN definition)=0 THEN RAISE EXCEPTION 'Unknown category restorer shape'; END IF;
   definition:=replace(definition,'cnt_categories := cnt_categories + 1;',
     'UPDATE public.demand_categories SET external_code=CASE WHEN item ? ''external_code'' THEN NULLIF(item->>''external_code'','''') ELSE external_code END WHERE id=item->>''id'' AND project_id=item->>''project_id''; cnt_categories := cnt_categories + 1;');
   EXECUTE definition;
 END LOOP;
END $migration$;
COMMIT;
