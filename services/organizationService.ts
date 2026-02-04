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
  role: "owner" | "admin" | "member";
  joined_at: string;
};

export type OrganizationJoinRequest = {
  request_id: string;
  user_id: string;
  email: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
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

  getOrganizationMembers: async (orgId: string): Promise<OrganizationMember[]> => {
    const { data, error } = await supabase.rpc("get_org_members", {
      org_id_input: orgId,
    });
    if (error) throw new Error(error.message);
    return data || [];
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
};
