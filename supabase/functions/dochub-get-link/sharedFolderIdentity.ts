import type { DocHubStructureV1, Provider } from "../_shared/dochub_providers.ts";

export type BaseSharedLinkKind = "pd" | "tenders" | "contracts" | "realization" | "archive";

export const SHARED_BASE_LINK_KINDS: readonly BaseSharedLinkKind[] = [
  "pd",
  "tenders",
  "contracts",
  "realization",
  "archive",
];

export const getBaseSharedFolderName = (
  kind: string,
  structure: DocHubStructureV1,
): string | null => {
  if (!SHARED_BASE_LINK_KINDS.includes(kind as BaseSharedLinkKind)) return null;
  return structure[kind as BaseSharedLinkKind];
};

export const getInquiryIdentityKeys = (
  provider: Provider,
  categoryId: string,
): readonly string[] => {
  const currentKey = `${categoryId}:inquiries`;
  return provider === "gdrive" ? [currentKey, categoryId] : [currentKey];
};
