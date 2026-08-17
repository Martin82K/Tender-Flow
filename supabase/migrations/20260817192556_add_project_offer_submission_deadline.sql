ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS offer_submission_deadline DATE;

COMMENT ON COLUMN public.projects.offer_submission_deadline IS
  'Termín odevzdání nabídky pro stavbu ve fázi soutěže.';
