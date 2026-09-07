import { pipelineRepository, type BidInsertPayload, type PersistedBidRow } from "@/infra/projects/pipelineRepository";
import { notifyProjectBidsPersisted } from "@features/projects/model/projectBidEvents";
import type { Bid, BidStatus, Subcontractor } from "@/types";
import { toSubcontractorPersistencePayload } from "@features/contacts/model/contactPersistence";

const persistBidChange = async <Response extends { error: unknown }>(request: PromiseLike<Response>): Promise<Response> => {
  const response = await request;
  if (!response.error) notifyProjectBidsPersisted();
  return response;
};

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
  return persistBidChange(pipelineRepository.updateBidStatus(bidId, status));
};

export const updateBidContracted = async (bidId: string, contracted: boolean) => {
  return persistBidChange(pipelineRepository.updateBidContracted(bidId, contracted));
};

export interface InsertBidsResult {
  data: PersistedBidRow[] | null;
  error: unknown;
  insertedIds: string[];
}

export const insertBids = async (payload: BidInsertPayload[]): Promise<InsertBidsResult> => {
  if (payload.length === 0) return { data: [], error: null, insertedIds: [] };
  // A batch can contain the same pair twice. Never overwrite an existing offer.
  const unique = [...new Map(payload.map(row => [JSON.stringify([row.demand_category_id, row.subcontractor_id]), row])).values()];
  let insertedIds: string[] = [];
  try {
    const written = await pipelineRepository.insertBids(unique);
    // Only transport failures are ambiguous; permission/validation errors remain errors.
    if (written.error && written.status !== 0) return { data: null, error: written.error, insertedIds };
    insertedIds = (written.data ?? []).map(row => row.id);
  } catch (error) {
    if (!(error instanceof TypeError) && !(error instanceof DOMException && ["AbortError", "TimeoutError"].includes(error.name))) {
      return { data: null, error, insertedIds };
    }
  }

  try {
    // Read both inserted and pre-existing rows under the caller's RLS. This also
    // reconciles a lost response after commit, without issuing a second write.
    const groups = new Map<string, string[]>();
    for (const row of unique) {
      groups.set(row.demand_category_id, [...(groups.get(row.demand_category_id) ?? []), row.subcontractor_id]);
    }
    const data: PersistedBidRow[] = [];
    for (const [categoryId, supplierIds] of groups) {
      for (let offset = 0; offset < supplierIds.length; offset += 100) {
        const response = await pipelineRepository.fetchBidsForSuppliers(categoryId, supplierIds.slice(offset, offset + 100));
        if (response.error) return { data: null, error: response.error, insertedIds };
        data.push(...(response.data ?? []));
      }
    }
    const found = new Set(data.map(row => JSON.stringify([row.demand_category_id, row.subcontractor_id])));
    if (unique.some(row => !found.has(JSON.stringify([row.demand_category_id, row.subcontractor_id])))) {
      return { data: null, error: new Error("Uložení všech dodavatelů zatím nelze ověřit. Opakování je bezpečné."), insertedIds };
    }
    notifyProjectBidsPersisted();
    return { data, error: null, insertedIds };
  } catch (error) {
    return { data: null, error, insertedIds };
  }
};

export const updateBid = async (
  bid: Bid,
  numericPrice: number | null,
) => {
  return persistBidChange(pipelineRepository.updateBid(bid.id, {
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
  }));
};

export const deleteBid = async (bidId: string) => {
  return persistBidChange(pipelineRepository.deleteBid(bidId));
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
