-- =====================================================
-- Contract Markdown Integrity Backfill Readiness
-- Migration: 20260216103000_contract_markdown_integrity_backfill.sql
-- =====================================================
-- Purpose:
-- 1) Provide operational visibility into markdown security backlog
-- 2) Speed up scans for legacy plaintext and missing hash rows
-- NOTE: This migration intentionally does NOT decrypt/re-encrypt data in SQL.
--       Backfill must run via secure server-side job using edge-function crypto.

CREATE OR REPLACE VIEW contract_markdown_integrity_backlog_v AS
SELECT
  cm.id,
  cm.entity_type,
  cm.contract_id,
  cm.amendment_id,
  cm.project_id,
  cm.version_no,
  cm.encryption_version,
  cm.encryption_key_id,
  cm.created_at,
  CASE
    WHEN cm.content_md IS NOT NULL THEN 'legacy_plaintext'
    WHEN cm.content_md_ciphertext IS NOT NULL AND cm.content_sha256 IS NULL THEN 'missing_hash'
    ELSE 'ok'
  END AS issue
FROM contract_markdown_versions cm
WHERE cm.content_md IS NOT NULL
   OR (cm.content_md_ciphertext IS NOT NULL AND cm.content_sha256 IS NULL);

CREATE INDEX IF NOT EXISTS idx_contract_md_versions_plaintext_backlog
  ON contract_markdown_versions (created_at DESC)
  WHERE content_md IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contract_md_versions_missing_hash_backlog
  ON contract_markdown_versions (created_at DESC)
  WHERE content_md_ciphertext IS NOT NULL AND content_sha256 IS NULL;
