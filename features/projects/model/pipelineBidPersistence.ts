import type { PersistedBidRow } from "@infra/projects/pipelineRepository";
import type { Bid } from "@/types";

export const toPipelineBid = (row: PersistedBidRow): Bid => ({
  id: row.id,
  subcontractorId: row.subcontractor_id,
  companyName: row.company_name,
  contactPerson: row.contact_person,
  email: row.email ?? undefined,
  phone: row.phone ?? undefined,
  price: row.price_display || (row.price != null ? row.price.toString() : undefined),
  notes: row.notes ?? undefined,
  status: row.status,
  tags: row.tags,
  priceHistory: row.price_history ?? undefined,
  updateDate: row.update_date ?? undefined,
  selectionRound: row.selection_round ?? undefined,
  contracted: row.contracted ?? false,
});

export const mergeConfirmedBids = (existing: Bid[], confirmed: Bid[]): Bid[] => {
  const byId = new Map(confirmed.map(bid => [bid.id, bid]));
  const existingIds = new Set(existing.map(bid => bid.id));
  return [
    ...existing.map(bid => byId.get(bid.id) ?? bid),
    ...confirmed.filter(bid => !existingIds.has(bid.id)),
  ];
};
