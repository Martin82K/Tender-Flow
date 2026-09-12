-- Read-only preflight/postflight. Save results immediately before and after deploy.
-- Counts/checksums cover all four bid-ID paths without returning customer data.
SELECT jsonb_build_object(
  'columns', (
    SELECT jsonb_agg(jsonb_build_object('table', a.attrelid::regclass::text,
      'column', a.attname, 'type', format_type(a.atttypid, a.atttypmod),
      'not_null', a.attnotnull) ORDER BY a.attrelid::regclass::text, a.attname)
    FROM pg_attribute a WHERE a.attnum > 0 AND NOT a.attisdropped AND (
      (a.attrelid = 'public.bids'::regclass AND a.attname = 'id') OR
      (a.attrelid = 'public.bid_tags'::regclass AND a.attname = 'bid_id') OR
      (a.attrelid = 'public.contracts'::regclass AND a.attname = 'source_bid_id') OR
      (a.attrelid = 'mcp_private.outlook_message_links'::regclass AND a.attname = 'bid_id'))
  ),
  'bids', (SELECT jsonb_build_object('count', count(*), 'long_ids', count(*) FILTER (WHERE length(id) > 36),
    'max_length', max(length(id)), 'checksum', md5(string_agg(to_jsonb(b)::text, '|' ORDER BY id))) FROM public.bids b),
  'tags', (SELECT jsonb_build_object('count', count(*), 'checksum', md5(string_agg(to_jsonb(t)::text, '|' ORDER BY bid_id, tag))) FROM public.bid_tags t),
  'contracts', (SELECT jsonb_build_object('count', count(*), 'linked', count(source_bid_id),
    'checksum', md5(string_agg(jsonb_build_array(id, source_bid_id)::text, '|' ORDER BY id))) FROM public.contracts),
  'outlook', (SELECT jsonb_build_object('count', count(*),
    'checksum', md5(string_agg(to_jsonb(l)::text, '|' ORDER BY to_jsonb(l)::text))) FROM mcp_private.outlook_message_links l),
  'orphans', jsonb_build_object(
    'tags', (SELECT count(*) FROM public.bid_tags t LEFT JOIN public.bids b ON b.id = t.bid_id WHERE b.id IS NULL),
    'outlook', (SELECT count(*) FROM mcp_private.outlook_message_links l LEFT JOIN public.bids b ON b.id = l.bid_id WHERE b.id IS NULL)),
  'security', (
    SELECT jsonb_agg(jsonb_build_object('table', c.oid::regclass::text, 'rls', c.relrowsecurity,
      'force_rls', c.relforcerowsecurity, 'acl', c.relacl) ORDER BY c.oid::regclass::text)
    FROM pg_class c WHERE c.oid IN ('public.bids'::regclass, 'public.bid_tags'::regclass,
      'public.contracts'::regclass, 'mcp_private.outlook_message_links'::regclass)
  ),
  'policies', (
    SELECT jsonb_agg(to_jsonb(p) ORDER BY schemaname, tablename, policyname)
    FROM pg_policies p WHERE (schemaname = 'public' AND tablename IN ('bids', 'bid_tags', 'contracts'))
      OR (schemaname = 'mcp_private' AND tablename = 'outlook_message_links')
  ),
  'constraints', (
    SELECT jsonb_agg(jsonb_build_object('table', conrelid::regclass::text, 'name', conname,
      'definition', pg_get_constraintdef(oid), 'validated', convalidated) ORDER BY conrelid::regclass::text, conname)
    FROM pg_constraint WHERE conrelid IN ('public.bids'::regclass, 'public.bid_tags'::regclass,
      'public.contracts'::regclass, 'mcp_private.outlook_message_links'::regclass)
      OR confrelid = 'public.bids'::regclass
  ),
  'indexes', (SELECT jsonb_agg(to_jsonb(i) ORDER BY schemaname, tablename, indexname)
    FROM pg_indexes i WHERE tablename IN ('bids', 'bid_tags', 'contracts', 'outlook_message_links')),
  'triggers', (SELECT jsonb_agg(jsonb_build_object('table', tgrelid::regclass::text,
    'definition', pg_get_triggerdef(oid), 'enabled', tgenabled) ORDER BY tgrelid::regclass::text, tgname)
    FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN ('public.bids'::regclass, 'public.bid_tags'::regclass)),
  'restore_functions', (SELECT jsonb_agg(jsonb_build_object('name', p.oid::regprocedure::text,
    'checksum', md5(pg_get_functiondef(p.oid)), 'acl', p.proacl) ORDER BY p.oid::regprocedure::text)
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'
      AND p.prokind = 'f' AND (p.proname LIKE '%backup%' OR p.proname = 'insert_pipeline_bids'))
) AS bid_id_audit;
