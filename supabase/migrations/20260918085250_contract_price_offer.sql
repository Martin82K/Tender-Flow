-- Store only a project-relative reference to an existing Složkomat file.
-- Existing contracts RLS and grants remain unchanged. No file is uploaded.
ALTER TABLE public.contracts ADD COLUMN price_offer_path text;
ALTER TABLE public.contracts ADD CONSTRAINT contracts_price_offer_path_valid CHECK (
  price_offer_path IS NULL OR (
    length(price_offer_path) BETWEEN 1 AND 2000
    AND price_offer_path !~ '[\\:\x00-\x1f\x7f]'
    AND price_offer_path !~ '(^/|/$|//|(^|/)\.{1,2}(/|$))'
    AND price_offer_path ~* '\.(pdf|docx|xlsx)$'
  )
);
COMMENT ON COLUMN public.contracts.price_offer_path IS
  'Path relative to the project Složkomat root, selected in desktop. No uploaded copy or user-specific absolute path.';
