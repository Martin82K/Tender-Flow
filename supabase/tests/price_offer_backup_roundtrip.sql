-- Fresh contract UUIDs only; all writes and backup-history entries roll back.
BEGIN;
DO $$
DECLARE candidate record; selected boolean := false; scope text; cid uuid; manifest jsonb; legacy jsonb;
BEGIN
  FOR candidate IN SELECT p.id,p.owner_id,p.organization_id FROM public.projects p
    WHERE p.owner_id IS NOT NULL AND p.organization_id IS NOT NULL AND p.status <> 'archived' LOOP
    PERFORM set_config('request.jwt.claim.sub',candidate.owner_id::text,true);
    PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',candidate.owner_id,'role','authenticated')::text,true);
    IF public.is_org_admin(candidate.organization_id) AND public.has_active_subscription()
      AND public.can_project_module_action(candidate.id,'module_contracts',true) THEN selected := true; EXIT; END IF;
  END LOOP;
  IF NOT selected THEN RAISE EXCEPTION 'No entitled admin-owned fixture'; END IF;
  FOREACH scope IN ARRAY ARRAY['user','tenant'] LOOP
    cid := gen_random_uuid();
    BEGIN
      INSERT INTO public.contracts(id,project_id,vendor_name,title,status,currency,base_price,source,owner_id,organization_id,price_offer_path)
        VALUES(cid,candidate.id,'Rollback fixture','Price offer backup test','active','CZK',1000,'manual',candidate.owner_id,candidate.organization_id,'Supplier/Original.pdf');
      EXECUTE format('SELECT public.export_%s_backup($1)',scope) INTO manifest USING candidate.organization_id;
      manifest := jsonb_build_object('version','1.0','contracts',(SELECT jsonb_agg(c) FROM jsonb_array_elements(manifest->'contracts') c WHERE c->>'id'=cid::text));
      IF manifest#>>'{contracts,0,price_offer_path}' IS DISTINCT FROM 'Supplier/Original.pdf' THEN RAISE EXCEPTION 'Missing exported mapping'; END IF;
      RAISE EXCEPTION 'Rollback fixture; retain manifest' USING ERRCODE='Z0001';
    EXCEPTION WHEN SQLSTATE 'Z0001' THEN NULL; END;
    EXECUTE format('SELECT public.restore_%s_backup($1,$2)',scope) USING manifest,candidate.organization_id;
    IF (SELECT price_offer_path FROM public.contracts WHERE id=cid) IS DISTINCT FROM 'Supplier/Original.pdf' THEN RAISE EXCEPTION 'Mapping missing after % insert',scope; END IF;
    UPDATE public.contracts SET price_offer_path='Supplier/Changed.xlsx' WHERE id=cid;
    EXECUTE format('SELECT public.restore_%s_backup($1,$2)',scope) USING manifest,candidate.organization_id;
    IF (SELECT price_offer_path FROM public.contracts WHERE id=cid) IS DISTINCT FROM 'Supplier/Original.pdf' THEN RAISE EXCEPTION 'Mapping missing after % update',scope; END IF;
    legacy := jsonb_set(manifest,'{contracts,0}',(manifest#>'{contracts,0}')-'price_offer_path');
    EXECUTE format('SELECT public.restore_%s_backup($1,$2)',scope) USING legacy,candidate.organization_id;
    IF (SELECT price_offer_path FROM public.contracts WHERE id=cid) IS DISTINCT FROM 'Supplier/Original.pdf' THEN RAISE EXCEPTION 'Legacy % backup removed mapping',scope; END IF;
    manifest := jsonb_set(manifest,'{contracts,0,price_offer_path}','null'::jsonb);
    EXECUTE format('SELECT public.restore_%s_backup($1,$2)',scope) USING manifest,candidate.organization_id;
    IF (SELECT price_offer_path FROM public.contracts WHERE id=cid) IS NOT NULL THEN RAISE EXCEPTION 'Explicit null not restored'; END IF;
  END LOOP;
END $$;
ROLLBACK;
