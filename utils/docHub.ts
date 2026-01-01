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

export type DocHubStructureV1 = typeof DOC_HUB_STRUCTURE_V1 & {
  extraTopLevel?: string[];
  extraSupplier?: string[];
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
