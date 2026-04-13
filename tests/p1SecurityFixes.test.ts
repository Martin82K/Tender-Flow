import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// P1-4: CORS — edge function shared helper must not use wildcard
// ---------------------------------------------------------------------------
describe('CORS origin hardening', () => {
  const corsPath = path.resolve('supabase/functions/_shared/cors.ts');
  const corsSource = fs.readFileSync(corsPath, 'utf-8');

  it('shared cors module does not export wildcard as default origin', () => {
    // The static corsHeaders fallback should NOT contain "*"
    expect(corsSource).not.toMatch(/["']access-control-allow-origin["']:\s*["']\*["']/i);
  });

  it('buildCorsHeaders validates origin against allowlist', () => {
    // Must contain the origin validation logic
    expect(corsSource).toContain('isOriginAllowed');
    expect(corsSource).toContain('tenderflow.cz');
  });

  it('includes Vary: Origin header for proper caching', () => {
    expect(corsSource).toContain('"vary"');
  });

  it('no edge function has its own wildcard CORS headers', () => {
    const functionsDir = path.resolve('supabase/functions');
    const edgeFunctions = fs.readdirSync(functionsDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name !== '_shared' && d.name !== 'node_modules')
      .map(d => d.name);

    for (const fn of edgeFunctions) {
      const indexPath = path.join(functionsDir, fn, 'index.ts');
      if (!fs.existsSync(indexPath)) continue;
      const source = fs.readFileSync(indexPath, 'utf-8');
      expect(
        source,
        `${fn}/index.ts should not define wildcard CORS`,
      ).not.toMatch(/["']Access-Control-Allow-Origin["']:\s*["']\*["']/);
    }
  });

  it('public/_headers does not use wildcard CORS', () => {
    const headersPath = path.resolve('public/_headers');
    const content = fs.readFileSync(headersPath, 'utf-8');
    expect(content).not.toMatch(/Access-Control-Allow-Origin:\s*\*/);
    expect(content).toContain('tenderflow.cz');
  });
});

// ---------------------------------------------------------------------------
// P1-5: Flask /merge endpoint must require API key
// ---------------------------------------------------------------------------
describe('Flask API key validation', () => {
  const flaskPath = path.resolve('server_py/excel_unlock_api/app.py');
  const flaskSource = fs.readFileSync(flaskPath, 'utf-8');

  it('/merge endpoint requires API key validation', () => {
    // Both /merge and /unlock must call has_valid_api_key()
    // Split source by endpoint definitions and check each
    const mergeIdx = flaskSource.indexOf('def merge_excel');
    expect(mergeIdx, '/merge endpoint must exist').toBeGreaterThan(-1);
    const mergeBody = flaskSource.slice(mergeIdx, flaskSource.indexOf('\n@', mergeIdx + 1) === -1 ? undefined : flaskSource.indexOf('\nif __name__', mergeIdx));
    expect(mergeBody).toContain('has_valid_api_key()');
    expect(mergeBody).toContain('401');
  });

  it('/unlock endpoint requires API key validation', () => {
    const unlockIdx = flaskSource.indexOf('def unlock_excel');
    expect(unlockIdx, '/unlock endpoint must exist').toBeGreaterThan(-1);
    const endIdx = flaskSource.indexOf('\ndef merge_excel', unlockIdx);
    const unlockBody = flaskSource.slice(unlockIdx, endIdx > -1 ? endIdx : undefined);
    expect(unlockBody).toContain('has_valid_api_key()');
  });

  it('Flask CORS does not use wildcard origin', () => {
    expect(flaskSource).not.toMatch(/["']Access-Control-Allow-Origin["']\s*=\s*["']\*["']/);
    expect(flaskSource).toContain('ALLOWED_ORIGINS');
  });

  it('Flask error handlers do not leak exception details', () => {
    // Should not interpolate exception message into response
    expect(flaskSource).not.toMatch(/return f".*\{str\(e\)\}.*"/);
    expect(flaskSource).not.toMatch(/return f".*\{e\}.*"/);
  });
});

// ---------------------------------------------------------------------------
// P1-6: SVG XSS — convert.html must not use innerHTML for SVG
// ---------------------------------------------------------------------------
describe('SVG XSS prevention', () => {
  const convertPath = path.resolve('public/subscriptions/convert.html');
  const convertSource = fs.readFileSync(convertPath, 'utf-8');

  it('does not use innerHTML to inject SVG content', () => {
    expect(convertSource).not.toMatch(/\.innerHTML\s*=\s*svg/i);
  });

  it('uses safe <img> rendering for SVG preview', () => {
    expect(convertSource).toContain('createElement(\'img\')');
    expect(convertSource).toContain('createObjectURL');
  });
});

// ---------------------------------------------------------------------------
// P1-7: secureStorage must not fall back to plaintext
// ---------------------------------------------------------------------------
describe('secureStorage plaintext fallback removal', () => {
  const storagePath = path.resolve('desktop/main/services/secureStorage.ts');
  const storageSource = fs.readFileSync(storagePath, 'utf-8');

  it('set() throws when encryption is unavailable instead of storing plaintext', () => {
    // The set method should throw SECURE_STORAGE_UNAVAILABLE
    expect(storageSource).toContain('SECURE_STORAGE_UNAVAILABLE');
  });

  it('does not contain plaintext fallback pattern', () => {
    // Old pattern: "data[key] = value" without encryption
    // The only data[key] assignment should be the encrypted version
    const dataAssignments = storageSource.match(/data\[key\]\s*=\s*/g) || [];
    expect(dataAssignments.length).toBe(1); // only the encrypted assignment
    expect(storageSource).toContain('encryptString');
  });

  it('get() refuses to read when encryption is unavailable', () => {
    expect(storageSource).toContain('refusing to read potentially unencrypted data');
  });

  it('does not log raw error objects or sensitive values', () => {
    expect(storageSource).not.toMatch(/console\.error\(.*error\)/);
  });
});
