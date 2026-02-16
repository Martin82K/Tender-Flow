import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthedUserClient, createServiceClient } from "../_shared/supabase.ts";
import { decryptTextAesGcm, encryptTextAesGcm, sha256Hex } from "../_shared/crypto.ts";
import {
  createPublicMarkdownRow,
  isMarkdownSecurityError,
  materializeRowContentSecure,
} from "./markdownSecurity.ts";

type EntityType = "contract" | "amendment";
type SourceKind = "ocr" | "manual_edit" | "manual_upload" | "import";
type AccessKind = "view" | "download" | "export";
type Action = "list" | "latest" | "create" | "log_access";

type MarkdownRow = {
  id: string;
  entity_type: EntityType;
  contract_id: string | null;
  amendment_id: string | null;
  project_id: string;
  vendor_id: string | null;
  version_no: number;
  source_kind: SourceKind;
  source_file_name: string | null;
  source_document_url: string | null;
  ocr_provider: string | null;
  ocr_model: string | null;
  content_md: string | null;
  content_md_ciphertext: string | null;
  encryption_version: number | null;
  encryption_key_id: string | null;
  content_sha256: string | null;
  metadata: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string | null;
};

type AccessContext = {
  entityType: EntityType;
  entityId: string;
  contractId: string | null;
  amendmentId: string | null;
  projectId: string;
  vendorId: string | null;
};

type EncryptionContext = {
  keyId: string;
  version: number;
  key: string;
};

type ErrorCode =
  | "UNAUTHORIZED"
  | "MISSING_ACTION"
  | "INVALID_ENTITY_IDENTIFIER"
  | "ACCESS_DENIED"
  | "INVALID_CREATE_PAYLOAD"
  | "MISSING_ENTITY_ID"
  | "MISSING_EDIT_PERMISSION"
  | "MARKDOWN_CREATE_FAILED"
  | "INVALID_ACCESS_LOG_PAYLOAD"
  | "VERSION_NOT_FOUND"
  | "VERSION_INVALID_ENTITY_LINK"
  | "UNSUPPORTED_ACTION"
  | "INTERNAL_ERROR"
  | "MD_INTEGRITY_MISMATCH"
  | "MD_LEGACY_MIGRATION_FAILED"
  | "MD_CONTENT_UNREADABLE";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });

const jsonError = (
  status: number,
  error: string,
  code: ErrorCode,
  requestId: string,
) => json(status, { error, code, requestId });

const asEntityType = (value: unknown): EntityType | null =>
  value === "contract" || value === "amendment" ? value : null;

const asSourceKind = (value: unknown): SourceKind | null =>
  value === "ocr" || value === "manual_edit" || value === "manual_upload" || value === "import"
    ? value
    : null;

const asAccessKind = (value: unknown): AccessKind | null =>
  value === "view" || value === "download" || value === "export" ? value : null;

