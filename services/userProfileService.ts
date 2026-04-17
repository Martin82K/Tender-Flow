import type { UserEmailSignatureProfile } from "@/types";

import { supabase } from "./supabase";

const mapProfileRow = (data: Record<string, unknown> | null | undefined): UserEmailSignatureProfile => ({
  displayName: typeof data?.display_name === "string" ? data.display_name : null,
  signatureName: typeof data?.signature_name === "string" ? data.signature_name : null,
  signatureRole: typeof data?.signature_role === "string" ? data.signature_role : null,
  signaturePhone: typeof data?.signature_phone === "string" ? data.signature_phone : null,
  signaturePhoneSecondary:
    typeof data?.signature_phone_secondary === "string"
      ? data.signature_phone_secondary
      : null,
  signatureEmail: typeof data?.signature_email === "string" ? data.signature_email : null,
  signatureGreeting:
    typeof data?.signature_greeting === "string" ? data.signature_greeting : null,
});

export const userProfileService = {
  async getProfile(userId: string): Promise<UserEmailSignatureProfile> {
    const { data, error } = await supabase
      .from("user_profiles")
      .select(
        [
          "display_name",
          "signature_name",
          "signature_role",
          "signature_phone",
          "signature_phone_secondary",
          "signature_email",
          "signature_greeting",
        ].join(", "),
      )
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      return mapProfileRow(null);
    }

    return mapProfileRow(data as unknown as Record<string, unknown> | null | undefined);
  },

  async getDisplayName(userId: string): Promise<string | null> {
    const profile = await this.getProfile(userId);
    return profile.displayName && profile.displayName.trim().length > 0
      ? profile.displayName
      : null;
  },

  async saveDisplayName(userId: string, displayName: string | null): Promise<void> {
    const existingProfile = await this.getProfile(userId);
    await this.saveProfile(userId, {
      ...existingProfile,
      displayName,
    });
  },

  async saveProfile(
    userId: string,
    profile: UserEmailSignatureProfile,
  ): Promise<void> {
    const { error } = await supabase.from("user_profiles").upsert(
      {
        user_id: userId,
        display_name: profile.displayName,
        signature_name: profile.signatureName,
        signature_role: profile.signatureRole,
        signature_phone: profile.signaturePhone,
        signature_phone_secondary: profile.signaturePhoneSecondary,
        signature_email: profile.signatureEmail,
        signature_greeting: profile.signatureGreeting,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) {
      throw error;
    }
  },
};
