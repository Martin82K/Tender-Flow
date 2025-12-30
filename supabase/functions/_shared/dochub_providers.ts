export type Provider = "gdrive" | "onedrive";

export type DocHubStructureV1 = {
  pd: string;
  tenders: string;
  contracts: string;
  realization: string;
  archive: string;
  tendersInquiries: string;
  supplierEmail: string;
  supplierOffer: string;
  extraTopLevel?: string[];
  extraSupplier?: string[];
};

export const DEFAULT_STRUCTURE_V1: DocHubStructureV1 = {
  pd: "01_PD",
  tenders: "02_Vyberova_rizeni",
  contracts: "03_Smlouvy",
  realization: "04_Realizace",
  archive: "99_Archiv",
  tendersInquiries: "Poptavky",
  supplierEmail: "Email",
  supplierOffer: "Cenova_nabidka",
};

export const getStructure = (
  overrides?: Partial<DocHubStructureV1> | null
): DocHubStructureV1 => ({
  ...DEFAULT_STRUCTURE_V1,
  ...(overrides || {}),
});

const googleApi = "https://www.googleapis.com/drive/v3";
const graphApi = "https://graph.microsoft.com/v1.0";

export const parseGoogleFolderId = (value: string): string | null => {
  const v = value.trim();
  const m1 = v.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
  if (m1?.[1]) return m1[1];
  const u = (() => {
    try {
      return new URL(v);
    } catch {
      return null;
    }
  })();
  const idParam = u?.searchParams.get("id");
  if (idParam) return idParam;
  const m2 = v.match(/([a-zA-Z0-9_-]{25,})/);
  return m2?.[1] || null;
};

const base64UrlEncode = (value: string): string => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

export const resolveMicrosoftSharingUrl = async (args: {
  accessToken: string;
  sharingUrl: string;
}): Promise<{ id: string; name: string; webUrl: string; driveId: string }> => {
  const encoded = `u!${base64UrlEncode(args.sharingUrl)}`;
  const res = await fetch(
    `${graphApi}/shares/${encoded}/driveItem?$select=id,name,webUrl,parentReference`,
    { headers: { Authorization: `Bearer ${args.accessToken}` } }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || "Failed to resolve OneDrive URL");
  const driveId = json?.parentReference?.driveId as string | undefined;
  if (!driveId) throw new Error("Missing driveId in resolved driveItem");
  return { id: json.id, name: json.name, webUrl: json.webUrl, driveId };
};

export const getGoogleFolderMeta = async (args: {
  accessToken: string;
  folderId: string;
}): Promise<{ id: string; name: string; webViewLink: string; driveId?: string }> => {
  const url = new URL(`${googleApi}/files/${encodeURIComponent(args.folderId)}`);
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("fields", "id,name,webViewLink,driveId,mimeType");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${args.accessToken}` } });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || "Failed to fetch Drive folder");
  if (json.mimeType !== "application/vnd.google-apps.folder") {
    throw new Error("Selected item is not a folder");
  }
  return { id: json.id, name: json.name, webViewLink: json.webViewLink, driveId: json.driveId };
};

export const findOrCreateGoogleFolder = async (args: {
  accessToken: string;
  parentId: string;
  name: string;
}): Promise<{ id: string; name: string; webViewLink: string }> => {
  const query = [
    `name='${args.name.replace(/'/g, "\\'")}'`,
    "mimeType='application/vnd.google-apps.folder'",
    `'${args.parentId}' in parents`,
    "trashed=false",
  ].join(" and ");

  const listUrl = new URL(`${googleApi}/files`);
  listUrl.searchParams.set("supportsAllDrives", "true");
  listUrl.searchParams.set("includeItemsFromAllDrives", "true");
  listUrl.searchParams.set("q", query);
  listUrl.searchParams.set("pageSize", "10");
  listUrl.searchParams.set("fields", "files(id,name,webViewLink)");

  const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${args.accessToken}` } });
  const listJson = await listRes.json();
  if (!listRes.ok) throw new Error(listJson?.error?.message || "Drive list failed");
  const existing = (listJson.files || [])[0];
  if (existing?.id) return { id: existing.id, name: existing.name, webViewLink: existing.webViewLink };

  const createUrl = new URL(`${googleApi}/files`);
  createUrl.searchParams.set("supportsAllDrives", "true");
  createUrl.searchParams.set("fields", "id,name,webViewLink");
  const createRes = await fetch(createUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      name: args.name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [args.parentId],
    }),
  });
  const createJson = await createRes.json();
  if (!createRes.ok) throw new Error(createJson?.error?.message || "Drive create failed");
  return { id: createJson.id, name: createJson.name, webViewLink: createJson.webViewLink };
};

export const findOrCreateMicrosoftFolder = async (args: {
  accessToken: string;
  driveId: string;
  parentId: string;
  name: string;
}): Promise<{ id: string; name: string; webUrl: string }> => {
  const listRes = await fetch(
    `${graphApi}/drives/${encodeURIComponent(args.driveId)}/items/${encodeURIComponent(
      args.parentId
    )}/children?$select=id,name,webUrl,folder&$top=200`,
    { headers: { Authorization: `Bearer ${args.accessToken}` } }
  );
  const listJson = await listRes.json();
  if (!listRes.ok) throw new Error(listJson?.error?.message || "Graph list failed");
  const existing = (listJson.value || []).find((c: any) => c?.folder && c?.name === args.name);
  if (existing?.id) return { id: existing.id, name: existing.name, webUrl: existing.webUrl };

  const createRes = await fetch(
    `${graphApi}/drives/${encodeURIComponent(args.driveId)}/items/${encodeURIComponent(
      args.parentId
    )}/children`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: args.name,
        folder: {},
        "@microsoft.graph.conflictBehavior": "fail",
      }),
    }
  );
  const createJson = await createRes.json();
  if (!createRes.ok) {
    // If it already exists (race), retry list quickly
    if (createJson?.error?.code === "nameAlreadyExists") {
      return await findOrCreateMicrosoftFolder(args);
    }
    throw new Error(createJson?.error?.message || "Graph create failed");
  }
  return { id: createJson.id, name: createJson.name, webUrl: createJson.webUrl };
};

export const getTenderFolderName = (title: string): string => slugifyDocHubSegment(title);

export const slugifyDocHubSegment = (value: string): string => {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " a ")
    .replace(/[^\w\s-]/g, " ")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
  return normalized || "Neznamy";
};
