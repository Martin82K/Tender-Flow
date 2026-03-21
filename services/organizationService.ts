import { supabase } from "./supabase";

export type OrganizationSummary = {
  organization_id: string;
  organization_name: string;
  member_role: "owner" | "admin" | "member";
  domain_whitelist: string[] | null;
  logo_path?: string | null;
  email_logo_path?: string | null;
  email_signature_company_name?: string | null;
  email_signature_company_address?: string | null;
  email_signature_company_meta?: string | null;
  email_signature_disclaimer_html?: string | null;
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

const BRANDING_BUCKET = "organization-branding";
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/pjpeg",
  "image/webp",
  "image/svg+xml",
] as const;

const guessExtensionFromMime = (mimeType: string): string => {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg" || mimeType === "image/jpg" || mimeType === "image/pjpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/svg+xml") return "svg";
  return "bin";
};

const normalizeBrandingStorageError = (message: string): string => {
  const lower = message.toLowerCase();
  if (lower.includes("bucket not found")) {
    return "Storage bucket `organization-branding` nebyl nalezen. Aplikujte prosím migraci `supabase/migrations/20260301103000_organization_branding_logo.sql` v Supabase.";
  }
  if (lower.includes("row-level security policy")) {
    return "Upload loga blokuje RLS policy ve Storage. Ověřte, že máte v organizaci roli owner/admin a že jsou v Supabase aktivní policy `org_branding_insert`/`org_branding_update` pro bucket `organization-branding`.";
  }
  if (lower.includes("invalid logo path")) {
    return "Neplatná cesta loga v DB validaci. Nahrajte prosím znovu aktuální SQL fix pro funkci `set_organization_logo_path` (regex `logo\\.(png|jpg|jpeg|webp|svg)`).";
  }
  if (lower.includes("invalid email logo path")) {
    return "Neplatná cesta e-mailového loga v DB validaci. Nahrajte prosím aktuální SQL fix pro funkci `set_organization_email_logo_path`.";
  }
  return message;
};

