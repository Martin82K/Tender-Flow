-- Cache posledniho dotazu na ARES, aby se neopakoval pri kazdem mountu.
-- ares_checked_at: kdy byl ARES naposledy dotazovan (uspech i 404).
-- ares_not_found:  true pokud ARES vratil 404 (IC neexistuje).
ALTER TABLE public.subcontractors
ADD COLUMN IF NOT EXISTS ares_checked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ares_not_found BOOLEAN NOT NULL DEFAULT FALSE;
