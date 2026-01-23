CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);

-- RLS policies: only service_role (Edge Functions) should access this table directly
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can do anything with password_reset_tokens"
  ON password_reset_tokens
  TO service_role
  USING (true)
  WITH CHECK (true);
