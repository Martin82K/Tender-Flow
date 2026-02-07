import { supabase } from "./supabase";

export type OrganizationSummary = {
  organization_id: string;
  organization_name: string;
  member_role: "owner" | "admin" | "member";
  domain_whitelist: string[] | null;
};

export type OrganizationMember = {
  user_id: string;
  email: string;
  display_name?: string | null;
  role: "owner" | "admin" | "member";
  joined_at: string;
};

export type OrganizationJoinRequest = {
  request_id: string;
  user_id: string;
  email: string;
  display_name?: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export type OrganizationUnlockerTimeSavings = {
  organization_id: string;
  organization_name: string;
  unlocked_sheets_total: number;
  unlocked_sheets_range: number;
  unlock_events_total: number;
  unlock_events_range: number;
  minutes_saved_total: number;
  minutes_saved_range: number;
  last_unlock_at: string | null;
};

const pickEarlierMemberJoin = (
  current: OrganizationMember,
  incoming: OrganizationMember,
): OrganizationMember => {
  const currentTs = Date.parse(current.joined_at);
  const incomingTs = Date.parse(incoming.joined_at);
  if (Number.isNaN(currentTs)) return incoming;
  if (Number.isNaN(incomingTs)) return current;
  return incomingTs < currentTs ? incoming : current;
};

const dedupeOrganizationMembers = (rows: OrganizationMember[]): OrganizationMember[] => {
  const byUserId = new Map<string, OrganizationMember>();
  for (const row of rows) {
    const existing = byUserId.get(row.user_id);
    if (!existing) {
      byUserId.set(row.user_id, row);
      continue;
    }
    byUserId.set(row.user_id, pickEarlierMemberJoin(existing, row));
  }
  return Array.from(byUserId.values());
};

export const organizationService = {
  getMyOrganizations: async (): Promise<OrganizationSummary[]> => {
    const { data, error } = await supabase.rpc("get_my_organizations");
    if (error) throw new Error(error.message);
    return data || [];
  },

  getMyOrgRequestStatus: async (): Promise<{
    organization_id: string;
    organization_name: string;
    status: string;
  } | null> => {
    const { data, error } = await supabase.rpc("get_my_org_request_status");
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return row || null;
  },

  requestOrgJoinByEmail: async (email: string): Promise<void> => {
    const { error } = await supabase.rpc("request_org_join_by_email", {
      email_input: email,
    });
    if (error) throw new Error(error.message);
  },

  addOrganizationMember: async (orgId: string, userId: string, role: "owner" | "admin" | "member" = "member"): Promise<void> => {
    const { error } = await supabase.rpc("add_org_member", {
      org_id_input: orgId,
      user_id_input: userId,
      role_input: role,
    });
    if (error) throw new Error(error.message);
  },

  addOrganizationMemberByEmail: async (
    orgId: string,
    email: string,
    role: "owner" | "admin" | "member" = "member",
  ): Promise<void> => {
    const { error } = await supabase.rpc("add_org_member_by_email", {
      org_id_input: orgId,
      email_input: email,
      role_input: role,
    });
    if (error) throw new Error(error.message);
  },

  updateOrganizationMemberRole: async (
    orgId: string,
    userId: string,
    role: "admin" | "member",
  ): Promise<void> => {
    const { error } = await supabase.rpc("update_org_member_role", {
      org_id_input: orgId,
      user_id_input: userId,
      role_input: role,
    });
    if (error) throw new Error(error.message);
  },

  transferOrganizationOwnership: async (orgId: string, newOwnerUserId: string): Promise<void> => {
    const { error } = await supabase.rpc("transfer_org_ownership", {
      org_id_input: orgId,
      new_owner_user_id: newOwnerUserId,
    });
    if (error) throw new Error(error.message);
  },

  getOrganizationMembers: async (orgId: string): Promise<OrganizationMember[]> => {
    const { data, error } = await supabase.rpc("get_org_members", {
      org_id_input: orgId,
    });
    if (error) throw new Error(error.message);
    return dedupeOrganizationMembers(data || []);
  },

  getOrganizationJoinRequests: async (orgId: string): Promise<OrganizationJoinRequest[]> => {
    const { data, error } = await supabase.rpc("get_org_join_requests", {
      org_id_input: orgId,
    });
    if (error) throw new Error(error.message);
    return data || [];
  },

  approveJoinRequest: async (requestId: string): Promise<void> => {
    const { error } = await supabase.rpc("approve_org_join_request", {
      request_id_input: requestId,
    });
    if (error) throw new Error(error.message);
  },

  rejectJoinRequest: async (requestId: string): Promise<void> => {
    const { error } = await supabase.rpc("reject_org_join_request", {
      request_id_input: requestId,
    });
    if (error) throw new Error(error.message);
  },

  getOrganizationUnlockerTimeSavings: async (
    orgId: string,
    daysBack: number = 30,
    minutesPerSheet: number = 2,
  ): Promise<OrganizationUnlockerTimeSavings | null> => {
    const { data, error } = await supabase.rpc("get_org_unlocker_time_savings", {
      org_id_input: orgId,
      days_back: daysBack,
      minutes_per_sheet: minutesPerSheet,
    });

    if (error) throw new Error(error.message);

    const row = Array.isArray(data) ? data[0] : data;
    return row || null;
  },
};
