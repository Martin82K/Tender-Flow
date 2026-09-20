BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='30s';
DO $migration$
DECLARE definition text; anchor text := 'OR jsonb_typeof(node#>''{source,sheet}'') IS DISTINCT FROM ''string''';
BEGIN
 SELECT pg_get_functiondef('private.budget_save(text,uuid,uuid,integer,text,jsonb,jsonb,boolean)'::regprocedure) INTO definition;
 IF position(anchor IN definition)=0 THEN RAISE EXCEPTION 'Unexpected budget source validator'; END IF;
 definition:=replace(definition,anchor,anchor||'
      OR (CASE WHEN jsonb_typeof(node#>''{source,row}'')=''number'' THEN
        (node#>>''{source,row}'')::numeric < 0
        OR (node#>>''{source,row}'')::numeric > 2147483647
        OR (node#>>''{source,row}'')::numeric <> trunc((node#>>''{source,row}'')::numeric)
      ELSE true END)');
 EXECUTE definition;
END $migration$;
COMMIT;
