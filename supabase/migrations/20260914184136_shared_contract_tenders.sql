-- One contract may cover several tenders. Each tender category has one contract.
-- Keep source_bid_id as the original source for existing clients/documents.
BEGIN;
ALTER TABLE public.contracts ADD CONSTRAINT contracts_id_project_key UNIQUE (id, project_id);
ALTER TABLE public.demand_categories ADD CONSTRAINT demand_categories_id_project_key UNIQUE (id, project_id);
-- Compatibility for clean/older repositories (category_id) and the linked database.
DO $$ DECLARE category_column text;
BEGIN
  SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bids' AND column_name='demand_category_id') THEN 'demand_category_id' ELSE 'category_id' END INTO category_column;
  EXECUTE format('ALTER TABLE public.bids ADD CONSTRAINT bids_id_category_key UNIQUE (id, %I)',category_column);
END $$;
CREATE TABLE public.contract_bid_links (
  bid_id text PRIMARY KEY,
  contract_id uuid NOT NULL,
  project_id varchar(36) NOT NULL,
  category_id varchar(36) NOT NULL UNIQUE,
  FOREIGN KEY (contract_id, project_id) REFERENCES public.contracts(id, project_id) ON DELETE CASCADE,
  FOREIGN KEY (category_id, project_id) REFERENCES public.demand_categories(id, project_id) ON DELETE CASCADE
);
DO $$ DECLARE category_column text;
BEGIN
  SELECT CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bids' AND column_name='demand_category_id') THEN 'demand_category_id' ELSE 'category_id' END INTO category_column;
  EXECUTE format('ALTER TABLE public.contract_bid_links ADD CONSTRAINT contract_bid_links_bid_id_category_id_fkey FOREIGN KEY(bid_id,category_id) REFERENCES public.bids(id,%I) ON DELETE CASCADE',category_column);
END $$;
CREATE INDEX contract_bid_links_contract_idx ON public.contract_bid_links(contract_id, project_id);
CREATE INDEX contract_bid_links_project_idx ON public.contract_bid_links(project_id);
-- Fail the migration on ambiguous, orphaned or cross-project historical links; never discard them.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.contracts c LEFT JOIN public.bids b ON b.id=c.source_bid_id
    LEFT JOIN public.demand_categories dc ON dc.id=COALESCE(to_jsonb(b)->>'demand_category_id',to_jsonb(b)->>'category_id')
    WHERE c.source_bid_id IS NOT NULL AND (b.id IS NULL OR dc.project_id IS DISTINCT FROM c.project_id)) THEN
    RAISE EXCEPTION 'Invalid historical contract link; resolve before migration';
  END IF;
END $$;
INSERT INTO public.contract_bid_links(bid_id, contract_id, project_id, category_id)
SELECT c.source_bid_id, c.id, c.project_id, COALESCE(to_jsonb(b)->>'demand_category_id',to_jsonb(b)->>'category_id')
FROM public.contracts c JOIN public.bids b ON b.id=c.source_bid_id;
ALTER TABLE public.contract_bid_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contract_bid_links FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.contract_bid_links TO authenticated;
GRANT ALL ON public.contract_bid_links TO service_role;
CREATE POLICY contract_bid_links_read ON public.contract_bid_links FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.contracts c WHERE c.id=contract_id));
CREATE POLICY contract_bid_links_insert ON public.contract_bid_links FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.contracts c WHERE c.id=contract_id));
CREATE POLICY contract_bid_links_delete ON public.contract_bid_links FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.contracts c WHERE c.id=contract_id));
-- Exercise the contract's actual UPDATE policies, including subscription and module restrictions.
-- This avoids duplicating or weakening its permission rules. Invoker deliberately preserves RLS.
CREATE FUNCTION public.guard_contract_bid_link_write() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE target_id uuid; touched uuid;
BEGIN
  target_id := CASE WHEN TG_OP='DELETE' THEN OLD.contract_id ELSE NEW.contract_id END;
  UPDATE public.contracts SET updated_at=updated_at WHERE id=target_id RETURNING id INTO touched;
  IF touched IS NULL THEN
    -- Allow cascades when the parent was already removed.
    IF TG_OP='DELETE' AND NOT EXISTS (SELECT 1 FROM public.contracts WHERE id=target_id) THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'Contract is not writable' USING ERRCODE='42501';
  END IF;
  IF TG_OP='INSERT' AND NOT EXISTS (SELECT 1 FROM public.bids WHERE id=NEW.bid_id) THEN
    RAISE EXCEPTION 'Bid is not accessible' USING ERRCODE='42501';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_contract_bid_link_write BEFORE INSERT OR DELETE ON public.contract_bid_links
