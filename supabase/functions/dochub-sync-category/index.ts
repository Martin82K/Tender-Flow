import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthedUserClient, createServiceClient } from "../_shared/supabase.ts";
import { getAccessTokenForUser } from "../_shared/tokens.ts";
import {
  DEFAULT_STRUCTURE_V1,
  findOrCreateGoogleFolder,
  findOrCreateMicrosoftFolder,
  getStructure,
  getTenderFolderName,
  type Provider,
} from "../_shared/dochub_providers.ts";

type Action = "upsert" | "archive";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });

const googleApi = "https://www.googleapis.com/drive/v3";
const graphApi = "https://graph.microsoft.com/v1.0";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithRetry = async (input: RequestInfo | URL, init: RequestInit & { tries?: number } = {}) => {
  const tries = init.tries ?? 4;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < tries; attempt++) {
    const res = await fetch(input, init);
    if (res.ok) return res;
    // Retry on throttling / transient failures
    if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
      lastErr = new Error(`HTTP ${res.status}`);
      const retryAfter = Number(res.headers.get("retry-after") || "");
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 700 * Math.pow(2, attempt);
      await sleep(Math.min(60_000, waitMs));
      continue;
    }
    return res;
  }
  throw lastErr instanceof Error ? lastErr : new Error("Rate limit / retry failed");
};

const upsertFolder = async (args: {
  projectId: string;
  provider: Provider;
  kind: string;
  key: string | null;
  itemId: string;
  driveId?: string | null;
  webUrl?: string | null;
}) => {
  const service = createServiceClient();
  await service.from("dochub_project_folders").upsert({
    project_id: args.projectId,
    provider: args.provider,
    kind: args.kind,
    key: args.key,
    item_id: args.itemId,
    drive_id: args.driveId || null,
    web_url: args.webUrl || null,
    updated_at: new Date().toISOString(),
  });
};

const getStoredFolder = async (args: {
  projectId: string;
  provider: Provider;
  kind: string;
  key: string | null;
}) => {
  const service = createServiceClient();
  const { data } = await service
    .from("dochub_project_folders")
    .select("*")
    .eq("project_id", args.projectId)
    .eq("provider", args.provider)
    .eq("kind", args.kind)
    .eq("key", args.key)
    .maybeSingle();
  return data as
    | { item_id: string; drive_id: string | null; web_url: string | null }
    | null;
};

const ensureProjectFolder = async (args: {
  provider: Provider;
  accessToken: string;
  projectId: string;
  rootId: string;
  driveId?: string | null;
  kind: keyof typeof DEFAULT_STRUCTURE_V1;
  name: string;
}) => {
  const existing = await getStoredFolder({
    projectId: args.projectId,
    provider: args.provider,
    kind: args.kind,
    key: null,
  });
  if (existing?.item_id) return existing;

  if (args.provider === "gdrive") {
    const folder = await findOrCreateGoogleFolder({
      accessToken: args.accessToken,
      parentId: args.rootId,
      name: args.name,
      appProperties: {
        dochubProjectId: args.projectId,
        dochubKind: args.kind,
        dochubKey: "",
      },
    });
    await upsertFolder({
      projectId: args.projectId,
      provider: args.provider,
      kind: args.kind,
      key: null,
      itemId: folder.id,
      webUrl: folder.webViewLink,
    });
    return { item_id: folder.id, drive_id: null, web_url: folder.webViewLink };
  }

  if (!args.driveId) throw new Error("Missing driveId for OneDrive");
  const folder = await findOrCreateMicrosoftFolder({
    accessToken: args.accessToken,
    driveId: args.driveId,
    parentId: args.rootId,
    name: args.name,
  });
  await upsertFolder({
    projectId: args.projectId,
    provider: args.provider,
    kind: args.kind,
    key: null,
    itemId: folder.id,
    driveId: args.driveId,
    webUrl: folder.webUrl,
  });
  return { item_id: folder.id, drive_id: args.driveId, web_url: folder.webUrl };
};

