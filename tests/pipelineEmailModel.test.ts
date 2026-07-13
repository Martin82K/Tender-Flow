import { describe, expect, it } from "vitest";
import {
  buildBccRecipientList,
  isValidEmailAddress,
  selectBulkInquiryRecipients,
  selectLoserEmailRecipients,
} from "../features/projects/model/pipelineEmailModel";
import type { Bid } from "../types";

describe("buildBccRecipientList", () => {
  it("joins emails with semicolon", () => {
    expect(buildBccRecipientList(["a@x.cz", "b@x.cz"])).toBe("a@x.cz;b@x.cz");
  });

  it("ignores empty values, trims values and deduplicates", () => {
    expect(
      buildBccRecipientList([
        " a@x.cz ",
        "",
        "   ",
        "a@x.cz",
        "b@x.cz",
        "b@x.cz",
      ]),
    ).toBe("a@x.cz;b@x.cz");
  });

  it("deduplikuje adresy bez ohledu na velikost písmen", () => {
    expect(buildBccRecipientList(["A@X.cz", "a@x.CZ", "b@x.cz"])).toBe(
      "A@X.cz;b@x.cz",
    );
  });

  it("vynechá neplatné adresy a pokusy o vložení hlavičky", () => {
    expect(
      buildBccRecipientList([
        "valid@example.com",
        "invalid",
        "safe@example.com\r\nBcc: attacker@example.com",
      ]),
    ).toBe("valid@example.com");
  });
});

const createBid = (overrides: Partial<Bid>): Bid =>
  ({
    id: overrides.id || "bid-1",
    subcontractorId: overrides.subcontractorId || "supplier-1",
    companyName: overrides.companyName || "Dodavatel",
    contactPerson: "Kontakt",
    status: "contacted",
    ...overrides,
  }) as Bid;

describe("pipeline email recipient selection", () => {
  it("vybere pro hromadnou poptávku pouze platné adresy z Oslovení", () => {
    const selection = selectBulkInquiryRecipients([
      createBid({ id: "eligible", email: " valid@example.com " }),
      createBid({ id: "missing", email: "" }),
      createBid({ id: "invalid", email: "not-an-email" }),
      createBid({ id: "sent", email: "sent@example.com", status: "sent" }),
    ]);

    expect(selection.candidateBids.map((bid) => bid.id)).toEqual([
      "eligible",
      "missing",
      "invalid",
    ]);
    expect(selection.recipientBids.map((bid) => bid.id)).toEqual(["eligible"]);
    expect(selection.emails).toEqual(["valid@example.com"]);
    expect(selection.missingEmailBids.map((bid) => bid.id)).toEqual(["missing"]);
    expect(selection.invalidEmailBids.map((bid) => bid.id)).toEqual(["invalid"]);
  });

  it("ponechá obě karty se stejnou adresou, ale vytvoří jen jednoho BCC příjemce", () => {
    const selection = selectBulkInquiryRecipients([
      createBid({ id: "a", email: "office@example.com" }),
      createBid({ id: "b", email: "OFFICE@example.com" }),
    ]);

    expect(selection.recipientBids.map((bid) => bid.id)).toEqual(["a", "b"]);
    expect(selection.emails).toEqual(["office@example.com"]);
  });

  it("u poděkování zachová stávající pravidlo účastníků s cenou mimo SOD", () => {
    const selection = selectLoserEmailRecipients([
      createBid({ id: "offer", email: "offer@example.com", price: "100", status: "offer" }),
      createBid({ id: "winner", email: "winner@example.com", price: "90", status: "sod" }),
      createBid({ id: "without-price", email: "empty@example.com", status: "rejected" }),
    ]);

    expect(selection.recipientBids.map((bid) => bid.id)).toEqual(["offer"]);
    expect(selection.emails).toEqual(["offer@example.com"]);
  });

  it("validuje adresu bez přijetí CRLF", () => {
    expect(isValidEmailAddress("user@example.com")).toBe(true);
    expect(isValidEmailAddress("user@example.com\r\nBcc:x@example.com")).toBe(false);
    expect(isValidEmailAddress("invalid")).toBe(false);
  });
});
