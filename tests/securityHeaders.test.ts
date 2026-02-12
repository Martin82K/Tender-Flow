import {
  createSecurityHeadersConfig,
  isOriginAllowed,
} from '@/server/securityHeaders.js';

describe('securityHeaders config', () => {
  it('v produkci bez env defaultně nepovoluje všechny origins', () => {
    const config = createSecurityHeadersConfig({
      NODE_ENV: 'production',
    } as NodeJS.ProcessEnv);

    expect(config.allowAllOrigins).toBe(false);
    expect(config.allowedOrigins).toEqual([]);
    expect(config.frameAncestors).toBe("'self'");
  });

  it('v development režimu defaultně povolí all origins kvůli lokálnímu vývoji', () => {
    const config = createSecurityHeadersConfig({
      NODE_ENV: 'development',
    } as NodeJS.ProcessEnv);

    expect(config.allowAllOrigins).toBe(true);
    expect(config.allowedOrigins).toEqual(['*']);
    expect(config.frameAncestors).toBe('*');
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
});
