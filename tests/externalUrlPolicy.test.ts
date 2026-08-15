import { afterEach, describe, expect, it } from 'vitest';
import {
    canOpenExternalUrl,
    isAllowedExternalUrl,
    parseExternalUrl,
} from '../desktop/main/security/externalUrlPolicy';

describe('externalUrlPolicy', () => {
    const originalSupabaseUrl = process.env.VITE_SUPABASE_URL;

    afterEach(() => {
        if (originalSupabaseUrl === undefined) delete process.env.VITE_SUPABASE_URL;
        else process.env.VITE_SUPABASE_URL = originalSupabaseUrl;
    });

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

    it('allows only HTTPS on the exact Microsoft OAuth host', () => {
        expect(canOpenExternalUrl(
            'https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize',
        )).toBe(true);
        expect(canOpenExternalUrl(
            'http://login.microsoftonline.com/organizations/oauth2/v2.0/authorize',
            { allowHttp: true },
        )).toBe(false);
        expect(canOpenExternalUrl(
            'https://login.microsoftonline.com.evil.example/organizations/oauth2/v2.0/authorize',
        )).toBe(false);
    });

    it('blocks unapproved HTTPS hosts', () => {
        expect(canOpenExternalUrl('https://example.com/docs')).toBe(false);
    });

    it('allows only signed contract documents on the configured Supabase origin', () => {
        process.env.VITE_SUPABASE_URL = 'https://project-ref.supabase.co';

        expect(canOpenExternalUrl(
            'https://project-ref.supabase.co/storage/v1/object/sign/contract-documents/projects/project-1/contracts/document.pdf?token=signed',
        )).toBe(true);
        expect(canOpenExternalUrl(
            'https://project-ref.supabase.co/storage/v1/object/sign/other-bucket/projects/project-1/contracts/document.pdf?token=signed',
        )).toBe(false);
        expect(canOpenExternalUrl(
            'https://project-ref.supabase.co/storage/v1/object/sign/contract-documents/projects/project-1/contracts/document.pdf',
        )).toBe(false);
        expect(canOpenExternalUrl(
            'https://attacker.supabase.co/storage/v1/object/sign/contract-documents/projects/project-1/contracts/document.pdf?token=signed',
        )).toBe(false);
        expect(canOpenExternalUrl(
            'http://project-ref.supabase.co/storage/v1/object/sign/contract-documents/projects/project-1/contracts/document.pdf?token=signed',
            { allowHttp: true },
        )).toBe(false);
    });
});
