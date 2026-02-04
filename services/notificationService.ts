import { supabase } from "./supabase";

export type AppNotification = {
  id: string;
  type: "info" | "success" | "warning" | "error" | string;
  title: string;
  body: string | null;
  created_at: string;
  read_at: string | null;
};

export const notificationService = {
  getMyNotifications: async (limit: number = 20): Promise<AppNotification[]> => {
    const { data, error } = await supabase.rpc("get_my_notifications", {
      limit_count: limit,
    });
    if (error) throw new Error(error.message);
    return data || [];
  },

  markAllRead: async (): Promise<void> => {
    const { error } = await supabase.rpc("mark_notifications_read");
    if (error) throw new Error(error.message);
  },
};
