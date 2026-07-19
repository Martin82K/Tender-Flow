import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import {
  buildWebReportOnlyCsp,
  createSecurityHeadersConfig,
  createSecurityHeadersMiddleware,
  isOriginAllowed,
} from '@/server/securityHeaders.js';

const expectedWebReportOnlyCsp = [
  "script-src 'self'",
  "script-src-elem 'self'",
  "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co wss://*.supabase.in https://api.mapy.com https://ares.gov.cz https://eu.i.posthog.com https://eu.posthog.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

describe('securityHeaders config', () => {
  it('v produkci bez env defaultně nepovoluje všechny origins', () => {
    const config = createSecurityHeadersConfig({
      NODE_ENV: 'production',
    } as NodeJS.ProcessEnv);

    expect(config.allowAllOrigins).toBe(false);
    expect(config.allowedOrigins).toEqual([]);
    expect(config.frameAncestors).toBe("'self'");
  });

  it('v development režimu má bezpečný frame-ancestors default', () => {
    const config = createSecurityHeadersConfig({
      NODE_ENV: 'development',
    } as NodeJS.ProcessEnv);

    expect(config.allowAllOrigins).toBe(true);
    expect(config.allowedOrigins).toEqual(['*']);
    expect(config.frameAncestors).toBe("'self'");
  });

  it('podporuje explicitní allowlist včetně wildcard patternů', () => {
    const config = createSecurityHeadersConfig({
      NODE_ENV: 'production',
      CORS_ALLOW_ORIGINS: 'https://app.example.com,https://*.trusted.example',
    } as NodeJS.ProcessEnv);

    expect(isOriginAllowed('https://app.example.com', config)).toBe(true);
    expect(isOriginAllowed('https://api.trusted.example', config)).toBe(true);
    expect(isOriginAllowed('https://evil.example', config)).toBe(false);
  });

  it('vytváří omezenou report-only CSP bez unsafe nebo obecných zdrojů', () => {
    const policy = buildWebReportOnlyCsp();

    expect(policy).toBe(expectedWebReportOnlyCsp);
    expect(policy).not.toContain("'unsafe-inline'");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toMatch(/(?:^|\s)https:(?:\s|;|$)/);
    expect(policy).not.toMatch(/(?:^|\s)\*(?:\s|;|$)/);
  });

  it('posílá report-only CSP z Node middleware', () => {
    const headers = new Map<string, string>();
    const next = vi.fn();
    const middleware = createSecurityHeadersMiddleware(
      createSecurityHeadersConfig({ NODE_ENV: 'production' } as NodeJS.ProcessEnv),
    );

    middleware(
      { headers: {}, method: 'GET' } as never,
      {
        setHeader: (name: string, value: string) => headers.set(name, value),
      } as never,
      next,
    );

    expect(headers.get('Content-Security-Policy-Report-Only')).toBe(
      expectedWebReportOnlyCsp,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('udržuje stejnou report-only CSP ve všech statických delivery konfiguracích', () => {
    const vercel = JSON.parse(
      readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'),
    ) as {
      headers: Array<{
        headers: Array<{ key: string; value: string }>;
      }>;
    };
    const globalHeaders = vercel.headers[0]?.headers ?? [];

    expect(
      globalHeaders.find(
        ({ key }) => key === 'Content-Security-Policy-Report-Only',
      )?.value,
    ).toBe(expectedWebReportOnlyCsp);

    const publicHeaders = readFileSync(
      resolve(process.cwd(), 'public/_headers'),
      'utf8',
    );
    expect(publicHeaders).toContain(
      `Content-Security-Policy-Report-Only: ${expectedWebReportOnlyCsp}`,
    );

    const appEngineConfig = readFileSync(
      resolve(process.cwd(), 'app.yaml'),
      'utf8',
    );
    expect(appEngineConfig).toContain(
      `Content-Security-Policy-Report-Only: "${expectedWebReportOnlyCsp}"`,
    );
  });
});
