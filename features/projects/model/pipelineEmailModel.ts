import type { Bid } from "@/types";

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

export const getLoserEmails = (loserBids: Bid[]): string[] => {
  return loserBids.filter((bid) => !!bid.email).map((bid) => bid.email);
};

export const buildDefaultLosersEmailDraft = (
  projectTitle: string,
  categoryTitle: string,
) => {
  const subject = `${projectTitle} - ${categoryTitle} - Výsledek výběrového řízení`;
  const body =
    `Vážený obchodní partnere,\n\n` +
    `děkujeme za Vaši nabídku v rámci výběrového řízení na zakázku "${projectTitle}" - ${categoryTitle}.\n\n` +
    `Po pečlivém zvážení všech nabídek jsme se rozhodli pokračovat s jiným dodavatelem.\n\n` +
    `Věříme, že budeme mít možnost spolupracovat na dalších projektech v budoucnosti.\n\n` +
    `S pozdravem`;

  return { subject, body };
};
