const DESKTOP_DEV_CSP_HOSTS = new Set([
    'localhost:3000',
    '127.0.0.1:3000',
]);

export const buildDesktopCsp = (isDev: boolean): string => {
    const scriptSrc = [
        "'self'",
        "'unsafe-inline'",
        ...(isDev ? ["'unsafe-eval'"] : []),
        'https://cdn.tailwindcss.com',
        'https://js.stripe.com',
        'https://*.stripe.com',
    ].join(' ');

    const styleSrc = [
        "'self'",
        "'unsafe-inline'",
        'https://fonts.googleapis.com',
    ].join(' ');

    const fontSrc = [
        "'self'",
        'https://fonts.gstatic.com',
        'data:',
    ].join(' ');

    const imgSrc = [
        "'self'",
        'data:',
        'blob:',
        'https:',
    ].join(' ');

    const connectSrc = [
        "'self'",
        'https://*.supabase.co',
        'https://*.supabase.in',
        'wss://*.supabase.co',
        'wss://*.supabase.in',
        'https://ares.gov.cz',
        'https://api.stripe.com',
        'https://js.stripe.com',
        'https://r.stripe.com',
        'https://m.stripe.com',
        'https://q.stripe.com',
        'https://m.stripe.network',
        'https://*.stripe.com',
        'https://*.stripe.network',
        'https://fonts.googleapis.com',
        'https://fonts.gstatic.com',
    ].join(' ');

    const frameSrc = [
        "'self'",
        'https://js.stripe.com',
        'https://hooks.stripe.com',
        'https://*.stripe.com',
    ].join(' ');

    return [
        "default-src 'self'",
        `script-src ${scriptSrc}`,
        `script-src-elem ${scriptSrc}`,
        `style-src ${styleSrc}`,
        `font-src ${fontSrc}`,
        `img-src ${imgSrc}`,
        `connect-src ${connectSrc}`,
        `frame-src ${frameSrc}`,
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
    ].join('; ');
};

export const shouldInjectDesktopCsp = (requestUrl: string, isDev: boolean): boolean => {
    try {
        const parsed = new URL(requestUrl);
        if (parsed.protocol === 'file:') {
            return true;
        }

        if (!isDev) {
            return false;
        }

        return parsed.protocol === 'http:' && DESKTOP_DEV_CSP_HOSTS.has(parsed.host);
    } catch {
        return requestUrl.startsWith('file://');
    }
};
