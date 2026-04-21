import { supabase } from "./supabase";

export type AppNotification = {
  id: string;
  type: "info" | "success" | "warning" | "error" | string;
  title: string;
  body: string | null;
  created_at: string;
  read_at: string | null;
  category?: string;
  action_url?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  dismissed_at?: string | null;
};

export const notificationService = {
  getMyNotifications: async (limit: number = 20, categoryFilter?: string): Promise<AppNotification[]> => {
    const { data, error } = await supabase.rpc("get_my_notifications", {
      limit_count: limit,
      category_filter: categoryFilter ?? null,
    });
    if (error) throw new Error(error.message);
    return data || [];
  },

  markAllRead: async (): Promise<void> => {
    const { error } = await supabase.rpc("mark_notifications_read");
    if (error) throw new Error(error.message);
  },

  markRead: async (notificationId: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc("mark_notification_read", {
      notification_id_input: notificationId,
    });
    if (error) throw new Error(error.message);
    return data ?? false;
  },

  dismiss: async (notificationId: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc("dismiss_notification", {
      notification_id_input: notificationId,
    });
    if (error) throw new Error(error.message);
    return data ?? false;
  },

  dismissAll: async (): Promise<number> => {
    const { data, error } = await supabase.rpc("dismiss_all_notifications");
    if (error) throw new Error(error.message);
    return typeof data === "number" ? data : 0;
  },

  insert: async (params: {
    targetUserId: string;
    type: string;
    category: string;
    title: string;
    body?: string | null;
    actionUrl?: string | null;
    entityType?: string | null;
    entityId?: string | null;
  }): Promise<string | null> => {
    const { data, error } = await supabase.rpc("insert_notification", {
      target_user_id: params.targetUserId,
      notif_type: params.type,
      notif_category: params.category,
      notif_title: params.title,
      notif_body: params.body ?? null,
      notif_action_url: params.actionUrl ?? null,
      notif_entity_type: params.entityType ?? null,
      notif_entity_id: params.entityId ?? null,
    });
    if (error) throw new Error(error.message);
    return data;
  },

  getPreferences: async (): Promise<any | null> => {
    const { data, error } = await supabase.rpc("get_notification_preferences");
    if (error) throw new Error(error.message);
    return data?.[0] ?? null;
  },

  savePreferences: async (prefs: Record<string, any>): Promise<boolean> => {
    const { data, error } = await supabase.rpc("save_notification_preferences", {
      prefs: prefs,
    });
    if (error) throw new Error(error.message);
    return data ?? false;
  },

  /** Get the supabase client for realtime subscriptions */
  getSupabaseClient: () => supabase,
};
