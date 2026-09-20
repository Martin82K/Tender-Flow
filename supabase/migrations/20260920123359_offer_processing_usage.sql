BEGIN;
CREATE TABLE public.offer_processing_settings (
 organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
 enabled boolean NOT NULL DEFAULT false,
 monthly_limit_usd numeric(12,6) NOT NULL DEFAULT 5 CHECK(monthly_limit_usd BETWEEN 0 AND 10000)
);
CREATE TABLE public.offer_processing_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 project_id text REFERENCES public.projects(id) ON DELETE SET NULL, user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 request_id uuid NOT NULL, input_hash text NOT NULL CHECK(input_hash ~ '^[a-f0-9]{64}$'), stage text NOT NULL CHECK(stage IN ('ocr','matching','extraction')),
 model text NOT NULL, resolved_model text, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','failed')),
 reserved_usd numeric(12,6) NOT NULL CHECK(reserved_usd>=0), estimated_cost_usd numeric(12,6),
 input_tokens integer, output_tokens integer, pages integer, pricing jsonb NOT NULL,
 result jsonb, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 UNIQUE(organization_id,request_id)
);
-- Keep accounting after project deletion, but never retain extracted document content.
-- Also covers provider completions arriving after the FK has been set to NULL.
CREATE FUNCTION private.offer_processing_scrub_orphan_result() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF NEW.project_id IS NULL THEN NEW.result := NULL; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.offer_processing_scrub_orphan_result() FROM PUBLIC,anon,authenticated,service_role,tenderflow_mcp_client;
CREATE TRIGGER offer_processing_scrub_orphan_result BEFORE INSERT OR UPDATE OF project_id,result
 ON public.offer_processing_runs FOR EACH ROW EXECUTE FUNCTION private.offer_processing_scrub_orphan_result();
