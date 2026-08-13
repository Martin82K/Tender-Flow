import { createServiceClient } from "../_shared/supabase.ts";
import { getAccessTokenForUser } from "../_shared/tokens.ts";
import {
  findGoogleFolder,
  findMicrosoftFolder,
  getTenderFolderName,
  type DocHubStructureV1,
  type Provider,
} from "../_shared/dochub_providers.ts";
import {
  getBaseSharedFolderName,
  getInquiryIdentityKeys,
  type BaseSharedLinkKind,
} from "./sharedFolderIdentity.ts";

export type SharedLinkKind = BaseSharedLinkKind | "tender" | "tender_inquiries" | "supplier";

export type ResolvedFolder = {
  item_id: string;
  drive_id: string | null;
  web_url: string;
};

const cacheResolvedFolder = async (args: {
  projectId: string;
  rootId: string;
  provider: Provider;
  kind: string;
  key: string | null;
  folder: ResolvedFolder;
}) => {
  const service = createServiceClient();
  await service.from("dochub_project_folders").upsert({
    project_id: args.projectId,
    root_id: args.rootId,
    provider: args.provider,
    kind: args.kind,
    key: args.key ?? "",
    item_id: args.folder.item_id,
    drive_id: args.folder.drive_id,
    web_url: args.folder.web_url,
    updated_at: new Date().toISOString(),
  });
};

const findExistingFolder = async (args: {
  provider: Provider;
  accessToken: string;
  driveId?: string | null;
  parentId: string;
  name: string;
  appProperties?: Record<string, string>;
}): Promise<ResolvedFolder | null> => {
  if (args.provider === "gdrive") {
    const folder = await findGoogleFolder({
      accessToken: args.accessToken,
      parentId: args.parentId,
      name: args.name,
      appProperties: args.appProperties,
    });
    return folder
      ? { item_id: folder.id, drive_id: null, web_url: folder.webViewLink }
      : null;
  }
  if (!args.driveId) return null;
  const folder = await findMicrosoftFolder({
    accessToken: args.accessToken,
    driveId: args.driveId,
    parentId: args.parentId,
    name: args.name,
  });
  return folder
    ? { item_id: folder.id, drive_id: args.driveId, web_url: folder.webUrl }
    : null;
};

export const resolveSharedFolderLink = async (args: {
  projectId: string;
  ownerId: string;
  requestingUserId: string;
  provider: Provider;
  rootId: string;
  driveId?: string | null;
  kind: SharedLinkKind;
  categoryId?: string | null;
  supplierId?: string | null;
  structure: DocHubStructureV1;
}): Promise<ResolvedFolder | null> => {
  const service = createServiceClient();
  const baseFolderName = getBaseSharedFolderName(args.kind, args.structure);
  const getOwnerFolderFinder = async () => {
    const usePersonalMicrosoftGrant = args.provider === "onedrive";
    const { accessToken } = await getAccessTokenForUser({
      userId: usePersonalMicrosoftGrant ? args.requestingUserId : args.ownerId,
      provider: args.provider,
      accessKind: usePersonalMicrosoftGrant ? "personal_read" : "manage",
    });
    return (parentId: string, name: string, appProperties?: Record<string, string>) =>
      findExistingFolder({ ...args, accessToken, parentId, name, appProperties });
  };

  if (baseFolderName) {
    const find = await getOwnerFolderFinder();
    const baseFolder = await find(args.rootId, baseFolderName, {
      dochubProjectId: args.projectId,
      dochubKind: args.kind,
    });
    if (!baseFolder) return null;
    await cacheResolvedFolder({ ...args, kind: args.kind, key: null, folder: baseFolder });
    return baseFolder;
  }

  const categoryId = args.categoryId;
  if (!categoryId) return null;
  const { data: category } = await service
    .from("demand_categories")
    .select("id,title")
    .eq("id", categoryId)
    .eq("project_id", args.projectId)
    .maybeSingle();
  if (!category?.id || typeof category.title !== "string") return null;

  const supplierFolderNames: string[] = [];
  if (args.kind === "supplier") {
    if (!args.supplierId) return null;
    const { data: bid } = await service
      .from("bids")
      .select("subcontractor_id,company_name")
      .eq("demand_category_id", categoryId)
      .eq("subcontractor_id", args.supplierId)
      .limit(1)
      .maybeSingle();
    if (!bid?.subcontractor_id) return null;
    const { data: supplier } = await service
      .from("subcontractors")
      .select("company_name")
      .eq("id", bid.subcontractor_id)
      .maybeSingle();
    if (typeof supplier?.company_name !== "string" || !supplier.company_name.trim()) return null;
    supplierFolderNames.push(supplier.company_name);
    if (typeof bid.company_name === "string" && bid.company_name.trim()) {
      supplierFolderNames.push(bid.company_name);
    }
  }

  const find = await getOwnerFolderFinder();

  const tendersFolder = await find(args.rootId, args.structure.tenders, {
    dochubProjectId: args.projectId,
    dochubKind: "tenders",
  });
  if (!tendersFolder) return null;
  await cacheResolvedFolder({ ...args, kind: "tenders", key: null, folder: tendersFolder });

  const tenderFolder = await find(tendersFolder.item_id, getTenderFolderName(category.title), {
    dochubProjectId: args.projectId,
    dochubKind: "tender",
    dochubKey: categoryId,
  });
  if (!tenderFolder) return null;
  await cacheResolvedFolder({ ...args, kind: "tender", key: categoryId, folder: tenderFolder });
  if (args.kind === "tender") return tenderFolder;

  const inquiriesKey = `${categoryId}:inquiries`;
  const inquiryKeys = getInquiryIdentityKeys(args.provider, categoryId);
  let inquiriesFolder: ResolvedFolder | null = null;
  for (const inquiryKey of inquiryKeys) {
    if (!inquiryKey) continue;
    inquiriesFolder = await find(tenderFolder.item_id, args.structure.tendersInquiries, {
      dochubProjectId: args.projectId,
      dochubKind: "tender_inquiries",
      dochubKey: inquiryKey,
    });
    if (inquiriesFolder) break;
  }
  if (!inquiriesFolder) return null;
  await cacheResolvedFolder({ ...args, kind: "tender_inquiries", key: inquiriesKey, folder: inquiriesFolder });
  if (args.kind === "tender_inquiries") return inquiriesFolder;

  const supplierKey = `${categoryId}:${args.supplierId}`;
  let supplierFolder: ResolvedFolder | null = null;
  for (const supplierName of [...new Set(supplierFolderNames)]) {
    supplierFolder = await find(inquiriesFolder.item_id, getTenderFolderName(supplierName), {
      dochubProjectId: args.projectId,
      dochubKind: "supplier",
      dochubKey: supplierKey,
    });
    if (supplierFolder) break;
  }
  if (!supplierFolder) return null;
  await cacheResolvedFolder({ ...args, kind: "supplier", key: supplierKey, folder: supplierFolder });
  return supplierFolder;
};
