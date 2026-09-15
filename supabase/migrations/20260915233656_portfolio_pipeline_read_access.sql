BEGIN;
-- A bulk permission check avoids treating RLS-filtered empty arrays as zero counts.
CREATE FUNCTION public.get_portfolio_pipeline_read_access(project_ids_input text[])
RETURNS TABLE(project_id text) LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT p.id FROM public.projects p WHERE p.id=ANY(project_ids_input)
    AND public.can_project_module_action(p.id,'module_pipeline',false)
$$;
REVOKE ALL ON FUNCTION public.get_portfolio_pipeline_read_access(text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_portfolio_pipeline_read_access(text[]) TO authenticated;
COMMIT;
