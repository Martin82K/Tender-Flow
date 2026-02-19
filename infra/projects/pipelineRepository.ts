import { supabase } from "@/services/supabase";
import type { BidStatus } from "@/types";

export type BidInsertPayload = {
  id: string;
  demand_category_id: string;
  subcontractor_id: string;
  company_name: string;
  contact_person: string;
  email: string | null | undefined;
  phone: string | null | undefined;
  price: number | null;
  price_display: string | null | undefined;
  notes: string | null | undefined;
  status: BidStatus;
  tags: string[];
};

export const pipelineRepository = {
  fetchLinkedTenderPlanDates(projectId: string, categoryId: string, categoryTitle: string) {
    return supabase
      .from("tender_plans")
      .select("date_from, date_to")
      .eq("project_id", projectId)
      .or(`category_id.eq.${categoryId},name.ilike.${categoryTitle}`)
      .limit(1)
      .single();
  },

  updateBidStatus(bidId: string, status: BidStatus) {
    return supabase.from("bids").update({ status }).eq("id", bidId);
  },

  updateBidContracted(bidId: string, contracted: boolean) {
    return supabase.from("bids").update({ contracted }).eq("id", bidId);
  },

  insertBids(payload: BidInsertPayload[]) {
    return supabase.from("bids").insert(payload).select();
  },

  updateBid(
    bidId: string,
    payload: {
      contact_person: string;
      email: string | null | undefined;
      phone: string | null | undefined;
      price: number | null;
      price_display: string | null | undefined;
      price_history: Record<number, string> | null;
      notes: string | null | undefined;
      status: BidStatus;
      update_date: string | null;
      selection_round: number | null;
    },
  ) {
    return supabase.from("bids").update(payload).eq("id", bidId);
  },

  deleteBid(bidId: string) {
    return supabase.from("bids").delete().eq("id", bidId);
  },

  insertSubcontractor(payload: {
    id: string;
    company_name: string;
    contact_person_name: string | undefined;
    email: string | undefined;
    phone: string | undefined;
    specialization: string[];
    ico: string | undefined;
    region: string | undefined;
    status_id: string;
  }) {
    return supabase.from("subcontractors").insert(payload);
  },

  updateSubcontractor(
    id: string,
    payload: {
      company_name: string;
      contact_person_name: string | undefined;
      email: string | undefined;
      phone: string | undefined;
      specialization: string[];
      ico: string | undefined;
      region: string | undefined;
      status_id: string;
    },
  ) {
    return supabase.from("subcontractors").update(payload).eq("id", id);
  },
};
