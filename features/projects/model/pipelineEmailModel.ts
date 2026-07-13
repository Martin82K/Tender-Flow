import type { Bid } from "@/types";

export type PipelineBulkEmailKind = "inquiry" | "materialInquiry" | "losers";

export interface PipelineEmailRecipientSelection {
  candidateBids: Bid[];
  recipientBids: Bid[];
  missingEmailBids: Bid[];
  invalidEmailBids: Bid[];
  emails: string[];
}

const SIMPLE_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeEmailAddress = (email: string): string => email.trim();

export const isValidEmailAddress = (email: string): boolean => {
  const normalized = normalizeEmailAddress(email);
  return (
    normalized.length > 0 &&
    normalized.length <= 254 &&
    !/[\r\n]/.test(normalized) &&
    SIMPLE_EMAIL_PATTERN.test(normalized)
  );
};

const hasBidAnyPrice = (bid: Bid): boolean => {
  const hasMainPrice = !!bid.price && bid.price !== "?" && bid.price !== "-";
  const hasPriceHistory = !!(bid.priceHistory && Object.keys(bid.priceHistory).length > 0);
  return hasMainPrice || hasPriceHistory;
};

export const getLoserBidsWithPrice = (categoryBids: Bid[]): Bid[] => {
  return categoryBids.filter((bid) => {
    if (bid.status === "sod") return false;
    return hasBidAnyPrice(bid);
  });
};

export const buildBccRecipientList = (emails: string[]): string => {
  const uniqueEmails = new Map<string, string>();

  for (const email of emails) {
    const normalized = normalizeEmailAddress(email);
    if (!isValidEmailAddress(normalized)) continue;
    const deduplicationKey = normalized.toLocaleLowerCase("en-US");
    if (!uniqueEmails.has(deduplicationKey)) {
      uniqueEmails.set(deduplicationKey, normalized);
    }
  }

  return Array.from(uniqueEmails.values()).join(";");
};

const selectEmailRecipients = (
  candidateBids: Bid[],
): PipelineEmailRecipientSelection => {
  const recipientBids: Bid[] = [];
  const missingEmailBids: Bid[] = [];
  const invalidEmailBids: Bid[] = [];
  const uniqueEmails = new Map<string, string>();

  for (const bid of candidateBids) {
    const email = normalizeEmailAddress(bid.email || "");
    if (!email) {
      missingEmailBids.push(bid);
      continue;
    }
    if (!isValidEmailAddress(email)) {
      invalidEmailBids.push(bid);
      continue;
    }

    recipientBids.push(bid);
    const deduplicationKey = email.toLocaleLowerCase("en-US");
    if (!uniqueEmails.has(deduplicationKey)) {
      uniqueEmails.set(deduplicationKey, email);
    }
  }

  return {
    candidateBids,
    recipientBids,
    missingEmailBids,
    invalidEmailBids,
    emails: Array.from(uniqueEmails.values()),
  };
};

export const selectBulkInquiryRecipients = (
  categoryBids: Bid[],
): PipelineEmailRecipientSelection =>
  selectEmailRecipients(
    categoryBids.filter((bid) => bid.status === "contacted"),
  );

export const selectLoserEmailRecipients = (
  categoryBids: Bid[],
): PipelineEmailRecipientSelection =>
  selectEmailRecipients(getLoserBidsWithPrice(categoryBids));

export const buildDefaultLosersEmailDraft = (
  projectTitle: string,
  categoryTitle: string,
) => {
  const subject = `${projectTitle} - ${categoryTitle} - Výsledek výběrového řízení`;
  const body =
    `Vážený obchodní partnere,\n\n` +
    `děkujeme za Vaši nabídku v rámci výběrového řízení na zakázku "${projectTitle}" - ${categoryTitle}.\n\n` +
    `Po pečlivém zvážení všech nabídek jsme se rozhodli pokračovat s jiným dodavatelem.\n\n` +
    `Věříme, že budeme mít možnost spolupracovat na dalších projektech v budoucnosti.`;

  return { subject, body };
};
