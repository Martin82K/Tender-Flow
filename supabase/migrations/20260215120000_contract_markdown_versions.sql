-- =====================================================
-- Contract Markdown Versions
-- Migration: 20260215120000_contract_markdown_versions.sql
-- =====================================================

CREATE TABLE IF NOT EXISTS contract_markdown_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL CHECK (entity_type IN ('contract', 'amendment')),

    contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
    amendment_id UUID REFERENCES contract_amendments(id) ON DELETE CASCADE,

    project_id VARCHAR(36) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    vendor_id VARCHAR(36) REFERENCES subcontractors(id) ON DELETE SET NULL,

    version_no INTEGER NOT NULL,
    source_kind TEXT NOT NULL CHECK (source_kind IN ('ocr', 'manual_edit', 'manual_upload', 'import')),

    source_file_name TEXT,
    source_document_url TEXT,
    ocr_provider TEXT,
    ocr_model TEXT,

    content_md TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,

    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT contract_markdown_versions_single_link CHECK (
      (entity_type = 'contract' AND contract_id IS NOT NULL AND amendment_id IS NULL) OR
      (entity_type = 'amendment' AND amendment_id IS NOT NULL AND contract_id IS NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_md_versions_contract_unique
    ON contract_markdown_versions (contract_id, version_no)
    WHERE contract_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_md_versions_amendment_unique
    ON contract_markdown_versions (amendment_id, version_no)
    WHERE amendment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contract_md_versions_project_created
    ON contract_markdown_versions (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contract_md_versions_vendor_created
    ON contract_markdown_versions (vendor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contract_md_versions_contract_created
    ON contract_markdown_versions (contract_id, created_at DESC)
    WHERE contract_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contract_md_versions_amendment_created
    ON contract_markdown_versions (amendment_id, created_at DESC)
    WHERE amendment_id IS NOT NULL;

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

        SELECT COALESCE(MAX(cm.version_no), 0) + 1
          INTO v_next_version
          FROM contract_markdown_versions cm
         WHERE cm.contract_id = p_contract_id;
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
        p_content_md,
        COALESCE(p_metadata, '{}'::JSONB),
        auth.uid()
    )
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$$;

ALTER TABLE contract_markdown_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contract_md_versions_select" ON contract_markdown_versions;
CREATE POLICY "contract_md_versions_select"
  ON contract_markdown_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM projects p
      WHERE p.id = contract_markdown_versions.project_id
        AND (
          p.owner_id = auth.uid()
          OR p.owner_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM project_shares ps
            WHERE ps.project_id = p.id
              AND ps.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "contract_md_versions_insert" ON contract_markdown_versions;
CREATE POLICY "contract_md_versions_insert"
  ON contract_markdown_versions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM projects p
      WHERE p.id = contract_markdown_versions.project_id
        AND (
          p.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM project_shares ps
            WHERE ps.project_id = p.id
              AND ps.user_id = auth.uid()
              AND ps.permission = 'edit'
          )
        )
    )
  );

DROP POLICY IF EXISTS "contract_md_versions_update_none" ON contract_markdown_versions;
CREATE POLICY "contract_md_versions_update_none"
  ON contract_markdown_versions
  FOR UPDATE
  USING (FALSE)
  WITH CHECK (FALSE);

DROP POLICY IF EXISTS "contract_md_versions_delete_none" ON contract_markdown_versions;
CREATE POLICY "contract_md_versions_delete_none"
  ON contract_markdown_versions
  FOR DELETE
  USING (FALSE);
