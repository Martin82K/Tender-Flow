-- Cover the project foreign key independently of the user-scoped unique index.
CREATE INDEX IF NOT EXISTS idx_microsoft_todo_list_mappings_project_id
  ON public.microsoft_todo_list_mappings(todo_project_id);
