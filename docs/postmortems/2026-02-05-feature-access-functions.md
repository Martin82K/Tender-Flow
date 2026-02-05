# Postmortem: Feature Access Functions Ambiguity

**Date:** 2026-02-05

## Summary
An ambiguity bug in `public.user_has_feature()` and `public.user_id_has_feature()` caused RLS policies to fail on feature-gated tables (including `templates`). This blocked template reads and resulted in runtime errors when users generated inquiry emails.

## Impact
- Users saw "Chyba šablony / Nepodařilo se načíst šablonu emailu" when generating inquiries.
- Any RLS policy relying on `public.user_has_feature()` failed at evaluation time.
- Affected tables included:
  - `contracts`, `contract_amendments`, `contract_drawdowns`
  - `dochub_autocreate_runs`
  - `short_urls`
  - `templates`
  - `excel_indexer_entries`

## Root Cause
In PL/pgSQL, the parameter `feature_key` in `user_has_feature(feature_key TEXT)` was ambiguous in this query:

```sql
... WHERE stf.feature_key = feature_key
```

PostgreSQL could not resolve whether `feature_key` referred to a column or function parameter. The function threw an error, which propagated into RLS policies.

## Resolution
Fixed both feature helpers to use positional parameters (`$1`, `$2`) in their queries to avoid ambiguity.

Migration added:
- `supabase/migrations/20260205090000_fix_feature_access_functions.sql`

## Detection
Reported by user `toupalikova@baustav.cz` (tenant Baustav) when inquiry template generation failed.

## Prevention / Follow-ups
1. Add a lightweight DB health check in ops runbook: run `select public.user_has_feature('dynamic_templates');` under a known auth context.
2. Ensure future function updates use positional parameters in PL/pgSQL to avoid name shadowing.
