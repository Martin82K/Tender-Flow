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
 * Desktop-specific version that builds path from saved hierarchy structure.
 * This reads the actual folder names from extraHierarchy and preserves diacritics.
 * Path is built by traversing: root -> tenders folder -> category folder -> supplier folder
 */
export const getDocHubTenderLinksDesktop = (
  root: string,
  tenderTitle: string,
  supplierName: string,
  overrides?: Partial<DocHubStructureV1> | null
): string => {
  const structure = overrides || {};
  const hierarchy = (structure as any).extraHierarchy as DocHubHierarchyItem[] | undefined;

  // Clean segment - only remove Windows-invalid chars, preserve diacritics
  const cleanSegment = (value: string): string => {
    return value.replace(/[<>:"|?*]/g, "").trim();
  };

  // If no hierarchy, fall back to simple structure
  if (!hierarchy || hierarchy.length === 0) {
    console.log('[DocHub] No hierarchy found, using simple fallback structure');
    const tendersFolder = "03_Vyberova_rizeni"; // Default
    return joinDocHubPath(root, tendersFolder, cleanSegment(tenderTitle), cleanSegment(supplierName));
  }

  // Find tenders folder from hierarchy (key === 'tenders')
  const tendersItem = hierarchy.find(item => item.key === 'tenders' && item.enabled !== false);
  const tendersFolder = tendersItem?.name || "03_Vyberova_rizeni";

  console.log('[DocHub] Building path from hierarchy:', {
    tendersFolder,
    tenderTitle,
    supplierName,
    hierarchyKeys: hierarchy.map(h => `${h.key}:${h.name}@depth${h.depth}`)
  });

  // Path: root / tenders folder / category title / supplier name
  // Supplier is directly under category (no intermediate folders like Poptavky)
  const fullPath = joinDocHubPath(
    root,
    tendersFolder,
    cleanSegment(tenderTitle),
    cleanSegment(supplierName)
  );

  console.log('[DocHub] Final desktop path:', fullPath);

  return fullPath;
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

