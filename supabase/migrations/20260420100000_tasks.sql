-- =====================================================
-- Tasks — uživatelské TODO úkoly (V1)
-- Migration: 20260420100000_tasks.sql
--
-- Tenká task vrstva navrstvená nad derivované akce Command Center.
-- Sync metadata pole (external_id, external_provider, ...) jsou připravena
-- pro V2 integraci s externími task managery (Todoist apod.).
-- =====================================================

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 500),
  note TEXT CHECK (note IS NULL OR length(note) <= 10000),
  due_at TIMESTAMPTZ,
  priority SMALLINT CHECK (priority IS NULL OR priority BETWEEN 1 AND 4),
  project_id VARCHAR(36) REFERENCES projects(id) ON DELETE SET NULL,
  related_entity_type TEXT CHECK (
    related_entity_type IS NULL OR
    related_entity_type IN ('category', 'bid', 'contract', 'document')
  ),
  related_entity_id TEXT,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- V2 sync metadata (nullable ve V1)
  external_id TEXT,
  external_provider TEXT CHECK (
    external_provider IS NULL OR
    external_provider IN ('todoist', 'ms-todo', 'apple-reminders', 'google-tasks')
  ),
  external_url TEXT,
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT CHECK (
    sync_status IS NULL OR
    sync_status IN ('synced', 'pending', 'error')
  ),
  sync_error TEXT,

  CONSTRAINT tasks_related_entity_consistent CHECK (
    (related_entity_type IS NULL AND related_entity_id IS NULL) OR
    (related_entity_type IS NOT NULL AND related_entity_id IS NOT NULL)
  ),
  CONSTRAINT tasks_completed_consistent CHECK (
    (completed = FALSE AND completed_at IS NULL) OR
    (completed = TRUE AND completed_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_open_due ON tasks(due_at)
  WHERE completed = FALSE;
CREATE INDEX IF NOT EXISTS idx_tasks_external ON tasks(external_provider, external_id)
  WHERE external_id IS NOT NULL;

-- Updated_at trigger — sdílená funkce je už v DB z předchozích migrací.
-- Použijeme vlastní funkci, abychom nebyli závislí na konkrétním názvu existujícího triggeru.
CREATE OR REPLACE FUNCTION tasks_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  -- Auto-fill completed_at z přechodu completed false→true
  IF NEW.completed = TRUE AND (OLD.completed = FALSE OR OLD.completed IS NULL) AND NEW.completed_at IS NULL THEN
    NEW.completed_at := NOW();
  END IF;
  -- Vynuluj completed_at pokud byl task znovu otevřen
  IF NEW.completed = FALSE AND OLD.completed = TRUE THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_tasks_updated_at ON tasks;
CREATE TRIGGER tr_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION tasks_set_updated_at();

-- RLS — V1 = per-user (uživatel vidí jen své tasky).
-- V2 je otevřená otázka per-organization; rozšíří se samostatnou migrací, až padne rozhodnutí.
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tasks_select_own" ON tasks;
CREATE POLICY "tasks_select_own" ON tasks
  FOR SELECT USING (created_by = auth.uid());

DROP POLICY IF EXISTS "tasks_insert_own" ON tasks;
CREATE POLICY "tasks_insert_own" ON tasks
  FOR INSERT WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "tasks_update_own" ON tasks;
CREATE POLICY "tasks_update_own" ON tasks
  FOR UPDATE USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "tasks_delete_own" ON tasks;
CREATE POLICY "tasks_delete_own" ON tasks
  FOR DELETE USING (created_by = auth.uid());
