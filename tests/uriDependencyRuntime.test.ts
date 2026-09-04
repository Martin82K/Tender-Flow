// @vitest-environment node
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const uri = require('fast-uri') as {
  serialize: (parts: Record<string, string>) => string;
  resolve: (base: string, reference: string) => string;
};

describe('URI dependency used by MCP schema validation', () => {
  it('rejects authority injection through an untrusted port', () => {
    expect(() => uri.serialize({
      scheme: 'https', host: 'trusted.example', port: '@127.0.0.1:8124', path: '/app',
    })).toThrow();
  });

  it('continues to resolve normal JSON schema references', () => {
    expect(uri.resolve('https://example.test/schema/root.json', '../common.json#/$defs/task'))
      .toBe('https://example.test/common.json#/$defs/task');
  });
});
