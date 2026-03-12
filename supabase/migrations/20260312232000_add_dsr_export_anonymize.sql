-- Admin-only DSR export and anonymization helpers.

CREATE OR REPLACE FUNCTION public.get_data_subject_export_admin(subject_query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query TEXT;
  v_result JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  v_query := NULLIF(btrim(subject_query), '');
  IF v_query IS NULL THEN
    RAISE EXCEPTION 'subject_query is required';
  END IF;

  SELECT jsonb_build_object(
    'query', v_query,
    'generated_at', timezone('utc'::text, now()),
    'user_profiles', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'user_id', up.user_id,
          'display_name', up.display_name,
          'email', au.email,
          'updated_at', up.updated_at
        )
      )
      FROM public.user_profiles up
      JOIN auth.users au ON au.id = up.user_id
      WHERE
        COALESCE(up.display_name, '') ILIKE '%' || v_query || '%'
        OR COALESCE(au.email, '') ILIKE '%' || v_query || '%'
    ), '[]'::jsonb),
    'subcontractors', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'company_name', s.company_name,
          'contact_person_name', s.contact_person_name,
          'email', s.email,
          'phone', s.phone,
          'ico', s.ico,
          'region', s.region,
          'contacts', s.contacts,
          'updated_at', s.updated_at
        )
      )
      FROM public.subcontractors s
      WHERE
        COALESCE(s.company_name, '') ILIKE '%' || v_query || '%'
        OR COALESCE(s.contact_person_name, '') ILIKE '%' || v_query || '%'
        OR COALESCE(s.email, '') ILIKE '%' || v_query || '%'
        OR COALESCE(s.phone, '') ILIKE '%' || v_query || '%'
        OR COALESCE(s.contacts::text, '') ILIKE '%' || v_query || '%'
    ), '[]'::jsonb),
    'projects', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'name', p.name,
          'investor', p.investor,
          'technical_supervisor', p.technical_supervisor,
          'site_manager', p.site_manager,
          'construction_manager', p.construction_manager,
          'construction_technician', p.construction_technician,
          'location', p.location,
          'updated_at', p.updated_at
        )
      )
      FROM public.projects p
      WHERE
        COALESCE(p.name, '') ILIKE '%' || v_query || '%'
        OR COALESCE(p.investor, '') ILIKE '%' || v_query || '%'
        OR COALESCE(p.technical_supervisor, '') ILIKE '%' || v_query || '%'
        OR COALESCE(p.site_manager, '') ILIKE '%' || v_query || '%'
        OR COALESCE(p.construction_manager, '') ILIKE '%' || v_query || '%'
        OR COALESCE(p.construction_technician, '') ILIKE '%' || v_query || '%'
    ), '[]'::jsonb)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.anonymize_data_subject_admin(subject_query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query TEXT;
  v_profiles BIGINT := 0;
  v_subcontractors BIGINT := 0;
  v_projects BIGINT := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Admin only';
  END IF;

  v_query := NULLIF(btrim(subject_query), '');
  IF v_query IS NULL THEN
    RAISE EXCEPTION 'subject_query is required';
  END IF;

  UPDATE public.user_profiles up
  SET
    display_name = '[redacted-subject]',
    updated_at = timezone('utc'::text, now())
  FROM auth.users au
  WHERE
    au.id = up.user_id
    AND (
      COALESCE(up.display_name, '') ILIKE '%' || v_query || '%'
      OR COALESCE(au.email, '') ILIKE '%' || v_query || '%'
    );
  GET DIAGNOSTICS v_profiles = ROW_COUNT;

  UPDATE public.subcontractors s
  SET
    contact_person_name = CASE
      WHEN COALESCE(s.contact_person_name, '') ILIKE '%' || v_query || '%'
        THEN '[redacted-subject]'
      ELSE s.contact_person_name
    END,
    email = CASE
      WHEN COALESCE(s.email, '') ILIKE '%' || v_query || '%'
        THEN 'redacted-subject@invalid.local'
      ELSE s.email
    END,
    phone = CASE
      WHEN COALESCE(s.phone, '') ILIKE '%' || v_query || '%'
        THEN '[redacted-phone]'
      ELSE s.phone
    END,
    contacts = CASE
      WHEN COALESCE(s.contacts::text, '') ILIKE '%' || v_query || '%'
        THEN (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', COALESCE(contact_item->>'id', 'redacted'),
              'name', CASE
                WHEN COALESCE(contact_item->>'name', '') ILIKE '%' || v_query || '%'
                  THEN '[redacted-subject]'
                ELSE COALESCE(contact_item->>'name', '')
              END,
              'phone', CASE
                WHEN COALESCE(contact_item->>'phone', '') ILIKE '%' || v_query || '%'
                  THEN '[redacted-phone]'
                ELSE COALESCE(contact_item->>'phone', '')
              END,
              'email', CASE
                WHEN COALESCE(contact_item->>'email', '') ILIKE '%' || v_query || '%'
                  THEN 'redacted-subject@invalid.local'
                ELSE COALESCE(contact_item->>'email', '')
              END,
              'position', contact_item->>'position'
            )
          )
          FROM jsonb_array_elements(COALESCE(s.contacts, '[]'::jsonb)) AS contact_item
        )
      ELSE s.contacts
    END,
    updated_at = timezone('utc'::text, now())
  WHERE
    COALESCE(s.contact_person_name, '') ILIKE '%' || v_query || '%'
    OR COALESCE(s.email, '') ILIKE '%' || v_query || '%'
    OR COALESCE(s.phone, '') ILIKE '%' || v_query || '%'
    OR COALESCE(s.contacts::text, '') ILIKE '%' || v_query || '%';
  GET DIAGNOSTICS v_subcontractors = ROW_COUNT;

  UPDATE public.projects p
  SET
    investor = CASE
      WHEN COALESCE(p.investor, '') ILIKE '%' || v_query || '%' THEN '[redacted-subject]'
      ELSE p.investor
    END,
    technical_supervisor = CASE
      WHEN COALESCE(p.technical_supervisor, '') ILIKE '%' || v_query || '%' THEN '[redacted-subject]'
      ELSE p.technical_supervisor
    END,
    site_manager = CASE
      WHEN COALESCE(p.site_manager, '') ILIKE '%' || v_query || '%' THEN '[redacted-subject]'
      ELSE p.site_manager
    END,
    construction_manager = CASE
      WHEN COALESCE(p.construction_manager, '') ILIKE '%' || v_query || '%' THEN '[redacted-subject]'
      ELSE p.construction_manager
    END,
    construction_technician = CASE
      WHEN COALESCE(p.construction_technician, '') ILIKE '%' || v_query || '%' THEN '[redacted-subject]'
      ELSE p.construction_technician
    END,
    updated_at = timezone('utc'::text, now())
  WHERE
    COALESCE(p.investor, '') ILIKE '%' || v_query || '%'
    OR COALESCE(p.technical_supervisor, '') ILIKE '%' || v_query || '%'
    OR COALESCE(p.site_manager, '') ILIKE '%' || v_query || '%'
    OR COALESCE(p.construction_manager, '') ILIKE '%' || v_query || '%'
    OR COALESCE(p.construction_technician, '') ILIKE '%' || v_query || '%';
  GET DIAGNOSTICS v_projects = ROW_COUNT;

  RETURN jsonb_build_object(
    'query', v_query,
    'anonymized_user_profiles', v_profiles,
    'anonymized_subcontractors', v_subcontractors,
    'anonymized_projects', v_projects,
    'completed_at', timezone('utc'::text, now())
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_data_subject_export_admin(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_data_subject_export_admin(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.anonymize_data_subject_admin(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.anonymize_data_subject_admin(TEXT) TO service_role;
