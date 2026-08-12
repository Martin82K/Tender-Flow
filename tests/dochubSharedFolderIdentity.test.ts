import { describe, expect, it } from "vitest";

import { DEFAULT_STRUCTURE_V1 } from "../supabase/functions/_shared/dochub_providers.ts";
import {
  getBaseSharedFolderName,
  getInquiryIdentityKeys,
  SHARED_BASE_LINK_KINDS,
} from "../supabase/functions/dochub-get-link/sharedFolderIdentity.ts";

describe("DocHub shared folder identity", () => {
  it("maps every supported top-level kind to the configured folder name", () => {
    expect(SHARED_BASE_LINK_KINDS).toEqual([
      "pd",
      "tenders",
      "contracts",
      "realization",
      "archive",
    ]);
    expect(SHARED_BASE_LINK_KINDS.map((kind) => getBaseSharedFolderName(kind, DEFAULT_STRUCTURE_V1)))
      .toEqual([
        DEFAULT_STRUCTURE_V1.pd,
        DEFAULT_STRUCTURE_V1.tenders,
        DEFAULT_STRUCTURE_V1.contracts,
        DEFAULT_STRUCTURE_V1.realization,
        DEFAULT_STRUCTURE_V1.archive,
      ]);
    expect(getBaseSharedFolderName("supplier", DEFAULT_STRUCTURE_V1)).toBeNull();
  });

  it("tries the current and legacy inquiry identities only for Google Drive", () => {
    expect(getInquiryIdentityKeys("gdrive", "category-1"))
      .toEqual(["category-1:inquiries", "category-1"]);
    expect(getInquiryIdentityKeys("onedrive", "category-1"))
      .toEqual(["category-1:inquiries"]);
  });
});
