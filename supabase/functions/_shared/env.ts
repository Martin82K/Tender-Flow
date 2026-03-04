export const normalizeSecret = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const isWrappedInDoubleQuotes = trimmed.startsWith("\"") && trimmed.endsWith("\"");
  const isWrappedInSingleQuotes = trimmed.startsWith("'") && trimmed.endsWith("'");
  if ((isWrappedInDoubleQuotes || isWrappedInSingleQuotes) && trimmed.length >= 2) {
    const unwrapped = trimmed.slice(1, -1).trim();
    return unwrapped || null;
  }

  return trimmed;
};

export const getFirstEnvSecret = (
  ...keys: string[]
): { value: string | null; key: string | null } => {
  for (const key of keys) {
    const normalized = normalizeSecret(Deno.env.get(key));
    if (normalized) {
      return { value: normalized, key };
    }
  }
  return { value: null, key: null };
};
