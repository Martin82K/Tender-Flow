-- Identity card of the project client (objednatel). One row per project.
-- Financial contract rows stay in their existing table and are not written here.

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.is_valid_czech_ico(raw text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  digits text;
  total integer := 0;
  weights integer[] := ARRAY[8, 7, 6, 5, 4, 3, 2];
  digit_index integer;
  remainder integer;
  check_digit integer;
BEGIN
  IF raw IS NULL THEN
    RETURN false;
  END IF;
  digits := regexp_replace(raw, '\s', '', 'g');
  IF digits !~ '^[0-9]{8}$' THEN
    RETURN false;
  END IF;
  FOR digit_index IN 1..7 LOOP
    total := total + substring(digits, digit_index, 1)::integer * weights[digit_index];
  END LOOP;
  remainder := total % 11;
  check_digit := CASE
    WHEN remainder = 0 THEN 1
    WHEN remainder = 1 THEN 0
    ELSE 11 - remainder
  END;
  RETURN substring(digits, 8, 1)::integer = check_digit;
END;
$$;

REVOKE ALL ON FUNCTION private.is_valid_czech_ico(text) FROM PUBLIC, anon, authenticated, tenderflow_mcp_client;
GRANT EXECUTE ON FUNCTION private.is_valid_czech_ico(text) TO authenticated;

CREATE TABLE public.project_client_cards (
  project_id varchar(36) PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  ico text,
  street text,
  zip text,
  city text,
  contact_name text,
  contact_email text,
  contact_phone text,
  internal_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT project_client_cards_company_name_len CHECK (char_length(btrim(company_name)) BETWEEN 1 AND 200),
  CONSTRAINT project_client_cards_ico_valid CHECK (ico IS NULL OR private.is_valid_czech_ico(ico)),
  CONSTRAINT project_client_cards_street_len CHECK (street IS NULL OR char_length(street) <= 160),
  CONSTRAINT project_client_cards_city_len CHECK (city IS NULL OR char_length(city) <= 80),
  CONSTRAINT project_client_cards_zip_valid CHECK (zip IS NULL OR zip ~ '^[0-9]{3} [0-9]{2}$'),
  CONSTRAINT project_client_cards_contact_name_len CHECK (contact_name IS NULL OR char_length(contact_name) <= 120),
  CONSTRAINT project_client_cards_email_valid CHECK (
    contact_email IS NULL
    OR (char_length(contact_email) <= 254 AND contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
  ),
  CONSTRAINT project_client_cards_phone_valid CHECK (
    contact_phone IS NULL OR contact_phone ~ '^\+?[0-9][0-9 ]{7,22}$'
  ),
  CONSTRAINT project_client_cards_note_len CHECK (internal_note IS NULL OR char_length(internal_note) <= 4000)
);

CREATE INDEX project_client_cards_organization_idx ON public.project_client_cards(organization_id);

COMMENT ON TABLE public.project_client_cards IS
  'Identity of the project client. Not a financial contract record.';

CREATE OR REPLACE FUNCTION public.guard_project_client_card()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  project_org uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.project_id IS DISTINCT FROM OLD.project_id THEN
    RAISE EXCEPTION 'Project client card cannot move between projects';
  END IF;

  SELECT p.organization_id INTO project_org
  FROM public.projects p
  WHERE p.id = NEW.project_id;

  IF project_org IS NULL OR project_org IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'Client card organization must match the project';
  END IF;

  NEW.company_name := btrim(NEW.company_name);
  NEW.ico := nullif(regexp_replace(coalesce(NEW.ico, ''), '\s', '', 'g'), '');
  NEW.street := nullif(btrim(coalesce(NEW.street, '')), '');
  NEW.city := nullif(btrim(coalesce(NEW.city, '')), '');
  NEW.contact_name := nullif(btrim(coalesce(NEW.contact_name, '')), '');
  NEW.contact_email := nullif(lower(btrim(coalesce(NEW.contact_email, ''))), '');
  NEW.contact_phone := nullif(regexp_replace(btrim(coalesce(NEW.contact_phone, '')), '\s+', ' ', 'g'), '');
  NEW.internal_note := nullif(btrim(coalesce(NEW.internal_note, '')), '');
  IF NEW.zip IS NOT NULL THEN
    NEW.zip := nullif(regexp_replace(NEW.zip, '\s', '', 'g'), '');
    IF NEW.zip ~ '^[0-9]{5}$' THEN
      NEW.zip := substring(NEW.zip, 1, 3) || ' ' || substring(NEW.zip, 4, 2);
    END IF;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    NEW.updated_by := auth.uid();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_project_client_card() FROM PUBLIC, anon, authenticated, tenderflow_mcp_client;

DROP TRIGGER IF EXISTS trg_guard_project_client_card ON public.project_client_cards;
CREATE TRIGGER trg_guard_project_client_card
  BEFORE INSERT OR UPDATE ON public.project_client_cards
  FOR EACH ROW EXECUTE FUNCTION public.guard_project_client_card();

DROP TRIGGER IF EXISTS trg_archived_guard_project_client_cards ON public.project_client_cards;
CREATE TRIGGER trg_archived_guard_project_client_cards
  BEFORE INSERT OR UPDATE OR DELETE ON public.project_client_cards
  FOR EACH ROW EXECUTE FUNCTION public.guard_archived_project_write('direct', 'project_id');

ALTER TABLE public.project_client_cards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_client_cards FROM PUBLIC, anon, authenticated, tenderflow_mcp_client;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_client_cards TO authenticated, service_role;

DROP POLICY IF EXISTS "Select client card via project" ON public.project_client_cards;
CREATE POLICY "Select client card via project"
  ON public.project_client_cards
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_client_cards.project_id
        AND p.organization_id = project_client_cards.organization_id
        AND (
          p.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.project_shares ps
            WHERE ps.project_id = p.id
              AND ps.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "Manage client card via project" ON public.project_client_cards;
CREATE POLICY "Manage client card via project"
  ON public.project_client_cards
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_client_cards.project_id
        AND p.organization_id = project_client_cards.organization_id
        AND (
          p.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.project_shares ps
            WHERE ps.project_id = p.id
              AND ps.user_id = auth.uid()
              AND ps.permission = 'edit'
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_client_cards.project_id
        AND p.organization_id = project_client_cards.organization_id
        AND (
          p.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.project_shares ps
            WHERE ps.project_id = p.id
              AND ps.user_id = auth.uid()
              AND ps.permission = 'edit'
          )
        )
    )
  );

DROP POLICY IF EXISTS team_module_project_client_cards_select ON public.project_client_cards;
CREATE POLICY team_module_project_client_cards_select
  ON public.project_client_cards
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated
  USING (public.can_project_module_action(project_id::text, 'module_projects', false));

DROP POLICY IF EXISTS team_module_project_client_cards_insert ON public.project_client_cards;
CREATE POLICY team_module_project_client_cards_insert
  ON public.project_client_cards
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_project_module_action(project_id::text, 'module_projects', true));

