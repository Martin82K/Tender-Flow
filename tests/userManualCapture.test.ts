import { describe, expect, it } from 'vitest';
import { getBrowserLaunchOptions, getCaptureMetadata } from '../docs/user-manual/captureSupport.mjs';

describe('přenositelný záznam screenshotů', () => {
  it('bez vlastní cesty nechá Playwright vybrat jeho instalovaný prohlížeč', () => {
    expect(getBrowserLaunchOptions({})).toEqual({});
    expect(getBrowserLaunchOptions({ CHROME_BIN: '/opt/chrome' })).toEqual({ executablePath: '/opt/chrome' });
  });
  it('používá ověřenou verzi a skutečné datum pořízení i při pozdější revizi', () => {
    expect(getCaptureMetadata({ appVersion: '2.4.0', reviewedAt: '2030-01-01' }, new Date('2030-02-03T12:00:00Z'))).toEqual({ version: '2.4.0', capturedAt: '2030-02-03' });
  });
});
