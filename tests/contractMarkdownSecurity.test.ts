import { describe, expect, it, vi } from "vitest";
import {
  createPublicMarkdownRow,
  isMarkdownSecurityError,
  materializeRowContentSecure,
} from "../supabase/functions/contract-markdown-secure/markdownSecurity";

const baseRow = {
  id: "row-1",
  entity_type: "contract" as const,
  project_id: "project-1",
  content_md: null as string | null,
  content_md_ciphertext: "ciphertext",
  encryption_version: 1,
  encryption_key_id: "v1",
  content_sha256: "hash-ok",
  version_no: 1,
};

describe("contract markdown security helpers", () => {
  it("materializeRowContentSecure returns plaintext for valid ciphertext + hash", async () => {
    const decryptCiphertext = vi.fn().mockResolvedValue("hello");
    const hashPlaintext = vi.fn().mockResolvedValue("hash-ok");
    const updateRow = vi.fn().mockResolvedValue(undefined);

    const row = await materializeRowContentSecure(
      { ...baseRow },
      { keyId: "v1", version: 1 },
      {
        decryptCiphertext,
        encryptWithActiveKey: vi.fn(),
        hashPlaintext,
        updateRow,
      },
    );

    expect(row.content_md).toBe("hello");
    expect(updateRow).not.toHaveBeenCalled();
  });

  it("materializeRowContentSecure fails closed on hash mismatch", async () => {
    const decryptCiphertext = vi.fn().mockResolvedValue("hello");
    const hashPlaintext = vi.fn().mockResolvedValue("different-hash");

    await expect(
      materializeRowContentSecure(
        { ...baseRow },
        { keyId: "v1", version: 1 },
        {
          decryptCiphertext,
          encryptWithActiveKey: vi.fn(),
          hashPlaintext,
          updateRow: vi.fn(),
        },
      ),
    ).rejects.toMatchObject({
      code: "MD_INTEGRITY_MISMATCH",
      status: 409,
    });
  });

  it("materializeRowContentSecure backfills missing hash for ciphertext rows", async () => {
    const updateRow = vi.fn().mockResolvedValue(undefined);

    const row = await materializeRowContentSecure(
      {
        ...baseRow,
        content_sha256: null,
      },
      { keyId: "v1", version: 1 },
      {
        decryptCiphertext: vi.fn().mockResolvedValue("hello"),
        encryptWithActiveKey: vi.fn(),
        hashPlaintext: vi.fn().mockResolvedValue("hash-new"),
        updateRow,
      },
    );

    expect(updateRow).toHaveBeenCalledWith("row-1", { content_sha256: "hash-new" });
    expect(row.content_sha256).toBe("hash-new");
  });

  it("materializeRowContentSecure migrates legacy plaintext rows", async () => {
    const updateRow = vi.fn().mockResolvedValue(undefined);

    const row = await materializeRowContentSecure(
      {
        ...baseRow,
        content_md: "legacy text",
        content_md_ciphertext: null,
        content_sha256: null,
      },
      { keyId: "v2", version: 2 },
      {
        decryptCiphertext: vi.fn(),
        encryptWithActiveKey: vi.fn().mockResolvedValue("new-cipher"),
        hashPlaintext: vi.fn().mockResolvedValue("legacy-hash"),
        updateRow,
      },
    );

    expect(updateRow).toHaveBeenCalledWith(
      "row-1",
      expect.objectContaining({
        content_md_ciphertext: "new-cipher",
        encryption_version: 2,
        encryption_key_id: "v2",
        content_sha256: "legacy-hash",
        content_md: null,
      }),
    );
    expect(row.content_md).toBe("legacy text");
  });

  it("materializeRowContentSecure blocks read when legacy migration fails", async () => {
    const error = await materializeRowContentSecure(
      {
        ...baseRow,
        content_md: "legacy text",
        content_md_ciphertext: null,
        content_sha256: null,
      },
      { keyId: "v2", version: 2 },
      {
        decryptCiphertext: vi.fn(),
        encryptWithActiveKey: vi.fn().mockResolvedValue("new-cipher"),
        hashPlaintext: vi.fn().mockResolvedValue("legacy-hash"),
        updateRow: vi.fn().mockRejectedValue(new Error("db failed")),
      },
    ).catch((err) => err);

    expect(isMarkdownSecurityError(error)).toBe(true);
    expect(error).toMatchObject({
      code: "MD_LEGACY_MIGRATION_FAILED",
      status: 409,
    });
  });

  it("createPublicMarkdownRow strips content_md_ciphertext", () => {
    const publicRow = createPublicMarkdownRow({
      ...baseRow,
      content_md: "plain",
    });

    expect(publicRow).toMatchObject({
      id: "row-1",
      content_md: "plain",
    });
    expect("content_md_ciphertext" in publicRow).toBe(false);
  });
});