DROP POLICY IF EXISTS team_module_project_client_cards_update ON public.project_client_cards;
CREATE POLICY team_module_project_client_cards_update
  ON public.project_client_cards
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (public.can_project_module_action(project_id::text, 'module_projects', true))
  WITH CHECK (public.can_project_module_action(project_id::text, 'module_projects', true));

DROP POLICY IF EXISTS team_module_project_client_cards_delete ON public.project_client_cards;
CREATE POLICY team_module_project_client_cards_delete
  ON public.project_client_cards
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (public.can_project_module_action(project_id::text, 'module_projects', true));

DROP POLICY IF EXISTS subscription_required ON public.project_client_cards;
CREATE POLICY subscription_required
  ON public.project_client_cards
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING ((SELECT public.has_active_subscription()))
  WITH CHECK ((SELECT public.has_active_subscription()));

DROP POLICY IF EXISTS tenant_subscription_required ON public.project_client_cards;
CREATE POLICY tenant_subscription_required
  ON public.project_client_cards
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    public.has_project_subscription(project_id::text)
    AND public.has_resource_subscription(organization_id)
  )
  WITH CHECK (
    public.has_project_subscription(project_id::text)
    AND public.has_resource_subscription(organization_id)
  );

NOTIFY pgrst, 'reload schema';
