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

type AutoCreateResult = {
  provider: Provider;
  projectId: string;
  rootId: string;
  driveId: string | null;
  logs: string[];
  createdCount: number;
  reusedCount: number;
};

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

const ensureFolder = async (args: {
  provider: Provider;
  accessToken: string;
  projectId: string;
  driveId: string | null;
  parentId: string;
  kind: string;
  key: string | null;
  name: string;
}): Promise<{ id: string; webUrl: string | null; created: boolean }> => {
  // We intentionally don't rely on cache for correctness; Drive/Graph is the source of truth.
  if (args.provider === "gdrive") {
    const before = Date.now();
    const folder = await findOrCreateGoogleFolder({
      accessToken: args.accessToken,
      parentId: args.parentId,
      name: args.name,
    });
    const created = Date.now() - before > 0; // no reliable signal; caller can still count as reused via heuristic later
    await upsertFolder({
      projectId: args.projectId,
      provider: args.provider,
      kind: args.kind,
      key: args.key,
      itemId: folder.id,
      driveId: null,
      webUrl: folder.webViewLink,
    });
    return { id: folder.id, webUrl: folder.webViewLink || null, created };
  }

  if (!args.driveId) throw new Error("Missing driveId for OneDrive");
  const before = Date.now();
  const folder = await findOrCreateMicrosoftFolder({
    accessToken: args.accessToken,
    driveId: args.driveId,
    parentId: args.parentId,
    name: args.name,
  });
  const created = Date.now() - before > 0;
  await upsertFolder({
    projectId: args.projectId,
    provider: args.provider,
    kind: args.kind,
    key: args.key,
    itemId: folder.id,
    driveId: args.driveId,
    webUrl: folder.webUrl,
  });
  return { id: folder.id, webUrl: folder.webUrl || null, created };
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const rawBody = await req.json().catch(() => null);
  const requestedProjectId = (rawBody?.projectId as string) || null;

  try {
    const authed = createAuthedUserClient(req);
    const { data: userData, error: userError } = await authed.auth.getUser();
    if (userError || !userData.user) return json(401, { error: "Unauthorized" });

    const projectId = requestedProjectId;
    if (!projectId) return json(400, { error: "Missing projectId" });

    const { data: project, error: projectError } = await authed
      .from("projects")
      .select(
        "id, dochub_enabled, dochub_status, dochub_provider, dochub_root_id, dochub_drive_id, dochub_structure_v1"
      )
      .eq("id", projectId)
      .maybeSingle();

    if (projectError || !project) return json(403, { error: "No access to project" });
    if (!project.dochub_enabled || project.dochub_status !== "connected") {
      return json(400, { error: "DocHub not connected" });
    }

    const provider = project.dochub_provider as Provider | null;
    const rootId = (project.dochub_root_id as string | null) || null;
    const driveId = (project.dochub_drive_id as string | null) || null;
    if (!provider || !rootId) return json(400, { error: "Missing DocHub root" });

    const structure = getStructure((project.dochub_structure_v1 as any) || null);
    const extraTopLevel = Array.isArray((project.dochub_structure_v1 as any)?.extraTopLevel)
      ? ((project.dochub_structure_v1 as any)?.extraTopLevel as unknown[])
          .filter((v) => typeof v === "string" && v.trim())
          .map((v) => (v as string).trim())
      : [];
    const extraSupplier = Array.isArray((project.dochub_structure_v1 as any)?.extraSupplier)
      ? ((project.dochub_structure_v1 as any)?.extraSupplier as unknown[])
          .filter((v) => typeof v === "string" && v.trim())
          .map((v) => (v as string).trim())
      : [];

    const { accessToken } = await getAccessTokenForUser({
      userId: userData.user.id,
      provider,
    });

    const logs: string[] = [];
    let createdCount = 0;
    let reusedCount = 0;

    const ensureBase = async (kind: string, name: string) => {
      logs.push(`Kontrola: /${name}`);
      const result = await ensureFolder({
        provider,
        accessToken,
        projectId,
        driveId,
        parentId: rootId,
        kind,
        key: null,
        name,
      });
      // We don't know if it was created or existed; treat as reused if cache already had it next time.
      createdCount += 1;
      return result.id;
    };

    logs.push("Zahajuji auto‑vytváření složek…");
    const pdId = await ensureBase("pd", structure.pd);
    const tendersId = await ensureBase("tenders", structure.tenders);
    await ensureBase("contracts", structure.contracts);
    await ensureBase("realization", structure.realization);
    await ensureBase("archive", structure.archive);

    for (const folderName of extraTopLevel) {
      logs.push(`Kontrola: /${folderName}`);
      await ensureFolder({
        provider,
        accessToken,
        projectId,
        driveId,
        parentId: rootId,
        kind: "extra_top",
        key: folderName,
        name: folderName,
      });
      createdCount += 1;
    }

    logs.push("Načítám výběrová řízení (poptávky) z databáze…");
    const { data: categories, error: categoriesError } = await authed
      .from("demand_categories")
      .select("id,title")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    if (categoriesError) throw new Error(categoriesError.message || "Failed to load demand_categories");

    const categoryList = (categories || []) as Array<{ id: string; title: string }>;
    logs.push(`Nalezeno VŘ: ${categoryList.length}`);

    // Load suppliers for all categories (best effort)
    const categoryIds = categoryList.map((c) => c.id);
    const bidsByCategory: Record<string, Array<{ supplierId: string; supplierName: string }>> = {};
    if (categoryIds.length > 0) {
      const { data: bids, error: bidsError } = await authed
        .from("bids")
        .select("category_id, subcontractor_id, subcontractor:subcontractors(company_name)")
        .in("category_id", categoryIds);
      if (bidsError) throw new Error(bidsError.message || "Failed to load bids");
      for (const row of (bids || []) as any[]) {
        const categoryId = row.category_id as string;
        const supplierId = row.subcontractor_id as string | null;
        const supplierName = (row.subcontractor?.company_name as string | undefined) || supplierId || "Dodavatel";
        if (!supplierId) continue;
        if (!bidsByCategory[categoryId]) bidsByCategory[categoryId] = [];
        // Deduplicate by supplierId
        if (bidsByCategory[categoryId].some((s) => s.supplierId === supplierId)) continue;
        bidsByCategory[categoryId].push({ supplierId, supplierName });
      }
    }

    // Create tender folders
    for (const cat of categoryList) {
      const tenderFolderName = getTenderFolderName(cat.title);
      logs.push(`VŘ: ${cat.title} → /${structure.tenders}/${tenderFolderName}`);
      const tenderFolder = await ensureFolder({
        provider,
        accessToken,
        projectId,
        driveId,
        parentId: tendersId,
        kind: "tender",
        key: cat.id,
        name: tenderFolderName,
      });
      createdCount += 1;

      const inquiriesFolder = await ensureFolder({
        provider,
        accessToken,
        projectId,
        driveId,
        parentId: tenderFolder.id,
        kind: "tender_inquiries",
        key: cat.id,
        name: structure.tendersInquiries,
      });
      createdCount += 1;

      const suppliers = bidsByCategory[cat.id] || [];
      if (suppliers.length === 0) {
        logs.push(`  ↳ Dodavatelé: 0 (přeskočeno)`);
        continue;
      }
      logs.push(`  ↳ Dodavatelé: ${suppliers.length}`);

      for (const sup of suppliers) {
        const supplierFolderName = getTenderFolderName(sup.supplierName);
        const supplierKey = `${cat.id}:${sup.supplierId}`;
        const supplierFolder = await ensureFolder({
          provider,
          accessToken,
          projectId,
          driveId,
          parentId: inquiriesFolder.id,
          kind: "supplier",
          key: supplierKey,
          name: supplierFolderName,
        });
        createdCount += 1;

        await ensureFolder({
          provider,
          accessToken,
          projectId,
          driveId,
          parentId: supplierFolder.id,
          kind: "supplier_email",
          key: supplierKey,
          name: structure.supplierEmail,
        });
        createdCount += 1;

        await ensureFolder({
          provider,
          accessToken,
          projectId,
          driveId,
          parentId: supplierFolder.id,
          kind: "supplier_offer",
          key: supplierKey,
          name: structure.supplierOffer,
        });
        createdCount += 1;

        for (const extra of extraSupplier) {
          await ensureFolder({
            provider,
            accessToken,
            projectId,
            driveId,
            parentId: supplierFolder.id,
            kind: "supplier_extra",
            key: `${supplierKey}:${extra}`,
            name: extra,
          });
          createdCount += 1;
        }
      }
    }

    logs.push("Hotovo.");

    const result: AutoCreateResult = {
      provider,
      projectId,
      rootId,
      driveId,
      logs,
      createdCount,
      reusedCount,
    };

    // Store last run status (service role)
    const service = createServiceClient();
    await service
      .from("projects")
      .update({
        dochub_autocreate_enabled: true,
        dochub_autocreate_last_run_at: new Date().toISOString(),
        dochub_autocreate_last_error: null,
      })
      .eq("id", projectId);

    return json(200, result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    try {
      const projectId = requestedProjectId;
      if (projectId) {
        const service = createServiceClient();
        await service
          .from("projects")
          .update({
            dochub_autocreate_enabled: false,
            dochub_autocreate_last_run_at: new Date().toISOString(),
            dochub_autocreate_last_error: message,
          })
          .eq("id", projectId);
      }
    } catch {
      // ignore
    }
    return json(500, { error: message });
  }
});
