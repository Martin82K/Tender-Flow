import { corsHeaders, handleCors } from "../_shared/cors.ts";
import { createAuthedUserClient, createServiceClient } from "../_shared/supabase.ts";
import { getAccessTokenForUser } from "../_shared/tokens.ts";
import {
  findOrCreateGoogleFolder,
  findOrCreateMicrosoftFolder,
  getStructure,
  getTenderFolderName,
  type Provider,
} from "../_shared/dochub_providers.ts";

type LinkKind = "pd" | "tender_inquiries" | "supplier";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });

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
  kind: "pd" | "tenders" | "contracts" | "realization" | "archive";
  name: string;
}) => {
  const existing = await getStoredFolder({
    projectId: args.projectId,
    provider: args.provider,
    kind: args.kind,
    key: null,
  });
  if (existing?.item_id && existing.web_url) return existing;

  if (args.provider === "gdrive") {
    const folder = await findOrCreateGoogleFolder({
      accessToken: args.accessToken,
      parentId: args.rootId,
      name: args.name,
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

const ensureTenderInquiries = async (args: {
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
  const tenderExisting = await getStoredFolder({
    projectId: args.projectId,
    provider: args.provider,
    kind: "tender",
    key: tenderKey,
  });

  const tenderFolderName = getTenderFolderName(args.categoryTitle);
  const tenderFolder =
    tenderExisting?.item_id && tenderExisting.web_url
      ? tenderExisting
      : args.provider === "gdrive"
        ? await (async () => {
            const folder = await findOrCreateGoogleFolder({
              accessToken: args.accessToken,
              parentId: args.tendersFolderId,
              name: tenderFolderName,
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
              name: tenderFolderName,
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
  if (inquiriesExisting?.item_id && inquiriesExisting.web_url) return inquiriesExisting;

  if (args.provider === "gdrive") {
    const folder = await findOrCreateGoogleFolder({
      accessToken: args.accessToken,
      parentId: tenderFolder.item_id,
      name: args.inquiriesName,
    });
    await upsertFolder({
      projectId: args.projectId,
      provider: args.provider,
      kind: "tender_inquiries",
      key: inquiriesKey,
      itemId: folder.id,
      webUrl: folder.webViewLink,
    });
    return { item_id: folder.id, drive_id: null, web_url: folder.webViewLink };
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
  return { item_id: folder.id, drive_id: args.driveId, web_url: folder.webUrl };
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
    const kind = (body?.kind as LinkKind) || null;
    const categoryId = (body?.categoryId as string) || null;
    const categoryTitle = (body?.categoryTitle as string) || null;
    const supplierId = (body?.supplierId as string) || null;
    const supplierName = (body?.supplierName as string) || null;

    if (!projectId) return json(400, { error: "Missing projectId" });
    if (!kind || !["pd", "tender_inquiries", "supplier"].includes(kind)) return json(400, { error: "Invalid kind" });

    // Read project config through RLS
    const { data: project, error: projectError } = await authed
      .from("projects")
      .select(
        "id, dochub_provider, dochub_root_id, dochub_drive_id, dochub_structure_v1, dochub_enabled, dochub_status"
      )
      .eq("id", projectId)
      .maybeSingle();

    if (projectError || !project) return json(403, { error: "No access to project" });
    if (!project.dochub_enabled || project.dochub_status !== "connected") {
      return json(400, { error: "DocHub not connected" });
    }

    const provider = project.dochub_provider as Provider | null;
    const rootId = project.dochub_root_id as string | null;
    const driveId = (project.dochub_drive_id as string | null) || null;
    if (!provider || !rootId) return json(400, { error: "Missing DocHub root" });

    const structure = getStructure((project.dochub_structure_v1 as any) || null);
    const { accessToken } = await getAccessTokenForUser({
      userId: userData.user.id,
      provider,
    });

    // Ensure base folders
    const tendersFolder = await ensureProjectFolder({
      provider,
      accessToken,
      projectId,
      rootId,
      driveId,
      kind: "tenders",
      name: structure.tenders,
    });

    if (kind === "pd") {
      const pdFolder = await ensureProjectFolder({
        provider,
        accessToken,
        projectId,
        rootId,
        driveId,
        kind: "pd",
        name: structure.pd,
      });
      return json(200, { webUrl: pdFolder.web_url, itemId: pdFolder.item_id });
    }

    if (!categoryId || !categoryTitle) return json(400, { error: "Missing categoryId/categoryTitle" });

    const inquiriesFolder = await ensureTenderInquiries({
      provider,
      accessToken,
      projectId,
      rootId,
      driveId,
      tendersFolderId: tendersFolder.item_id,
      categoryId,
      categoryTitle,
      inquiriesName: structure.tendersInquiries,
    });

    if (kind === "tender_inquiries") {
      return json(200, { webUrl: inquiriesFolder.web_url, itemId: inquiriesFolder.item_id });
    }

    if (!supplierId || !supplierName) return json(400, { error: "Missing supplierId/supplierName" });
    const supplierKey = `${categoryId}:${supplierId}`;
    const supplierExisting = await getStoredFolder({
      projectId,
      provider,
      kind: "supplier",
      key: supplierKey,
    });
    if (supplierExisting?.item_id && supplierExisting.web_url) {
      return json(200, { webUrl: supplierExisting.web_url, itemId: supplierExisting.item_id });
    }

    const supplierFolderName = getTenderFolderName(supplierName);
    if (provider === "gdrive") {
      const folder = await findOrCreateGoogleFolder({
        accessToken,
        parentId: inquiriesFolder.item_id,
        name: supplierFolderName,
      });
      await upsertFolder({
        projectId,
        provider,
        kind: "supplier",
        key: supplierKey,
        itemId: folder.id,
        webUrl: folder.webViewLink,
      });
      return json(200, { webUrl: folder.webViewLink, itemId: folder.id });
    }

    if (!driveId) throw new Error("Missing driveId for OneDrive");
    const folder = await findOrCreateMicrosoftFolder({
      accessToken,
      driveId,
      parentId: inquiriesFolder.item_id,
      name: supplierFolderName,
    });
    await upsertFolder({
      projectId,
      provider,
      kind: "supplier",
      key: supplierKey,
      itemId: folder.id,
      driveId,
      webUrl: folder.webUrl,
    });
    return json(200, { webUrl: folder.webUrl, itemId: folder.id });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});