const ensureTenderAndInquiries = async (args: {
  provider: Provider;
  accessToken: string;
  projectId: string;
  rootId: string;
  driveId?: string | null;
  tendersFolderId: string;
  categoryId: string;
  categoryTitle: string;
  inquiriesName: string;
}) => {
  const tenderKey = args.categoryId;
  const tenderName = getTenderFolderName(args.categoryTitle);

  const tenderExisting = await getStoredFolder({
    projectId: args.projectId,
    provider: args.provider,
    kind: "tender",
    key: tenderKey,
  });

  const tenderFolder =
    tenderExisting?.item_id
      ? tenderExisting
      : args.provider === "gdrive"
        ? await (async () => {
            const folder = await findOrCreateGoogleFolder({
              accessToken: args.accessToken,
              parentId: args.tendersFolderId,
              name: tenderName,
              appProperties: {
                dochubProjectId: args.projectId,
                dochubKind: "tender",
                dochubKey: tenderKey,
              },
            });
            await upsertFolder({
              projectId: args.projectId,
              provider: args.provider,
              kind: "tender",
              key: tenderKey,
              itemId: folder.id,
              webUrl: folder.webViewLink,
            });
            return { item_id: folder.id, drive_id: null, web_url: folder.webViewLink };
          })()
        : await (async () => {
            if (!args.driveId) throw new Error("Missing driveId for OneDrive");
            const folder = await findOrCreateMicrosoftFolder({
              accessToken: args.accessToken,
              driveId: args.driveId,
              parentId: args.tendersFolderId,
              name: tenderName,
            });
            await upsertFolder({
              projectId: args.projectId,
              provider: args.provider,
              kind: "tender",
              key: tenderKey,
              itemId: folder.id,
              driveId: args.driveId,
              webUrl: folder.webUrl,
            });
            return { item_id: folder.id, drive_id: args.driveId, web_url: folder.webUrl };
          })();

  const inquiriesKey = `${args.categoryId}:inquiries`;
  const inquiriesExisting = await getStoredFolder({
    projectId: args.projectId,
    provider: args.provider,
    kind: "tender_inquiries",
    key: inquiriesKey,
  });
  if (inquiriesExisting?.item_id) return { tender: tenderFolder, inquiries: inquiriesExisting };

  if (args.provider === "gdrive") {
    const folder = await findOrCreateGoogleFolder({
      accessToken: args.accessToken,
      parentId: tenderFolder.item_id,
      name: args.inquiriesName,
      appProperties: {
        dochubProjectId: args.projectId,
        dochubKind: "tender_inquiries",
        dochubKey: inquiriesKey,
      },
    });
    await upsertFolder({
      projectId: args.projectId,
      provider: args.provider,
      kind: "tender_inquiries",
      key: inquiriesKey,
      itemId: folder.id,
      webUrl: folder.webViewLink,
    });
    return { tender: tenderFolder, inquiries: { item_id: folder.id, drive_id: null, web_url: folder.webViewLink } };
  }

  if (!args.driveId) throw new Error("Missing driveId for OneDrive");
  const folder = await findOrCreateMicrosoftFolder({
    accessToken: args.accessToken,
    driveId: args.driveId,
    parentId: tenderFolder.item_id,
    name: args.inquiriesName,
  });
  await upsertFolder({
    projectId: args.projectId,
    provider: args.provider,
    kind: "tender_inquiries",
    key: inquiriesKey,
    itemId: folder.id,
    driveId: args.driveId,
    webUrl: folder.webUrl,
  });
  return { tender: tenderFolder, inquiries: { item_id: folder.id, drive_id: args.driveId, web_url: folder.webUrl } };
};

