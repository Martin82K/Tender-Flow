-- Permissive policies compose with OR. This legacy policy made the scoped
-- category/project policy ineffective for every authenticated user.
DROP POLICY IF EXISTS "Enable all access for authenticated users"
  ON public.bids;
