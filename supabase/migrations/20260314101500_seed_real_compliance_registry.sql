insert into public.compliance_retention_policies (id, category, purpose, retention_days, status, notes)
values
  ('account-contracts', 'Účet a smluvní agenda', 'Správa účtu, smlouvy, fakturace a zákaznická komunikace', 3650, 'implemented', 'Retence odpovídá účetním a smluvním povinnostem a ochraně právních nároků.'),
  ('contacts-projects', 'Kontakty a projektová data', 'CRM agenda, příprava staveb a práce s tendry', 1095, 'partial', 'Výchozí retenční rámec pro aktivní obchodní a projektová data.'),
  ('support-requests', 'Support a provozní požadavky', 'Řešení ticketů, incidentů a provozních dotazů', 365, 'implemented', 'Používá se pro support komunikaci a provozní dohled.')
on conflict (id) do update
set
  category = excluded.category,
  purpose = excluded.purpose,
  retention_days = excluded.retention_days,
  status = excluded.status,
  notes = excluded.notes,
  updated_at = timezone('utc'::text, now());

insert into public.subprocessors (id, name, region, purpose, transfer_mechanism, notes)
values
  ('subprocessor-supabase', 'Supabase', 'EU', 'Databáze, autentizace, storage a backend služby', 'EHP / EU hosting', 'Primární cloudová infrastruktura pro Tender Flow.'),
  ('subprocessor-stripe', 'Stripe', 'EU / USA', 'Platby, billing a související finanční operace', 'SCC / doplňkové záruky dodavatele', 'Používá se pro billing a správu předplatného.'),
  ('subprocessor-openai', 'OpenAI', 'USA', 'Volitelné AI funkce, asistence a generativní zpracování', 'SCC / doplňkové záruky dodavatele', 'Používá se pouze pro volitelné AI workflow v aplikaci.')
on conflict (id) do update
set
  name = excluded.name,
  region = excluded.region,
  purpose = excluded.purpose,
  transfer_mechanism = excluded.transfer_mechanism,
  notes = excluded.notes,
  updated_at = timezone('utc'::text, now());

insert into public.processing_activities (
  id,
  activity_name,
  purpose,
  legal_basis,
  data_categories,
  retention_policy_id,
  notes
)
values
  ('ropa-account-management', 'Správa uživatelských účtů a organizací', 'Registrace, autentizace, autorizace a správa přístupů v aplikaci', 'plnění smlouvy', array['jméno', 'e-mail', 'role', 'organizační zařazení'], 'account-contracts', 'Základní provoz účtu a řízení přístupů.'),
  ('ropa-crm-projects', 'CRM agenda, kontakty a projektová příprava', 'Evidence kontaktů, projektů, komunikace a podkladů k tendrům', 'plnění smlouvy', array['jméno', 'e-mail', 'telefon', 'firma', 'projektové poznámky'], 'contacts-projects', 'Hlavní pracovní data zákazníků Tender Flow.'),
  ('ropa-support-security', 'Support, zabezpečení a incident management', 'Řešení podpory, prevence zneužití, audit a bezpečnostní dohled', 'oprávněný zájem', array['e-mail', 'obsah support komunikace', 'IP adresa', 'technické logy'], 'support-requests', 'Bezpečnostní a podpůrná vrstva provozu služby.'),
  ('ropa-billing', 'Billing a fakturační agenda', 'Platby, fakturace, vedení účetních a daňových podkladů', 'právní povinnost', array['jméno', 'fakturační údaje', 'platební reference', 'stav předplatného'], 'account-contracts', 'Smluvní a účetní agenda.'),
  ('ropa-ai-assistance', 'Volitelné AI asistované funkce', 'Zpracování uživatelských promptů a asistence při práci v aplikaci', 'souhlas / pokyn zákazníka', array['obsah promptu', 'metadatové identifikátory požadavku'], 'support-requests', 'Aplikuje se pouze při využití AI funkcí.')
on conflict (id) do update
set
  activity_name = excluded.activity_name,
  purpose = excluded.purpose,
  legal_basis = excluded.legal_basis,
  data_categories = excluded.data_categories,
  retention_policy_id = excluded.retention_policy_id,
  notes = excluded.notes,
  updated_at = timezone('utc'::text, now());

insert into public.processing_activity_subprocessors (processing_activity_id, subprocessor_id)
values
  ('ropa-account-management', 'subprocessor-supabase'),
  ('ropa-crm-projects', 'subprocessor-supabase'),
  ('ropa-support-security', 'subprocessor-supabase'),
  ('ropa-billing', 'subprocessor-stripe'),
  ('ropa-ai-assistance', 'subprocessor-openai')
on conflict (processing_activity_id, subprocessor_id) do nothing;
