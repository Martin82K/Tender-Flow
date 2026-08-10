import { pipelineRepository, type BidInsertPayload } from "@/infra/projects/pipelineRepository";
import type { Bid, BidStatus, Subcontractor } from "@/types";
import { toSubcontractorPersistencePayload } from "@features/contacts/model/contactPersistence";

export const fetchLinkedTenderPlanDates = async (
  projectId: string,
  categoryId: string,
  categoryTitle: string,
) => {
  const { data, error } = await pipelineRepository.fetchLinkedTenderPlanDates(
    projectId,
    categoryId,
    categoryTitle,
  );

  if (error || !data) {
    return null;
  }

  return {
    dateFrom: data.date_from || "",
    dateTo: data.date_to || "",
  };
};

export const updateBidStatus = async (bidId: string, status: BidStatus) => {
  return pipelineRepository.updateBidStatus(bidId, status);
};

export const updateBidContracted = async (bidId: string, contracted: boolean) => {
  return pipelineRepository.updateBidContracted(bidId, contracted);
};

export const insertBids = async (payload: BidInsertPayload[]) => {
  return pipelineRepository.insertBids(payload);
};

export const updateBid = async (
  bid: Bid,
  numericPrice: number | null,
) => {
  return pipelineRepository.updateBid(bid.id, {
    contact_person: bid.contactPerson,
    email: bid.email,
    phone: bid.phone,
    price: numericPrice && numericPrice > 0 ? numericPrice : null,
    price_display: bid.price,
    price_history: bid.priceHistory || null,
    notes: bid.notes,
    status: bid.status,
    update_date: bid.updateDate || null,
    selection_round: bid.selectionRound || null,
  });
};

export const deleteBid = async (bidId: string) => {
  return pipelineRepository.deleteBid(bidId);
};

export const insertSubcontractor = async (
  contact: Subcontractor,
  organizationId?: string,
) => {
  return pipelineRepository.insertSubcontractor(
    toSubcontractorPersistencePayload(contact, organizationId),
  );
};

export const updateSubcontractor = async (contact: Subcontractor) => {
  const { id: _id, ...payload } = toSubcontractorPersistencePayload(contact);
  return pipelineRepository.updateSubcontractor(contact.id, payload);
};
