import { describe, expect, it } from "vitest";
import { getOfferStatusMeta } from "@/shared/offers/offerStatus";
import { getOfferStatusMeta as getOfferStatusMetaFromLegacy } from "../utils/offerStatus";

describe("getOfferStatusMeta", () => {
  it("returns Czech labels for offer statuses", () => {
    expect(getOfferStatusMeta("offer").label).toBe("Nabídka");
    expect(getOfferStatusMeta("shortlist").label).toBe("Užší výběr");
    expect(getOfferStatusMeta("sod").label).toBe("SOD");
    expect(getOfferStatusMeta("rejected").label).toBe("Zamítnuto");
  });

  it("stays available from the legacy utils entrypoint", () => {
    expect(getOfferStatusMetaFromLegacy("contacted")).toEqual(getOfferStatusMeta("contacted"));
  });
});
