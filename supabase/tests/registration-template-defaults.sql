-- Execute on the linked database. Only temporary fixtures are modified.
-- Exercises the deployed function body with its table references redirected.
BEGIN;
CREATE TEMP TABLE default_templates (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  subject text NOT NULL,
  content text NOT NULL,
  is_default boolean,
  created_at timestamptz,
  updated_at timestamptz
);
CREATE TEMP TABLE templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  subject text NOT NULL,
  content text NOT NULL,
  is_default boolean,
  source_template_id uuid,
  project_id varchar(36),
  created_at timestamptz,
  updated_at timestamptz
);
CREATE UNIQUE INDEX test_one_legacy_default ON pg_temp.templates(user_id)
  WHERE is_default AND project_id IS NULL;
CREATE TEMP TABLE registration_users (id uuid PRIMARY KEY);
DO $$
DECLARE definition text := pg_get_functiondef('public.copy_default_templates_to_new_user()'::regprocedure);
BEGIN
  definition := replace(definition, 'public.copy_default_templates_to_new_user', 'pg_temp.copy_default_templates_to_new_user');
  definition := replace(definition, 'public.default_templates', 'pg_temp.default_templates');
  definition := replace(definition, 'public.templates', 'pg_temp.templates');
  EXECUTE definition;
END;
$$;
CREATE TRIGGER copy_templates AFTER INSERT ON pg_temp.registration_users
  FOR EACH ROW EXECUTE FUNCTION pg_temp.copy_default_templates_to_new_user();
DO $$
DECLARE
  first_user uuid := gen_random_uuid();
  second_user uuid := gen_random_uuid();
  scenario_user uuid;
  expected_default uuid := '00000000-0000-0000-0000-000000000001';
  scenario integer;
BEGIN
  -- Duplicate marked defaults, tied timestamps, one unmarked and one NULL flag.
  INSERT INTO pg_temp.default_templates VALUES
    (expected_default, 'first', 'subject 1', 'body 1', true, '2026-01-01', '2026-02-01'),
    ('00000000-0000-0000-0000-000000000002', 'second', 'subject 2', 'body 2', true, '2026-01-01', '2026-02-01'),
    ('00000000-0000-0000-0000-000000000003', 'third', 'subject 3', 'body 3', false, '2026-01-01', '2026-03-01'),
    ('00000000-0000-0000-0000-000000000004', 'fourth', 'subject 4', 'body 4', NULL, NULL, NULL);
  INSERT INTO pg_temp.registration_users VALUES (first_user), (second_user);
  IF (SELECT count(*) FROM pg_temp.templates) <> 8
    OR (SELECT count(*) FROM pg_temp.templates WHERE is_default) <> 2
    OR EXISTS (SELECT FROM pg_temp.templates WHERE is_default AND source_template_id <> expected_default)
    OR EXISTS (
      SELECT FROM pg_temp.templates t JOIN pg_temp.default_templates d ON d.id = t.source_template_id
      WHERE (t.name, t.subject, t.content) IS DISTINCT FROM (d.name, d.subject, d.content)
        OR t.project_id IS NOT NULL
    ) THEN
    RAISE EXCEPTION 'Duplicate defaults must preserve every template and select one stable default per user';
  END IF;
  -- Most recently updated marked default wins; unmarked newer rows never win.
  UPDATE pg_temp.default_templates SET updated_at = '2026-02-02'
    WHERE id = '00000000-0000-0000-0000-000000000002';
  scenario_user := gen_random_uuid();
  INSERT INTO pg_temp.registration_users VALUES (scenario_user);
  IF NOT EXISTS (SELECT FROM pg_temp.templates WHERE user_id = scenario_user AND is_default
    AND source_template_id = '00000000-0000-0000-0000-000000000002') THEN
    RAISE EXCEPTION 'Latest marked default must win';
  END IF;
  -- Single default, no default, and empty catalog preserve existing semantics.
  FOR scenario IN 1..3 LOOP
    IF scenario = 1 THEN
      UPDATE pg_temp.default_templates SET is_default = (id = expected_default);
    ELSIF scenario = 2 THEN
      UPDATE pg_temp.default_templates SET is_default = false;
    ELSE
      DELETE FROM pg_temp.default_templates;
    END IF;
    scenario_user := gen_random_uuid();
    INSERT INTO pg_temp.registration_users VALUES (scenario_user);
    IF (SELECT count(*) FROM pg_temp.templates WHERE user_id = scenario_user) <> (CASE WHEN scenario = 3 THEN 0 ELSE 4 END)
      OR (SELECT count(*) FROM pg_temp.templates WHERE user_id = scenario_user AND is_default) <> (CASE WHEN scenario = 1 THEN 1 ELSE 0 END) THEN
      RAISE EXCEPTION 'Incorrect template/default count in scenario %', scenario;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_temp.templates WHERE user_id = first_user) <> 4
    OR (SELECT count(*) FROM pg_temp.templates WHERE user_id = second_user) <> 4
    OR (SELECT count(*) FROM pg_temp.templates WHERE user_id IN (first_user, second_user) AND is_default AND source_template_id = expected_default) <> 2 THEN
    RAISE EXCEPTION 'Later registrations changed another user templates';
  END IF;
END;
$$;
SELECT 'PASS: duplicate, stable tie, latest, single, absent, empty defaults; content and user isolation' AS result;
ROLLBACK;
