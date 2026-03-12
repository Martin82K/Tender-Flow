const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._\-+/=]+/gi;
const JWT_PATTERN = /\b[A-Za-z0-9-_]{20,}\.[A-Za-z0-9-_]{20,}\.[A-Za-z0-9-_]{20,}\b/g;
const AUTHORIZATION_PATTERN = /(authorization\s*[:=]\s*)([^\s,}]+)/gi;
const APIKEY_PATTERN = /(apikey\s*[:=]\s*)([^\s,}]+)/gi;
const REFRESH_TOKEN_PATTERN = /(refresh_token\s*[:=]\s*)([^\s,}]+)/gi;

export const SECRET_KEY_PATTERN =
  /(token|password|secret|authorization|cookie|apikey|api_key|refresh|bearer)/i;

export const redactSensitiveText = (value: unknown): string => {
  const raw = String(value ?? "");
  if (!raw) return "";

  return raw
    .replace(EMAIL_PATTERN, "[redacted-email]")
    .replace(BEARER_PATTERN, "Bearer [redacted-token]")
    .replace(JWT_PATTERN, "[redacted-jwt]")
    .replace(AUTHORIZATION_PATTERN, "$1[redacted-token]")
    .replace(APIKEY_PATTERN, "$1[redacted-token]")
    .replace(REFRESH_TOKEN_PATTERN, "$1[redacted-token]");
};

export const sanitizeLogText = (value: unknown, maxLen: number): string => {
  const redacted = redactSensitiveText(value);
  if (redacted.length <= maxLen) return redacted;
  return `${redacted.slice(0, maxLen)}…`;
};
