-- Caller must wrap in BEGIN/ROLLBACK. This test never transfers a tender plan.
DO $$
BEGIN
 IF has_function_privilege('authenticated','public.construction_budget_apply_plan(text,uuid,text,numeric)','EXECUTE')
    OR has_function_privilege('authenticated','private.budget_apply_plan(text,uuid,text,numeric)','EXECUTE')
    OR has_function_privilege('anon','public.construction_budget_apply_plan(text,uuid,text,numeric)','EXECUTE')
 THEN RAISE EXCEPTION 'Unreleased tender-plan transfer is callable by clients'; END IF;
END $$;
SET LOCAL ROLE authenticated;
DO $$
DECLARE denied boolean := false;
BEGIN
 BEGIN PERFORM public.construction_budget_apply_plan('synthetic',gen_random_uuid(),'synthetic',0);
 EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Plan wrapper is callable'; END IF;
 denied := false;
 BEGIN PERFORM private.budget_apply_plan('synthetic',gen_random_uuid(),'synthetic',0);
 EXCEPTION WHEN insufficient_privilege THEN denied := true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Private plan helper is callable'; END IF;
END $$;
RESET ROLE;
SELECT 'unreleased tender plan RPC is unavailable to clients' AS result;
