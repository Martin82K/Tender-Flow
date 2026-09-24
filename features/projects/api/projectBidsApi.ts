import { dbAdapter } from "@infra/db/dbAdapter";
import { withRetry } from "@shared/async/asyncControl";
import type { Bid } from "@/types";

interface BidRow {
  id: string;
  demand_category_id: string;
  subcontractor_id: string;
  company_name: string;
  contact_person: string;
  email?: string;
  phone?: string;
  price_display?: string | null;
  price?: string | number | null;
  price_history?: Bid["priceHistory"];
  notes?: string;
  tags?: string[];
  status: Bid["status"];
  update_date?: string;
  selection_round?: number;
  contracted?: boolean | null;
}

export const fetchProjectBids = async (categoryIds: string[], signal?: AbortSignal): Promise<Record<string, Bid[]>> => {
  if (categoryIds.length === 0) return {};
  const response = await withRetry(async () => {
    const query = dbAdapter.from("bids").select("id,demand_category_id,subcontractor_id,company_name,contact_person,email,phone,price_display,price,price_history,notes,tags,status,update_date,selection_round,contracted").in("demand_category_id", categoryIds);
    return signal ? query.abortSignal(signal) : query;
  });
  if (response.error) throw response.error;
  const bidsData = (response.data || []) as BidRow[];
  const bidsRecord: Record<string, Bid[]> = {};
  bidsData.forEach((bid) => {
    const categoryId = bid.demand_category_id;
    if (!bidsRecord[categoryId]) bidsRecord[categoryId] = [];

    bidsRecord[categoryId].push({
      id: bid.id,
      subcontractorId: bid.subcontractor_id,
      companyName: bid.company_name,
      contactPerson: bid.contact_person,
      email: bid.email,
      phone: bid.phone,
      price:
        bid.price_display || (bid.price != null ? bid.price.toString() : undefined),
      priceHistory: bid.price_history || undefined,
      notes: bid.notes,
      tags: bid.tags,
      status: bid.status,
      updateDate: bid.update_date,
      selectionRound: bid.selection_round,
      contracted: bid.contracted || false,
    });
  });

  return bidsRecord;
};
