import type { BidStatus } from "../types";

type OfferStatusMeta = {
  label: string;
  className: string;
};

const OFFER_STATUS_META: Record<BidStatus, OfferStatusMeta> = {
  contacted: {
    label: "Kontaktováno",
    className:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 ring-1 ring-slate-200/60 dark:ring-slate-700/60",
  },
  sent: {
    label: "Odesláno",
    className:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 ring-1 ring-slate-200/60 dark:ring-slate-700/60",
  },
  offer: {
    label: "Nabídka",
    className:
      "bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500/30",
  },
  shortlist: {
    label: "Užší výběr",
    className:
      "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30",
  },
  sod: {
    label: "SOD",
    className:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30",
  },
  rejected: {
    label: "Zamítnuto",
    className:
      "bg-rose-500/15 text-rose-700 dark:text-rose-300 ring-1 ring-rose-500/30",
  },
};

export const getOfferStatusMeta = (status: BidStatus): OfferStatusMeta =>
  OFFER_STATUS_META[status];
