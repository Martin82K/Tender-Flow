-- Make the private proof store's deny-by-default RLS posture explicit. The
-- registration and validation helpers run as their tightly controlled owner;
-- every invoker role remains unable to read or mutate rows directly.

CREATE POLICY mcp_backend_proof_deny_all
ON mcp_private.mcp_backend_proof
AS RESTRICTIVE
FOR ALL
TO PUBLIC
USING (false)
WITH CHECK (false);

COMMENT ON POLICY mcp_backend_proof_deny_all
ON mcp_private.mcp_backend_proof IS
  'Explicitly denies direct row access; only approved security-definer helpers may access the backend proof.';
