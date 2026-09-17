-- Licensing is an additional resource boundary, never a membership grant.
-- Account-level entitlement remains available for bootstrap and billing recovery.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
CREATE SCHEMA IF NOT EXISTS private;

CREATE FUNCTION private.resource_subscription_tier(org_id uuid, owner_id uuid, actor_id uuid) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE o public.organizations%ROWTYPE; access_end timestamptz; tier text;
BEGIN
  IF actor_id IS NULL THEN RETURN 'free'; END IF;
  IF public.is_platform_admin(actor_id) THEN RETURN 'admin'; END IF;
  -- Legacy rows without an organization belong to the recorded owner's account.
  -- Never infer a different organization from the viewer's memberships.
  IF org_id IS NULL THEN RETURN COALESCE(public.get_effective_user_tier(COALESCE(owner_id,actor_id))->>'tier','free'); END IF;
  SELECT * INTO o FROM public.organizations WHERE id=org_id;
  IF NOT FOUND THEN RETURN 'free'; END IF;
  access_end := CASE WHEN left(o.billing_customer_id,4)='cus_' THEN o.expires_at ELSE COALESCE(o.billing_period_end,o.expires_at) END;
  IF o.override_tier IS NOT NULL AND (o.override_expires_at IS NULL OR o.override_expires_at > now()) THEN
    tier := o.override_tier;
  ELSIF (o.subscription_status='active' AND (access_end IS NULL OR access_end > now()))
    OR (o.subscription_status IN ('trial','cancelled','canceled','pending','past_due') AND access_end > now()) THEN
    tier := o.subscription_tier;
  END IF;
  IF tier IN ('starter','pro','enterprise') THEN RETURN tier; END IF;
  -- A historical personal subscription can license its owner's personal space,
  -- but must never license a business organization or a different personal org.
  IF o.type='personal' THEN
    SELECT COALESCE(up.subscription_tier_override,up.stripe_subscription_tier) INTO tier
    FROM public.user_profiles up WHERE up.user_id=o.owner_user_id AND (
      (up.subscription_status='active' AND (up.subscription_expires_at IS NULL OR up.subscription_expires_at > now()))
      OR (up.subscription_status='trial' AND up.trial_ends_at > now() AND (up.subscription_expires_at IS NULL OR up.subscription_expires_at > now()))
      OR (up.subscription_status IN ('cancelled','canceled') AND up.subscription_expires_at > now())
    );
    IF tier IN ('starter','pro','enterprise') THEN RETURN tier; END IF;
  END IF;
  RETURN 'free';
END $$;

