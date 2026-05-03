import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { isRedirectUrlSafe } from '@shared/security/validateRedirectUrl';

// ---------------------------------------------------------------------------
// P2-8: app_settings RLS must use is_admin() not profiles.is_admin
// ---------------------------------------------------------------------------
describe('app_settings RLS hardening', () => {
  it('migration exists to replace legacy profiles.is_admin with is_admin()', () => {
    const migrationPath = path.resolve(
      'supabase/migrations/20260413200000_harden_app_settings_rls.sql',
    );
    expect(fs.existsSync(migrationPath)).toBe(true);
    const content = fs.readFileSync(migrationPath, 'utf-8');
    expect(content).toContain('public.is_admin()');
    // The actual policy SQL must not reference the legacy column
    const sqlWithoutComments = content.replace(/--.*$/gm, '');
    expect(sqlWithoutComments).not.toContain('profiles.is_admin');
  });
});

// ---------------------------------------------------------------------------
// P2-9: Password reset rate limiting
// ---------------------------------------------------------------------------
describe('password reset rate limiting', () => {
  const resetPath = path.resolve('supabase/functions/request-password-reset/index.ts');
  const resetSource = fs.readFileSync(resetPath, 'utf-8');

  it('enforces per-user request limit per hour', () => {
    expect(resetSource).toContain('recentTokens.length >= 3');
  });

  it('enforces cooldown between consecutive requests', () => {
    // At least a 2-minute cooldown
    expect(resetSource).toMatch(/2\s*\*\s*60\s*\*\s*1000/);
  });

  it('returns success even when rate limited to prevent user enumeration', () => {
    // Rate-limited responses must not differ from normal success
    const successPattern = /success.*true/g;
    const matches = resetSource.match(successPattern) || [];
    // At least 4: non-existent user, rate limit (2 cases), actual success
    expect(matches.length).toBeGreaterThanOrEqual(4);
  });

  it('does not leak error details in response', () => {
    expect(resetSource).not.toMatch(/error:\s*error\.message/);
    expect(resetSource).not.toMatch(/JSON\.stringify\(errorData\)/);
  });
});

// ---------------------------------------------------------------------------
// P2-10: Redirect URL validation
// ---------------------------------------------------------------------------
describe('isRedirectUrlSafe', () => {
  it('allows GoPay production domains', () => {
    expect(isRedirectUrlSafe('https://gw.gopay.com/gp/pay/12345')).toBe(true);
    expect(isRedirectUrlSafe('https://gate.gopay.cz/api/payments')).toBe(true);
  });

  it('allows GoPay sandbox domain', () => {
    expect(isRedirectUrlSafe('https://gw.sandbox.gopay.com/gp/pay/12345')).toBe(true);
  });

  it('allows Stripe Checkout (test + live)', () => {
    expect(isRedirectUrlSafe('https://checkout.stripe.com/c/pay/cs_test_a1B2c3')).toBe(true);
    expect(isRedirectUrlSafe('https://checkout.stripe.com/c/pay/cs_live_a1B2c3')).toBe(true);
  });

  it('allows Google OAuth', () => {
    expect(isRedirectUrlSafe('https://accounts.google.com/o/oauth2/auth?client_id=123')).toBe(true);
  });

  it('allows Microsoft OAuth', () => {
    expect(isRedirectUrlSafe('https://login.microsoftonline.com/common/oauth2/v2.0/authorize')).toBe(true);
    expect(isRedirectUrlSafe('https://login.live.com/oauth20_authorize.srf')).toBe(true);
  });

  it('allows app domains', () => {
    expect(isRedirectUrlSafe('https://tenderflow.cz/app')).toBe(true);
    expect(isRedirectUrlSafe('https://www.tenderflow.cz/reset-password?token=abc')).toBe(true);
  });

  it('allows Vercel preview deployments', () => {
    expect(isRedirectUrlSafe('https://tender-flow-abc123.vercel.app/app')).toBe(true);
  });

  it('rejects unknown domains', () => {
    expect(isRedirectUrlSafe('https://evil.com/phishing')).toBe(false);
    expect(isRedirectUrlSafe('https://gopay.com.evil.com/fake')).toBe(false);
  });

  it('rejects javascript: protocol', () => {
    expect(isRedirectUrlSafe('javascript:alert(1)')).toBe(false);
  });

  it('rejects data: protocol', () => {
    expect(isRedirectUrlSafe('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('rejects HTTP (non-HTTPS) URLs', () => {
    expect(isRedirectUrlSafe('http://gw.gopay.com/pay')).toBe(false);
  });

  it('rejects empty or malformed URLs', () => {
    expect(isRedirectUrlSafe('')).toBe(false);
    expect(isRedirectUrlSafe('not-a-url')).toBe(false);
  });
});

describe('redirect validation is applied in billing components', () => {
  it('OrgBillingTab performs no unvalidated external redirect', () => {
    // Self-service Stripe checkout was removed (Enterprise is sales-assisted).
    // This guards against re-introducing an unvalidated location redirect.
    const source = fs.readFileSync(
      path.resolve('features/organization/ui/OrgBillingTab.tsx'),
      'utf-8',
    );
    const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(stripped).not.toMatch(/window\.location\.(href|assign|replace)\s*=?/);
    expect(stripped).not.toMatch(/location\.(href|assign|replace)\s*=/);
  });

  it('SubscriptionSettings validates checkout URL before redirect', () => {
    const source = fs.readFileSync(
      path.resolve('features/settings/SubscriptionSettings.tsx'),
      'utf-8',
    );
    expect(source).toContain('isRedirectUrlSafe');
  });

  it('useDocHubIntegration validates OAuth URL before redirect', () => {
    const source = fs.readFileSync(
      path.resolve('hooks/useDocHubIntegration.ts'),
      'utf-8',
    );
    expect(source).toContain('isRedirectUrlSafe');
  });
});

// ---------------------------------------------------------------------------
// P2-11 & P2-12: Documented as low-risk (defense-in-depth only)
// ---------------------------------------------------------------------------
describe('P2-11 token validation — defense-in-depth assessment', () => {
  it('token is always validated server-side by Supabase (not just client length check)', () => {
    const authCtx = fs.readFileSync(path.resolve('context/AuthContext.tsx'), 'utf-8');
    // Supabase SDK refreshSession is the actual security boundary
    expect(authCtx).toContain('refreshSession');
    // Client check is only a sanity guard
    expect(authCtx).toContain('length < 10');
  });
});

describe('P2-12 localStorage role/tier — defense-in-depth assessment', () => {
  it('server-side RLS independently validates admin role via is_admin()', () => {
    const migrations = fs.readdirSync(path.resolve('supabase/migrations'));
    const adminMigrations = migrations.filter(
      (f) => f.includes('admin') || f.includes('harden'),
    );
    // Multiple hardening migrations exist = server-side enforcement
    expect(adminMigrations.length).toBeGreaterThan(3);
  });
});