FOR EACH ROW EXECUTE FUNCTION public.guard_contract_bid_link_write();
-- Existing create/import paths still set source_bid_id. Register that link atomically too.
CREATE FUNCTION public.sync_contract_source_bid_link() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD.source_bid_id IS DISTINCT FROM NEW.source_bid_id THEN
    DELETE FROM public.contract_bid_links WHERE contract_id=NEW.id AND bid_id=OLD.source_bid_id;
  END IF;
  IF NEW.source_bid_id IS NOT NULL THEN
    INSERT INTO public.contract_bid_links(bid_id, contract_id, project_id, category_id)
    SELECT b.id, NEW.id, NEW.project_id, COALESCE(to_jsonb(b)->>'demand_category_id',to_jsonb(b)->>'category_id') FROM public.bids b WHERE b.id=NEW.source_bid_id
    ON CONFLICT (bid_id) DO NOTHING;
    IF NOT EXISTS (SELECT 1 FROM public.contract_bid_links WHERE bid_id=NEW.source_bid_id AND contract_id=NEW.id) THEN
      RAISE EXCEPTION 'Tender is already linked or inaccessible' USING ERRCODE='23505';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sync_contract_source_bid_link AFTER INSERT OR UPDATE OF source_bid_id ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.sync_contract_source_bid_link();
