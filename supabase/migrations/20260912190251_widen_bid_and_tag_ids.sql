-- Restore/import IDs can exceed 36 characters. Reconcile fresh schemas and the
-- live text/varchar drift without rewriting IDs, dropping FKs or changing access.
SET lock_timeout = '5s';
SET statement_timeout = '60s';

DO $migration$
DECLARE
  dependent_policy RECORD;
  restore_statements TEXT[] := ARRAY[]::TEXT[];
  restore_statement TEXT;
BEGIN
  -- Snapshot policies only after excluding concurrent writes and policy DDL.
  -- The DO statement is atomic: any failure restores both policies and types.
  LOCK TABLE public.bids, public.bid_tags IN ACCESS EXCLUSIVE MODE;

  FOR dependent_policy IN
    SELECT p.*, n.nspname, c.relname,
      pg_get_expr(p.polqual, p.polrelid) AS using_expression,
      pg_get_expr(p.polwithcheck, p.polrelid) AS check_expression,
      obj_description(p.oid, 'pg_policy') AS policy_comment,
      (SELECT string_agg(CASE WHEN role_id = 0 THEN 'PUBLIC'
         ELSE quote_ident(pg_get_userbyid(role_id)) END, ', ' ORDER BY role_id)
       FROM unnest(p.polroles) AS role_id) AS role_list
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE EXISTS (
      SELECT 1 FROM pg_depend d
      JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
      WHERE d.classid = 'pg_policy'::regclass AND d.objid = p.oid
        AND d.refclassid = 'pg_class'::regclass
        AND ((a.attrelid = 'public.bids'::regclass AND a.attname = 'id')
          OR (a.attrelid = 'public.bid_tags'::regclass AND a.attname = 'bid_id'))
    )
    ORDER BY p.polname
  LOOP
    -- An unexpected dependency needs a new audit, not an automatic wider change.
    IF dependent_policy.polrelid <> 'public.bid_tags'::regclass THEN
      RAISE EXCEPTION 'Unexpected bid ID policy dependency: %.%',
        dependent_policy.nspname, dependent_policy.relname;
    END IF;
    restore_statements := array_append(restore_statements, format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s',
      dependent_policy.polname, dependent_policy.nspname, dependent_policy.relname,
      CASE WHEN dependent_policy.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      CASE dependent_policy.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT'
        WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE' WHEN '*' THEN 'ALL' END,
      dependent_policy.role_list,
      CASE WHEN dependent_policy.using_expression IS NULL THEN ''
        ELSE format(' USING (%s)', dependent_policy.using_expression) END,
      CASE WHEN dependent_policy.check_expression IS NULL THEN ''
        ELSE format(' WITH CHECK (%s)', dependent_policy.check_expression) END
    ));
    IF dependent_policy.policy_comment IS NOT NULL THEN
      restore_statements := array_append(restore_statements, format(
        'COMMENT ON POLICY %I ON %I.%I IS %L', dependent_policy.polname,
        dependent_policy.nspname, dependent_policy.relname, dependent_policy.policy_comment
      ));
    END IF;
    EXECUTE format('DROP POLICY %I ON %I.%I', dependent_policy.polname,
      dependent_policy.nspname, dependent_policy.relname);
  END LOOP;

  ALTER TABLE public.bids ALTER COLUMN id TYPE text;
  ALTER TABLE public.bid_tags ALTER COLUMN bid_id TYPE text;

  FOREACH restore_statement IN ARRAY restore_statements LOOP
    EXECUTE restore_statement;
  END LOOP;
END;
$migration$;

RESET statement_timeout;
RESET lock_timeout;
