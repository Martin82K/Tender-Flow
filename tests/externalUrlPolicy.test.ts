import { describe, expect, it } from 'vitest';
import {
    canOpenExternalUrl,
    isAllowedExternalUrl,
    parseExternalUrl,
} from '../desktop/main/security/externalUrlPolicy';

describe('externalUrlPolicy', () => {
    it('allows HTTPS SharePoint tenant document links', () => {
        const parsed = parseExternalUrl('https://baustavky-my.sharepoint.com/:f:/g/personal/example');

        expect(isAllowedExternalUrl(parsed)).toBe(true);
        expect(canOpenExternalUrl('https://baustavky-my.sharepoint.com/:f:/g/personal/example')).toBe(true);
    });

    it('does not allow SharePoint lookalike hosts', () => {
        expect(canOpenExternalUrl('https://sharepoint.com.evil.example/file')).toBe(false);
        expect(canOpenExternalUrl('https://evilsharepoint.com/file')).toBe(false);
    });

    it('keeps SharePoint links HTTPS-only even when HTTP parsing is enabled for IPC compatibility', () => {
        const parsed = parseExternalUrl('http://baustavky-my.sharepoint.com/file', { allowHttp: true });

        expect(isAllowedExternalUrl(parsed)).toBe(false);
    });

    it('blocks unapproved HTTPS hosts', () => {
        expect(canOpenExternalUrl('https://example.com/docs')).toBe(false);
    });
});