CREATE FUNCTION public.has_resource_subscription(organization_id_input uuid, owner_id_input uuid DEFAULT NULL) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.resource_subscription_tier(organization_id_input,owner_id_input,auth.uid()) IN ('starter','pro','enterprise','admin');
$$;
CREATE FUNCTION public.has_project_subscription(project_id_input text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE((SELECT private.resource_subscription_tier(p.organization_id,p.owner_id,auth.uid()) IN ('starter','pro','enterprise','admin')
    FROM public.projects p WHERE p.id=project_id_input),false);
$$;
-- Only trusted OAuth callbacks may supply an actor instead of the verified JWT.
CREATE FUNCTION public.has_project_subscription_for_user(project_id_input text, user_id_input uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE((SELECT private.resource_subscription_tier(p.organization_id,p.owner_id,user_id_input) IN ('starter','pro','enterprise','admin')
    FROM public.projects p WHERE p.id=project_id_input),false);
$$;
CREATE FUNCTION public.project_has_feature(project_id_input text, feature_key_input text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE((SELECT tier='admin' OR (tier IN ('starter','pro','enterprise') AND (
    EXISTS(SELECT 1 FROM public.subscription_tier_features f WHERE f.tier=e.tier AND f.feature_key=feature_key_input AND f.enabled)
    OR EXISTS(SELECT 1 FROM public.user_feature_overrides u WHERE u.user_id=auth.uid() AND u.feature_key=feature_key_input AND (u.expires_at IS NULL OR u.expires_at>now()))
  )) FROM (SELECT private.resource_subscription_tier(p.organization_id,p.owner_id,auth.uid()) AS tier
    FROM public.projects p WHERE p.id=project_id_input) e),false);
$$;
REVOKE ALL ON FUNCTION private.resource_subscription_tier(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,tenderflow_mcp_client,service_role;
REVOKE ALL ON FUNCTION public.has_resource_subscription(uuid,uuid),public.has_project_subscription(text),public.project_has_feature(text,text),public.has_project_subscription_for_user(text,uuid) FROM PUBLIC,anon,authenticated,tenderflow_mcp_client,service_role;
GRANT EXECUTE ON FUNCTION public.has_resource_subscription(uuid,uuid),public.has_project_subscription(text),public.project_has_feature(text,text) TO authenticated,tenderflow_mcp_client,service_role;
GRANT EXECUTE ON FUNCTION public.has_project_subscription_for_user(text,uuid) TO service_role;

CREATE FUNCTION public.organization_has_feature(org_id uuid, feature_key_input text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT tier='admin' OR (tier IN ('starter','pro','enterprise') AND (
    EXISTS(SELECT 1 FROM public.subscription_tier_features f WHERE f.tier=e.tier AND f.feature_key=feature_key_input AND f.enabled)
    OR EXISTS(SELECT 1 FROM public.user_feature_overrides u WHERE u.user_id=auth.uid() AND u.feature_key=feature_key_input AND (u.expires_at IS NULL OR u.expires_at>now()))
  )) FROM (SELECT private.resource_subscription_tier(org_id,NULL,auth.uid()) AS tier) e;
$$;
REVOKE ALL ON FUNCTION public.organization_has_feature(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.organization_has_feature(uuid,text) TO authenticated,service_role;

-- Existing emitters persist the source project in action_url, or use a stable
-- project/task entity id. Resolve those stored identifiers, never viewer orgs.
CREATE FUNCTION private.notification_subscription_allowed(entity_type_input text, entity_id_input text, action_url_input text, actor_id uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE source_project text;
BEGIN
  IF actor_id IS NULL THEN RETURN false; END IF;
  source_project := substring(action_url_input FROM '[?&]projectId=([^&#]+)');
  IF source_project IS NULL AND entity_type_input IN ('project','project_archive','project_clone') THEN
    source_project := entity_id_input;
  ELSIF entity_type_input='task_reminder' THEN
    SELECT t.project_id::text INTO source_project FROM public.tasks t WHERE t.id::text=entity_id_input;
    IF NOT FOUND THEN RETURN false; END IF;
  END IF;
  IF source_project IS NOT NULL THEN
    RETURN COALESCE((SELECT private.resource_subscription_tier(p.organization_id,p.owner_id,actor_id) IN ('starter','pro','enterprise','admin') FROM public.projects p WHERE p.id=source_project),false);
  END IF;
  -- An orphaned project notification must not fall back to an account licence.
  IF entity_type_input IN ('project','project_archive','project_clone','bid','bid_contracted','category_status','tender_closed','deadline','document') THEN RETURN false; END IF;
  -- Account notices (including licence recovery) and personal reminders are not
  -- organization data; preserve their existing access rules and generation.
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION private.notification_subscription_allowed(text,text,text,uuid) FROM PUBLIC,anon,authenticated,tenderflow_mcp_client,service_role;
CREATE FUNCTION public.notification_has_subscription(entity_type_input text,entity_id_input text,action_url_input text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.notification_subscription_allowed(entity_type_input,entity_id_input,action_url_input,auth.uid());
$$;
REVOKE ALL ON FUNCTION public.notification_has_subscription(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.notification_has_subscription(text,text,text) TO authenticated;
CREATE POLICY tenant_subscription_required ON public.notifications AS RESTRICTIVE FOR ALL TO authenticated
USING (public.notification_has_subscription(entity_type,entity_id,action_url))
WITH CHECK (public.notification_has_subscription(entity_type,entity_id,action_url));
-- Service-role deadline/task generators bypass RLS; suppress unlicensed output
-- centrally, including direct inserts and insert_notification RPC calls.
CREATE FUNCTION private.guard_notification_subscription() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.notification_subscription_allowed(NEW.entity_type,NEW.entity_id,NEW.action_url,NEW.user_id) THEN RETURN NULL; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.guard_notification_subscription() FROM PUBLIC,anon,authenticated,tenderflow_mcp_client,service_role;
CREATE TRIGGER notification_subscription_guard BEFORE INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION private.guard_notification_subscription();

-- Preserve function identities and their existing authorization, signatures and ACLs.
-- In particular, renaming an RLS helper would leave policy dependencies on the old OID.
DO $migration$
DECLARE entry record; definition text; original text;
BEGIN
  FOR entry IN SELECT * FROM (VALUES
    ('public.can_project_action(text,text)', 'IF NOT public.has_project_subscription(project_id_input) THEN RETURN false; END IF;'),
    ('public.create_project_with_team(text,text,text,text,uuid,jsonb)', 'IF NOT public.has_resource_subscription(organization_id_input) THEN RAISE EXCEPTION ''Active organization subscription required'' USING ERRCODE=''PT402''; END IF;'),
    ('public.clone_tender_project_to_realization(character varying)', 'IF NOT public.has_project_subscription(project_id_input::text) THEN RAISE EXCEPTION ''Active project subscription required'' USING ERRCODE=''PT402''; END IF;'),
    ('public.restore_user_backup(jsonb,uuid)', 'IF NOT public.has_resource_subscription(target_org_id) THEN RAISE EXCEPTION ''Active organization subscription required'' USING ERRCODE=''PT402''; END IF;'),
    ('public.restore_tenant_backup(jsonb,uuid)', 'IF NOT public.has_resource_subscription(target_org_id) THEN RAISE EXCEPTION ''Active organization subscription required'' USING ERRCODE=''PT402''; END IF;')
  ) AS guards(signature,guard) LOOP
    original := pg_get_functiondef(entry.signature::regprocedure);
    IF position(E'BEGIN\n' IN original)=0 THEN RAISE EXCEPTION 'Unexpected function body: %',entry.signature; END IF;
    definition := regexp_replace(original,E'BEGIN\n',E'BEGIN\n  '||entry.guard||E'\n');
    IF entry.signature='public.can_project_action(text,text)' THEN
      definition := replace(definition,'public.user_has_feature(', 'public.project_has_feature(project_id_input,');
    ELSIF entry.signature='public.create_project_with_team(text,text,text,text,uuid,jsonb)' THEN
      IF position('public.user_has_feature(''module_projects'')' IN definition)=0 THEN RAISE EXCEPTION 'Unexpected create project feature guard'; END IF;
      definition := replace(definition,'public.user_has_feature(''module_projects'')','public.organization_has_feature(organization_id_input,''module_projects'')');
    END IF;
    EXECUTE definition;
  END LOOP;
  original := pg_get_functiondef('public.effective_project_role(text,uuid)'::regprocedure);
  IF position('WHERE p.id = project_id_input' IN original)=0 THEN RAISE EXCEPTION 'Unexpected effective_project_role body'; END IF;
  EXECUTE replace(original,'WHERE p.id = project_id_input','WHERE p.id = project_id_input AND private.resource_subscription_tier(p.organization_id,p.owner_id,user_id_input) IN (''starter'',''pro'',''enterprise'',''admin'')');
  original := pg_get_functiondef('public.can_project_module_action(text,text,boolean)'::regprocedure);
  IF position('public.user_has_feature(feature_key_input)' IN original)=0 THEN RAISE EXCEPTION 'Unexpected project module body'; END IF;
  EXECUTE replace(original,'public.user_has_feature(feature_key_input)','public.project_has_feature(project_id_input,feature_key_input)');
  original := pg_get_functiondef('public.contract_overview_access_scope(uuid,uuid)'::regprocedure);
  IF position('SELECT CASE' IN original)=0 THEN RAISE EXCEPTION 'Unexpected contract overview scope'; END IF;
  EXECUTE replace(original,'SELECT CASE','SELECT CASE WHEN private.resource_subscription_tier(org_id_input,NULL,user_id_input) NOT IN (''starter'',''pro'',''enterprise'',''admin'') THEN ''none''');
  -- A readable project must not join contact details from an expired organization.
  original := pg_get_functiondef('public.get_overview_tenant_data()'::regprocedure);
  IF position('ON s.id = b.subcontractor_id' IN original)=0 THEN RAISE EXCEPTION 'Unexpected tenant overview join'; END IF;
  EXECUTE replace(original,'ON s.id = b.subcontractor_id','ON s.id = b.subcontractor_id AND public.has_resource_subscription(s.organization_id,s.owner_id)');
  FOR entry IN SELECT unnest(ARRAY['public.get_my_notifications(integer)','public.get_my_notifications(integer,text)']) AS signature LOOP
    original := pg_get_functiondef(entry.signature::regprocedure);
    IF position('WHERE n.user_id = auth.uid()' IN original)=0 THEN RAISE EXCEPTION 'Unexpected notifications RPC: %',entry.signature; END IF;
    EXECUTE replace(original,'WHERE n.user_id = auth.uid()','WHERE n.user_id = auth.uid() AND public.notification_has_subscription(n.entity_type,n.entity_id,n.action_url)');
  END LOOP;
END $migration$;

CREATE OR REPLACE FUNCTION public.export_user_backup(target_org_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.has_resource_subscription(target_org_id) THEN RAISE EXCEPTION 'Active organization subscription required' USING ERRCODE='PT402'; END IF;
  RETURN public.export_user_backup_before_shared_tenders(target_org_id);
END $$;
CREATE OR REPLACE FUNCTION public.export_tenant_backup(target_org_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.has_resource_subscription(target_org_id) THEN RAISE EXCEPTION 'Active organization subscription required' USING ERRCODE='PT402'; END IF;
  RETURN public.export_tenant_backup_before_shared_tenders(target_org_id);
END $$;
CREATE OR REPLACE FUNCTION public.get_project_owner_emails()
RETURNS TABLE(project_id varchar(255),owner_email varchar(255))
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.id::varchar(255),u.email::varchar(255) FROM public.projects p JOIN auth.users u ON u.id=p.owner_id
  WHERE public.can_project_action(p.id::text,'view');
$$;

-- Intersect current tenant/role policies for every direct resource. Bootstrap and
-- billing metadata are deliberately excluded so an expired tenant can recover.
DO $migration$
DECLARE entry record; predicate text; owner_column text;
BEGIN
  FOR entry IN SELECT c.table_name,
    bool_or(c.column_name='organization_id') AS has_org,
    bool_or(c.column_name='project_id') AS has_project
    FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name IN (
      'projects','project_shares','project_access_audit_events','user_hidden_projects','demand_categories','contracts',
      'contract_markdown_versions','contract_markdown_access_audit','contract_bid_links',
      'project_amendments','project_contracts','project_internal_amendments','project_investor_financials',
      'project_investor_invoices','project_budgets','project_template_selections','tender_plans',
      'subcontractors','subcontractor_statuses','tasks','templates','excel_indexer_entries',
      'dochub_autocreate_runs','dochub_project_folders','backup_history'
    ) GROUP BY c.table_name LOOP
    IF entry.table_name='projects' THEN
      predicate := 'public.has_resource_subscription(organization_id,owner_id)';
    ELSIF entry.table_name='project_access_audit_events' THEN
      predicate := 'public.has_resource_subscription(organization_id) AND (project_id IS NULL OR public.has_project_subscription(project_id::text))';
    ELSIF entry.table_name='subcontractor_statuses' THEN
      predicate := '(organization_id IS NULL AND public.has_active_subscription()) OR public.has_resource_subscription(organization_id)';
    ELSIF entry.has_project THEN
      predicate := 'public.has_project_subscription(project_id::text)';
      IF entry.table_name IN ('tasks','templates') THEN
        predicate := '(project_id IS NULL AND public.has_active_subscription()) OR ('||predicate||')';
      END IF;
      IF entry.has_org THEN predicate := '('||predicate||') AND (organization_id IS NULL OR public.has_resource_subscription(organization_id))'; END IF;
    ELSIF entry.has_org THEN
      SELECT c.column_name INTO owner_column FROM information_schema.columns c
      WHERE c.table_schema='public' AND c.table_name=entry.table_name AND c.column_name IN ('owner_id','user_id')
      ORDER BY c.column_name LIMIT 1;
      predicate := format('public.has_resource_subscription(organization_id,%s)',COALESCE(quote_ident(owner_column),'NULL'));
    ELSE RAISE EXCEPTION 'Unmapped licensed table: %',entry.table_name;
    END IF;
    EXECUTE format('CREATE POLICY tenant_subscription_required ON public.%I AS RESTRICTIVE FOR ALL TO authenticated,tenderflow_mcp_client USING (%s) WITH CHECK (%s)',entry.table_name,predicate,predicate);
  END LOOP;
  -- Children without a direct project/organization column resolve their parent.
  FOR entry IN SELECT * FROM (VALUES
    ('bids','EXISTS(SELECT 1 FROM public.demand_categories d WHERE d.id=COALESCE(to_jsonb(bids)->>''demand_category_id'',to_jsonb(bids)->>''category_id'') AND public.has_project_subscription(d.project_id::text))'),
    ('bid_tags','EXISTS(SELECT 1 FROM public.bids b WHERE b.id=bid_tags.bid_id)'),
    ('contract_amendments','EXISTS(SELECT 1 FROM public.contracts c WHERE c.id=contract_amendments.contract_id)'),
    ('contract_drawdowns','EXISTS(SELECT 1 FROM public.contracts c WHERE c.id=contract_drawdowns.contract_id)'),
    ('contract_invoices','EXISTS(SELECT 1 FROM public.contracts c WHERE c.id=contract_invoices.contract_id)'),
    ('contract_generated_documents','EXISTS(SELECT 1 FROM public.contracts c WHERE c.id=contract_generated_documents.contract_id)'),
    ('contract_handover_events','EXISTS(SELECT 1 FROM public.contracts c WHERE c.id=contract_handover_events.contract_id)'),
    ('project_budget_sheets','EXISTS(SELECT 1 FROM public.project_budgets b WHERE b.id=project_budget_sheets.budget_id)'),
    ('project_budget_categories','EXISTS(SELECT 1 FROM public.project_budget_sheets s WHERE s.id=project_budget_categories.sheet_id)'),
    ('project_budget_items','EXISTS(SELECT 1 FROM public.project_budget_categories c WHERE c.id=project_budget_items.category_id)'),
    ('project_budget_measurements','EXISTS(SELECT 1 FROM public.project_budget_items i WHERE i.id=project_budget_measurements.item_id)')
  ) AS rules(table_name,expression) LOOP
    IF to_regclass('public.'||entry.table_name) IS NOT NULL THEN
      EXECUTE format('CREATE POLICY tenant_subscription_required ON public.%I AS RESTRICTIVE FOR ALL TO authenticated,tenderflow_mcp_client USING (%s) WITH CHECK (%s)',entry.table_name,entry.expression,entry.expression);
    END IF;
  END LOOP;
END $migration$;

CREATE POLICY tenant_subscription_required ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated,tenderflow_mcp_client
USING (CASE
  WHEN bucket_id='contract-documents' THEN public.has_project_subscription(split_part(name,'/',2))
  WHEN bucket_id='contract-protocol-files' THEN EXISTS(SELECT 1 FROM public.contracts c WHERE c.id::text=split_part(name,'/',1) AND public.has_project_subscription(c.project_id::text))
  WHEN bucket_id='organization-branding' THEN EXISTS(SELECT 1 FROM public.organizations o WHERE o.id::text=split_part(name,'/',2) AND public.has_resource_subscription(o.id))
  ELSE public.has_active_subscription() END)
WITH CHECK (CASE
  WHEN bucket_id='contract-documents' THEN public.has_project_subscription(split_part(name,'/',2))
  WHEN bucket_id='contract-protocol-files' THEN EXISTS(SELECT 1 FROM public.contracts c WHERE c.id::text=split_part(name,'/',1) AND public.has_project_subscription(c.project_id::text))
  WHEN bucket_id='organization-branding' THEN EXISTS(SELECT 1 FROM public.organizations o WHERE o.id::text=split_part(name,'/',2) AND public.has_resource_subscription(o.id))
  ELSE public.has_active_subscription() END);
NOTIFY pgrst, 'reload schema';
COMMIT;
