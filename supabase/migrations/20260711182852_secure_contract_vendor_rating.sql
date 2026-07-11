-- Secure contract vendor-rating updates behind existing contracts RLS.
-- The caller supplies only rating content; audit metadata comes from the DB session.

CREATE OR REPLACE FUNCTION public.update_contract_vendor_rating(
  contract_id_input UUID,
  rating_input NUMERIC,
  note_input TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  affected_rows INTEGER;
  normalized_note TEXT := NULLIF(BTRIM(note_input), '');
  has_rating_content BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to update vendor rating'
      USING ERRCODE = '42501';
  END IF;

  IF rating_input IS NOT NULL AND (rating_input < 0 OR rating_input > 5) THEN
    RAISE EXCEPTION 'Vendor rating must be between 0 and 5'
      USING ERRCODE = '22023';
  END IF;

  has_rating_content := rating_input IS NOT NULL OR normalized_note IS NOT NULL;

  UPDATE public.contracts
  SET
    vendor_rating = rating_input,
    vendor_rating_note = normalized_note,
    vendor_rating_at = CASE
      WHEN has_rating_content THEN NOW()
      ELSE NULL
    END,
    vendor_rating_by = CASE
      WHEN has_rating_content THEN auth.uid()
      ELSE NULL
    END
  WHERE id = contract_id_input;

  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 1 THEN
    RAISE EXCEPTION 'Contract was not found or cannot be updated'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_contract_vendor_rating(UUID, NUMERIC, TEXT)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_contract_vendor_rating(UUID, NUMERIC, TEXT)
  FROM anon;
GRANT EXECUTE ON FUNCTION public.update_contract_vendor_rating(UUID, NUMERIC, TEXT)
  TO authenticated;
