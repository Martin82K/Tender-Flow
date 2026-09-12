import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve('supabase/migrations/20260912190251_widen_bid_and_tag_ids.sql'), 'utf8');

describe('bid ID width migration safety', () => {
  it('widens both the canonical ID and the tag FK without rewriting identifiers', () => {
    expect(migration).toContain('ALTER TABLE public.bids ALTER COLUMN id TYPE text;');
    expect(migration).toContain('ALTER TABLE public.bid_tags ALTER COLUMN bid_id TYPE text;');
    expect(migration).not.toMatch(/\b(?:UPDATE|DELETE FROM|TRUNCATE|DROP TABLE|DROP CONSTRAINT|GRANT|REVOKE)\s+public\./i);
    expect(migration).not.toContain('ALTER TABLE public.contracts');
  });

  it('preserves policy semantics and applies dependency changes atomically', () => {
    expect(migration).toContain('LOCK TABLE public.bids, public.bid_tags IN ACCESS EXCLUSIVE MODE;');
    expect(migration).toContain("'PERMISSIVE' ELSE 'RESTRICTIVE'");
    expect(migration).toContain('dependent_policy.role_list');
    expect(migration).toContain('dependent_policy.using_expression');
    expect(migration).toContain('dependent_policy.check_expression');
    expect(migration).toContain('dependent_policy.policy_comment');
    expect(migration).toContain('Unexpected bid ID policy dependency');
    expect(migration).not.toMatch(/DISABLE\s+(ROW LEVEL SECURITY|TRIGGER)|EXCEPTION\s+WHEN/i);
    expect(migration).toContain("SET lock_timeout = '5s'");
    expect(migration).toContain("SET statement_timeout = '60s'");
  });
});
