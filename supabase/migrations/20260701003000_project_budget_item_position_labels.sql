-- Preserve original imported item numbering from Excel budget rows.

ALTER TABLE public.project_budget_items
ADD COLUMN IF NOT EXISTS position_label VARCHAR(40);
