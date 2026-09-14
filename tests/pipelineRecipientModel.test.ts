import { describe, expect, it } from "vitest";
import type { ContactPerson } from "@/types";
import { defaultBidRecipient, recipientPatch } from "@features/projects/model/pipelineRecipientModel";

const main: ContactPerson = { id: "main", name: "Podatelna", email: "office@example.com", phone: "111" };
const other: ContactPerson = { id: "other", name: "Rozpočtář", email: " budget@example.com ", phone: "222", position: "Poptávky" };

describe("pipeline recipient defaults", () => {
  it("uses the main contact and keeps the directory unchanged", () => {
    const contacts = [main, other];
    expect(defaultBidRecipient(contacts)).toEqual(recipientPatch(main));
    expect(contacts).toEqual([main, other]);
  });
  it("uses the only valid recipient when the main contact has no email", () => {
    expect(defaultBidRecipient([{ ...main, email: "-" }, other])).toEqual({ contactPerson: other.name, email: "budget@example.com", phone: "222" });
  });
  it("requires a choice when the main contact is unusable and several alternatives exist", () => {
    expect(defaultBidRecipient([{ ...main, email: "" }, other, { ...main, id: "general" }]).email).toBe("");
  });
  it.each(["-", "invalid", "a@example.com,b@example.com", "a@example.com\r\nBcc: b@example.com"])("rejects unusable recipient %s", email => {
    expect(() => recipientPatch({ ...main, email })).toThrow();
  });
});
