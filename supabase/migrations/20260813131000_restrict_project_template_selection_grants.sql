-- Default table privileges in the production project may grant authenticated
-- roles more than the four row-level operations intended by the original
-- project_template_selections migration. In particular, TRUNCATE bypasses RLS.
REVOKE ALL ON public.project_template_selections FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.project_template_selections
  TO authenticated;

