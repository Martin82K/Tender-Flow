const DEFAULT_ALLOWED_METHODS = 'GET, POST, PUT, DELETE, OPTIONS';
const DEFAULT_ALLOWED_HEADERS = 'Content-Type, Authorization';

const parseCsv = (value) => {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const escapeRegExp = (input) => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildOriginMatcher = (pattern) => {
  if (pattern === '*') return () => true;
  if (!pattern.includes('*')) {
    return (origin) => origin === pattern;
  }

  const regex = new RegExp(
    `^${pattern
      .split('*')
      .map((token) => escapeRegExp(token))
      .join('.*')}$`,
  );

  return (origin) => regex.test(origin);
};

export const createSecurityHeadersConfig = (env = process.env) => {
  const nodeEnv = env.NODE_ENV || 'development';
  const configuredOrigins = parseCsv(env.CORS_ALLOW_ORIGINS);
  const effectiveOrigins =
    configuredOrigins.length > 0 ? configuredOrigins : nodeEnv === 'production' ? [] : ['*'];

  return {
    allowAllOrigins: effectiveOrigins.includes('*'),
    allowedOrigins: effectiveOrigins,
    allowedOriginMatchers: effectiveOrigins.map((origin) => buildOriginMatcher(origin)),
    frameAncestors: env.CSP_FRAME_ANCESTORS || (nodeEnv === 'production' ? "'self'" : '*'),
    allowedMethods: env.CORS_ALLOW_METHODS || DEFAULT_ALLOWED_METHODS,
    allowedHeaders: env.CORS_ALLOW_HEADERS || DEFAULT_ALLOWED_HEADERS,
  };
};

export const isOriginAllowed = (origin, config) => {
  if (!origin) return false;
  if (config.allowAllOrigins) return true;
  return config.allowedOriginMatchers.some((matcher) => matcher(origin));
};

export const createSecurityHeadersMiddleware = (config = createSecurityHeadersConfig()) => {
  return (req, res, next) => {
    const requestOrigin = req.headers.origin;

    // We intentionally keep embedding configurable by CSP and remove legacy X-Frame-Options.
    res.removeHeader('X-Frame-Options');
    res.setHeader('Content-Security-Policy', `frame-ancestors ${config.frameAncestors}`);
    res.setHeader('Access-Control-Allow-Methods', config.allowedMethods);
    res.setHeader('Access-Control-Allow-Headers', config.allowedHeaders);

    const hasOrigin = typeof requestOrigin === 'string' && requestOrigin.length > 0;
    const allowedOrigin = hasOrigin && isOriginAllowed(requestOrigin, config);

    if (allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', config.allowAllOrigins ? '*' : requestOrigin);
      if (!config.allowAllOrigins) {
        res.setHeader('Vary', 'Origin');
      }
    }

    if (req.method === 'OPTIONS') {
      if (hasOrigin && !allowedOrigin && !config.allowAllOrigins) {
        res.status(403).json({
          error: 'Origin not allowed by CORS policy',
        });
        return;
      }
      res.status(204).end();
      return;
    }

    next();
  };
};
