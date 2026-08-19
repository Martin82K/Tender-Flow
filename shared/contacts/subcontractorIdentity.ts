import type { Subcontractor } from "@/types";

export const SUBCONTRACTOR_NAME_CONFLICT_CONSTRAINT =
  "subcontractors_tenant_company_name_key";
export const SUBCONTRACTOR_NAME_CONFLICT_MARKER =
  "SUBCONTRACTOR_NAME_CONFLICT";

export const normalizeSubcontractorIdentityName = (value: string): string =>
  value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("cs-CZ");

export const findSubcontractorNameConflict = (
  contacts: Subcontractor[],
  companyName: string,
  excludedContactId?: string,
): Subcontractor | undefined => {
  const candidateKey = normalizeSubcontractorIdentityName(companyName);
  if (!candidateKey) return undefined;

  return contacts.find(
    (contact) =>
      contact.id !== excludedContactId &&
      normalizeSubcontractorIdentityName(contact.company || "") === candidateKey,
  );
};

export const getSubcontractorNameConflictMessage = (companyName: string): string =>
  `Subdodavatel s názvem „${companyName.trim()}“ již existuje. Zvolte odlišný název střediska.`;

export class SubcontractorNameConflictError extends Error {
  readonly code = "SUBCONTRACTOR_NAME_CONFLICT";

  constructor(companyName: string) {
    super(getSubcontractorNameConflictMessage(companyName));
    this.name = "SubcontractorNameConflictError";
  }
}

const asErrorRecord = (error: unknown): Record<string, unknown> | null =>
  typeof error === "object" && error !== null
    ? (error as Record<string, unknown>)
    : null;

export const isSubcontractorNameConflictError = (error: unknown): boolean => {
  if (error instanceof SubcontractorNameConflictError) return true;

  const record = asErrorRecord(error);
  if (!record) return false;

  return (
    record.code === "23505" &&
    (record.constraint === SUBCONTRACTOR_NAME_CONFLICT_CONSTRAINT ||
      String(record.message || "").includes(SUBCONTRACTOR_NAME_CONFLICT_MARKER) ||
      String(record.details || "").includes(SUBCONTRACTOR_NAME_CONFLICT_CONSTRAINT))
  );
};

export const mapSubcontractorPersistenceError = (
  error: unknown,
  companyName: string,
): Error =>
  isSubcontractorNameConflictError(error)
    ? new SubcontractorNameConflictError(companyName)
    : error instanceof Error
      ? error
      : new Error(String(error));

export const assertUniqueSubcontractorName = (
  contacts: Subcontractor[],
  companyName: string,
  excludedContactId?: string,
): void => {
  if (findSubcontractorNameConflict(contacts, companyName, excludedContactId)) {
    throw new SubcontractorNameConflictError(companyName);
  }
};
