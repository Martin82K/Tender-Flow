export const DOC_HUB_STRUCTURE_V1 = {
  pd: "01_PD",
  pdChanges: "02_Zmeny_PD",
  tenders: "03_Vyberova_rizeni",
  contracts: "04_Smlouvy",
  realization: "05_Realizace",
  // ceniky: "05_Ceniky", // Conflict with realization or purely optional? Let's move it or keep as is if not strictly number-bound
  ceniky: "06_Ceniky",
  archive: "99_Archiv",
  tendersInquiries: "Poptavky",
  supplierEmail: "Email",
  supplierOffer: "Cenova_nabidka",
} as const;

export type DocHubHierarchyItem = {
  id: string;        // Unique ID (uuid for custom, key for builtins)
  key: string;       // 'tenders', 'category', 'tendersInquiries', 'supplier', 'custom'
  name: string;      // Display/folder name (editable for custom and some builtins)
  enabled: boolean;
  depth: number;     // Nesting level (0 = root children)
  children?: DocHubHierarchyItem[];
};

export const DEFAULT_DOCHUB_HIERARCHY: DocHubHierarchyItem[] = [
  { id: 'pd', key: 'pd', name: '01_PD', enabled: true, depth: 0 },
  { id: 'pdChanges', key: 'pdChanges', name: '02_Zmeny_PD', enabled: true, depth: 0 },
  { id: 'tenders', key: 'tenders', name: '03_Vyberova_rizeni', enabled: true, depth: 0 },
  { id: 'category', key: 'category', name: '{Název VŘ}', enabled: true, depth: 1 },
  { id: 'category_docs', key: 'custom', name: 'Dokumentace', enabled: true, depth: 2 }, // Example subfolder often desired
  { id: 'tendersInquiries', key: 'tendersInquiries', name: 'Poptavky', enabled: true, depth: 2 },
  { id: 'supplier', key: 'supplier', name: '{Název dodavatele}', enabled: true, depth: 3 },
  { id: 'contracts', key: 'contracts', name: '04_Smlouvy', enabled: true, depth: 0 },
  { id: 'realization', key: 'realization', name: '05_Realizace', enabled: true, depth: 0 },
  { id: 'archive', key: 'archive', name: '99_Archiv', enabled: true, depth: 0 },
];

export const buildHierarchyTree = (flatItems: DocHubHierarchyItem[]): DocHubHierarchyItem[] => {
  const root: DocHubHierarchyItem[] = [];
  // Stack stores items and their potential children arrays
  // Actually, we just need to track the current "parent" at each depth level
  const stack: { item: DocHubHierarchyItem, depth: number }[] = [];

  for (const flatItem of flatItems) {
    // Create a clean item for the tree (with children array initialized)
    // We remove 'depth' from the output tree if we want, but keeping it is harmless
    const itemWithChildren: DocHubHierarchyItem = { ...flatItem, children: [] };
    const currentDepth = flatItem.depth || 0;

    if (currentDepth === 0) {
      root.push(itemWithChildren);
      // Reset stack for new root
      stack.length = 0;
      stack.push({ item: itemWithChildren, depth: 0 });
    } else {
      // Find the nearest parent (item with depth < currentDepth)
      // Pop stack until we find a parent
      while (stack.length > 0 && stack[stack.length - 1].depth >= currentDepth) {
        stack.pop();
      }

      if (stack.length > 0) {
        const parent = stack[stack.length - 1].item;
        parent.children = parent.children || [];
        parent.children.push(itemWithChildren);
        // Push self to stack to potentially be parent of next items
        stack.push({ item: itemWithChildren, depth: currentDepth });
      } else {
        // No parent found (e.g. started with depth 2?), treat as root or adjust depth?
        // Let's treat as root for safety
        root.push(itemWithChildren);
        stack.push({ item: itemWithChildren, depth: currentDepth }); // Store as is
      }
    }
  }
  return root;
};

export type DocHubStructureV1 = typeof DOC_HUB_STRUCTURE_V1 & {
  extraTopLevel?: string[];
  extraSupplier?: string[];
  extraHierarchy?: DocHubHierarchyItem[];
};

const stripTrailingSeparators = (value: string) => value.replace(/[\\/]+$/, "");

export const isProbablyUrl = (value: string): boolean =>
  /^https?:\/\//i.test(value.trim());

