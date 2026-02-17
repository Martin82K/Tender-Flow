export type MarkdownRowForSecurity = {
  id: string;
  entity_type: "contract" | "amendment";
  project_id: string;
  content_md: string | null;
  content_md_ciphertext: string | null;
  encryption_version: number | null;
  encryption_key_id: string | null;
  content_sha256: string | null;
  [key: string]: unknown;
};

export type EncryptionContextForSecurity = {
  keyId: string;
  version: number;
};

export type MarkdownSecurityCode =
  | "MD_INTEGRITY_MISMATCH"
  | "MD_LEGACY_MIGRATION_FAILED"
  | "MD_CONTENT_UNREADABLE";

export class MarkdownSecurityError extends Error {
  code: MarkdownSecurityCode;
  status: number;

  constructor(message: string, code: MarkdownSecurityCode, status = 409) {
    super(message);
    this.name = "MarkdownSecurityError";
    this.code = code;
    this.status = status;
  }
}

type MaterializeDeps = {
  decryptCiphertext: (ciphertext: string, keyId: string) => Promise<string>;
  encryptWithActiveKey: (plaintext: string) => Promise<string>;
  hashPlaintext: (plaintext: string) => Promise<string>;
  updateRow: (rowId: string, patch: Record<string, unknown>) => Promise<void>;
  logEvent?: (event: string, payload: Record<string, unknown>) => void;
};

export const isMarkdownSecurityError = (
  error: unknown,
): error is MarkdownSecurityError => error instanceof MarkdownSecurityError;

export const createPublicMarkdownRow = <T extends MarkdownRowForSecurity>(
  row: T,
  contentOverride?: string | null,
): Omit<T, "content_md_ciphertext"> => {
  const { content_md_ciphertext: _dropCiphertext, ...rest } = row;
  return {
    ...rest,
    ...(contentOverride !== undefined ? { content_md: contentOverride } : {}),
  };
};

export const materializeRowContentSecure = async <T extends MarkdownRowForSecurity>(
  row: T,
  activeEncryption: EncryptionContextForSecurity,
  deps: MaterializeDeps,
): Promise<T> => {
  if (row.content_md_ciphertext) {
    const keyId = row.encryption_key_id || "v1";
    const plaintext = await deps.decryptCiphertext(row.content_md_ciphertext, keyId);
    const computedHash = await deps.hashPlaintext(plaintext);

    if (row.content_sha256 && row.content_sha256 !== computedHash) {
      deps.logEvent?.("MD_INTEGRITY_MISMATCH", {
        rowId: row.id,
        entityType: row.entity_type,
        projectId: row.project_id,
        keyId,
      });
      throw new MarkdownSecurityError(
        "Markdown integrity check failed",
        "MD_INTEGRITY_MISMATCH",
        409,
      );
    }

    if (!row.content_sha256) {
      await deps.updateRow(row.id, { content_sha256: computedHash });
    }

    return {
      ...row,
      content_md: plaintext,
      content_sha256: computedHash,
    };
  }

  if (row.content_md) {
    const legacyPlaintext = row.content_md;
    try {
      const ciphertext = await deps.encryptWithActiveKey(legacyPlaintext);
      const contentHash = await deps.hashPlaintext(legacyPlaintext);
      await deps.updateRow(row.id, {
        content_md_ciphertext: ciphertext,
        encryption_version: activeEncryption.version,
        encryption_key_id: activeEncryption.keyId,
        content_sha256: contentHash,
        content_md: null,
      });

      return {
        ...row,
        content_md: legacyPlaintext,
        content_md_ciphertext: ciphertext,
        encryption_version: activeEncryption.version,
        encryption_key_id: activeEncryption.keyId,
        content_sha256: contentHash,
      };
    } catch {
      deps.logEvent?.("MD_LEGACY_MIGRATION_FAILED", {
        rowId: row.id,
        entityType: row.entity_type,
        projectId: row.project_id,
        activeKeyId: activeEncryption.keyId,
      });
      throw new MarkdownSecurityError(
        "Legacy markdown migration failed",
        "MD_LEGACY_MIGRATION_FAILED",
        409,
      );
    }
  }

  throw new MarkdownSecurityError(
    `Markdown row has no readable content: ${row.id}`,
    "MD_CONTENT_UNREADABLE",
    500,
  );
};
