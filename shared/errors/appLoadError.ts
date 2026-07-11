export const APP_CORE_DATA_LOAD_ERROR_CODE = "APP_CORE_DATA_LOAD_FAILED";
export const APP_CORE_DATA_LOAD_ERROR_MESSAGE =
  "Nepodařilo se načíst základní data aplikace. Zkuste obnovit stránku nebo se znovu přihlásit.";

export interface CoreQueryError {
  query: string;
  error: unknown;
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message || error.name;
  return String(error ?? "Unknown error");
};

export const buildCoreDataLoadDiagnostic = (
  queryErrors: readonly CoreQueryError[],
): string | null => {
  const failures = queryErrors.filter(({ error }) => Boolean(error));
  if (failures.length < 2) return null;

  return failures
    .map(({ query, error }) => `${query}: ${getErrorMessage(error)}`)
    .join(" | ");
};