const isIpv4Host = (host: string): boolean => {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  const parts = host.split(".").map(Number);
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255);
};

const isPrivateOrLocalIpv4 = (host: string): boolean => {
  if (!isIpv4Host(host)) return false;
  const [a, b] = host.split(".").map(Number);

  if (a === 10) return true; // RFC1918
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking

  return false;
};

const isPrivateOrLocalIpv6 = (host: string): boolean => {
  const normalized = host.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!normalized.includes(":")) return false;
  if (normalized === "::1") return true; // loopback
  if (normalized.startsWith("fe80:")) return true; // link-local
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique local
  return false;
};

export const isSafePublicHttpUrlForExternalShortener = (value: string): boolean => {
  const trimmed = value.trim();
  if (!isProbablyUrl(trimmed)) return false;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }

  const host = parsed.hostname.toLowerCase();
  if (!host) return false;
  if (host === "localhost" || host.endsWith(".local")) return false;
  if (!host.includes(".") && !isIpv4Host(host) && !host.includes(":")) return false;

  if (isPrivateOrLocalIpv4(host)) return false;
  if (isPrivateOrLocalIpv6(host)) return false;

  return true;
};

export const resolveDocHubStructureV1 = (
  overrides?: Partial<DocHubStructureV1> | null
): DocHubStructureV1 => ({
  ...DOC_HUB_STRUCTURE_V1,
  ...(overrides || {}),
});

export const slugifyDocHubSegment = (value: string): string => {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // diacritics
    .replace(/&/g, " a ")
    .replace(/[^\w\s-.]/g, "") // Keep words, spaces, dashes, dots. Remove others.
    .trim()
    .replace(/\s+/g, " "); // Collapse multiple spaces to single space

  return normalized || "Neznamy";
};

export const slugifyDocHubSegmentStrict = (value: string): string => {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " a ")
    .replace(/[^\w\s-]/g, " ") // Use backend rules: replace non-word/dash with space
    .trim()
    .replace(/\s+/g, "_")    // Replace spaces with underscores
    .replace(/_+/g, "_");
  return normalized || "Neznamy";
};

export const joinDocHubPath = (root: string, ...segments: string[]): string => {
  const cleanRoot = stripTrailingSeparators(root.trim());
  const cleanSegments = segments
    .filter(Boolean)
    .map((s) => s.trim())
    .map((s) => s.replace(/^[\\/]+/, "").replace(/[\\/]+$/, ""));

  if (!cleanRoot) return cleanSegments.join("/");

  if (isProbablyUrl(cleanRoot)) {
    return [cleanRoot, ...cleanSegments].join("/");
  }

  const useBackslash = /^[A-Za-z]:[\\/]/.test(cleanRoot) || cleanRoot.startsWith("\\\\");
  const sep = useBackslash ? "\\" : "/";
  return [cleanRoot, ...cleanSegments].join(sep);
};

export const getDocHubProjectLinks = (
  root: string,
  overrides?: Partial<DocHubStructureV1> | null
) => {
  const structure = resolveDocHubStructureV1(overrides);
  return {
    pd: joinDocHubPath(root, structure.pd),
    tenders: joinDocHubPath(root, structure.tenders),
    contracts: joinDocHubPath(root, structure.contracts),
    realization: joinDocHubPath(root, structure.realization),
    archive: joinDocHubPath(root, structure.archive),
    ceniky: joinDocHubPath(root, structure.ceniky),
  };
};

export const getDocHubTenderLinks = (
  root: string,
  tenderTitle: string,
  overrides?: Partial<DocHubStructureV1> | null
) => {
  const structure = resolveDocHubStructureV1(overrides);
  const tenderFolder = slugifyDocHubSegment(tenderTitle);

  const tenderBase = joinDocHubPath(root, structure.tenders, tenderFolder);
  const inquiriesBase = joinDocHubPath(tenderBase, structure.tendersInquiries);

  return {
    tenderBase,
    inquiriesBase,
    supplierBase: (supplierName: string) =>
      joinDocHubPath(inquiriesBase, slugifyDocHubSegment(supplierName)),
    supplierEmail: (supplierName: string) =>
      joinDocHubPath(inquiriesBase, slugifyDocHubSegment(supplierName), structure.supplierEmail),
    supplierOffer: (supplierName: string) =>
      joinDocHubPath(inquiriesBase, slugifyDocHubSegment(supplierName), structure.supplierOffer),
  };
};

