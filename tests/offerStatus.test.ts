import { describe, expect, it } from "vitest";
import { getOfferStatusMeta } from "../utils/offerStatus";

describe("getOfferStatusMeta", () => {
  it("returns Czech labels for offer statuses", () => {
    expect(getOfferStatusMeta("offer").label).toBe("Nabídka");
    expect(getOfferStatusMeta("shortlist").label).toBe("Užší výběr");
    expect(getOfferStatusMeta("sod").label).toBe("SOD");
    expect(getOfferStatusMeta("rejected").label).toBe("Zamítnuto");
  });
});
