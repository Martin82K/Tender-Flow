BEGIN;
-- Tenant restore already authorizes organization administrators in the wrapped
-- entry point. It preserves project owners, so personal project edit rights
-- must not become an additional condition for restoring that tenant's links.
DO $migration$
DECLARE definition text;
  old_guard constant text := $guard$IF auth.uid() IS NULL OR NOT public.has_active_subscription()
        OR NOT public.user_has_feature('module_contracts')
        OR NOT public.can_project_module_action(c.project_id::text,'module_contracts',true)
        OR NOT EXISTS(SELECT 1 FROM public.projects p WHERE p.id=c.project_id AND
          (p.owner_id=auth.uid() OR EXISTS(SELECT 1 FROM public.project_shares ps WHERE ps.project_id=p.id AND ps.user_id=auth.uid() AND ps.permission='edit'))) THEN
        RAISE EXCEPTION 'Project is not writable for restored contract links' USING ERRCODE='42501';
      END IF;$guard$;
BEGIN
  SELECT pg_get_functiondef('public.restore_tenant_backup(jsonb,uuid)'::regprocedure) INTO definition;
  IF position(old_guard IN definition) = 0 THEN
    RAISE EXCEPTION 'Unexpected tenant restore definition; inspect before migrating';
  END IF;
  EXECUTE replace(definition, old_guard, $guard$IF auth.uid() IS NULL OR NOT public.is_org_admin(target_org_id) THEN
        RAISE EXCEPTION 'Organization admin role required for restored contract links' USING ERRCODE='42501';
      END IF;$guard$);
END $migration$;
NOTIFY pgrst, 'reload schema';
COMMIT;
