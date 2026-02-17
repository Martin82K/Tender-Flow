-- =====================================================
-- Contract Markdown Security Hardening
-- Migration: 20260215183000_contract_markdown_security_hardening.sql
-- =====================================================

ALTER TABLE contract_markdown_versions
  ALTER COLUMN content_md DROP NOT NULL;

ALTER TABLE contract_markdown_versions
  ADD COLUMN IF NOT EXISTS content_md_ciphertext TEXT,
  ADD COLUMN IF NOT EXISTS encryption_version SMALLINT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS encryption_key_id TEXT DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS content_sha256 TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'contract_markdown_versions_content_presence'
  ) THEN
    ALTER TABLE contract_markdown_versions
      ADD CONSTRAINT contract_markdown_versions_content_presence
      CHECK (content_md IS NOT NULL OR content_md_ciphertext IS NOT NULL);
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS contract_markdown_access_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  markdown_version_id UUID REFERENCES contract_markdown_versions(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('contract', 'amendment')),
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  amendment_id UUID REFERENCES contract_amendments(id) ON DELETE SET NULL,
  project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  vendor_id VARCHAR(36) REFERENCES subcontractors(id) ON DELETE SET NULL,
  access_kind TEXT NOT NULL CHECK (access_kind IN ('view', 'download', 'export')),
  access_source TEXT NOT NULL DEFAULT 'panel',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT contract_markdown_access_audit_single_link CHECK (
    (entity_type = 'contract' AND contract_id IS NOT NULL AND amendment_id IS NULL) OR
    (entity_type = 'amendment' AND amendment_id IS NOT NULL AND contract_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_contract_md_audit_project_created
  ON contract_markdown_access_audit (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contract_md_audit_vendor_created
  ON contract_markdown_access_audit (vendor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contract_md_audit_created_by_created
  ON contract_markdown_access_audit (created_by, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contract_md_audit_version_created
  ON contract_markdown_access_audit (markdown_version_id, created_at DESC);

CREATE OR REPLACE FUNCTION insert_contract_markdown_version_secure(
    p_entity_type TEXT,
    p_contract_id UUID,
    p_amendment_id UUID,
    p_source_kind TEXT,
    p_content_md_ciphertext TEXT,
    p_encryption_version SMALLINT DEFAULT 1,
    p_encryption_key_id TEXT DEFAULT 'v1',
    p_content_sha256 TEXT DEFAULT NULL,
    p_source_file_name TEXT DEFAULT NULL,
    p_source_document_url TEXT DEFAULT NULL,
    p_ocr_provider TEXT DEFAULT NULL,
    p_ocr_model TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::JSONB,
    p_created_by UUID DEFAULT NULL
)
RETURNS contract_markdown_versions
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_project_id VARCHAR(36);
    v_vendor_id VARCHAR(36);
    v_next_version INTEGER;
    v_row contract_markdown_versions;
BEGIN
    IF p_entity_type NOT IN ('contract', 'amendment') THEN
        RAISE EXCEPTION 'Unsupported entity_type: %', p_entity_type;
    END IF;

    IF p_source_kind NOT IN ('ocr', 'manual_edit', 'manual_upload', 'import') THEN
        RAISE EXCEPTION 'Unsupported source_kind: %', p_source_kind;
    END IF;

    IF p_content_md_ciphertext IS NULL OR length(trim(p_content_md_ciphertext)) = 0 THEN
        RAISE EXCEPTION 'Encrypted content is required';
    END IF;

    IF p_entity_type = 'contract' THEN
        IF p_contract_id IS NULL OR p_amendment_id IS NOT NULL THEN
            RAISE EXCEPTION 'Contract markdown requires contract_id and no amendment_id';
        END IF;

        SELECT c.project_id, c.vendor_id
          INTO v_project_id, v_vendor_id
          FROM contracts c
         WHERE c.id = p_contract_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Contract not found: %', p_contract_id;
        END IF;
    ELSE
        IF p_amendment_id IS NULL OR p_contract_id IS NOT NULL THEN
            RAISE EXCEPTION 'Amendment markdown requires amendment_id and no contract_id';
        END IF;

        SELECT c.project_id, c.vendor_id
          INTO v_project_id, v_vendor_id
          FROM contract_amendments a
          JOIN contracts c ON c.id = a.contract_id
         WHERE a.id = p_amendment_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Amendment not found: %', p_amendment_id;
        END IF;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext(COALESCE(p_contract_id::TEXT, p_amendment_id::TEXT)));

    IF p_entity_type = 'contract' THEN
      SELECT COALESCE(MAX(cm.version_no), 0) + 1
        INTO v_next_version
        FROM contract_markdown_versions cm
       WHERE cm.contract_id = p_contract_id;
    ELSE
      SELECT COALESCE(MAX(cm.version_no), 0) + 1
        INTO v_next_version
        FROM contract_markdown_versions cm
       WHERE cm.amendment_id = p_amendment_id;
    END IF;

    INSERT INTO contract_markdown_versions (
        entity_type,
        contract_id,
        amendment_id,
        project_id,
        vendor_id,
        version_no,
        source_kind,
        source_file_name,
        source_document_url,
        ocr_provider,
        ocr_model,
        content_md,
        content_md_ciphertext,
        encryption_version,
        encryption_key_id,
        content_sha256,
        metadata,
        created_by
    )
    VALUES (
        p_entity_type,
        p_contract_id,
        p_amendment_id,
        v_project_id,
        v_vendor_id,
        v_next_version,
        p_source_kind,
        p_source_file_name,
        p_source_document_url,
        p_ocr_provider,
        p_ocr_model,
        NULL,
        p_content_md_ciphertext,
        COALESCE(p_encryption_version, 1),
        COALESCE(NULLIF(trim(p_encryption_key_id), ''), 'v1'),
        p_content_sha256,
        COALESCE(p_metadata, '{}'::JSONB),
        COALESCE(p_created_by, auth.uid())
    )
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION insert_contract_markdown_access_audit(
  p_markdown_version_id UUID,
  p_access_kind TEXT,
  p_access_source TEXT DEFAULT 'panel',
  p_created_by UUID DEFAULT NULL
)
RETURNS contract_markdown_access_audit
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_version contract_markdown_versions;
  v_row contract_markdown_access_audit;
BEGIN
  IF p_access_kind NOT IN ('view', 'download', 'export') THEN
    RAISE EXCEPTION 'Unsupported access kind: %', p_access_kind;
  END IF;

  SELECT *
    INTO v_version
    FROM contract_markdown_versions
   WHERE id = p_markdown_version_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Markdown version not found: %', p_markdown_version_id;
  END IF;

  INSERT INTO contract_markdown_access_audit (
    markdown_version_id,
    entity_type,
    contract_id,
    amendment_id,
    project_id,
    vendor_id,
    access_kind,
    access_source,
    created_by
  )
  VALUES (
    v_version.id,
    v_version.entity_type,
    v_version.contract_id,
    v_version.amendment_id,
    v_version.project_id,
    v_version.vendor_id,
    p_access_kind,
    COALESCE(NULLIF(trim(p_access_source), ''), 'panel'),
    COALESCE(p_created_by, auth.uid())
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION insert_contract_markdown_version(
    p_entity_type TEXT,
    p_contract_id UUID,
    p_amendment_id UUID,
    p_source_kind TEXT,
    p_content_md TEXT,
    p_source_file_name TEXT DEFAULT NULL,
    p_source_document_url TEXT DEFAULT NULL,
    p_ocr_provider TEXT DEFAULT NULL,
    p_ocr_model TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS contract_markdown_versions
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Plaintext markdown writes are disabled. Use insert_contract_markdown_version_secure.';
END;
$$;

REVOKE EXECUTE ON FUNCTION insert_contract_markdown_version(
  TEXT, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB
) FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION insert_contract_markdown_version_secure(
  TEXT, UUID, UUID, TEXT, TEXT, SMALLINT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, UUID
) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION insert_contract_markdown_version_secure(
  TEXT, UUID, UUID, TEXT, TEXT, SMALLINT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, UUID
) TO service_role;

REVOKE EXECUTE ON FUNCTION insert_contract_markdown_access_audit(
  UUID, TEXT, TEXT, UUID
) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION insert_contract_markdown_access_audit(
  UUID, TEXT, TEXT, UUID
) TO service_role;

DROP POLICY IF EXISTS "contract_md_versions_select" ON contract_markdown_versions;
DROP POLICY IF EXISTS "contract_md_versions_insert" ON contract_markdown_versions;
DROP POLICY IF EXISTS "contract_md_versions_update_none" ON contract_markdown_versions;
DROP POLICY IF EXISTS "contract_md_versions_delete_none" ON contract_markdown_versions;

CREATE POLICY "contract_md_versions_deny_select"
  ON contract_markdown_versions
  FOR SELECT
  TO authenticated
  USING (FALSE);

CREATE POLICY "contract_md_versions_deny_insert"
  ON contract_markdown_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (FALSE);

CREATE POLICY "contract_md_versions_deny_update"
  ON contract_markdown_versions
  FOR UPDATE
  TO authenticated
  USING (FALSE)
  WITH CHECK (FALSE);

CREATE POLICY "contract_md_versions_deny_delete"
  ON contract_markdown_versions
  FOR DELETE
  TO authenticated
  USING (FALSE);

ALTER TABLE contract_markdown_access_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contract_md_access_audit_deny_select"
  ON contract_markdown_access_audit
  FOR SELECT
  TO authenticated
  USING (FALSE);

CREATE POLICY "contract_md_access_audit_deny_insert"
  ON contract_markdown_access_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (FALSE);

CREATE POLICY "contract_md_access_audit_deny_update"
  ON contract_markdown_access_audit
  FOR UPDATE
  TO authenticated
  USING (FALSE)
  WITH CHECK (FALSE);

CREATE POLICY "contract_md_access_audit_deny_delete"
  ON contract_markdown_access_audit
  FOR DELETE
  TO authenticated
  USING (FALSE);