const getKeyForId = (keyId: string): string => {
  const normalized = keyId.trim();
  if (!normalized) throw new Error("Missing encryption key id");

  if (normalized === "v1") {
    const v1 = Deno.env.get("CONTRACT_MD_ENC_KEY_V1")?.trim();
    if (v1) return v1;
  }

  const envKey = `CONTRACT_MD_ENC_KEY_${normalized.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  const key = Deno.env.get(envKey)?.trim();
  if (!key) throw new Error(`Missing encryption key for key id: ${normalized}`);
  return key;
};

const getActiveEncryptionContext = (): EncryptionContext => {
  const keyId = (Deno.env.get("CONTRACT_MD_ENC_ACTIVE_KEY_ID") || "v1").trim() || "v1";
  const parsedVersion = Number.parseInt(
    (Deno.env.get("CONTRACT_MD_ENC_ACTIVE_VERSION") || "1").trim(),
    10,
  );
  const version = Number.isFinite(parsedVersion) && parsedVersion > 0 ? parsedVersion : 1;
  return {
    keyId,
    version,
    key: getKeyForId(keyId),
  };
};

const resolveEntityContext = async (
  authed: ReturnType<typeof createAuthedUserClient>,
  entityType: EntityType,
  entityId: string,
): Promise<AccessContext | null> => {
  if (entityType === "contract") {
    const { data, error } = await authed
      .from("contracts")
      .select("id, project_id, vendor_id")
      .eq("id", entityId)
      .maybeSingle();

    if (error || !data) return null;
    return {
      entityType,
      entityId: data.id as string,
      contractId: data.id as string,
      amendmentId: null,
      projectId: data.project_id as string,
      vendorId: (data.vendor_id as string | null) || null,
    };
  }

  const { data: amendment, error: amendmentError } = await authed
    .from("contract_amendments")
    .select("id, contract_id")
    .eq("id", entityId)
    .maybeSingle();

  if (amendmentError || !amendment) return null;

  const { data: contract, error: contractError } = await authed
    .from("contracts")
    .select("id, project_id, vendor_id")
    .eq("id", amendment.contract_id as string)
    .maybeSingle();

  if (contractError || !contract) return null;

  return {
    entityType,
    entityId: amendment.id as string,
    contractId: amendment.contract_id as string,
    amendmentId: amendment.id as string,
    projectId: contract.project_id as string,
    vendorId: (contract.vendor_id as string | null) || null,
  };
};

const canEditProject = async (
  service: ReturnType<typeof createServiceClient>,
  projectId: string,
  userId: string,
): Promise<boolean> => {
  const { data: project, error: projectError } = await service
    .from("projects")
    .select("id, owner_id")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError || !project) return false;
  if (project.owner_id === userId) return true;

  const { data: share } = await service
    .from("project_shares")
    .select("permission")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("permission", "edit")
    .maybeSingle();

  return !!share;
};

const sanitizeLimit = (value: unknown): number => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 20;
  return Math.min(parsed, 100);
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const requestId = req.headers.get("x-request-id")?.trim() || crypto.randomUUID();

  try {
    const authed = createAuthedUserClient(req);
    const service = createServiceClient();

    const { data: authData, error: authError } = await authed.auth.getUser();
    const user = authData?.user;
    if (authError || !user) {
      return jsonError(401, "Unauthorized", "UNAUTHORIZED", requestId);
    }

    const body = await req.json().catch(() => null);
    const action = (body?.action as Action | undefined) || null;
    if (!action) {
      return jsonError(400, "Missing action", "MISSING_ACTION", requestId);
    }

    const activeEncryption = getActiveEncryptionContext();

    if (action === "list" || action === "latest") {
      const entityType = asEntityType(body?.entityType);
      const entityId = typeof body?.entityId === "string" ? body.entityId.trim() : "";
      if (!entityType || !entityId) {
        return jsonError(
          400,
          "Invalid entity identifier",
          "INVALID_ENTITY_IDENTIFIER",
          requestId,
        );
      }

      const context = await resolveEntityContext(authed, entityType, entityId);
      if (!context) {
        return jsonError(403, "Access denied", "ACCESS_DENIED", requestId);
      }

      const entityColumn = entityType === "contract" ? "contract_id" : "amendment_id";
      const limit = action === "latest" ? 1 : sanitizeLimit(body?.limit);
      const { data, error } = await service
        .from("contract_markdown_versions")
        .select("*")
        .eq(entityColumn, entityId)
        .order("version_no", { ascending: false })
        .limit(limit);

      if (error) throw error;
      const rows = (data || []) as MarkdownRow[];
      const versions = await Promise.all(
        rows.map((row) =>
          materializeRowContentSecure(row, activeEncryption, {
            decryptCiphertext: async (ciphertext, keyId) => {
              const key = getKeyForId(keyId);
              return decryptTextAesGcm(ciphertext, key);
            },
            encryptWithActiveKey: async (plaintext) =>
              encryptTextAesGcm(plaintext, activeEncryption.key),
            hashPlaintext: sha256Hex,
            updateRow: async (rowId, patch) => {
              const { error: updateError } = await service
                .from("contract_markdown_versions")
                .update(patch)
                .eq("id", rowId);
              if (updateError) throw updateError;
            },
            logEvent: (event, payload) => {
              console.error("[contract-markdown-secure]", {
                event,
                requestId,
                ...payload,
              });
            },
          }),
        ),
      );
      const publicVersions = versions.map((version) => createPublicMarkdownRow(version));

      if (action === "latest") {
        return json(200, { version: publicVersions[0] || null });
      }
      return json(200, { versions: publicVersions });
    }

    if (action === "create") {
      const entityType = asEntityType(body?.entityType);
      const sourceKind = asSourceKind(body?.sourceKind);
      const contentMd = typeof body?.contentMd === "string" ? body.contentMd : "";
      const contractId = typeof body?.contractId === "string" ? body.contractId.trim() : "";
      const amendmentId = typeof body?.amendmentId === "string" ? body.amendmentId.trim() : "";

      if (!entityType || !sourceKind || !contentMd.trim()) {
        return jsonError(
          400,
          "Invalid create payload",
          "INVALID_CREATE_PAYLOAD",
          requestId,
        );
      }

      const entityId = entityType === "contract" ? contractId : amendmentId;
      if (!entityId) {
        return jsonError(400, "Missing entity id", "MISSING_ENTITY_ID", requestId);
      }

      const context = await resolveEntityContext(authed, entityType, entityId);
      if (!context) {
        return jsonError(403, "Access denied", "ACCESS_DENIED", requestId);
      }

      const hasEditPermission = await canEditProject(service, context.projectId, user.id);
      if (!hasEditPermission) {
        return jsonError(
          403,
          "Missing edit permission",
          "MISSING_EDIT_PERMISSION",
          requestId,
        );
      }

      const ciphertext = await encryptTextAesGcm(contentMd, activeEncryption.key);
      const contentHash = await sha256Hex(contentMd);

      const { data, error } = await service.rpc(
        "insert_contract_markdown_version_secure",
        {
          p_entity_type: entityType,
          p_contract_id: entityType === "contract" ? entityId : null,
          p_amendment_id: entityType === "amendment" ? entityId : null,
          p_source_kind: sourceKind,
          p_content_md_ciphertext: ciphertext,
          p_encryption_version: activeEncryption.version,
          p_encryption_key_id: activeEncryption.keyId,
          p_content_sha256: contentHash,
          p_source_file_name:
            typeof body?.sourceFileName === "string" ? body.sourceFileName : null,
          p_source_document_url:
            typeof body?.sourceDocumentUrl === "string" ? body.sourceDocumentUrl : null,
          p_ocr_provider: typeof body?.ocrProvider === "string" ? body.ocrProvider : null,
          p_ocr_model: typeof body?.ocrModel === "string" ? body.ocrModel : null,
          p_metadata:
            body?.metadata && typeof body.metadata === "object" ? body.metadata : {},
          p_created_by: user.id,
        },
      );

      if (error) throw error;
      const payload = (Array.isArray(data) ? data[0] : data) as MarkdownRow | null;
      if (!payload) {
        return jsonError(
          500,
          "Failed to store markdown version",
          "MARKDOWN_CREATE_FAILED",
          requestId,
        );
      }

      return json(200, {
        version: createPublicMarkdownRow({
          ...payload,
          content_md: contentMd,
          content_md_ciphertext: ciphertext,
          encryption_version: activeEncryption.version,
          encryption_key_id: activeEncryption.keyId,
          content_sha256: contentHash,
        }),
      });
    }

    if (action === "log_access") {
      const versionId =
        typeof body?.markdownVersionId === "string" ? body.markdownVersionId.trim() : "";
      const accessKind = asAccessKind(body?.accessKind);
      const accessSource =
        typeof body?.accessSource === "string" ? body.accessSource.trim() : "panel";

      if (!versionId || !accessKind) {
        return jsonError(
          400,
          "Invalid access log payload",
          "INVALID_ACCESS_LOG_PAYLOAD",
          requestId,
        );
      }

      const { data: versionRow, error: versionError } = await service
        .from("contract_markdown_versions")
        .select("id, entity_type, contract_id, amendment_id")
        .eq("id", versionId)
        .maybeSingle();

      if (versionError) throw versionError;
      if (!versionRow) {
        return jsonError(404, "Version not found", "VERSION_NOT_FOUND", requestId);
      }

      const versionEntityType = versionRow.entity_type as EntityType;
      const versionEntityId =
        versionEntityType === "contract"
          ? (versionRow.contract_id as string | null)
          : (versionRow.amendment_id as string | null);

      if (!versionEntityId) {
        return jsonError(
          500,
          "Version has invalid entity link",
          "VERSION_INVALID_ENTITY_LINK",
          requestId,
        );
      }

      const context = await resolveEntityContext(authed, versionEntityType, versionEntityId);
      if (!context) {
        return jsonError(403, "Access denied", "ACCESS_DENIED", requestId);
      }

      const { error: auditError } = await service.rpc("insert_contract_markdown_access_audit", {
        p_markdown_version_id: versionId,
        p_access_kind: accessKind,
        p_access_source: accessSource || "panel",
        p_created_by: user.id,
      });

      if (auditError) throw auditError;
      return json(200, { ok: true });
    }

    return jsonError(400, "Unsupported action", "UNSUPPORTED_ACTION", requestId);
  } catch (error) {
    if (isMarkdownSecurityError(error)) {
      console.error("[contract-markdown-secure]", {
        event: error.code,
        requestId,
      });
      return jsonError(error.status, error.message, error.code, requestId);
    }

    console.error("[contract-markdown-secure] Error:", {
      requestId,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return jsonError(500, "Internal server error", "INTERNAL_ERROR", requestId);
  }
});
