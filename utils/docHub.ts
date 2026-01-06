export const DOC_HUB_STRUCTURE_V1 = {
  pd: "01_PD",
  tenders: "02_Vyberova_rizeni",
  contracts: "03_Smlouvy",
  realization: "04_Realizace",
  archive: "99_Archiv",
  tendersInquiries: "Poptavky",
  supplierEmail: "Email",
  supplierOffer: "Cenova_nabidka",
  ceniky: "05_Ceniky",

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
  { id: 'tenders', key: 'tenders', name: '02_Vyberova_rizeni', enabled: true, depth: 0 },
  { id: 'category', key: 'category', name: 'VR-001_Nazev_vyberoveho_rizeni', enabled: true, depth: 1 },
  { id: 'tendersInquiries', key: 'tendersInquiries', name: 'Poptavky', enabled: true, depth: 2 },
  { id: 'supplier', key: 'supplier', name: 'Dodavatel_X', enabled: true, depth: 3 },
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
    .replace(/[^\w\s-]/g, " ")
    .trim()
    .replace(/\s+/g, "_")
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
