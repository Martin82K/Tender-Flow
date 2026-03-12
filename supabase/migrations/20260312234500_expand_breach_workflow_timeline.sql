-- Breach workflow metadata for 72h timeline and notification evidence.

ALTER TABLE public.breach_cases
  ADD COLUMN IF NOT EXISTS assessment_summary TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS authority_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS data_subjects_notified_at TIMESTAMPTZ;

UPDATE public.breach_cases
SET
  assessment_summary = COALESCE(NULLIF(assessment_summary, ''), notes, ''),
  updated_at = timezone('utc'::text, now())
WHERE assessment_summary = '';

INSERT INTO public.breach_case_events (
  breach_case_id,
  event_type,
  summary,
  actor
)
SELECT
  id,
  'timeline_bootstrap',
  'Případ připraven pro 72h workflow a evidenci notifikací.',
  'system'
FROM public.breach_cases
WHERE NOT EXISTS (
  SELECT 1
  FROM public.breach_case_events e
  WHERE e.breach_case_id = public.breach_cases.id
);
