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

export const sanitizeLogValue = (value: unknown, depth = 0): unknown => {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return sanitizeLogText(value, 200);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= 2) return "[truncated]";

  if (Array.isArray(value)) {
    return value.slice(0, 10).map((item) => sanitizeLogValue(item, depth + 1));
  }

  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>).slice(0, 15)) {
      output[key] = SECRET_KEY_PATTERN.test(key)
        ? "[redacted]"
        : sanitizeLogValue(entry, depth + 1);
    }
    return output;
  }

  return sanitizeLogText(String(value), 200);
};

export const summarizeErrorForLog = (error: unknown): unknown => {
  if (error instanceof Error) {
    return {
      name: sanitizeLogText(error.name, 80),
      message: sanitizeLogText(error.message, 300),
      stack: error.stack ? sanitizeLogText(error.stack, 500) : undefined,
      code: "code" in error ? sanitizeLogValue((error as { code?: unknown }).code) : undefined,
      status: "status" in error ? sanitizeLogValue((error as { status?: unknown }).status) : undefined,
    };
  }

  return sanitizeLogValue(error);
};
