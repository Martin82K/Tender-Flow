-- Align join-request RLS with owner-only approval/view RPC authorization.

-- Requesters can still see their own requests; only owners can see all requests for an org.
DROP POLICY IF EXISTS "org_join_requests_select" ON public.organization_join_requests;
CREATE POLICY "org_join_requests_select"
ON public.organization_join_requests FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_org_owner(organization_id)
);

-- Only org owners can update request status/decision fields directly.
DROP POLICY IF EXISTS "org_join_requests_update" ON public.organization_join_requests;
CREATE POLICY "org_join_requests_update"
ON public.organization_join_requests FOR UPDATE
TO authenticated
USING (
  public.is_org_owner(organization_id)
);

-- Requesters can still delete their own pending requests; only owners can delete any request in org.
DROP POLICY IF EXISTS "org_join_requests_delete" ON public.organization_join_requests;
CREATE POLICY "org_join_requests_delete"
ON public.organization_join_requests FOR DELETE
TO authenticated
USING (
  (user_id = auth.uid() AND status = 'pending')
  OR public.is_org_owner(organization_id)
);
