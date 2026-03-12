export const buildDesktopCsp = (isDev: boolean): string => {
    const defaultSrc = isDev
        ? "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: data: blob:"
        : "default-src 'self' 'unsafe-inline' https: data: blob:";

    const connectSrc = [
        "'self'",
        'https://*.supabase.co',
        'https://*.supabase.in',
        'wss://*.supabase.co',
        'wss://*.supabase.in',
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

    return `${defaultSrc}; connect-src ${connectSrc};`;
};
