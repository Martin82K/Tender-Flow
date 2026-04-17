import { notificationApi } from "./notificationApi";
import type { NotificationPreferences } from "../types";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "../types";

export const notificationPreferencesApi = {
  async get(): Promise<NotificationPreferences> {
    const prefs = await notificationApi.getPreferences();
    return prefs ?? DEFAULT_NOTIFICATION_PREFERENCES;
  },

  async save(prefs: Partial<NotificationPreferences>): Promise<boolean> {
    return notificationApi.savePreferences(prefs);
  },
};
