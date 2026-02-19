import { supabase } from "./supabase";

export const userProfileService = {
  async getDisplayName(userId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("display_name")
      .eq("user_id", userId)
      .single();

    if (error) {
      return null;
    }

    const value = data?.display_name;
    return typeof value === "string" && value.trim().length > 0 ? value : null;
  },

  async saveDisplayName(userId: string, displayName: string | null): Promise<void> {
    const { error } = await supabase.from("user_profiles").upsert(
      {
        user_id: userId,
        display_name: displayName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) {
      throw error;
    }
  },
};
