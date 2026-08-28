CREATE OR REPLACE FUNCTION public.delete_my_completed_tasks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := (SELECT auth.uid());
  v_deleted INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.tasks AS child
  SET
    parent_task_id = NULL,
    external_id = NULL,
    external_provider = NULL,
    external_container_id = NULL,
    external_parent_id = NULL,
    external_etag = NULL,
    external_updated_at = NULL,
    last_synced_at = NULL,
    sync_status = 'pending',
    sync_error = NULL
  WHERE child.created_by = v_user_id
    AND child.completed = FALSE
    AND EXISTS (
      SELECT 1
      FROM public.tasks AS parent
      WHERE parent.id = child.parent_task_id
        AND parent.created_by = v_user_id
        AND parent.completed = TRUE
    );

  DELETE FROM public.tasks AS task
  WHERE task.created_by = v_user_id
    AND task.completed = TRUE;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_completed_tasks() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_my_completed_tasks() TO authenticated;

COMMENT ON FUNCTION public.delete_my_completed_tasks() IS
  'Deletes every completed task owned by the authenticated user after detaching active subtasks.';
