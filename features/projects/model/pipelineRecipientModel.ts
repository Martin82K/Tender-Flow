import type { Bid, ContactPerson } from "@/types";
import { isValidEmailAddress, normalizeEmailAddress } from "./pipelineEmailModel";

export type BidRecipient = Pick<Bid, "contactPerson" | "email" | "phone">;

export const recipientPatch = (contact: ContactPerson): BidRecipient => {
  if (!isValidEmailAddress(contact.email)) throw new Error("Kontakt nemá platný e-mail.");
  return {
    contactPerson: contact.name,
    email: normalizeEmailAddress(contact.email),
    phone: contact.phone === "-" ? "" : contact.phone,
  };
};

export const defaultBidRecipient = (contacts: ContactPerson[]): BidRecipient => {
  // The contacts directory represents the primary person by the first position.
  const main = contacts[0];
  if (main && isValidEmailAddress(main.email)) return recipientPatch(main);
  const usable = contacts.filter(contact => isValidEmailAddress(contact.email));
  if (usable.length === 1) return recipientPatch(usable[0]);
  return { contactPerson: main?.name || "-", email: "", phone: main?.phone || "" };
};
