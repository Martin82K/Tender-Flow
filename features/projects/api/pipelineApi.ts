import { pipelineRepository, type BidInsertPayload, type PersistedBidRow } from "@/infra/projects/pipelineRepository";
import { notifyProjectBidsPersisted } from "@features/projects/model/projectBidEvents";
import type { Bid, BidStatus, Subcontractor } from "@/types";
import { toSubcontractorPersistencePayload } from "@features/contacts/model/contactPersistence";
import { RecipientSaveError, type BidRecipient } from "@features/projects/model/pipelineRecipientModel";
import { isValidEmailAddress } from "@features/projects/model/pipelineEmailModel";

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

export const updateBidRecipient = async (categoryId: string, bid: Bid, recipient: BidRecipient): Promise<BidRecipient> => {
  const email = recipient.email?.trim() || "";
  if (!isValidEmailAddress(email)) throw new Error("Kontakt nemá platný e-mail.");
  const before = await pipelineRepository.fetchBidRecipient(categoryId, bid.id, bid.subcontractorId);
  if (before.error || before.data?.id !== bid.id
    || !(before.data.updated_at === null || (typeof before.data.updated_at === "string" && before.data.updated_at.length > 0))) {
    throw new RecipientSaveError(false);
  }
  // Keep the exact server timestamp (including microseconds). A timed-out
  // request may still commit; CAS prevents it from overwriting a later save.
  const expectedVersion = before.data.updated_at;
  try {
    const { data, error, status } = await pipelineRepository.updateBidRecipient(categoryId, bid.id, bid.subcontractorId, {
      contact_person: recipient.contactPerson, email, phone: recipient.phone || "",
    }, expectedVersion);
    if (error || !data || data.id !== bid.id) {
      const ambiguous = status === 0 || status === 408 || status === 429 || status >= 500;
      throw new RecipientSaveError(ambiguous);
    }
  } catch (cause) {
    const ambiguous = cause instanceof RecipientSaveError ? cause.uncertain
      : cause instanceof TypeError || (cause instanceof DOMException && ["AbortError", "TimeoutError"].includes(cause.name));
    if (!ambiguous) throw cause;
  }
  // Always read after the write response: another editor may have committed
  // a newer contact while our response was in flight. A lost response also
  // does not imply a rollback. Never reissue a write during reconciliation.
  let response;
  try {
    response = await pipelineRepository.fetchBidRecipient(categoryId, bid.id, bid.subcontractorId);
  } catch {
    throw new RecipientSaveError(true);
  }
  if (!response?.data || response.error || response.data.id !== bid.id) throw new RecipientSaveError(true);
  const current = { contactPerson: response.data.contact_person, email: response.data.email, phone: response.data.phone };
  if (current.contactPerson !== recipient.contactPerson || current.email !== email || current.phone !== (recipient.phone || "")) {
    throw new RecipientSaveError(true, current);
  }
  notifyProjectBidsPersisted();
  return current;
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
  const insertedIds: string[] = [];
  const returnedRows: PersistedBidRow[] = [];
  const verifiedPairs = new Set<string>();
  let completedBatches = 0;
  let writeError: unknown = null;
  const finish = (data: PersistedBidRow[], error: unknown): InsertBidsResult => {
    // A successful read supersedes RETURNING, including an empty RLS-filtered
    // result. Failed reads must not discard rows already confirmed by the RPC.
    const confirmed = [...data, ...returnedRows.filter(row => !verifiedPairs.has(
      JSON.stringify([row.demand_category_id, row.subcontractor_id]),
    ))];
    const found = new Set(confirmed.map(row => JSON.stringify([row.demand_category_id, row.subcontractor_id])));
    const complete = unique.every(row => found.has(JSON.stringify([row.demand_category_id, row.subcontractor_id])));
    if (confirmed.length > 0) notifyProjectBidsPersisted();
    return { data: confirmed.length > 0 ? confirmed : null, error: complete ? null : error, insertedIds };
  };
  try {
    for (let offset = 0; offset < unique.length; offset += 1000) {
      const written = await pipelineRepository.insertBids(unique.slice(offset, offset + 1000));
      if (written.error) {
        const ambiguous = written.status === 0 || written.status === 408 || written.status === 429
          || (written.status >= 500 && written.status <= 599);
        if (!ambiguous && completedBatches === 0) return finish([], written.error);
        writeError = written.error;
        break;
      }
      returnedRows.push(...(written.data ?? []));
      insertedIds.push(...(written.data ?? []).map(row => row.id));
      completedBatches += 1;
    }
  } catch (error) {
    const ambiguous = error instanceof TypeError
      || (error instanceof DOMException && ["AbortError", "TimeoutError"].includes(error.name));
    if (!ambiguous && completedBatches === 0) return finish([], error);
    writeError = error;
  }

  const data: PersistedBidRow[] = [];
  try {
    // Reconcile both ambiguous responses and earlier committed batches, always
    // under caller RLS. Never reissue a write here or discard confirmed rows.
    const groups = new Map<string, string[]>();
    for (const row of unique) {
      groups.set(row.demand_category_id, [...(groups.get(row.demand_category_id) ?? []), row.subcontractor_id]);
    }
    for (const [categoryId, supplierIds] of groups) {
      for (let offset = 0; offset < supplierIds.length; offset += 100) {
        const response = await pipelineRepository.fetchBidsForSuppliers(categoryId, supplierIds.slice(offset, offset + 100));
        if (response.error) return finish(data, response.error);
        for (const supplierId of supplierIds.slice(offset, offset + 100)) {
          verifiedPairs.add(JSON.stringify([categoryId, supplierId]));
        }
        data.push(...(response.data ?? []));
      }
    }
    const found = new Set(data.map(row => JSON.stringify([row.demand_category_id, row.subcontractor_id])));
    if (unique.some(row => !found.has(JSON.stringify([row.demand_category_id, row.subcontractor_id])))) {
      return finish(data, writeError ?? new Error("Uložení všech dodavatelů zatím nelze ověřit. Opakování je bezpečné."));
    }
    return finish(data, null);
  } catch (error) {
    return finish(data, error);
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