CREATE FUNCTION public.unlink_contract_bid(p_project_id text, p_contract_id uuid, p_bid_id text) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE touched uuid; removed text;
BEGIN
  UPDATE public.contracts SET updated_at=updated_at
    WHERE id=p_contract_id AND project_id=p_project_id RETURNING id INTO touched;
  IF touched IS NULL THEN RAISE EXCEPTION 'Contract is not writable' USING ERRCODE='42501'; END IF;
  DELETE FROM public.contract_bid_links WHERE contract_id=p_contract_id AND project_id=p_project_id AND bid_id=p_bid_id RETURNING bid_id INTO removed;
  IF removed IS NULL THEN RETURN false; END IF;
  UPDATE public.contracts SET source_bid_id=NULL WHERE id=p_contract_id AND source_bid_id=p_bid_id;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.guard_contract_bid_link_write(), public.sync_contract_source_bid_link(), public.unlink_contract_bid(text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unlink_contract_bid(text,uuid,text) TO authenticated, service_role;
-- Extend existing backup entry points without changing their authorization or legacy restore rules.
-- The wrapped functions remain inaccessible directly.
DO $migration$
DECLARE kind text; original text; wrapper text;
BEGIN
  FOREACH kind IN ARRAY ARRAY['user','tenant'] LOOP
    EXECUTE format('ALTER FUNCTION public.export_%s_backup(uuid) RENAME TO export_%s_backup_before_shared_tenders', kind, kind);
    EXECUTE format('REVOKE ALL ON FUNCTION public.export_%s_backup_before_shared_tenders(uuid) FROM PUBLIC, anon, authenticated, service_role', kind);
    wrapper := format($definition$
      CREATE FUNCTION public.export_%1$s_backup(target_org_id uuid) RETURNS jsonb
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $body$
      DECLARE result jsonb;
      BEGIN
        result := public.export_%1$s_backup_before_shared_tenders(target_org_id);
        RETURN jsonb_set(result, '{contracts}', COALESCE((
          SELECT jsonb_agg(item || jsonb_build_object('contract_bid_links', COALESCE((
            SELECT jsonb_agg(to_jsonb(l)) FROM public.contract_bid_links l WHERE l.contract_id=(item->>'id')::uuid
          ), '[]'::jsonb))) FROM jsonb_array_elements(result->'contracts') item
        ), '[]'::jsonb));
      END $body$;
    $definition$, kind);
    EXECUTE wrapper;
    EXECUTE format('REVOKE ALL ON FUNCTION public.export_%s_backup(uuid) FROM PUBLIC, anon', kind);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.export_%s_backup(uuid) TO authenticated, service_role', kind);
    EXECUTE format('ALTER FUNCTION public.restore_%s_backup(jsonb,uuid) RENAME TO restore_%s_backup_before_shared_tenders', kind, kind);
    EXECUTE format('REVOKE ALL ON FUNCTION public.restore_%s_backup_before_shared_tenders(jsonb,uuid) FROM PUBLIC, anon, authenticated, service_role', kind);
    wrapper := format($definition$
      CREATE FUNCTION public.restore_%1$s_backup(backup_json jsonb, target_org_id uuid) RETURNS jsonb
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $body$
      DECLARE result jsonb; item jsonb; link jsonb; c public.contracts; category text;
      BEGIN
        result := public.restore_%1$s_backup_before_shared_tenders(backup_json, target_org_id);
        FOR item IN SELECT jsonb_array_elements(COALESCE(backup_json->'contracts','[]'::jsonb)) LOOP
          SELECT * INTO c FROM public.contracts WHERE id=(item->>'id')::uuid
            AND organization_id=target_org_id
            AND ('%1$s'='tenant' OR owner_id=auth.uid());
          IF c.id IS NULL THEN CONTINUE; END IF;
          IF NOT (item ? 'contract_bid_links') AND c.source_bid_id IS NOT NULL THEN
            UPDATE public.contracts SET source_bid_id=source_bid_id WHERE id=c.id;
          END IF;
          FOR link IN SELECT jsonb_array_elements(COALESCE(item->'contract_bid_links','[]'::jsonb)) LOOP
            SELECT COALESCE(to_jsonb(b)->>'demand_category_id',to_jsonb(b)->>'category_id') INTO category FROM public.bids b JOIN public.demand_categories dc ON dc.id=COALESCE(to_jsonb(b)->>'demand_category_id',to_jsonb(b)->>'category_id')
              WHERE b.id=link->>'bid_id' AND dc.project_id=c.project_id;
            IF category IS NULL THEN RAISE EXCEPTION 'Invalid restored tender link' USING ERRCODE='23503'; END IF;
            INSERT INTO public.contract_bid_links(bid_id,contract_id,project_id,category_id)
              VALUES(link->>'bid_id',c.id,c.project_id,category) ON CONFLICT(bid_id) DO NOTHING;
            IF NOT EXISTS(SELECT 1 FROM public.contract_bid_links WHERE bid_id=link->>'bid_id' AND contract_id=c.id) THEN
              RAISE EXCEPTION 'Restored tender already belongs to another contract' USING ERRCODE='23505';
            END IF;
          END LOOP;
        END LOOP;
        RETURN result;
      END $body$;
    $definition$, kind);
    EXECUTE wrapper;
    EXECUTE format('REVOKE ALL ON FUNCTION public.restore_%s_backup(jsonb,uuid) FROM PUBLIC, anon', kind);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.restore_%s_backup(jsonb,uuid) TO authenticated, service_role', kind);
  END LOOP;
END $migration$;

NOTIFY pgrst, 'reload schema';
COMMIT;
