BEGIN;
-- Patch only the contracts INSERT/UPDATE in both existing authorized restorers.
-- Keep all subscription, ownership, tenant and retention-evidence guards intact.
DO $migration$
DECLARE
  scope text;
  signature regprocedure;
  definition text;
  original_block text;
  patched_block text;
  start_at integer;
  end_at integer;
BEGIN
  FOREACH scope IN ARRAY ARRAY['user', 'tenant'] LOOP
    signature := format('public.restore_%s_backup_without_offer_deadline_20260817(jsonb,uuid)', scope)::regprocedure;
    SELECT pg_get_functiondef(signature) INTO definition;
    start_at := position('INSERT INTO public.contracts (' IN definition);
    end_at := position('cnt_contracts := cnt_contracts + 1;' IN definition);
    IF start_at = 0 OR end_at <= start_at THEN
      RAISE EXCEPTION 'Unexpected % contracts restore shape', scope;
    END IF;
    original_block := substring(definition FROM start_at FOR end_at - start_at);
    IF position('price_offer_path' IN original_block) > 0
      OR position(') VALUES (' IN original_block) = 0
      OR position('ON CONFLICT (id) DO UPDATE SET' IN original_block) = 0 THEN
      RAISE EXCEPTION 'Unexpected % contracts restore columns', scope;
    END IF;
    patched_block := replace(original_block, 'INSERT INTO public.contracts (', 'INSERT INTO public.contracts (price_offer_path,');
    patched_block := replace(patched_block, ') VALUES (', ') VALUES (item->>''price_offer_path'',');
    patched_block := replace(patched_block, 'ON CONFLICT (id) DO UPDATE SET',
      'ON CONFLICT (id) DO UPDATE SET price_offer_path = CASE WHEN item ? ''price_offer_path'' THEN EXCLUDED.price_offer_path ELSE contracts.price_offer_path END,');
    EXECUTE replace(definition, original_block, patched_block);
  END LOOP;
END $migration$;
COMMIT;
