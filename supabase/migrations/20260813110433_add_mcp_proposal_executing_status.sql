-- Atomický mezistav brání tomu, aby dvě souběžná execute volání provedla
-- business mutaci pro stejný potvrzený proposal vícekrát.
ALTER TABLE public.mcp_change_proposals
  DROP CONSTRAINT IF EXISTS mcp_change_proposals_status_check;

ALTER TABLE public.mcp_change_proposals
  ADD CONSTRAINT mcp_change_proposals_status_check
  CHECK (status IN (
    'prepared',
    'confirmed',
    'executing',
    'executed',
    'expired',
    'cancelled'
  ));

COMMENT ON COLUMN public.mcp_change_proposals.status IS
  'Proposal lifecycle. executing is an atomic fail-closed claim acquired before the business mutation.';
