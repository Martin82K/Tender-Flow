-- =====================================================
-- Tasks — personal TODO subtasks (V2)
--
-- TODO je personal scope. Podúkol je stejný task model s parent_task_id,
-- ale rodič i dítě musí patřit stejnému created_by uživateli.
-- MVP povoluje jednu úroveň podúkolů.
-- =====================================================

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_personal_tree ON tasks(created_by, parent_task_id, completed, sort_order);

ALTER TABLE tasks
  DROP CONSTRAINT IF EXISTS tasks_parent_not_self;

ALTER TABLE tasks
  ADD CONSTRAINT tasks_parent_not_self CHECK (
    parent_task_id IS NULL OR parent_task_id <> id
  );

CREATE OR REPLACE FUNCTION tasks_validate_parent()
RETURNS TRIGGER AS $$
DECLARE
  parent_owner UUID;
  parent_parent UUID;
BEGIN
  IF NEW.parent_task_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT created_by, parent_task_id
    INTO parent_owner, parent_parent
    FROM tasks
    WHERE id = NEW.parent_task_id;

  IF parent_owner IS NULL THEN
    RAISE EXCEPTION 'Parent task % does not exist', NEW.parent_task_id;
  END IF;

  IF parent_owner <> NEW.created_by THEN
    RAISE EXCEPTION 'Parent task belongs to a different user';
  END IF;

  IF parent_parent IS NOT NULL THEN
    RAISE EXCEPTION 'Nested subtasks deeper than one level are not supported in MVP';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_tasks_validate_parent ON tasks;
CREATE TRIGGER tr_tasks_validate_parent
  BEFORE INSERT OR UPDATE OF parent_task_id, created_by ON tasks
  FOR EACH ROW EXECUTE FUNCTION tasks_validate_parent();
