import { createHmac, timingSafeEqual } from "crypto";

export interface SupabaseJwtPayload {
  sub?: string;
  exp?: number;
  iat?: number;
  nbf?: number;
  [key: string]: unknown;
}

const UPDATE_PREFIX = "releases/win/";

const base64UrlToBuffer = (value: string): Buffer => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + "=".repeat(padLength);
  return Buffer.from(padded, "base64");
};

const parseJson = <T>(value: string): T | null => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const stripWrappingQuotes = (value: string): string => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const normalizeRelativeUpdateFile = (value: string): string | null => {
  const raw = stripWrappingQuotes(value);
  if (!raw) return null;

  if (raw.startsWith("file?path=")) {
    const encoded = raw.slice("file?path=".length);
    const decoded = decodeURIComponent(encoded);
    return isAllowedUpdateBlobPath(decoded) ? decoded : null;
  }

  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      const pathname = parsed.pathname.replace(/^\/+/, "");
      if (isAllowedUpdateBlobPath(pathname)) {
        return pathname;
      }
      return `${UPDATE_PREFIX}${pathname.split("/").pop() || ""}`;
    } catch {
      return null;
    }
  }

  if (isAllowedUpdateBlobPath(raw)) {
    return raw;
  }

  const normalized = raw.replace(/^\/+/, "").replace(/^\.\//, "");
  if (!normalized) return null;
  return `${UPDATE_PREFIX}${normalized}`;
};

export const getBearerToken = (authorizationHeader: string | undefined): string | null => {
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(" ");
  if (!scheme || !token) return null;
  if (scheme.toLowerCase() !== "bearer") return null;
  return token.trim() || null;
};

export const verifySupabaseAccessToken = (
  token: string,
  jwtSecret: string
): SupabaseJwtPayload | null => {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = parseJson<{ alg?: string }>(base64UrlToBuffer(encodedHeader).toString("utf-8"));
  if (!header || header.alg !== "HS256") return null;

  const payload = parseJson<SupabaseJwtPayload>(
    base64UrlToBuffer(encodedPayload).toString("utf-8")
  );
  if (!payload) return null;

  const signedPart = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = createHmac("sha256", jwtSecret).update(signedPart).digest();
  const tokenSignature = base64UrlToBuffer(encodedSignature);

  if (expectedSignature.length !== tokenSignature.length) return null;
  if (!timingSafeEqual(expectedSignature, tokenSignature)) return null;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp < nowSeconds) return null;
  if (typeof payload.nbf === "number" && payload.nbf > nowSeconds) return null;

  return payload;
};

export const isAllowedUpdateBlobPath = (pathname: string): boolean => {
  if (!pathname) return false;
  if (pathname.includes("..")) return false;
  return pathname.startsWith(UPDATE_PREFIX);
};

export const rewriteLatestYamlForUpdateProxy = (yamlContent: string): string => {
  const replacePath = (input: string): string => {
    const match = input.match(/^path:\s*(.+)\s*$/m);
    if (!match) return input;

    const normalizedBlobPath = normalizeRelativeUpdateFile(match[1]);
    if (!normalizedBlobPath) return input;

    const proxyRelativePath = `file?path=${encodeURIComponent(normalizedBlobPath)}`;
    return input.replace(match[0], `path: ${proxyRelativePath}`);
  };

  const replaceUrls = (input: string): string => {
    return input.replace(
      /^(\s*(?:-\s*)?url:\s*)(.+)\s*$/gm,
      (_full, prefix: string, rawValue: string) => {
        const normalizedBlobPath = normalizeRelativeUpdateFile(rawValue);
        if (!normalizedBlobPath) return `${prefix}${rawValue}`;
        return `${prefix}file?path=${encodeURIComponent(normalizedBlobPath)}`;
      }
    );
  };

  return replaceUrls(replacePath(yamlContent));
};
