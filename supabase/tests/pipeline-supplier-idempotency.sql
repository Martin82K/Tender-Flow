-- LOCAL TEST DATABASE ONLY. This creates synthetic fixtures and roles.
-- Run the migration against this schema between setup and verification.
\set ON_ERROR_STOP on
CREATE TABLE public.bids (
  id text PRIMARY KEY,
  demand_category_id varchar,
  subcontractor_id text,
  company_name text,
  price numeric,
  status text,
  notes text,
  price_history jsonb,
  tenant_id text NOT NULL DEFAULT 'tenant-a'
);
CREATE ROLE pipeline_editor;
CREATE ROLE pipeline_reader;
GRANT SELECT, INSERT ON public.bids TO pipeline_editor;
GRANT SELECT ON public.bids TO pipeline_reader;
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;
-- Minimal RLS fixture exercises PostgreSQL conflict behavior; production's
-- project/module/subscription policies are separately checked for no change.
CREATE POLICY fixture_select ON public.bids FOR SELECT TO pipeline_editor, pipeline_reader
  USING (tenant_id = current_setting('test.tenant'));
CREATE POLICY fixture_insert ON public.bids FOR INSERT TO pipeline_editor
  WITH CHECK (tenant_id = current_setting('test.tenant'));
INSERT INTO public.bids (id,demand_category_id,subcontractor_id,price,status,notes,price_history)
VALUES ('original','category-a','supplier-a',25000,'sod','Keep original','{"1":"27000"}');

BEGIN;
\ir ../migrations/20260907093847_unique_pipeline_supplier.sql
COMMIT;

SET test.tenant = 'tenant-a';
SET ROLE pipeline_editor;
INSERT INTO public.bids (id,demand_category_id,subcontractor_id,price,status,notes)
VALUES ('retry','category-a','supplier-a',0,'contacted','Do not overwrite')
ON CONFLICT (demand_category_id,subcontractor_id) DO NOTHING;
INSERT INTO public.bids (id,demand_category_id,subcontractor_id)
VALUES ('other-category','category-b','supplier-a'),('other-supplier','category-a','supplier-b')
ON CONFLICT (demand_category_id,subcontractor_id) DO NOTHING;
DO $$ BEGIN
  IF (SELECT count(*) FROM public.bids) <> 3 THEN RAISE EXCEPTION 'Category/supplier uniqueness failed'; END IF;
  IF NOT EXISTS (SELECT FROM public.bids WHERE id='original' AND price=25000 AND status='sod'
      AND notes='Keep original' AND price_history='{"1":"27000"}') THEN
    RAISE EXCEPTION 'Existing commercial data changed';
  END IF;
END $$;

SET test.tenant = 'tenant-b';
DO $$ BEGIN
  IF EXISTS (SELECT FROM public.bids) THEN RAISE EXCEPTION 'Foreign rows visible'; END IF;
  BEGIN
    INSERT INTO public.bids (id,demand_category_id,subcontractor_id,tenant_id)
    VALUES ('foreign','category-a','supplier-a','tenant-a')
    ON CONFLICT (demand_category_id,subcontractor_id) DO NOTHING;
    RAISE EXCEPTION 'Foreign write unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

RESET ROLE;
SET ROLE pipeline_reader;
SET test.tenant = 'tenant-a';
DO $$ BEGIN
  BEGIN
    INSERT INTO public.bids (id,demand_category_id,subcontractor_id)
    VALUES ('reader','category-a','supplier-a')
    ON CONFLICT (demand_category_id,subcontractor_id) DO NOTHING;
    RAISE EXCEPTION 'Reader write unexpectedly allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
SELECT 'PASS: unique category/supplier, original values, cross-category use, RLS and read-only role' AS result;
