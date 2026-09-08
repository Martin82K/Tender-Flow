-- LOCAL EMPTY TEST DATABASE ONLY: synthetic rows/roles, never production data.
\set ON_ERROR_STOP on
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE ROLE pipeline_editor IN ROLE authenticated;
CREATE ROLE pipeline_reader IN ROLE authenticated;
CREATE TABLE public.bids (
  id text PRIMARY KEY, demand_category_id varchar, subcontractor_id text,
  company_name text, contact_person text, email text, phone text,
  price numeric, price_display text, status text, notes text, tags text[],
  price_history jsonb, tenant_id text NOT NULL DEFAULT 'tenant-a'
);
GRANT SELECT, INSERT ON public.bids TO pipeline_editor;
GRANT SELECT ON public.bids TO pipeline_reader;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
-- Minimal fixture; production project/module/subscription policies stay unchanged.
CREATE POLICY fixture_select ON public.bids FOR SELECT TO pipeline_editor, pipeline_reader
  USING (tenant_id = current_setting('test.tenant'));
CREATE POLICY fixture_insert ON public.bids FOR INSERT TO pipeline_editor
  WITH CHECK (tenant_id = current_setting('test.tenant'));
INSERT INTO public.bids (id,demand_category_id,subcontractor_id,price,status,notes,price_history)
VALUES ('original','category-a','supplier-a',25000,'sod','Keep original','{"1":"27000"}'),
       ('historical','category-a','supplier-a',30000,'offer','Historical offer','{"1":"32000"}');

BEGIN;
\ir ../migrations/20260907093847_idempotent_pipeline_supplier.sql
COMMIT;

SET test.tenant = 'tenant-a';
SET ROLE pipeline_editor;
SELECT * FROM public.insert_pipeline_bids('[{"id":"retry","demand_category_id":"category-a","subcontractor_id":"supplier-a","price":0,"status":"contacted"}]');
SELECT * FROM public.insert_pipeline_bids('[{"id":"other-category","demand_category_id":"category-b","subcontractor_id":"supplier-a"},{"id":"other-supplier","demand_category_id":"category-a","subcontractor_id":"supplier-b"}]');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.bids) <> 4 THEN RAISE EXCEPTION 'Idempotent insertion failed'; END IF;
  IF NOT EXISTS (SELECT FROM public.bids WHERE id='original' AND price=25000 AND status='sod'
      AND notes='Keep original' AND price_history='{"1":"27000"}')
    OR NOT EXISTS (SELECT FROM public.bids WHERE id='historical' AND price=30000 AND status='offer'
      AND notes='Historical offer' AND price_history='{"1":"32000"}') THEN
    RAISE EXCEPTION 'Historical commercial data changed';
  END IF;
END $$;
-- An old desktop INSERT still succeeds; the new path adds no table constraint.
INSERT INTO public.bids (id,demand_category_id,subcontractor_id,price)
VALUES ('legacy-client','category-a','supplier-a',40000);
RESET ROLE;
-- The ON CONFLICT(id) restore strategy can preserve every historical row.
INSERT INTO public.bids (id,demand_category_id,subcontractor_id,price,notes)
VALUES ('backup-a','restored-category','restored-supplier',50000,'Backup A'),
       ('backup-b','restored-category','restored-supplier',60000,'Backup B')
ON CONFLICT (id) DO UPDATE SET price=excluded.price, notes=excluded.notes;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.bids WHERE demand_category_id='restored-category') <> 2
    OR NOT EXISTS (SELECT FROM public.bids WHERE id='backup-a' AND price=50000 AND notes='Backup A')
    OR NOT EXISTS (SELECT FROM public.bids WHERE id='backup-b' AND price=60000 AND notes='Backup B') THEN
    RAISE EXCEPTION 'Legacy restore lost commercial rows';
  END IF;
END $$;

SET ROLE pipeline_editor;
SET test.tenant = 'tenant-b';
DO $$ BEGIN
  IF EXISTS (SELECT FROM public.bids) THEN RAISE EXCEPTION 'Foreign rows visible'; END IF;
  BEGIN
    PERFORM public.insert_pipeline_bids('[{"id":"foreign","demand_category_id":"category-a","subcontractor_id":"supplier-a","tenant_id":"tenant-b"}]');
    RAISE EXCEPTION 'Foreign write unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
SET ROLE pipeline_reader;
SET test.tenant = 'tenant-a';
DO $$ BEGIN
  BEGIN
    PERFORM public.insert_pipeline_bids('[{"id":"reader","demand_category_id":"category-a","subcontractor_id":"supplier-a"}]');
    RAISE EXCEPTION 'Reader write unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
SET ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM public.insert_pipeline_bids('[]');
    RAISE EXCEPTION 'Anonymous execution unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF (SELECT prosecdef FROM pg_proc WHERE oid='public.insert_pipeline_bids(jsonb)'::regprocedure) THEN
    RAISE EXCEPTION 'Function must not elevate caller privileges';
  END IF;
  BEGIN
    PERFORM public.insert_pipeline_bids('[{"id":"missing-pair"}]');
    RAISE EXCEPTION 'Missing identifiers unexpectedly accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.insert_pipeline_bids('{}');
    RAISE EXCEPTION 'Invalid input unexpectedly accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
END $$;
SELECT 'PASS: idempotency, historical data/restore, legacy INSERT, RLS, read-only and anonymous roles' AS result;
