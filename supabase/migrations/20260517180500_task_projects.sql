-- =====================================================
-- Tasks — personal TODO projects/lists
-- Migration: 20260517180500_task_projects.sql
--
-- TODO projects are personal organization scopes inspired by Todoist.
-- They are separate from construction projects (`tasks.project_id`).
-- =====================================================

CREATE TABLE IF NOT EXISTS public.task_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  color TEXT CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_projects_created_by
  ON public.task_projects(created_by, sort_order, created_at);

ALTER TABLE public.task_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "task_projects_select_own" ON public.task_projects;
CREATE POLICY "task_projects_select_own" ON public.task_projects
  FOR SELECT USING (created_by = auth.uid());

DROP POLICY IF EXISTS "task_projects_insert_own" ON public.task_projects;
CREATE POLICY "task_projects_insert_own" ON public.task_projects
  FOR INSERT WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "task_projects_update_own" ON public.task_projects;
CREATE POLICY "task_projects_update_own" ON public.task_projects
  FOR UPDATE USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "task_projects_delete_own" ON public.task_projects;
CREATE POLICY "task_projects_delete_own" ON public.task_projects
  FOR DELETE USING (created_by = auth.uid());

CREATE OR REPLACE FUNCTION public.task_projects_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_task_projects_updated_at ON public.task_projects;
CREATE TRIGGER tr_task_projects_updated_at
  BEFORE UPDATE ON public.task_projects
  FOR EACH ROW EXECUTE FUNCTION public.task_projects_set_updated_at();

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS todo_project_id UUID REFERENCES public.task_projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_todo_project
  ON public.tasks(created_by, todo_project_id, completed, sort_order)
  WHERE archived_at IS NULL;

CREATE OR REPLACE FUNCTION public.tasks_validate_todo_project()
RETURNS TRIGGER AS $$
DECLARE
  project_owner UUID;
  parent_project_id UUID;
BEGIN
  IF NEW.parent_task_id IS NOT NULL THEN
    SELECT todo_project_id
      INTO parent_project_id
      FROM public.tasks
      WHERE id = NEW.parent_task_id;

    NEW.todo_project_id := parent_project_id;
  END IF;

  IF NEW.todo_project_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT created_by
    INTO project_owner
    FROM public.task_projects
    WHERE id = NEW.todo_project_id;

  IF project_owner IS NULL THEN
    RAISE EXCEPTION 'TODO project % does not exist', NEW.todo_project_id;
  END IF;

  IF project_owner <> NEW.created_by THEN
    RAISE EXCEPTION 'TODO project must belong to the same user as task';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_tasks_validate_todo_project ON public.tasks;
CREATE TRIGGER tr_tasks_validate_todo_project
  BEFORE INSERT OR UPDATE OF todo_project_id, parent_task_id, created_by ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_validate_todo_project();

CREATE OR REPLACE FUNCTION public.tasks_sync_subtask_todo_project()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_task_id IS NULL AND NEW.todo_project_id IS DISTINCT FROM OLD.todo_project_id THEN
    UPDATE public.tasks
      SET todo_project_id = NEW.todo_project_id
      WHERE parent_task_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_tasks_sync_subtask_todo_project ON public.tasks;
CREATE TRIGGER tr_tasks_sync_subtask_todo_project
  AFTER UPDATE OF todo_project_id ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.tasks_sync_subtask_todo_project();
