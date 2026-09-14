-- Return exactly the manifest whose size/counts the original exporter recorded.
-- Re-reading links in an outer wrapper could race with a concurrent link edit.
CREATE OR REPLACE FUNCTION public.export_user_backup(target_org_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$ SELECT public.export_user_backup_before_shared_tenders(target_org_id) $$;
CREATE OR REPLACE FUNCTION public.export_tenant_backup(target_org_id uuid) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$ SELECT public.export_tenant_backup_before_shared_tenders(target_org_id) $$;
REVOKE ALL ON FUNCTION public.export_user_backup(uuid),public.export_tenant_backup(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.export_user_backup(uuid),public.export_tenant_backup(uuid) TO authenticated,service_role;
NOTIFY pgrst, 'reload schema';
