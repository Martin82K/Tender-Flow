# Contract Markdown Security Runbook

## Purpose
Operational playbook for markdown security hardening in `contract-markdown-secure`:
- integrity mismatch handling (`MD_INTEGRITY_MISMATCH`)
- legacy plaintext migration failures (`MD_LEGACY_MIGRATION_FAILED`)
- backlog management for legacy plaintext / missing hashes

## Backlog Report Queries

```sql
-- Detailed backlog rows
SELECT *
FROM contract_markdown_integrity_backlog_v
ORDER BY created_at DESC;
```

```sql
-- Backlog counts by issue
SELECT issue, COUNT(*) AS rows
FROM contract_markdown_integrity_backlog_v
GROUP BY issue
ORDER BY issue;
```

## Incident Signals
Set up alerts based on edge-function logs:
- `MD_INTEGRITY_MISMATCH > 0` (critical)
- `MD_LEGACY_MIGRATION_FAILED > 0` (high)

Expected log payload includes:
- `event`
- `requestId`
- `rowId`
- `entityType`
- `projectId`

No plaintext markdown and no ciphertext should be logged.

## Response Behavior
- On integrity mismatch: HTTP `409`, code `MD_INTEGRITY_MISMATCH`
- On legacy migration failure: HTTP `409`, code `MD_LEGACY_MIGRATION_FAILED`
- Error payload format:
  - `error`
  - `code`
  - `requestId`

## Deployment Checklist
1. Apply DB migrations.
2. Ensure encryption env vars are present:
   - `CONTRACT_MD_ENC_ACTIVE_KEY_ID`
   - `CONTRACT_MD_ENC_ACTIVE_VERSION`
   - corresponding `CONTRACT_MD_ENC_KEY_*`
3. Run backlog report and reduce legacy plaintext backlog before production traffic cutover.
4. Verify alerts are wired to incident channel.