const getOrganizationById = async (orgId: string): Promise<OrganizationSummary | null> => {
  if (!orgId) return null;

  const { data, error } = await supabase.rpc("get_my_organizations");
  if (error) throw new Error(error.message);

  const organizations = (data || []) as OrganizationSummary[];
  return organizations.find((item) => item.organization_id === orgId) || null;
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

  getOrganizationLogoUrl: async (
    orgId: string,
    options?: { expiresInSeconds?: number },
  ): Promise<string | null> => {
    if (!orgId) return null;
    const org = await getOrganizationById(orgId);
    if (!org?.logo_path) return null;

    const expiresInSeconds = Math.min(
      Math.max(options?.expiresInSeconds ?? 3600, 60),
      24 * 3600,
    );
    const { data: signedData, error: signedError } = await supabase.storage
      .from(BRANDING_BUCKET)
      .createSignedUrl(org.logo_path, expiresInSeconds);

    if (signedError) {
      throw new Error(normalizeBrandingStorageError(signedError.message));
    }

    return signedData?.signedUrl || null;
  },

  uploadOrganizationLogo: async (
    orgId: string,
    file: File,
  ): Promise<{ logoPath: string; logoUrl: string | null }> => {
    if (!orgId) throw new Error("Chybí organizace.");
    if (!file) throw new Error("Nebyl vybrán soubor.");
    if (file.size > MAX_LOGO_BYTES) {
      throw new Error("Logo je příliš velké. Maximální velikost je 2 MB.");
    }
    if (!ALLOWED_LOGO_MIME_TYPES.includes(file.type as (typeof ALLOWED_LOGO_MIME_TYPES)[number])) {
      throw new Error("Nepodporovaný formát loga. Povolené: PNG, JPG, WEBP, SVG.");
    }

    const extension = guessExtensionFromMime(file.type);
    const logoPath = `organizations/${orgId}/logo.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(BRANDING_BUCKET)
      .upload(logoPath, file, {
        upsert: true,
        cacheControl: "3600",
        contentType: file.type,
      });

    if (uploadError) {
      throw new Error(normalizeBrandingStorageError(uploadError.message));
    }

    const { error: updateError } = await supabase.rpc("set_organization_logo_path", {
      org_id_input: orgId,
      logo_path_input: logoPath,
    });
    if (updateError) {
      throw new Error(updateError.message);
    }

    const logoUrl = await organizationService.getOrganizationLogoUrl(orgId);
    return {
      logoPath,
      logoUrl,
    };
  },

  removeOrganizationLogo: async (orgId: string): Promise<void> => {
    if (!orgId) throw new Error("Chybí organizace.");
    const org = await getOrganizationById(orgId);
    const existingPath = org?.logo_path || null;

    if (existingPath) {
      const { error: removeError } = await supabase.storage
        .from(BRANDING_BUCKET)
        .remove([existingPath]);
      if (removeError) {
        throw new Error(normalizeBrandingStorageError(removeError.message));
      }
    }

    const { error: updateError } = await supabase.rpc("set_organization_logo_path", {
      org_id_input: orgId,
      logo_path_input: null,
    });
    if (updateError) {
      throw new Error(updateError.message);
    }
  },

  getOrganizationEmailBranding: async (
    orgId: string,
    options?: { expiresInSeconds?: number },
  ) => {
    const org = await getOrganizationById(orgId);
    if (!org) return null;

    let emailLogoUrl: string | null = null;
    if (org.email_logo_path) {
      const expiresInSeconds = Math.min(
        Math.max(options?.expiresInSeconds ?? 3600, 60),
        24 * 3600,
      );
      const { data: signedData, error: signedError } = await supabase.storage
        .from(BRANDING_BUCKET)
        .createSignedUrl(org.email_logo_path, expiresInSeconds);

      if (signedError) {
        throw new Error(normalizeBrandingStorageError(signedError.message));
      }

      emailLogoUrl = signedData?.signedUrl || null;
    }

    return {
      emailLogoPath: org.email_logo_path || null,
      emailLogoUrl,
      companyName: org.email_signature_company_name || null,
      companyAddress: org.email_signature_company_address || null,
      companyMeta: org.email_signature_company_meta || null,
      disclaimerHtml: org.email_signature_disclaimer_html || null,
    };
  },

  uploadOrganizationEmailLogo: async (
    orgId: string,
    file: File,
  ): Promise<{ logoPath: string; logoUrl: string | null }> => {
    if (!orgId) throw new Error("Chybí organizace.");
    if (!file) throw new Error("Nebyl vybrán soubor.");
    if (file.size > MAX_LOGO_BYTES) {
      throw new Error("Logo je příliš velké. Maximální velikost je 2 MB.");
    }
    if (!ALLOWED_LOGO_MIME_TYPES.includes(file.type as (typeof ALLOWED_LOGO_MIME_TYPES)[number])) {
      throw new Error("Nepodporovaný formát loga. Povolené: PNG, JPG, WEBP, SVG.");
    }

    const extension = guessExtensionFromMime(file.type);
    const logoPath = `organizations/${orgId}/email-logo.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(BRANDING_BUCKET)
      .upload(logoPath, file, {
        upsert: true,
        cacheControl: "3600",
        contentType: file.type,
      });

    if (uploadError) {
      throw new Error(normalizeBrandingStorageError(uploadError.message));
    }

    const { error: updateError } = await supabase.rpc(
      "set_organization_email_logo_path",
      {
        org_id_input: orgId,
        email_logo_path_input: logoPath,
      },
    );
    if (updateError) {
      throw new Error(updateError.message);
    }

    const branding = await organizationService.getOrganizationEmailBranding(orgId);
    return {
      logoPath,
      logoUrl: branding?.emailLogoUrl || null,
    };
  },

  removeOrganizationEmailLogo: async (orgId: string): Promise<void> => {
    if (!orgId) throw new Error("Chybí organizace.");
    const org = await getOrganizationById(orgId);
    const existingPath = org?.email_logo_path || null;

    if (existingPath) {
      const { error: removeError } = await supabase.storage
        .from(BRANDING_BUCKET)
        .remove([existingPath]);
      if (removeError) {
        throw new Error(normalizeBrandingStorageError(removeError.message));
      }
    }

    const { error: updateError } = await supabase.rpc(
      "set_organization_email_logo_path",
      {
        org_id_input: orgId,
        email_logo_path_input: null,
      },
    );
    if (updateError) {
      throw new Error(updateError.message);
    }
  },

  saveOrganizationEmailBranding: async (
    orgId: string,
    input: {
      companyName: string | null;
      companyAddress: string | null;
      companyMeta: string | null;
      disclaimerHtml: string | null;
    },
  ): Promise<void> => {
    if (!orgId) throw new Error("Chybí organizace.");

    const { error } = await supabase.rpc("set_organization_email_branding", {
      org_id_input: orgId,
      company_name_input: input.companyName,
      company_address_input: input.companyAddress,
      company_meta_input: input.companyMeta,
      disclaimer_html_input: input.disclaimerHtml,
    });

    if (error) {
      throw new Error(error.message);
    }
  },
};
