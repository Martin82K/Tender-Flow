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
  runId?: string;
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
      appProperties: {
        dochubProjectId: args.projectId,
        dochubKind: args.kind,
        dochubKey: args.key || "",
      },
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
  const requestedRunId = (rawBody?.runId as string) || null;
  let runId: string | null = requestedRunId;
  let runUserId: string | null = null;

  try {
    const authed = createAuthedUserClient(req);
    const { data: userData, error: userError } = await authed.auth.getUser();
    if (userError || !userData.user) return json(401, { error: "Unauthorized" });
    runUserId = userData.user.id;

    const projectId = requestedProjectId;
    if (!projectId) return json(400, { error: "Missing projectId" });
    if (!runId) runId = crypto.randomUUID();
    const service = createServiceClient();

    const persistRun = async (patch: Partial<{
      status: "running" | "success" | "error";
      provider: Provider | null;
      step: string | null;
      progress_percent: number;
      total_actions: number | null;
      completed_actions: number;
      logs: string[];
      error: string | null;
      finished_at: string | null;
    }>) => {
      const safeLogs = (patch.logs || []).slice(-200);
      await service
        .from("dochub_autocreate_runs")
        .upsert(
          {
            id: runId,
            project_id: projectId,
            user_id: runUserId,
            provider: (patch.provider as any) ?? null,
            status: patch.status || "running",
            step: patch.step ?? null,
            progress_percent: typeof patch.progress_percent === "number" ? patch.progress_percent : 0,
            total_actions: patch.total_actions ?? null,
            completed_actions: typeof patch.completed_actions === "number" ? patch.completed_actions : 0,
            logs: safeLogs,
            error: patch.error ?? null,
            finished_at: patch.finished_at ?? null,
          } as any,
          { onConflict: "id" }
        );
    };

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

    const pushLog = async (line: string) => {
      logs.push(line);
      await persistRun({
        status: "running",
        provider,
        step: line,
        logs,
      });
    };

    await persistRun({
      status: "running",
      provider,
      step: "Zahajuji auto‑vytváření složek…",
      progress_percent: 1,
      logs: ["Zahajuji auto‑vytváření složek…"],
    });

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

    const baseFoldersTotal = 5 + extraTopLevel.length;
    let completedActions = 0;
    let totalActions: number | null = null;
    let lastPersistAt = 0;
    const maybePersistProgress = async (step: string, force = false) => {
      const now = Date.now();
      if (!force && now - lastPersistAt < 350) return;
      lastPersistAt = now;
      const pct =
        totalActions && totalActions > 0
          ? Math.min(99, 10 + Math.round((completedActions / totalActions) * 89))
          : Math.min(20, Math.round((completedActions / Math.max(1, baseFoldersTotal)) * 20));
      await persistRun({
        status: "running",
        provider,
        step,
        progress_percent: pct,
        total_actions: totalActions,
        completed_actions: completedActions,
        logs,
      });
    };

    const pdId = await ensureBase("pd", structure.pd);
    completedActions += 1;
    await maybePersistProgress("Zakládám hlavní složky projektu…");
    const tendersId = await ensureBase("tenders", structure.tenders);
    completedActions += 1;
    await maybePersistProgress("Zakládám hlavní složky projektu…");
    await ensureBase("contracts", structure.contracts);
    completedActions += 1;
    await maybePersistProgress("Zakládám hlavní složky projektu…");
    await ensureBase("realization", structure.realization);
    completedActions += 1;
    await maybePersistProgress("Zakládám hlavní složky projektu…");
    await ensureBase("archive", structure.archive);
    completedActions += 1;
    await maybePersistProgress("Zakládám hlavní složky projektu…");

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
      completedActions += 1;
      await maybePersistProgress("Zakládám hlavní složky projektu…");
    }

    await pushLog("Načítám výběrová řízení (poptávky) z databáze…");
    await maybePersistProgress("Kontroluji existující výběrová řízení (VŘ)…", true);
    const { data: categories, error: categoriesError } = await authed
      .from("demand_categories")
      .select("id,title")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    if (categoriesError) throw new Error(categoriesError.message || "Failed to load demand_categories");

    const categoryList = (categories || []) as Array<{ id: string; title: string }>;
    await pushLog(`Nalezeno VŘ: ${categoryList.length}`);

    // Load suppliers for all categories (best effort)
    const categoryIds = categoryList.map((c) => c.id);
    const bidsByCategory: Record<string, Array<{ supplierId: string; supplierName: string }>> = {};
    if (categoryIds.length > 0) {
      const hydrateSuppliers = async (rows: Array<{ category_id: string; subcontractor_id: string | null }>) => {
        const supplierIds = Array.from(
          new Set(rows.map((r) => r.subcontractor_id).filter((v): v is string => typeof v === "string" && v.length > 0))
        );
        const supplierNameById = new Map<string, string>();
        if (supplierIds.length > 0) {
          const { data: subs, error: subsError } = await authed
            .from("subcontractors")
            .select("id, company_name")
            .in("id", supplierIds);
          if (subsError) {
            await pushLog(`⚠️ Nelze načíst dodavatele (subcontractors): ${subsError.message}`);
          } else {
            for (const sub of (subs || []) as any[]) {
              if (sub?.id) supplierNameById.set(String(sub.id), String(sub.company_name || sub.id));
            }
          }
        }

        for (const row of rows) {
          const categoryId = row.category_id;
          const supplierId = row.subcontractor_id;
          if (!supplierId) continue;
          if (!bidsByCategory[categoryId]) bidsByCategory[categoryId] = [];
          if (bidsByCategory[categoryId].some((s) => s.supplierId === supplierId)) continue;
          bidsByCategory[categoryId].push({
            supplierId,
            supplierName: supplierNameById.get(supplierId) || supplierId || "Dodavatel",
          });
        }
      };

      // Don't rely on PostgREST relationship cache (it may be stale/missing in some environments).
      // Fetch bids first, then hydrate supplier names via a separate query.
      const { data: plainBids, error: plainBidsError } = await authed
        .from("bids")
        .select("category_id, subcontractor_id")
        .in("category_id", categoryIds);

      if (plainBidsError) {
        await pushLog(`⚠️ Nelze načíst výběrová řízení dodavatelů (bids): ${plainBidsError.message}`);
      } else {
        await hydrateSuppliers((plainBids || []) as any[]);
      }
    }

    const suppliersTotal = Object.values(bidsByCategory).reduce((sum, arr) => sum + (arr?.length || 0), 0);
    const perSupplierBase = 3 + extraSupplier.length;
    const perCategoryBase = 2;
    totalActions = baseFoldersTotal + categoryList.length * perCategoryBase + suppliersTotal * perSupplierBase;
    await maybePersistProgress("Připravuji vytváření složek VŘ…", true);

    // Create tender folders
    for (let categoryIndex = 0; categoryIndex < categoryList.length; categoryIndex++) {
      const cat = categoryList[categoryIndex];
      const tenderFolderName = getTenderFolderName(cat.title);
      await pushLog(`VŘ: ${cat.title} → /${structure.tenders}/${tenderFolderName}`);
      await maybePersistProgress(`Zakládám VŘ ${categoryIndex + 1}/${categoryList.length}…`, true);
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
      completedActions += 1;
      await maybePersistProgress(`Zakládám VŘ ${categoryIndex + 1}/${categoryList.length}…`);

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
      completedActions += 1;
      await maybePersistProgress(`Zakládám VŘ ${categoryIndex + 1}/${categoryList.length}…`);

      const suppliers = bidsByCategory[cat.id] || [];
      if (suppliers.length === 0) {
        await pushLog(`  ↳ Dodavatelé: 0 (přeskočeno)`);
        continue;
      }
      await pushLog(`  ↳ Dodavatelé: ${suppliers.length}`);

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
        completedActions += 1;
        await maybePersistProgress("Zakládám složky dodavatelů…");

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
        completedActions += 1;
        await maybePersistProgress("Zakládám složky dodavatelů…");

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
        completedActions += 1;
        await maybePersistProgress("Zakládám složky dodavatelů…");

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
          completedActions += 1;
          await maybePersistProgress("Zakládám složky dodavatelů…");
        }
      }
    }

    await pushLog("Hotovo.");
    await persistRun({
      status: "success",
      provider,
      step: "Hotovo.",
      progress_percent: 100,
      total_actions: totalActions,
      completed_actions: completedActions,
      logs,
      finished_at: new Date().toISOString(),
      error: null,
    });

    const result: AutoCreateResult = {
      provider,
      projectId,
      rootId,
      driveId,
      runId,
      logs,
      createdCount,
      reusedCount,
    };

    // Store last run status (service role)
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

        if (runId && runUserId) {
          await service
            .from("dochub_autocreate_runs")
            .upsert(
              {
                id: runId,
                project_id: projectId,
                user_id: runUserId,
                status: "error",
                step: "Chyba",
                progress_percent: 100,
                error: message,
                finished_at: new Date().toISOString(),
              } as any,
              { onConflict: "id" }
            );
        }
      }
    } catch {
      // ignore
    }
    return json(500, { error: message });
  }
});