const moveGoogleFolderToParent = async (args: { accessToken: string; folderId: string; newParentId: string }) => {
  const metaUrl = new URL(`${googleApi}/files/${encodeURIComponent(args.folderId)}`);
  metaUrl.searchParams.set("supportsAllDrives", "true");
  metaUrl.searchParams.set("fields", "id,parents");
  const metaRes = await fetchWithRetry(metaUrl, { headers: { Authorization: `Bearer ${args.accessToken}` } });
  const metaJson = await metaRes.json();
  if (!metaRes.ok) throw new Error(metaJson?.error?.message || "Drive get failed");
  const parents: string[] = Array.isArray(metaJson.parents) ? metaJson.parents : [];

  const patchUrl = new URL(`${googleApi}/files/${encodeURIComponent(args.folderId)}`);
  patchUrl.searchParams.set("supportsAllDrives", "true");
  patchUrl.searchParams.set("addParents", args.newParentId);
  if (parents.length) patchUrl.searchParams.set("removeParents", parents.join(","));
  const patchRes = await fetchWithRetry(patchUrl, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${args.accessToken}` },
  });
  if (!patchRes.ok) {
    const patchJson = await patchRes.json().catch(() => null);
    throw new Error(patchJson?.error?.message || "Drive move failed");
  }
};

const moveMicrosoftFolderToParent = async (args: {
  accessToken: string;
  driveId: string;
  itemId: string;
  newParentId: string;
}) => {
  const url = `${graphApi}/drives/${encodeURIComponent(args.driveId)}/items/${encodeURIComponent(args.itemId)}`;
  const res = await fetchWithRetry(url, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${args.accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ parentReference: { id: args.newParentId } }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error?.message || "Graph move failed");
  }
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const authed = createAuthedUserClient(req);
    const { data: userData, error: userError } = await authed.auth.getUser();
    if (userError || !userData.user) return json(401, { error: "Unauthorized" });

    const body = await req.json().catch(() => null);
    const projectId = (body?.projectId as string) || null;
    const categoryId = (body?.categoryId as string) || null;
    const action = (body?.action as Action) || "upsert";
    const categoryTitle = (body?.categoryTitle as string) || null;
    if (!projectId) return json(400, { error: "Missing projectId" });
    if (!categoryId) return json(400, { error: "Missing categoryId" });
    if (action !== "upsert" && action !== "archive") return json(400, { error: "Invalid action" });

    const { data: project, error: projectError } = await authed
      .from("projects")
      .select("id, dochub_enabled, dochub_status, dochub_provider, dochub_root_id, dochub_drive_id, dochub_structure_v1")
      .eq("id", projectId)
      .maybeSingle();
    if (projectError || !project) return json(403, { error: "No access to project" });
    if (!project.dochub_enabled || project.dochub_status !== "connected") {
      return json(200, { ok: true, skipped: true, reason: "DocHub not connected" });
    }

    const provider = project.dochub_provider as Provider | null;
    const rootId = (project.dochub_root_id as string | null) || null;
    const driveId = (project.dochub_drive_id as string | null) || null;
    if (!provider || !rootId) return json(400, { error: "Missing DocHub root" });

    const structure = getStructure((project.dochub_structure_v1 as any) || null);
    const { accessToken } = await getAccessTokenForUser({ userId: userData.user.id, provider });

    // Ensure base folders we need
    const tendersFolder = await ensureProjectFolder({
      provider,
      accessToken,
      projectId,
      rootId,
      driveId: driveId || undefined,
      kind: "tenders",
      name: structure.tenders,
    });

    if (action === "upsert") {
      // Load title if not provided (when called from UI trigger after insert we have it; for safety fetch)
      const title =
        categoryTitle ||
        (
          await authed
            .from("demand_categories")
            .select("title")
            .eq("id", categoryId)
            .maybeSingle()
        ).data?.title ||
        "Vyberove_rizeni";

      const res = await ensureTenderAndInquiries({
        provider,
        accessToken,
        projectId,
        rootId,
        driveId: driveId || undefined,
        tendersFolderId: tendersFolder.item_id,
        categoryId,
        categoryTitle: title,
        inquiriesName: structure.tendersInquiries,
      });

      return json(200, { ok: true, action, tenderId: res.tender.item_id, inquiriesId: res.inquiries.item_id });
    }

    // archive/delete on category removal: move tender folder under Archive/_Smazana_VR
    const service = createServiceClient();
    const tenderExisting = await getStoredFolder({ projectId, provider, kind: "tender", key: categoryId });
    if (!tenderExisting?.item_id) {
      // Still clean up DB mappings just in case
      await service
        .from("dochub_project_folders")
        .delete()
        .eq("project_id", projectId)
        .eq("provider", provider)
        .or(`key.eq.${categoryId},key.like.${categoryId}:%`);
      return json(200, { ok: true, action, skipped: true, reason: "Tender folder not found" });
    }

    const archiveFolder = await ensureProjectFolder({
      provider,
      accessToken,
      projectId,
      rootId,
      driveId: driveId || undefined,
      kind: "archive",
      name: structure.archive,
    });

    const deletedParentName = "_Smazana_VR";
    const deletedParentKey = "deleted_vr";
    const deletedParent =
      provider === "gdrive"
        ? await (async () => {
            const folder = await findOrCreateGoogleFolder({
              accessToken,
              parentId: archiveFolder.item_id,
              name: deletedParentName,
              appProperties: {
                dochubProjectId: projectId,
                dochubKind: "archive_deleted_vr",
                dochubKey: deletedParentKey,
              },
            });
            return { id: folder.id, driveId: null as string | null };
          })()
        : await (async () => {
            if (!driveId) throw new Error("Missing driveId for OneDrive");
            const folder = await findOrCreateMicrosoftFolder({
              accessToken,
              driveId,
              parentId: archiveFolder.item_id,
              name: deletedParentName,
            });
            return { id: folder.id, driveId };
          })();

    if (provider === "gdrive") {
      await moveGoogleFolderToParent({ accessToken, folderId: tenderExisting.item_id, newParentId: deletedParent.id });
    } else {
      if (!driveId) throw new Error("Missing driveId for OneDrive");
      await moveMicrosoftFolderToParent({
        accessToken,
        driveId,
        itemId: tenderExisting.item_id,
        newParentId: deletedParent.id,
      });
    }

    // Clean up cached mappings for this category + descendants
    await service
      .from("dochub_project_folders")
      .delete()
      .eq("project_id", projectId)
      .eq("provider", provider)
      .or(`key.eq.${categoryId},key.like.${categoryId}:%`);

    return json(200, { ok: true, action, archivedTo: deletedParentName });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    // Normalize rate limit message for UI
    if (message.includes("429") || message.toLowerCase().includes("rate")) {
      return json(429, { error: "Příliš mnoho požadavků na Drive/Graph. Počkejte 1 minutu a zkuste to znovu." });
    }
    return json(500, { error: message });
  }
});

