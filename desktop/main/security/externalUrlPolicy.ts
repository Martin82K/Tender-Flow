import { getPublicEnvValue } from '../services/publicEnv';

const ALLOWED_EXTERNAL_HOSTS = new Set([
    'accounts.google.com',
    'oauth2.googleapis.com',
    'github.com',
    'www.github.com',
    'tenderflow.cz',
    'www.tenderflow.cz',
    'ares.gov.cz',
    'www.rzp.cz',
    'rzp.gov.cz',
    'or.justice.cz',
]);

const HTTPS_ONLY_HOST_SUFFIXES = ['.sharepoint.com'];
const HTTPS_ONLY_EXTERNAL_HOSTS = new Set(['login.microsoftonline.com']);
const CONTRACT_DOCUMENT_SIGNED_PATH = /^\/storage\/v1\/object\/sign\/contract-documents\/projects\/[A-Za-z0-9-]+\/contracts\/[A-Za-z0-9-]+\.(pdf|docx)$/i;

type ExternalUrlPolicyOptions = {
    allowHttp?: boolean;
};

const isHttpsOnlyHost = (hostname: string): boolean => {
    const normalizedHostname = hostname.toLowerCase();
    return HTTPS_ONLY_HOST_SUFFIXES.some((suffix) => normalizedHostname.endsWith(suffix));
};

const isConfiguredContractDocumentUrl = (parsed: URL): boolean => {
    if (
        parsed.protocol !== 'https:'
        || parsed.username
        || parsed.password
        || !parsed.searchParams.get('token')
        || !CONTRACT_DOCUMENT_SIGNED_PATH.test(parsed.pathname)
    ) {
        return false;
    }

    const configuredUrl = getPublicEnvValue('VITE_SUPABASE_URL');
    if (!configuredUrl) return false;

    try {
        const configuredOrigin = new URL(configuredUrl);
        return configuredOrigin.protocol === 'https:' && parsed.origin === configuredOrigin.origin;
    } catch {
        return false;
    }
};

export const parseExternalUrl = (
    rawUrl: string,
    options: ExternalUrlPolicyOptions = {},
): URL => {
    let parsed: URL;
    try {
        parsed = new URL(rawUrl);
    } catch {
        throw new Error('Invalid URL');
    }

    if (parsed.protocol === 'mailto:' || parsed.protocol === 'https:') {
        return parsed;
    }

    if (options.allowHttp && parsed.protocol === 'http:') {
        return parsed;
    }

    throw new Error(`Blocked protocol: ${parsed.protocol}`);
};

export const isAllowedExternalUrl = (parsed: URL): boolean => {
    if (parsed.protocol === 'mailto:') return true;
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;

    const hostname = parsed.hostname.toLowerCase();
    if (ALLOWED_EXTERNAL_HOSTS.has(hostname)) return true;
    if (parsed.protocol === 'https:' && HTTPS_ONLY_EXTERNAL_HOSTS.has(hostname)) return true;
    if (parsed.protocol === 'https:' && isHttpsOnlyHost(hostname)) return true;
    if (isConfiguredContractDocumentUrl(parsed)) return true;

    return false;
};

export const canOpenExternalUrl = (
    rawUrl: string,
    options: ExternalUrlPolicyOptions = {},
): boolean => {
    try {
        return isAllowedExternalUrl(parseExternalUrl(rawUrl, options));
    } catch {
        return false;
    }
};
