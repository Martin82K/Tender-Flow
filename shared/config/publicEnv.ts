export const normalizePublicEnvValue = (value: unknown): string => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  const isWrappedInDoubleQuotes = trimmed.startsWith('"') && trimmed.endsWith('"');
  const isWrappedInSingleQuotes = trimmed.startsWith("'") && trimmed.endsWith("'");
  const unwrapped =
    (isWrappedInDoubleQuotes || isWrappedInSingleQuotes) && trimmed.length >= 2
      ? trimmed.slice(1, -1).trim()
      : trimmed;

  return unwrapped.replace(/[\r\n]+/g, "");
};
