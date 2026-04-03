import React, { useCallback, useEffect, useState } from "react";
import { desktopNotificationAdapter } from "@/services/platformAdapter";
import { notificationPreferencesApi } from "@features/notifications/api/notificationPreferencesApi";
import type { NotificationPreferences } from "@features/notifications/types";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "@features/notifications/types";

const TOGGLE_ITEMS: Array<{
  key: keyof NotificationPreferences;
  label: string;
  description: string;
  icon: string;
}> = [
  {
    key: "bid_status_changes",
    label: "Změny stavu nabídek",
    description: "Upozornění při změně stavu nabídky (odeslaná, přijatá, vítěz, odmítnutá)",
    icon: "gavel",
  },
  {
    key: "tender_closed",
    label: "Uzavření výběrového řízení",
    description: "Upozornění při uzavření výběrového řízení pro kategorii poptávky",
    icon: "check_circle",
  },
  {
    key: "deadline_reminders",
    label: "Připomínky termínů",
    description: "Upozornění na blížící se a prošlé termíny pro podání nabídek",
    icon: "schedule",
  },
  {
    key: "project_status_changes",
    label: "Změny stavu projektu",
    description: "Upozornění při archivaci projektu, přesunu do realizace, změně statusu kategorie",
    icon: "folder_managed",
  },
  {
    key: "document_events",
    label: "Události dokumentů",
    description: "Upozornění při nahrání dokumentu do kategorie",
    icon: "description",
  },
  {
    key: "team_events",
    label: "Týmové události",
    description: "Upozornění při schválení člena organizace a dalších týmových událostech",
    icon: "group",
  },
  {
    key: "agent_events",
    label: "AI Agent",
    description: "Upozornění při dokončení úlohy AI agentem",
    icon: "smart_toy",
  },
];

export const NotificationSettings: React.FC = () => {
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [desktopPermission, setDesktopPermission] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await notificationPreferencesApi.get();
        setPrefs(data);
      } catch (error) {
        console.error("Failed to load notification preferences:", error);
      } finally {
        setIsLoading(false);
      }
    })();
    // Check desktop notification permission
    if ("Notification" in window) {
      setDesktopPermission(Notification.permission === "granted");
    }
  }, []);

  const handleToggle = useCallback(async (key: keyof NotificationPreferences, value: boolean) => {
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    setIsSaving(true);
    try {
      await notificationPreferencesApi.save({ [key]: value });
    } catch (error) {
      console.error("Failed to save preference:", error);
      setPrefs((prev) => ({ ...prev, [key]: !value })); // rollback
    } finally {
      setIsSaving(false);
    }
  }, [prefs]);

  const handleRequestDesktopPermission = useCallback(async () => {
    const granted = await desktopNotificationAdapter.requestPermission();
    setDesktopPermission(granted);
    if (granted) {
      await handleToggle("desktop_notifications", true);
    }
  }, [handleToggle]);

  const handleQuietHoursChange = useCallback(async (field: "quiet_hours_start" | "quiet_hours_end", value: string) => {
    const updated = { ...prefs, [field]: value || null };
    setPrefs(updated);
    setIsSaving(true);
    try {
      await notificationPreferencesApi.save({ [field]: value || null });
    } catch (error) {
      console.error("Failed to save quiet hours:", error);
    } finally {
      setIsSaving(false);
    }
  }, [prefs]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <span className="material-symbols-outlined animate-spin text-[24px] text-slate-400">progress_activity</span>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-500">notifications</span>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Notifikace</h2>
        </div>
        <p className="text-sm text-slate-500">
          Nastavte, o kterých událostech chcete být informováni
        </p>
      </div>

      {/* Event toggles */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-6 space-y-1">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">tune</span>
          Upozornění na události
        </h3>
        {TOGGLE_ITEMS.map((item) => (
          <label
            key={item.key}
            className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700/30 last:border-0 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[20px] text-slate-400">{item.icon}</span>
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-white">{item.label}</div>
                <div className="text-xs text-slate-500">{item.description}</div>
              </div>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={prefs[item.key] as boolean}
                onChange={(e) => handleToggle(item.key, e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-6 bg-slate-200 dark:bg-slate-600 rounded-full peer-checked:bg-primary transition-colors" />
              <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-4" />
            </div>
          </label>
        ))}
      </div>

      {/* Desktop notifications */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">desktop_windows</span>
          Desktopové notifikace
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-slate-900 dark:text-white">
              Systémové notifikace
            </div>
            <div className="text-xs text-slate-500">
              Zobrazují se jako nativní notifikace operačního systému pro kritické události
            </div>
          </div>
          {desktopPermission ? (
            <label className="relative cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.desktop_notifications}
                onChange={(e) => handleToggle("desktop_notifications", e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-6 bg-slate-200 dark:bg-slate-600 rounded-full peer-checked:bg-primary transition-colors" />
              <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-4" />
            </label>
          ) : (
            <button
              onClick={handleRequestDesktopPermission}
              className="px-4 py-2 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors"
            >
              Povolit
            </button>
          )}
        </div>
      </div>

      {/* Quiet hours */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 rounded-xl p-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">do_not_disturb_on</span>
          Klidové hodiny
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Během klidových hodin se nezobrazují toasty ani desktopové notifikace
        </p>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600 dark:text-slate-300">Od:</label>
            <input
              type="time"
              value={prefs.quiet_hours_start ?? ""}
              onChange={(e) => handleQuietHoursChange("quiet_hours_start", e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600 dark:text-slate-300">Do:</label>
            <input
              type="time"
              value={prefs.quiet_hours_end ?? ""}
              onChange={(e) => handleQuietHoursChange("quiet_hours_end", e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-white"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
