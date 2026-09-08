import { expect, it } from "vitest";
import { mergeConfirmedBids } from "@features/projects/model/pipelineBidPersistence";
import type { Bid } from "@/types";

it("preserves historical bids with the same supplier as separate commercial records", () => {
  const original: Bid = { id: "original", subcontractorId: "supplier", companyName: "Firma", contactPerson: "Kontakt", price: "100", status: "sod" };
  const historical: Bid = { ...original, id: "historical", price: "200", status: "offer" };
  expect(mergeConfirmedBids([original, historical], [original, historical])).toEqual([original, historical]);
});
