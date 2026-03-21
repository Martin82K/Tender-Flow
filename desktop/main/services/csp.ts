export const buildDesktopCsp = (isDev: boolean): string => {
    const scriptSrc = [
        "'self'",
        "'unsafe-inline'",
        ...(isDev ? ["'unsafe-eval'"] : []),
        'https://cdn.tailwindcss.com',
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

    return [
        "default-src 'self'",
        `script-src ${scriptSrc}`,
        `style-src ${styleSrc}`,
        `font-src ${fontSrc}`,
        `img-src ${imgSrc}`,
        `connect-src ${connectSrc}`,
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
    ].join('; ');
};