CREATE INDEX offer_processing_runs_org_date ON public.offer_processing_runs(organization_id,created_at);
CREATE INDEX offer_processing_runs_project ON public.offer_processing_runs(project_id);
CREATE INDEX offer_processing_runs_user ON public.offer_processing_runs(user_id);
ALTER TABLE public.offer_processing_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_processing_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.offer_processing_settings,public.offer_processing_runs FROM PUBLIC,anon,authenticated,tenderflow_mcp_client;
GRANT ALL ON public.offer_processing_settings,public.offer_processing_runs TO service_role;
CREATE FUNCTION public.offer_processing_reserve(project_input text,user_input uuid,request_input uuid,hash_input text,stage_input text,model_input text,reserve_input numeric,pricing_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid; settings public.offer_processing_settings; existing public.offer_processing_runs; spent numeric;
BEGIN
 SELECT p.organization_id INTO org FROM public.projects p JOIN public.organization_members m ON m.organization_id=p.organization_id WHERE p.id=project_input AND m.user_id=user_input AND m.is_active;
 IF org IS NULL OR reserve_input IS NULL OR reserve_input<=0 OR reserve_input>10 THEN RAISE EXCEPTION 'Invalid processing request'; END IF;
 SELECT * INTO settings FROM public.offer_processing_settings WHERE organization_id=org FOR UPDATE;
 IF NOT FOUND OR NOT settings.enabled THEN RAISE EXCEPTION 'AI processing disabled for this organization'; END IF;
 SELECT * INTO existing FROM public.offer_processing_runs WHERE organization_id=org AND request_id=request_input;
 IF FOUND THEN
  IF existing.project_id IS DISTINCT FROM project_input OR existing.input_hash<>hash_input OR existing.user_id IS DISTINCT FROM user_input THEN RAISE EXCEPTION 'Request identity conflict'; END IF;
  RETURN jsonb_build_object('runId',existing.id,'status',existing.status,'result',existing.result,'reused',true);
 END IF;
 SELECT COALESCE(sum(COALESCE(estimated_cost_usd,reserved_usd)),0) INTO spent FROM public.offer_processing_runs WHERE organization_id=org AND created_at>=date_trunc('month',now());
 IF spent+reserve_input>settings.monthly_limit_usd THEN RAISE EXCEPTION 'Monthly AI budget exceeded'; END IF;
 INSERT INTO public.offer_processing_runs(organization_id,project_id,user_id,request_id,input_hash,stage,model,reserved_usd,pricing)
 VALUES(org,project_input,user_input,request_input,hash_input,stage_input,model_input,reserve_input,pricing_input) RETURNING * INTO existing;
 RETURN jsonb_build_object('runId',existing.id,'status','pending','reused',false);
END $$;
REVOKE ALL ON FUNCTION public.offer_processing_reserve(text,uuid,uuid,text,text,text,numeric,jsonb) FROM PUBLIC,anon,authenticated,tenderflow_mcp_client;
GRANT EXECUTE ON FUNCTION public.offer_processing_reserve(text,uuid,uuid,text,text,text,numeric,jsonb) TO service_role;
CREATE TABLE public.offer_processing_feedback (
 run_id uuid NOT NULL REFERENCES public.offer_processing_runs(id) ON DELETE CASCADE,
 item_id text NOT NULL CHECK(length(item_id) BETWEEN 1 AND 200),
 accepted boolean NOT NULL, reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 reviewed_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(run_id,item_id)
);
CREATE INDEX offer_processing_feedback_actor ON public.offer_processing_feedback(reviewed_by);
ALTER TABLE public.offer_processing_feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.offer_processing_feedback FROM PUBLIC,anon,authenticated,tenderflow_mcp_client;
CREATE FUNCTION private.offer_processing_feedback_save(run_input uuid,item_input text,accepted_input boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE run public.offer_processing_runs;
BEGIN
 SELECT * INTO run FROM public.offer_processing_runs WHERE id=run_input;
 IF run.id IS NULL OR run.stage<>'matching' OR run.status<>'completed' OR private.offer_comparison_access(run.project_id,true) IS NOT TRUE THEN RAISE EXCEPTION 'Feedback access denied' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements((run.result->>'text')::jsonb->'suggestions') s WHERE s->>'baseId'=item_input) THEN RAISE EXCEPTION 'Unknown suggestion'; END IF;
 INSERT INTO public.offer_processing_feedback(run_id,item_id,accepted,reviewed_by) VALUES(run_input,item_input,accepted_input,auth.uid())
 ON CONFLICT(run_id,item_id) DO UPDATE SET accepted=excluded.accepted,reviewed_by=excluded.reviewed_by,reviewed_at=now();
END $$;
CREATE FUNCTION public.offer_processing_feedback_save(run_input uuid,item_input text,accepted_input boolean) RETURNS void
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.offer_processing_feedback_save(run_input,item_input,accepted_input) $$;
REVOKE ALL ON FUNCTION private.offer_processing_feedback_save(uuid,text,boolean),public.offer_processing_feedback_save(uuid,text,boolean) FROM PUBLIC,anon,tenderflow_mcp_client;
GRANT EXECUTE ON FUNCTION private.offer_processing_feedback_save(uuid,text,boolean),public.offer_processing_feedback_save(uuid,text,boolean) TO authenticated;
CREATE FUNCTION private.offer_processing_admin(org_input uuid,days_input integer DEFAULT 30,enabled_input boolean DEFAULT NULL,limit_input numeric DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF public.is_active_org_admin_or_owner(org_input) IS NOT TRUE THEN RAISE EXCEPTION 'Organization admin required' USING ERRCODE='42501'; END IF;
 IF enabled_input IS NOT NULL OR limit_input IS NOT NULL THEN
  INSERT INTO public.offer_processing_settings(organization_id,enabled,monthly_limit_usd) VALUES(org_input,COALESCE(enabled_input,false),COALESCE(limit_input,5))
  ON CONFLICT(organization_id) DO UPDATE SET enabled=COALESCE(enabled_input,offer_processing_settings.enabled),monthly_limit_usd=COALESCE(limit_input,offer_processing_settings.monthly_limit_usd);
 END IF;
 RETURN jsonb_build_object('settings',COALESCE((SELECT to_jsonb(s) FROM public.offer_processing_settings s WHERE organization_id=org_input),'{"enabled":false,"monthly_limit_usd":5}'::jsonb),
 'quality',COALESCE((SELECT jsonb_agg(q) FROM (SELECT r.model,r.resolved_model,count(*) FILTER(WHERE f.accepted) AS accepted,count(*) FILTER(WHERE NOT f.accepted) AS rejected FROM public.offer_processing_feedback f JOIN public.offer_processing_runs r ON r.id=f.run_id WHERE r.organization_id=org_input AND r.created_at>=now()-make_interval(days=>greatest(1,least(days_input,365))) GROUP BY r.model,r.resolved_model) q),'[]'::jsonb),
 'runs',COALESCE((SELECT jsonb_agg(r ORDER BY created_at DESC) FROM (SELECT id,project_id,user_id,stage,model,resolved_model,status,reserved_usd,estimated_cost_usd,input_tokens,output_tokens,pages,created_at FROM public.offer_processing_runs WHERE organization_id=org_input AND created_at>=now()-make_interval(days=>greatest(1,least(days_input,365))) ORDER BY created_at DESC LIMIT 1000) r),'[]'::jsonb));
END $$;
CREATE FUNCTION public.offer_processing_admin(org_input uuid,days_input integer DEFAULT 30,enabled_input boolean DEFAULT NULL,limit_input numeric DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.offer_processing_admin(org_input,days_input,enabled_input,limit_input) $$;
REVOKE ALL ON FUNCTION private.offer_processing_admin(uuid,integer,boolean,numeric),public.offer_processing_admin(uuid,integer,boolean,numeric) FROM PUBLIC,anon,tenderflow_mcp_client;
GRANT EXECUTE ON FUNCTION private.offer_processing_admin(uuid,integer,boolean,numeric),public.offer_processing_admin(uuid,integer,boolean,numeric) TO authenticated;
COMMIT;
