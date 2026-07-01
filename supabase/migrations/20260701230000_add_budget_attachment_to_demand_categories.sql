ALTER TABLE public.demand_categories
ADD COLUMN IF NOT EXISTS budget_attachment JSONB;

COMMENT ON COLUMN public.demand_categories.budget_attachment IS
  'Metadata propojení na rozpočtovou přílohu ve složce VŘ v DocHubu; neobsahuje binární obsah souboru.';