/**
 * Returns the hierarchy to use for path/structure resolution.
 * Falls back to DEFAULT_DOCHUB_HIERARCHY when none is stored on the project.
 * This keeps auto-create (ensureStructure) and "Otevřít složku" aligned even before
 * the user explicitly saves a custom structure.
 */
export const ensureExtraHierarchy = (
  hierarchy?: DocHubHierarchyItem[] | null
): DocHubHierarchyItem[] =>
  hierarchy && hierarchy.length > 0 ? hierarchy : DEFAULT_DOCHUB_HIERARCHY;

/**
 * Walks a flat hierarchy array (as stored in docHubStructureV1.extraHierarchy)
 * and returns the chain of ancestors that lead to the first enabled node matching
 * the predicate, ending with the matched node itself.
 *
 * Works with flat+depth representation: the nearest preceding item with depth-1
 * is the parent, then depth-2, and so on.
 */
export const findHierarchyAncestors = (
  hierarchy: DocHubHierarchyItem[],
  predicate: (item: DocHubHierarchyItem) => boolean
): DocHubHierarchyItem[] => {
  const matchIndex = hierarchy.findIndex(
    (item) => predicate(item) && item.enabled !== false
  );
  if (matchIndex === -1) return [];

  const matched = hierarchy[matchIndex];
  const path: DocHubHierarchyItem[] = [];
  let targetDepth = (matched.depth ?? 0) - 1;

  for (let i = matchIndex - 1; i >= 0 && targetDepth >= 0; i--) {
    const item = hierarchy[i];
    if (item.enabled === false) continue;
    if ((item.depth ?? 0) === targetDepth) {
      path.unshift(item);
      targetDepth--;
    }
  }
  path.push(matched);
  return path;
};

/**
 * Desktop-specific version that builds path from saved hierarchy structure.
 * This reads the actual folder names from extraHierarchy and preserves diacritics.
 *
 * Crucially, it walks the WHOLE ancestor chain from `supplier` node upward,
 * so any intermediate folders configured by the user (e.g. "Poptavky",
 * "Dokumentace") are included in the path. This keeps the open-folder action
 * aligned with ensureStructure, which builds the same tree on disk.
 */
export const getDocHubTenderLinksDesktop = (
  root: string,
  tenderTitle: string,
  supplierName: string,
  overrides?: Partial<DocHubStructureV1> | null
): string => {
  const structure = overrides || {};
  const hierarchy = ensureExtraHierarchy(
    (structure as any).extraHierarchy as DocHubHierarchyItem[] | undefined
  );

  const cleanSegment = (value: string): string =>
    value.replace(/[<>:"|?*]/g, "").trim();

  const supplierPath = findHierarchyAncestors(
    hierarchy,
    (item) => item.key === "supplier" || item.name.includes("{Název dodavatele}")
  );

  // Safety fallback — if hierarchy has no supplier node at all
  if (supplierPath.length === 0) {
    const tendersItem = hierarchy.find(
      (item) => item.key === "tenders" && item.enabled !== false
    );
    const tendersFolder = tendersItem?.name || "03_Vyberova_rizeni";
    return joinDocHubPath(
      root,
      tendersFolder,
      cleanSegment(tenderTitle),
      cleanSegment(supplierName)
    );
  }

  const segments = supplierPath.map((item) => {
    if (item.key === "category" || item.name.includes("{Název VŘ}")) {
      return cleanSegment(tenderTitle);
    }
    if (item.key === "supplier" || item.name.includes("{Název dodavatele}")) {
      return cleanSegment(supplierName);
    }
    return cleanSegment(item.name);
  });

  return joinDocHubPath(root, ...segments);
};

/**
 * Simplified helper to get the tenders folder name from hierarchy
 */
export const getTendersFolderName = (
  overrides?: Partial<DocHubStructureV1> | null
): string => {
  const structure = overrides || {};
  const hierarchy = (structure as any).extraHierarchy as DocHubHierarchyItem[] | undefined;

  if (!hierarchy || hierarchy.length === 0) {
    return "03_Vyberova_rizeni"; // Default
  }

  const tendersItem = hierarchy.find(item => item.key === 'tenders' && item.enabled !== false);
  return tendersItem?.name || "03_Vyberova_rizeni";
};
