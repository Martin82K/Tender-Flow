import { notificationService } from "@/services/notificationService";
import type { AppNotification, NotificationCategory, NotificationPreferences } from "../types";

export const notificationApi = {
  async getNotifications(limit: number = 20, category?: NotificationCategory): Promise<AppNotification[]> {
    return notificationService.getMyNotifications(limit, category) as Promise<AppNotification[]>;
  },

  async markAllRead(): Promise<void> {
    return notificationService.markAllRead();
  },

  async markRead(notificationId: string): Promise<boolean> {
    return notificationService.markRead(notificationId);
  },

  async dismiss(notificationId: string): Promise<boolean> {
    return notificationService.dismiss(notificationId);
  },

  async dismissAll(): Promise<number> {
    return notificationService.dismissAll();
  },

  async insert(params: {
    targetUserId: string;
    type: string;
    category: NotificationCategory;
    title: string;
    body?: string;
    actionUrl?: string;
    entityType?: string;
    entityId?: string;
  }): Promise<string | null> {
    return notificationService.insert(params);
  },

  async getPreferences(): Promise<NotificationPreferences | null> {
    return notificationService.getPreferences();
  },

  async savePreferences(prefs: Partial<NotificationPreferences>): Promise<boolean> {
    return notificationService.savePreferences(prefs as Record<string, any>);
  },
};
