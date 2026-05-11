-- =====================================================
-- Remote MCP MVP support tables
-- - audit log for MCP tool calls
-- - 3-phase write proposal flow
-- - idempotency keys for execute calls
-- =====================================================

CREATE TABLE IF NOT EXISTS public.mcp_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  client_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
  success BOOLEAN NOT NULL,
  error_message TEXT,
  request_summary JSONB,
  result_summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_audit_user_created
  ON public.mcp_audit_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_audit_client_created
  ON public.mcp_audit_events(client_id, created_at DESC);

ALTER TABLE public.mcp_audit_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mcp_audit_insert_own" ON public.mcp_audit_events;
CREATE POLICY "mcp_audit_insert_own" ON public.mcp_audit_events
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "mcp_audit_select_own" ON public.mcp_audit_events;
CREATE POLICY "mcp_audit_select_own" ON public.mcp_audit_events
  FOR SELECT USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.mcp_change_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  change_type TEXT NOT NULL,
  change_payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'prepared'
    CHECK (status IN ('prepared', 'confirmed', 'executed', 'expired', 'cancelled')),
  risk_level TEXT NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high')),
  summary TEXT NOT NULL,
  confirmation_text TEXT,
  execute_token_hash TEXT,
  execution_result JSONB,
  expires_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mcp_change_proposals_user_status
  ON public.mcp_change_proposals(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mcp_change_proposals_expires
  ON public.mcp_change_proposals(expires_at);

ALTER TABLE public.mcp_change_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mcp_change_proposals_insert_own" ON public.mcp_change_proposals;
CREATE POLICY "mcp_change_proposals_insert_own" ON public.mcp_change_proposals
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "mcp_change_proposals_select_own" ON public.mcp_change_proposals;
CREATE POLICY "mcp_change_proposals_select_own" ON public.mcp_change_proposals
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "mcp_change_proposals_update_own" ON public.mcp_change_proposals;
CREATE POLICY "mcp_change_proposals_update_own" ON public.mcp_change_proposals
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.mcp_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_mcp_change_proposals_updated_at ON public.mcp_change_proposals;
CREATE TRIGGER tr_mcp_change_proposals_updated_at
  BEFORE UPDATE ON public.mcp_change_proposals
  FOR EACH ROW EXECUTE FUNCTION public.mcp_set_updated_at();

CREATE TABLE IF NOT EXISTS public.mcp_idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  proposal_id UUID REFERENCES public.mcp_change_proposals(id) ON DELETE SET NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, client_id, idempotency_key)
);

ALTER TABLE public.mcp_idempotency_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mcp_idempotency_insert_own" ON public.mcp_idempotency_keys;
CREATE POLICY "mcp_idempotency_insert_own" ON public.mcp_idempotency_keys
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "mcp_idempotency_select_own" ON public.mcp_idempotency_keys;
CREATE POLICY "mcp_idempotency_select_own" ON public.mcp_idempotency_keys
  FOR SELECT USING (user_id = auth.uid());
