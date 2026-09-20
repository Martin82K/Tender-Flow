BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';

-- Mapping an existing draft to existing categories does not change its document.
-- Keep the existing authorization, tenant checks, catalog lock, idempotency,
-- version check and server-derived quantities in budget_tender_import.
DO $migration$
DECLARE definition text;
 anchor text := $anchor$   saved:=private.budget_save(project_input,source_id,revision_id,COALESCE(base.version,0),
     CASE WHEN mode='assignments' THEN CASE WHEN base.status='confirmed' THEN left(base.title,180)||' · přiřazení VŘ' ELSE base.title END ELSE request_input->>'title' END,
     document,allocations,false);$anchor$;
 replacement text := $replacement$   IF mode='assignments' AND base.status='draft' AND jsonb_array_length(new_categories)=0
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(assignments) a WHERE a->>'action'<>'replace') THEN
     -- Only allocations change. The locked, previously validated document remains authoritative.
     -- The UPDATE trigger still enforces the project edit lock.
     saved:=jsonb_build_object('allocations',allocations);
     UPDATE public.construction_budget_revisions SET allocations=saved->'allocations',version=version+1
       WHERE id=base.id AND project_id=project_input;
     INSERT INTO public.construction_budget_history(revision_id,project_id,actor_id,event,previous_version,new_version,changes)
       VALUES(base.id,project_input,auth.uid(),'save',base.version,base.version+1,
         jsonb_build_object('format',1,'fields','[]'::jsonb,'nodes',NULL,
           'allocations',private.budget_array_reverse_patch(base.allocations,allocations)));
     saved:=to_jsonb(base)||jsonb_build_object('allocations',allocations,'version',base.version+1);
   ELSE
$replacement$;
BEGIN
 SELECT pg_get_functiondef('private.budget_tender_import(text,jsonb)'::regprocedure) INTO definition;
 IF (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1
 THEN RAISE EXCEPTION 'Unexpected budget tender import definition'; END IF;
 definition:=replace(definition,anchor,replacement||anchor||E'\n   END IF;');
 EXECUTE definition;
END $migration$;
COMMIT;
